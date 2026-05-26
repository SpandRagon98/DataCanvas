import { useState, useEffect, useRef, useCallback } from "react";
import {
  Wifi, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Clock, Edit2, X,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

// ── Helpers ────────────────────────────────────────────────────────────────

const detectType = (values) => {
  let nums = 0, dates = 0, ne = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    ne++;
    if (!isNaN(Number(v))) nums++;
    if (!isNaN(Date.parse(v))) dates++;
  }
  if (ne === 0) return "string";
  if (nums === ne) return "number";
  if (dates === ne) return "date";
  return "string";
};

const buildColumnsFromRows = (rows) => {
  if (!rows?.length) return { columns: [], dataTypes: {} };
  const columns = Object.keys(rows[0]);
  const dataTypes = {};
  columns.forEach((c) => { dataTypes[c] = detectType(rows.map((r) => r[c])); });
  return { columns, dataTypes };
};

function parseJsonPath(data, path) {
  if (!path?.trim()) return data;
  const parts = path.trim().split(".");
  let current = data;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = current[part];
  }
  return current;
}

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoStr).toLocaleDateString();
}

// ── Empty form state ───────────────────────────────────────────────────────
const emptyForm = () => ({
  name: "",
  url: "",
  method: "GET",
  headers: [],          // [{id, key, value}]
  jsonPath: "",
  autoRefresh: false,
  refreshInterval: 60,
});

// ── Connector card ─────────────────────────────────────────────────────────
function ConnectorCard({ connector, onFetch, onRemove, onEdit, T, fetching }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl border"
      style={{ background: T.s2, borderColor: T.border }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Wifi size={15} style={{ color: T.accent, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: T.text }}>{connector.name}</p>
          <p className="truncate text-xs" style={{ color: T.muted }}>
            {connector.method} {connector.url}
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1 shrink-0">
          {connector.lastError ? (
            <AlertCircle size={13} style={{ color: "#ef4444" }} title={connector.lastError} />
          ) : connector.lastFetched ? (
            <CheckCircle2 size={13} style={{ color: "#10b981" }} />
          ) : null}
          {connector.rowCount > 0 && (
            <span className="text-xs mono" style={{ color: T.muted }}>
              {connector.rowCount.toLocaleString()} rows
            </span>
          )}
          {connector.lastFetched && (
            <span className="flex items-center gap-0.5 text-[11px]" style={{ color: T.muted }}>
              <Clock size={10} />{timeAgo(connector.lastFetched)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFetch(connector)}
            disabled={fetching === connector.id}
            className="rounded-lg border px-2 py-1 text-xs transition hover:opacity-80 disabled:opacity-50"
            style={{ background: T.accentDim, borderColor: "rgba(245,158,11,0.25)", color: T.accent }}
            title="Fetch now"
          >
            <RefreshCw size={11} className={fetching === connector.id ? "animate-spin" : ""} />
          </button>
          <button onClick={() => onEdit(connector)} title="Edit" style={{ color: T.dim }}>
            <Edit2 size={13} />
          </button>
          <button onClick={() => onRemove(connector.id)} title="Remove" style={{ color: "#ef4444" }}>
            <Trash2 size={13} />
          </button>
          <button onClick={() => setOpen((o) => !o)} style={{ color: T.muted }}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div
          className="border-t px-4 py-3 text-xs space-y-1"
          style={{ borderColor: T.border, color: T.muted }}
        >
          {connector.jsonPath && <p>JSON path: <span className="mono" style={{ color: T.text }}>{connector.jsonPath}</span></p>}
          {connector.headers?.length > 0 && (
            <p>{connector.headers.length} custom header{connector.headers.length !== 1 ? "s" : ""}</p>
          )}
          {connector.autoRefresh && (
            <p>Auto-refresh every <span style={{ color: T.text }}>{connector.refreshInterval}s</span></p>
          )}
          {connector.lastError && (
            <p style={{ color: "#ef4444" }}>Error: {connector.lastError}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Connector form ─────────────────────────────────────────────────────────
function ConnectorForm({ initial, onSave, onCancel, T }) {
  const [form, setForm] = useState(initial || emptyForm());

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addHeader = () =>
    setForm((f) => ({
      ...f,
      headers: [...f.headers, { id: Date.now(), key: "", value: "" }],
    }));

  const updateHeader = (id, patch) =>
    setForm((f) => ({
      ...f,
      headers: f.headers.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));

  const removeHeader = (id) =>
    setForm((f) => ({ ...f, headers: f.headers.filter((h) => h.id !== id) }));

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: T.s2, borderColor: T.accent }}
    >
      <p className="text-sm font-semibold" style={{ color: T.text }}>
        {initial ? "Edit Connector" : "New REST API Connector"}
      </p>

      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>Name</label>
          <input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="My API"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>Method</label>
          <select
            value={form.method}
            onChange={(e) => set({ method: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={inputStyle}
          >
            {["GET", "POST", "PUT"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* URL */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>URL</label>
        <input
          value={form.url}
          onChange={(e) => set({ url: e.target.value })}
          placeholder="https://api.example.com/data"
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none mono"
          style={inputStyle}
        />
      </div>

      {/* JSON Path */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>
          JSON Path{" "}
          <span style={{ color: T.muted, fontWeight: 400 }}>(dot-notation to array, e.g. <span className="mono">data.results</span>)</span>
        </label>
        <input
          value={form.jsonPath}
          onChange={(e) => set({ jsonPath: e.target.value })}
          placeholder="Leave blank if response is a top-level array"
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none mono"
          style={inputStyle}
        />
      </div>

      {/* Headers */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: T.dim }}>Headers</label>
          <button
            onClick={addHeader}
            className="flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs"
            style={{ background: T.surface, borderColor: T.border, color: T.dim }}
          >
            <Plus size={10} /> Add
          </button>
        </div>
        {form.headers.length === 0 ? (
          <p className="text-xs" style={{ color: T.muted }}>No custom headers</p>
        ) : (
          <div className="space-y-1.5">
            {form.headers.map((h) => (
              <div key={h.id} className="flex gap-2">
                <input
                  value={h.key}
                  onChange={(e) => updateHeader(h.id, { key: e.target.value })}
                  placeholder="Key"
                  className="flex-1 rounded-xl border px-2 py-1.5 text-xs outline-none mono"
                  style={inputStyle}
                />
                <input
                  value={h.value}
                  onChange={(e) => updateHeader(h.id, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1 rounded-xl border px-2 py-1.5 text-xs outline-none mono"
                  style={inputStyle}
                />
                <button onClick={() => removeHeader(h.id)} style={{ color: T.muted }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-refresh */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            className="relative h-5 w-9 rounded-full transition"
            style={{ background: form.autoRefresh ? T.accent : T.border }}
            onClick={() => set({ autoRefresh: !form.autoRefresh })}
          >
            <div
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
              style={{ left: form.autoRefresh ? "20px" : "2px" }}
            />
          </div>
          <span className="text-xs font-medium" style={{ color: T.dim }}>Auto-refresh</span>
        </label>
        {form.autoRefresh && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: T.muted }}>every</span>
            <input
              type="number"
              min={10}
              max={86400}
              value={form.refreshInterval}
              onChange={(e) => set({ refreshInterval: Math.max(10, Number(e.target.value)) })}
              className="w-16 rounded-xl border px-2 py-1 text-xs outline-none text-center mono"
              style={inputStyle}
            />
            <span className="text-xs" style={{ color: T.muted }}>seconds</span>
          </div>
        )}
      </div>

      {/* Form actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: T.accent, color: "#000" }}
        >
          Save & Fetch
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border px-4 py-2 text-sm"
          style={{ background: T.surface, borderColor: T.border, color: T.dim }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────
export default function ApiConnectorPanel() {
  const T = useTheme();
  const apiConnectors     = useStore((s) => s.apiConnectors);
  const addApiConnector   = useStore((s) => s.addApiConnector);
  const updateApiConnector = useStore((s) => s.updateApiConnector);
  const removeApiConnector = useStore((s) => s.removeApiConnector);
  const addDataset        = useStore((s) => s.addDataset);
  const updateDatasetRows = useStore((s) => s.updateDatasetRows);
  const datasets          = useStore((s) => s.datasets);

  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState(null); // connector being edited
  const [fetching, setFetching]     = useState(null); // connectorId currently fetching
  const [fetchErrors, setFetchErrors] = useState({}); // id → error string

  // ── Fetch a connector ───────────────────────────────────────────────────
  const fetchConnector = useCallback(async (connector) => {
    setFetching(connector.id);
    setFetchErrors((e) => ({ ...e, [connector.id]: null }));
    try {
      const reqHeaders = {};
      (connector.headers || []).forEach(({ key, value }) => {
        if (key) reqHeaders[key] = value;
      });

      const res = await fetch(connector.url, { method: connector.method, headers: reqHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json = await res.json();
      let data = parseJsonPath(json, connector.jsonPath);

      if (!Array.isArray(data)) {
        // Try to find the first array in the response
        if (typeof json === "object" && json !== null) {
          const firstArray = Object.values(json).find(Array.isArray);
          if (firstArray) data = firstArray;
          else throw new Error("Response is not an array. Specify a JSON path to the array field.");
        } else {
          throw new Error("Response is not an array. Specify a JSON path to the array field.");
        }
      }

      if (!data.length) throw new Error("API returned an empty array.");

      const { columns, dataTypes } = buildColumnsFromRows(data);

      // Create or update linked dataset
      if (connector.datasetId && datasets.some((d) => d.id === connector.datasetId)) {
        updateDatasetRows(connector.datasetId, data, columns, dataTypes);
      } else {
        addDataset({
          name: connector.name,
          rows: data,
          columns,
          dataTypes,
          sourceType: "api",
          sourceConfig: { connectorId: connector.id },
        });
        // After addDataset, find the newly created dataset
        // (can't get ID directly here, but next render will show it)
      }

      updateApiConnector(connector.id, {
        lastFetched: new Date().toISOString(),
        lastError: null,
        rowCount: data.length,
      });
    } catch (err) {
      const msg = err.message || "Unknown error";
      updateApiConnector(connector.id, { lastError: msg });
      setFetchErrors((e) => ({ ...e, [connector.id]: msg }));
    } finally {
      setFetching(null);
    }
  }, [datasets, addDataset, updateDatasetRows, updateApiConnector]);

  // ── Auto-refresh timers ─────────────────────────────────────────────────
  useEffect(() => {
    const timers = apiConnectors
      .filter((c) => c.autoRefresh && c.refreshInterval >= 10)
      .map((c) => setInterval(() => fetchConnector(c), c.refreshInterval * 1000));
    return () => timers.forEach(clearInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConnectors.map((c) => `${c.id}:${c.autoRefresh}:${c.refreshInterval}`).join(",")]);

  // ── Save from form ──────────────────────────────────────────────────────
  const handleSave = (form) => {
    if (!form.url.trim()) return;
    if (editTarget) {
      updateApiConnector(editTarget.id, { ...form });
      setEditTarget(null);
      // Re-fetch with new config
      const updated = { ...editTarget, ...form };
      fetchConnector(updated);
    } else {
      addApiConnector(form);
      // Find the connector that will be created (will be available next render)
      // Trigger fetch after state updates
      setTimeout(() => {
        const latest = useStore.getState().apiConnectors.at(-1);
        if (latest) fetchConnector(latest);
      }, 50);
    }
    setShowForm(false);
  };

  const handleEdit = (connector) => {
    setEditTarget(connector);
    setShowForm(true);
  };

  return (
    <div
      className="rounded-xl border p-5 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "rgba(245,158,11,0.12)" }}
          >
            <Wifi size={16} style={{ color: T.accent }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: T.text }}>API Connectors</h2>
            <p className="text-xs" style={{ color: T.muted }}>
              Fetch JSON data from REST endpoints on demand or on a timer
            </p>
          </div>
        </div>

        {!showForm && (
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ background: T.accentDim, borderColor: "rgba(245,158,11,0.25)", color: T.accent }}
          >
            <Plus size={13} /> Add
          </button>
        )}
      </div>

      {/* Connector list */}
      {apiConnectors.length === 0 && !showForm && (
        <div
          className="rounded-xl border px-4 py-8 text-center"
          style={{ background: T.s2, borderColor: T.border }}
        >
          <Wifi size={28} style={{ color: T.muted, margin: "0 auto 10px" }} />
          <p className="text-sm font-medium" style={{ color: T.dim }}>No API connectors yet</p>
          <p className="mt-1 text-xs" style={{ color: T.muted }}>
            Add a connector to pull live data from any REST API
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: T.accent, color: "#000" }}
          >
            <Plus size={13} /> Add Connector
          </button>
        </div>
      )}

      <div className="space-y-3">
        {apiConnectors.map((c) => (
          <ConnectorCard
            key={c.id}
            connector={c}
            onFetch={fetchConnector}
            onRemove={removeApiConnector}
            onEdit={handleEdit}
            T={T}
            fetching={fetching}
          />
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="mt-4">
          <ConnectorForm
            initial={editTarget ? { ...editTarget } : null}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditTarget(null); }}
            T={T}
          />
        </div>
      )}

      {/* CORS notice */}
      <div
        className="mt-4 rounded-xl border px-3 py-2 text-xs"
        style={{ background: T.s2, borderColor: T.border, color: T.muted }}
      >
        Note: The API must support CORS for browser requests. If you see a network error, the server may need to
        add <span className="mono" style={{ color: T.dim }}>Access-Control-Allow-Origin: *</span> to its response headers.
      </div>
    </div>
  );
}
