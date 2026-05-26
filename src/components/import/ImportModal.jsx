import { useState } from "react";
import { Upload, X, Link2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { useTheme } from "../../styles/theme";

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
        className="anim-scale-in w-full max-w-xl rounded-2xl border p-6"
        style={{
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
              File upload, pasted CSV, or public Google Sheets link
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
          className="mb-5 flex gap-2 rounded-xl border p-1"
          style={{ background: T.s2, borderColor: T.border }}
        >
          {[
            ["file", "File Upload"],
            ["paste", "Paste CSV"],
            ["sheets", "Google Sheets"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setError("");
              }}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-medium"
              style={{
                background: tab === id ? T.surface : "transparent",
                color: tab === id ? T.text : T.muted,
                border: "none",
              }}
            >
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
