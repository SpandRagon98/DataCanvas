/**
 * BigQuery serverless endpoint — Vercel compatible.
 *
 * Accepts a service account JSON key + SQL query from the frontend,
 * authenticates with Google OAuth 2.0 (JWT flow), runs the query via
 * the BigQuery REST API, and returns rows + schema as JSON.
 *
 * POST /api/bigquery
 * Body: {
 *   projectId:   string   — GCP project ID
 *   credentials: object   — parsed service account JSON
 *   query:       string   — Standard SQL query
 *   maxResults?: number   — default 5000
 * }
 *
 * Response (success): { columns, rows, totalRows, jobId }
 * Response (error):   { error: string }
 *
 * Credentials never leave the serverless environment — they are used
 * only to generate a short-lived OAuth access token for this request.
 */

const crypto = require("crypto");

// ── JWT helpers ──────────────────────────────────────────────────────────────

function b64url(buf) {
  const str = Buffer.isBuffer(buf) ? buf.toString("base64") : Buffer.from(buf).toString("base64");
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Build and sign a service-account JWT for the BigQuery scope.
 * Uses Node.js crypto — no external dependency needed.
 */
function buildServiceAccountJWT(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/bigquery",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  }));
  const toSign = `${header}.${payload}`;
  const sign   = crypto.createSign("RSA-SHA256");
  sign.update(toSign);
  const sig = b64url(sign.sign(sa.private_key));
  return `${toSign}.${sig}`;
}

/**
 * Exchange a service-account JWT for a short-lived Bearer token.
 */
async function getAccessToken(sa) {
  const jwt = buildServiceAccountJWT(sa);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed (${res.status}): ${text}`);
  }
  const { access_token, error, error_description } = await res.json();
  if (error) throw new Error(`OAuth error: ${error_description || error}`);
  return access_token;
}

// ── BigQuery REST helpers ────────────────────────────────────────────────────

const BQ_BASE = "https://bigquery.googleapis.com/bigquery/v2";

/**
 * Run a synchronous BigQuery query and return the raw API response.
 * Uses the simpleQuery endpoint (no job polling needed for quick queries).
 */
async function runSynchronousQuery(projectId, query, maxResults, accessToken) {
  const url = `${BQ_BASE}/projects/${encodeURIComponent(projectId)}/queries`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      useLegacySql:  false,
      maxResults:    maxResults,
      timeoutMs:     25000,        // 25 s — well within Vercel's 30 s limit
      formatOptions: { useInt64Timestamp: false },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.error?.status || `HTTP ${res.status}`;
    throw new Error(`BigQuery query failed: ${msg}`);
  }
  return data;
}

/**
 * If the synchronous endpoint didn't finish in time, poll via jobsQuery.
 */
async function pollJobResults(projectId, jobId, accessToken, maxResults) {
  const url = `${BQ_BASE}/projects/${encodeURIComponent(projectId)}/queries/${encodeURIComponent(jobId)}?maxResults=${maxResults}&timeoutMs=25000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`BigQuery poll failed: ${data?.error?.message || res.status}`);
  return data;
}

// ── Schema → columns + type detection ───────────────────────────────────────

const BQ_TYPE_MAP = {
  INTEGER: "number", INT64: "number", FLOAT: "number", FLOAT64: "number",
  NUMERIC: "number", BIGNUMERIC: "number",
  BOOLEAN: "boolean", BOOL: "boolean",
  DATE: "date", DATETIME: "date", TIMESTAMP: "date", TIME: "date",
  STRING: "string", BYTES: "string", JSON: "string", STRUCT: "string",
  RECORD: "string",
};

function parseResults(apiData) {
  const fields    = apiData?.schema?.fields ?? [];
  const rawRows   = apiData?.rows           ?? [];
  const totalRows = Number(apiData?.totalRows ?? rawRows.length);

  const columns = fields.map((f) => f.name);
  const types   = {};
  fields.forEach((f) => {
    types[f.name] = BQ_TYPE_MAP[f.type?.toUpperCase()] ?? "string";
  });

  const rows = rawRows.map((row) => {
    const obj = {};
    (row.f ?? []).forEach((cell, i) => {
      const col   = columns[i];
      const rawVal = cell.v;
      // Coerce types for numeric fields
      if (types[col] === "number" && rawVal !== null && rawVal !== undefined && rawVal !== "") {
        obj[col] = Number(rawVal);
      } else {
        obj[col] = rawVal ?? "";
      }
    });
    return obj;
  });

  return { columns, rows, types, totalRows };
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS — allow the Vercel preview / production origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON body" }); }
  }

  const { projectId, credentials, query, maxResults = 5000 } = body ?? {};

  // ── Input validation ──
  if (!projectId || typeof projectId !== "string" || !projectId.trim()) {
    return res.status(400).json({ error: "projectId is required." });
  }
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query is required." });
  }
  if (!credentials || typeof credentials !== "object" || !credentials.client_email || !credentials.private_key) {
    return res.status(400).json({ error: "credentials must be a valid service account JSON with client_email and private_key." });
  }

  const safeMaxResults = Math.min(Math.max(Number(maxResults) || 5000, 1), 10000);

  try {
    // 1. Get OAuth token
    const accessToken = await getAccessToken(credentials);

    // 2. Run query
    let apiData = await runSynchronousQuery(projectId.trim(), query.trim(), safeMaxResults, accessToken);

    // 3. Poll if not complete within the synchronous timeout
    if (!apiData.jobComplete && apiData.jobReference?.jobId) {
      apiData = await pollJobResults(projectId.trim(), apiData.jobReference.jobId, accessToken, safeMaxResults);
      if (!apiData.jobComplete) {
        return res.status(202).json({ error: "Query timed out. Try a simpler query or add a LIMIT clause." });
      }
    }

    // 4. Parse results
    const { columns, rows, types, totalRows } = parseResults(apiData);

    if (!columns.length) {
      return res.status(200).json({ error: "Query returned no columns. Check your SELECT statement." });
    }

    return res.status(200).json({
      columns,
      rows,
      types,
      totalRows,
      jobId: apiData.jobReference?.jobId ?? null,
    });

  } catch (err) {
    console.error("[BigQuery] Error:", err.message);
    return res.status(500).json({ error: err.message || "BigQuery request failed." });
  }
};
