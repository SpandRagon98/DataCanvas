import { useEffect, useRef, useState } from "react";
import { Upload, X, Link2, AlertCircle, Database, Play, ChevronDown, ChevronUp, Info } from "lucide-react";
import * as XLSX from "xlsx";
import { useTheme } from "../../styles/theme";

// ── BigQuery helpers ─────────────────────────────────────────────────────────

const BQ_CREDS_KEY  = "datacanvas.bq.credentials";
const BQ_PROJECT_KEY = "datacanvas.bq.projectId";

function loadBQSession() {
  try {
    return {
      projectId:  sessionStorage.getItem(BQ_PROJECT_KEY) || "",
      credsText:  sessionStorage.getItem(BQ_CREDS_KEY)   || "",
    };
  } catch { return { projectId: "", credsText: "" }; }
}

function saveBQSession(projectId, credsText) {
  try {
    sessionStorage.setItem(BQ_PROJECT_KEY, projectId);
    sessionStorage.setItem(BQ_CREDS_KEY,   credsText);
  } catch {}
}

const _AI_BASE   = import.meta.env.VITE_AI_API_BASE_URL || "/api/ai";
const BQ_API_URL = _AI_BASE.replace(/\/ai$/, "/bigquery");

const detectType = (values) => {
  let numberCount = 0;
  let dateCount = 0;
  let boolCount = 0;
  let nonEmpty = 0;

  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    nonEmpty++;
    if (!isNaN(Number(v))) numberCount++;
    if (!isNaN(Date.parse(v))) dateCount++;
    if (
      String(v).toLowerCase() === "true" ||
      String(v).toLowerCase() === "false"
    ) {
      boolCount++;
    }
  }

  if (nonEmpty === 0) return "string";
  if (boolCount === nonEmpty) return "boolean";
  if (numberCount === nonEmpty) return "number";
  if (dateCount === nonEmpty) return "date";
  return "string";
};

const sanitizeColumns = (rows) => {
  if (!rows.length) return { rows: [], columns: [], types: {} };

  const originalColumns = Object.keys(rows[0]);
  const used = {};
  const renamedMap = {};

  const safeColumns = originalColumns.map((col) => {
    let safe = col?.trim() || "Column";
    if (!used[safe]) {
      used[safe] = 1;
      renamedMap[col] = safe;
      return safe;
    }
    const next = `${safe}_${used[safe]++}`;
    renamedMap[col] = next;
    return next;
  });

  const normalizedRows = rows.map((row) => {
    const next = {};
    originalColumns.forEach((col) => {
      next[renamedMap[col]] = row[col];
    });
    return next;
  });

  const types = {};
  safeColumns.forEach((col) => {
    types[col] = detectType(normalizedRows.map((r) => r[col]));
  });

  return {
    rows: normalizedRows,
    columns: safeColumns,
    types,
  };
};

function parseCSV(raw) {
  const lines = raw.trim().split("\n").filter((l) => l.trim());
  if (!lines.length) return { rows: [], columns: [], types: {} };

  const parse = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQ = !inQ;
        continue;
      }
      if (line[i] === "," && !inQ) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += line[i];
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parse(lines[0]);
  const rawRows = lines.slice(1).map((line) => {
    const vals = parse(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });

  return sanitizeColumns(rawRows);
}

export default function ImportModal({ open, onClose, onImport }) {
  const T = useTheme();
  const [tab, setTab] = useState("file");
  const [paste, setPaste] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── BigQuery state ──
  const bqSession = loadBQSession();
  const [bqProjectId,  setBqProjectId]  = useState(bqSession.projectId);
  const [bqCredsText,  setBqCredsText]  = useState(bqSession.credsText);
  const [bqQuery,      setBqQuery]      = useState("SELECT * FROM `project.dataset.table` LIMIT 1000");
  const [bqMaxRows,    setBqMaxRows]    = useState(5000);
  const [bqCredsOpen,  setBqCredsOpen]  = useState(!bqSession.credsText);
  const [bqStatus,     setBqStatus]     = useState(""); // info messages
  const queryRef = useRef(null);

  // Persist project + creds to sessionStorage whenever they change
  useEffect(() => {
    saveBQSession(bqProjectId, bqCredsText);
  }, [bqProjectId, bqCredsText]);

  if (!open) return null;

  const doImportRows = (jsonRows) => {
    const { rows, columns, types } = sanitizeColumns(jsonRows);
    if (!rows.length || !columns.length) {
      setError("No usable data found.");
      return;
    }
    onImport({ rows, columns, types });
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError("");

    try {
      const buffer = await file.arrayBuffer();

      if (file.name.endsWith(".csv") || file.type.includes("csv")) {
        const text = new TextDecoder().decode(buffer);
        const parsed = parseCSV(text);
        if (!parsed.rows.length) {
          setError("No data found in CSV.");
          return;
        }
        onImport(parsed);
        onClose();
        return;
      }

      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      doImportRows(json);
    } catch {
      setError("Failed to import file.");
    }
  };

  const handlePaste = () => {
    setError("");
    if (!paste.trim()) {
      setError("Paste CSV content first.");
      return;
    }
    const parsed = parseCSV(paste);
    if (!parsed.rows.length) {
      setError("Could not parse pasted CSV.");
      return;
    }
    onImport(parsed);
    onClose();
  };

  const handleBigQuery = async () => {
    setError("");
    setBqStatus("");

    if (!bqProjectId.trim()) { setError("Enter your GCP Project ID."); return; }
    if (!bqCredsText.trim()) { setError("Paste your service account JSON key."); setBqCredsOpen(true); return; }
    if (!bqQuery.trim())     { setError("Enter a SQL query."); return; }

    let credentials;
    try {
      credentials = JSON.parse(bqCredsText);
      if (!credentials.client_email || !credentials.private_key) throw new Error("Missing fields");
    } catch {
      setError("Invalid service account JSON. Make sure you copied the full key file.");
      setBqCredsOpen(true);
      return;
    }

    setLoading(true);
    setBqStatus("Authenticating with Google...");
    try {
      const res = await fetch(BQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId:   bqProjectId.trim(),
          credentials,
          query:       bqQuery.trim(),
          maxResults:  bqMaxRows,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || `Server error ${res.status}`);
        return;
      }

      const { columns, rows, types, totalRows } = data;
      if (!columns?.length) { setError("Query returned no columns."); return; }

      setBqStatus(`Fetched ${rows.length.toLocaleString()} of ${Number(totalRows).toLocaleString()} rows.`);
      onImport({ rows, columns, types });
      onClose();
    } catch (err) {
      setError(err.message || "Network error — check that the app is deployed on Vercel.");
    } finally {
      setLoading(false);
    }
  };

  const handleSheets = async () => {
    setError("");
    const match = url.match(/\/spreadsheets\/d\/([^/]+)/);
    const gid = (url.match(/gid=(\d+)/) || [])[1] || "0";

    if (!match) {
      setError("Invalid Google Sheets URL.");
      return;
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;

    try {
      setLoading(true);
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("fetch failed");
      const text = await res.text();
      const parsed = parseCSV(text);
      if (!parsed.rows.length) {
        setError("Google Sheet returned no data.");
        return;
      }
      onImport(parsed);
      onClose();
    } catch {
      setError(
        "Could not fetch sheet. Make sure it is public: Anyone with the link can view."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in w-full rounded-2xl border p-6"
        style={{
          maxWidth: tab === "bigquery" ? 680 : 576,
          transition: "max-width 0.2s ease",
          background: T.surface,
          borderColor: T.border,
          boxShadow: T.shadowXl,
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: T.text }}>
              Import Data
            </h2>
            <p className="mt-1 text-sm" style={{ color: T.dim }}>
              {tab === "bigquery"
                ? "Connect to Google BigQuery — run SQL and import results"
                : "File upload, pasted CSV, or public Google Sheets link"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 transition"
            style={{ color: T.muted, background: "transparent" }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="mb-5 flex gap-1 rounded-xl border p-1"
          style={{ background: T.s2, borderColor: T.border }}
        >
          {[
            ["file",     "File Upload"],
            ["paste",    "Paste CSV"],
            ["sheets",   "Google Sheets"],
            ["bigquery", "BigQuery"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setError(""); setBqStatus(""); }}
              className="flex-1 rounded-lg px-2 py-2 text-sm font-medium"
              style={{
                background: tab === id ? T.surface : "transparent",
                color: tab === id ? T.text : T.muted,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              {id === "bigquery" && <Database size={12} />}
              {label}
            </button>
          ))}
        </div>

        {tab === "file" && (
          <label
            className="block cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: T.border, background: T.s2 }}
          >
            <Upload size={30} style={{ color: T.muted, margin: "0 auto 12px" }} />
            <div className="text-sm font-medium" style={{ color: T.text }}>
              Drop a file here or click to browse
            </div>
            <div className="mt-1 text-xs" style={{ color: T.dim }}>
              Supports CSV, XLSX, XLS
            </div>
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        )}

        {tab === "paste" && (
          <div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"Name,Sales,Month\nAlice,4200,Jan\nBob,3800,Feb"}
              className="h-40 w-full resize-none rounded-xl border p-3 text-sm outline-none mono"
              style={{
                background: T.s2,
                borderColor: T.border,
                color: T.text,
              }}
            />
            <button
              onClick={handlePaste}
              className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: T.accent, color: "#000" }}
            >
              <Upload size={14} />
              Import CSV
            </button>
          </div>
        )}

        {tab === "sheets" && (
          <div>
            <div className="flex gap-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                style={{
                  background: T.s2,
                  borderColor: T.border,
                  color: T.text,
                }}
              />
              <button
                onClick={handleSheets}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                style={{
                  background: T.accent,
                  color: "#000",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <Link2 size={14} />
                {loading ? "Loading..." : "Import"}
              </button>
            </div>

            <p className="mt-3 text-xs" style={{ color: T.dim }}>
              Sheet must be public — “Anyone with the link can view”
            </p>
          </div>
        )}

        {/* ── BigQuery tab ── */}
        {tab === "bigquery" && (
          <div className="space-y-4">

            {/* Info banner */}
            <div
              className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs"
              style={{ background: "rgba(59,130,246,0.07)", borderColor: "rgba(59,130,246,0.25)", color: T.dim }}
            >
              <Info size={13} className="mt-0.5 shrink-0" style={{ color: "#60a5fa" }} />
              <span>
                Credentials are sent only to your own Vercel serverless function and used
                for a single request. They are never stored on any server.
                Your key is saved in browser <strong>sessionStorage</strong> for this tab session only.
              </span>
            </div>

            {/* Row 1: Project ID + max rows */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                  GCP Project ID
                </label>
                <input
                  value={bqProjectId}
                  onChange={(e) => setBqProjectId(e.target.value)}
                  placeholder="my-gcp-project-123"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none mono"
                  style={{ background: T.s2, borderColor: T.border, color: T.text }}
                />
              </div>
              <div style={{ width: 110 }}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                  Max Rows
                </label>
                <input
                  type="number"
                  min={1} max={10000}
                  value={bqMaxRows}
                  onChange={(e) => setBqMaxRows(Number(e.target.value) || 5000)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none mono"
                  style={{ background: T.s2, borderColor: T.border, color: T.text }}
                />
              </div>
            </div>

            {/* Service Account JSON — collapsible */}
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition"
                style={{
                  background: bqCredsText ? "rgba(16,185,129,0.08)" : T.s2,
                  borderColor: bqCredsText ? "rgba(16,185,129,0.35)" : T.border,
                  color: bqCredsText ? T.success : T.text,
                }}
                onClick={() => setBqCredsOpen((p) => !p)}
              >
                <span className="flex items-center gap-2">
                  <Database size={13} />
                  {bqCredsText ? "Service Account Key ✓ (loaded)" : "Paste Service Account JSON key"}
                </span>
                {bqCredsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {bqCredsOpen && (
                <div className="mt-2">
                  <textarea
                    value={bqCredsText}
                    onChange={(e) => setBqCredsText(e.target.value)}
                    placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "-----BEGIN RSA PRIVATE KEY-----\\n...",\n  "client_email": "name@project.iam.gserviceaccount.com"\n}'}
                    rows={7}
                    className="w-full resize-none rounded-xl border p-3 text-xs outline-none mono"
                    style={{ background: T.s2, borderColor: T.border, color: T.text, lineHeight: 1.5 }}
                    spellCheck={false}
                  />
                  <p className="mt-1 text-xs" style={{ color: T.muted }}>
                    GCP Console → IAM → Service Accounts → Keys → Add Key → JSON.
                    Grant the account <strong>BigQuery Data Viewer</strong> + <strong>BigQuery Job User</strong> roles.
                  </p>
                </div>
              )}
            </div>

            {/* SQL Query editor */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                SQL Query <span style={{ color: T.dim, fontWeight: 400, textTransform: "none" }}>(Standard SQL)</span>
              </label>
              <textarea
                ref={queryRef}
                value={bqQuery}
                onChange={(e) => setBqQuery(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full resize-y rounded-xl border p-3 text-sm outline-none mono"
                style={{
                  background: T.s2,
                  borderColor: T.border,
                  color: T.text,
                  lineHeight: 1.6,
                  minHeight: 110,
                  fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
                  fontSize: 12.5,
                }}
                onKeyDown={(e) => {
                  // Tab key → insert 2 spaces instead of switching focus
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const el = e.target;
                    const start = el.selectionStart;
                    const end   = el.selectionEnd;
                    const next  = bqQuery.substring(0, start) + "  " + bqQuery.substring(end);
                    setBqQuery(next);
                    setTimeout(() => el.setSelectionRange(start + 2, start + 2), 0);
                  }
                }}
              />
              <p className="mt-1 text-xs" style={{ color: T.muted }}>
                Use backtick-quoted table names: <span className="mono" style={{ color: T.dim }}>`project.dataset.table`</span>. Add a LIMIT clause for large tables.
              </p>
            </div>

            {/* Status + Run button row */}
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs" style={{ color: T.dim }}>
                {bqStatus && <span style={{ color: T.success }}>{bqStatus}</span>}
              </div>
              <button
                onClick={handleBigQuery}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                style={{
                  background: loading ? T.s3 : T.accent,
                  color: loading ? T.muted : "#000",
                  opacity: loading ? 0.85 : 1,
                  transition: "background 0.15s",
                  minWidth: 140,
                  justifyContent: "center",
                }}
              >
                {loading ? (
                  <>
                    <span
                      className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
                    />
                    {bqStatus || "Running…"}
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Run Query
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-3 text-sm"
            style={{
              background: "rgba(239,68,68,0.08)",
              borderColor: "rgba(239,68,68,0.25)",
              color: T.error,
            }}
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
