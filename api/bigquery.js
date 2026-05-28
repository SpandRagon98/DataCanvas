/**
 * BigQuery serverless endpoint — Vercel compatible (ES module).
 *
 * POST /api/bigquery
 * Body: {
 *   projectId:   string   — GCP project ID
 *   credentials: object   — parsed service account JSON
 *   query:       string   — Standard SQL
 *   maxResults?: number   — default 5000, max 10000
 * }
 *
 * Response (success): { columns, rows, types, totalRows, jobId }
 * Response (error):   { error: string }
 */

import { createSign } from "crypto";

// ── JWT / OAuth helpers ──────────────────────────────────────────────────────

function b64url(input) {
  const buf = typeof input === "string" ? Buffer.from(input) : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function buildJWT(sa) {
  const now     = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/bigquery",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  }));
  const sigInput = `${header}.${payload}`;
  const signer   = createSign("RSA-SHA256");
  signer.update(sigInput);
  const sig = signer.sign(sa.private_key);
  return `${sigInput}.${b64url(sig)}`;
}

async function getAccessToken(sa) {
  const jwt = buildJWT(sa);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`OAuth failed: ${json.error_description || json.error || res.status}`);
  }
  return json.access_token;
}

// ── BigQuery REST helpers ────────────────────────────────────────────────────

const BQ = "https://bigquery.googleapis.com/bigquery/v2";

async function runQuery(projectId, query, maxResults, token) {
  const res = await fetch(
    `${BQ}/projects/${encodeURIComponent(projectId)}/queries`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        useLegacySql: false,
        maxResults,
        timeoutMs: 25000,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `BigQuery error ${res.status}`);
  }
  return data;
}

async function pollJob(projectId, jobId, token, maxResults) {
  const res = await fetch(
    `${BQ}/projects/${encodeURIComponent(projectId)}/queries/${encodeURIComponent(jobId)}?maxResults=${maxResults}&timeoutMs=25000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Poll error ${res.status}`);
  return data;
}

// ── Type mapping ─────────────────────────────────────────────────────────────

const TYPE_MAP = {
  INTEGER: "number", INT64: "number", FLOAT: "number", FLOAT64: "number",
  NUMERIC: "number", BIGNUMERIC: "number",
  BOOLEAN: "boolean", BOOL: "boolean",
  DATE: "date", DATETIME: "date", TIMESTAMP: "date", TIME: "date",
};

function parseResults(data) {
  const fields    = data?.schema?.fields ?? [];
  const rawRows   = data?.rows           ?? [];
  const totalRows = Number(data?.totalRows ?? rawRows.length);

  const columns = fields.map((f) => f.name);
  const types   = {};
  fields.forEach((f) => {
    types[f.name] = TYPE_MAP[f.type?.toUpperCase()] ?? "string";
  });

  const rows = rawRows.map((row) => {
    const obj = {};
    (row.f ?? []).forEach((cell, i) => {
      const col = columns[i];
      const v   = cell.v ?? "";
      obj[col]  = types[col] === "number" && v !== "" ? Number(v) : v;
    });
    return obj;
  });

  return { columns, rows, types, totalRows };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const { projectId, credentials, query, maxResults = 5000 } = req.body ?? {};

  if (!projectId?.trim())
    return res.status(400).json({ error: "projectId is required." });
  if (!query?.trim())
    return res.status(400).json({ error: "query is required." });
  if (!credentials?.client_email || !credentials?.private_key)
    return res.status(400).json({ error: "credentials must be a valid service account JSON with client_email and private_key." });

  const limit = Math.min(Math.max(Number(maxResults) || 5000, 1), 10000);

  try {
    const token   = await getAccessToken(credentials);
    let   apiData = await runQuery(projectId.trim(), query.trim(), limit, token);

    // Poll if query didn't finish within the synchronous timeout
    if (!apiData.jobComplete && apiData.jobReference?.jobId) {
      apiData = await pollJob(projectId.trim(), apiData.jobReference.jobId, token, limit);
      if (!apiData.jobComplete) {
        return res.status(202).json({ error: "Query timed out. Add a LIMIT clause or simplify the query." });
      }
    }

    const { columns, rows, types, totalRows } = parseResults(apiData);
    if (!columns.length)
      return res.status(200).json({ error: "Query returned no columns. Check your SELECT statement." });

    return res.status(200).json({ columns, rows, types, totalRows, jobId: apiData.jobReference?.jobId ?? null });

  } catch (err) {
    console.error("[/api/bigquery]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
