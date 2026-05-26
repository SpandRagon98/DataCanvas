import { useMemo, useState } from "react";
import { Database, Upload, ChevronDown, ChevronUp, AlertTriangle, Table2, GitMerge, Wifi } from "lucide-react";
import { useStore } from "../store/useStore";
import ImportModal from "../components/import/ImportModal";
import CalcFieldManager from "../components/calcfields/CalcFieldManager";
import DatasetSlots from "../components/datasource/DatasetSlots";
import JoinBuilder from "../components/datasource/JoinBuilder";
import ApiConnectorPanel from "../components/datasource/ApiConnectorPanel";
import { useEffectiveData } from "../hooks/useEffectiveData";
import { useTheme } from "../styles/theme";

/** Compute profile stats for one column */
function profileColumn(rows, col, dataType) {
  const total = rows.length;
  if (!total) return null;

  const nullCount = rows.filter(
    (r) => r[col] === null || r[col] === undefined || r[col] === ""
  ).length;
  const nullPct = total > 0 ? (nullCount / total) * 100 : 0;
  const uniqueCount = new Set(rows.map((r) => r[col])).size;

  let min = null, max = null, topValues = [];

  if (dataType === "number") {
    const nums = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
    if (nums.length) {
      min = Math.min(...nums);
      max = Math.max(...nums);
    }
  }

  const freq = {};
  rows.forEach((r) => {
    const v = String(r[col] ?? "");
    freq[v] = (freq[v] || 0) + 1;
  });
  topValues = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return { total, nullCount, nullPct, uniqueCount, min, max, topValues };
}

function ColumnProfiler({ col, dataType, rows, T }) {
  const profile = useMemo(
    () => profileColumn(rows, col, dataType),
    [rows, col, dataType]
  );
  if (!profile) return null;

  const { nullPct, uniqueCount, min, max, topValues, total } = profile;
  const hasQualityWarning = nullPct > 20;

  return (
    <div
      className="mt-2 rounded-xl border p-3 text-xs space-y-2"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div>
        <div className="flex items-center justify-between mb-1" style={{ color: T.dim }}>
          <span>Null / Empty</span>
          <span style={{ color: hasQualityWarning ? T.accent : T.muted, fontWeight: 600 }}>
            {nullPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full" style={{ background: T.border }}>
          <div
            className="h-1.5 rounded-full"
            style={{ width: `${Math.min(nullPct, 100)}%`, background: hasQualityWarning ? T.accent : T.success }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3" style={{ color: T.muted }}>
        <span>
          <span style={{ color: T.text, fontWeight: 600 }}>{uniqueCount}</span> unique
        </span>
        {dataType === "number" && min !== null && (
          <>
            <span>Min: <span style={{ color: T.text, fontWeight: 600 }}>{Number(min).toLocaleString()}</span></span>
            <span>Max: <span style={{ color: T.text, fontWeight: 600 }}>{Number(max).toLocaleString()}</span></span>
          </>
        )}
      </div>

      <div>
        <div className="mb-1.5 font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
          Top values
        </div>
        <div className="space-y-1">
          {topValues.map(([val, count]) => {
            const pct = (count / total) * 100;
            return (
              <div key={val}>
                <div className="flex justify-between mb-0.5">
                  <span className="truncate max-w-[60%] mono" style={{ color: T.text }}>{val || "(blank)"}</span>
                  <span style={{ color: T.muted }}>{count} ({pct.toFixed(1)}%)</span>
                </div>
                <div className="h-1 w-full rounded-full" style={{ background: T.border }}>
                  <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: T.blue }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Right column tabs ──────────────────────────────────────────────────────
const RIGHT_TABS = [
  { id: "preview", label: "Preview",       icon: Table2    },
  { id: "join",    label: "Join Builder",  icon: GitMerge  },
  { id: "api",     label: "API Connectors", icon: Wifi     },
];

export default function DataSource() {
  const T = useTheme();
  const setData = useStore((s) => s.setData);
  const { rows, columns, dataTypes, calcFieldNames } = useEffectiveData({ applyScenario: false });

  const [importOpen, setImportOpen] = useState(false);
  const [expandedCol, setExpandedCol] = useState(null);
  const [rightTab, setRightTab] = useState("preview");

  const preview = useMemo(() => rows.slice(0, 8), [rows]);

  const nullPcts = useMemo(() => {
    const result = {};
    columns.forEach((col) => {
      const nullCount = rows.filter(
        (r) => r[col] === null || r[col] === undefined || r[col] === ""
      ).length;
      result[col] = rows.length > 0 ? (nullCount / rows.length) * 100 : 0;
    });
    return result;
  }, [rows, columns]);

  const toggleExpand = (col) => setExpandedCol((prev) => (prev === col ? null : col));

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-7xl p-4 space-y-4">
      {/* Full-reset import modal (replaces active dataset) */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={({ rows, columns, types }) => setData(rows, columns, types)}
      />

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div
        className="rounded-[18px] border px-5 py-4 shadow-sm"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <Database size={16} color={T.accent} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold leading-none" style={{ color: T.text }}>Data Source</h1>
              <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>
                Manage datasets · Join · REST API · Column profiler
              </p>
            </div>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold btn-primary"
            style={{ background: T.accent, color: "#000", boxShadow: "0 2px 8px rgba(245,158,11,0.22)" }}
          >
            <Upload size={13} /> Replace Dataset
          </button>
        </div>
      </div>

      {/* ── Dataset slots (full width) ─────────────────────────────────── */}
      <DatasetSlots />

      {/* ── Main 2-column grid ─────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1.9fr]">
        {/* ── Left column: summary + calc fields ──────────────────────── */}
        <div className="space-y-4">
          {/* Active dataset summary */}
          <div
            className="rounded-[18px] border p-4 shadow-sm"
            style={{ background: T.surface, borderColor: T.border }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: T.accentDim }}
              >
                <Database size={15} color={T.accent} />
              </div>
              <div>
                <h2 className="text-[13px] font-semibold leading-none" style={{ color: T.text }}>
                  Active Dataset
                </h2>
                <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>Auto-detected columns & types</p>
              </div>
            </div>

            <div className="space-y-3">
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ background: T.s2, borderColor: T.border }}
              >
                <span className="text-sm mono" style={{ color: T.dim }}>Rows</span>
                <span className="text-sm font-semibold mono" style={{ color: T.text }}>
                  {rows.length.toLocaleString()}
                </span>
              </div>
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ background: T.s2, borderColor: T.border }}
              >
                <span className="text-sm mono" style={{ color: T.dim }}>Columns</span>
                <span className="text-sm font-semibold mono" style={{ color: T.text }}>
                  {columns.length}
                </span>
              </div>
            </div>

            {/* Column profiler */}
            <div className="mt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                Column Profiler — click a column to inspect
              </div>
              <div className="space-y-1">
                {columns.length ? (
                  columns.map((col) => {
                    const isCalc = calcFieldNames?.has(col);
                    const hasWarning = nullPcts[col] > 20;
                    const isExpanded = expandedCol === col;
                    return (
                      <div key={col}>
                        <button
                          onClick={() => toggleExpand(col)}
                          className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition hover:opacity-90"
                          style={{ background: T.s2, borderColor: isExpanded ? T.accent : T.border }}
                        >
                          <span className="flex items-center gap-2 text-sm" style={{ color: T.text }}>
                            {col}
                            {isCalc && (
                              <span
                                className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase mono"
                                style={{ background: T.accentDim, color: T.accent }}
                              >
                                calc
                              </span>
                            )}
                            {hasWarning && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                                style={{ background: "rgba(245,158,11,0.14)", color: T.accent }}
                                title={`${nullPcts[col].toFixed(1)}% nulls`}
                              >
                                <AlertTriangle size={9} />
                                {nullPcts[col].toFixed(0)}% null
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className="rounded-md px-2 py-1 text-[11px] uppercase mono"
                              style={{
                                background: T.s3,
                                color:
                                  dataTypes[col] === "number" ? T.blue :
                                  dataTypes[col] === "date" ? T.success :
                                  dataTypes[col] === "boolean" ? T.accent : T.dim,
                              }}
                            >
                              {dataTypes[col]}
                            </span>
                            {isExpanded
                              ? <ChevronUp size={13} style={{ color: T.dim }} />
                              : <ChevronDown size={13} style={{ color: T.dim }} />
                            }
                          </div>
                        </button>
                        {isExpanded && (
                          <ColumnProfiler col={col} dataType={dataTypes[col]} rows={rows} T={T} />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div
                    className="rounded-xl border px-4 py-6 text-center text-sm"
                    style={{ background: T.s2, borderColor: T.border, color: T.dim }}
                  >
                    No dataset loaded yet
                  </div>
                )}
              </div>
            </div>
          </div>

          <CalcFieldManager />
        </div>

        {/* ── Right column: tabbed (Preview | Join | API) ──────────────── */}
        <div
          className="rounded-[20px] border shadow-sm"
          style={{ background: T.surface, borderColor: T.border }}
        >
          {/* Tab bar */}
          <div
            className="flex gap-1 border-b px-4 pt-4"
            style={{ borderColor: T.border }}
          >
            {RIGHT_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setRightTab(id)}
                className="flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-sm font-medium transition"
                style={{
                  background: rightTab === id ? T.s2 : "transparent",
                  color: rightTab === id ? T.text : T.muted,
                  borderBottom: rightTab === id ? `2px solid ${T.accent}` : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ── Preview tab ──────────────────────────────────────── */}
            {rightTab === "preview" && (
              <>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: T.text }}>Data Preview</h2>
                  <p className="mt-1 text-sm" style={{ color: T.dim }}>
                    First few rows from the active dataset
                  </p>
                </div>
                <div className="overflow-auto rounded-2xl border" style={{ borderColor: T.border }}>
                  {preview.length ? (
                    <table className="min-w-full text-sm">
                      <thead style={{ background: T.s2 }}>
                        <tr>
                          {columns.map((col) => (
                            <th
                              key={col}
                              className="border-b px-4 py-3 text-left font-semibold"
                              style={{ borderColor: T.border, color: T.text }}
                            >
                              <div className="flex items-center gap-1.5">
                                {col}
                                {nullPcts[col] > 20 && (
                                  <AlertTriangle
                                    size={11}
                                    style={{ color: T.accent }}
                                    title={`${nullPcts[col].toFixed(0)}% nulls`}
                                  />
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, idx) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? T.surface : T.s2 }}>
                            {columns.map((col, i) => (
                              <td
                                key={i}
                                className="border-b px-4 py-3"
                                style={{ borderColor: T.border, color: T.dim }}
                              >
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex h-72 flex-col items-center justify-center gap-3">
                      <Database size={34} color={T.muted} />
                      <div className="text-sm" style={{ color: T.dim }}>
                        Import a dataset to preview it here
                      </div>
                      <button
                        onClick={() => setImportOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                        style={{ background: T.accent, color: "#000" }}
                      >
                        <Upload size={14} /> Import Data
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Join Builder tab ──────────────────────────────────── */}
            {rightTab === "join" && <JoinBuilder />}

            {/* ── API Connectors tab ─────────────────────────────────── */}
            {rightTab === "api" && <ApiConnectorPanel />}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
