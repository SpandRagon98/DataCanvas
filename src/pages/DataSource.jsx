import { useMemo, useState } from "react";
import {
  Database, Upload, ChevronDown, ChevronUp, AlertTriangle,
  Table2, GitMerge, Wifi, Pencil, Check, X,
} from "lucide-react";
import { useStore }         from "../store/useStore";
import ImportModal          from "../components/import/ImportModal";
import CalcFieldManager     from "../components/calcfields/CalcFieldManager";
import DatasetSlots         from "../components/datasource/DatasetSlots";
import JoinBuilder          from "../components/datasource/JoinBuilder";
import ApiConnectorPanel    from "../components/datasource/ApiConnectorPanel";
import DataCleaningPanel    from "../components/ai/DataCleaningPanel";
import { useEffectiveData } from "../hooks/useEffectiveData";
import { useTheme }         from "../styles/theme";

/** Compute profile stats for one column */
function profileColumn(rows, col, dataType) {
  const total = rows.length;
  if (!total) return null;

  const nullCount = rows.filter(
    (r) => r[col] === null || r[col] === undefined || r[col] === ""
  ).length;
  const nullPct   = total > 0 ? (nullCount / total) * 100 : 0;
  const uniqueCount = new Set(rows.map((r) => r[col])).size;

  let min = null, max = null, topValues = [];

  if (dataType === "number") {
    const nums = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
    if (nums.length) { min = Math.min(...nums); max = Math.max(...nums); }
  }

  const freq = {};
  rows.forEach((r) => { const v = String(r[col] ?? ""); freq[v] = (freq[v] || 0) + 1; });
  topValues = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return { total, nullCount, nullPct, uniqueCount, min, max, topValues };
}

function ColumnProfiler({ col, dataType, rows, T }) {
  const profile = useMemo(() => profileColumn(rows, col, dataType), [rows, col, dataType]);
  if (!profile) return null;
  const { nullPct, uniqueCount, min, max, topValues, total } = profile;
  const warn = nullPct > 20;

  return (
    <div className="mt-2 rounded-xl border p-3 text-xs space-y-2" style={{ background: T.surface, borderColor: T.border }}>
      <div>
        <div className="flex items-center justify-between mb-1" style={{ color: T.dim }}>
          <span>Null / Empty</span>
          <span style={{ color: warn ? T.accent : T.muted, fontWeight: 600 }}>{nullPct.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full" style={{ background: T.border }}>
          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(nullPct, 100)}%`, background: warn ? T.accent : T.success }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3" style={{ color: T.muted }}>
        <span><span style={{ color: T.text, fontWeight: 600 }}>{uniqueCount}</span> unique</span>
        {dataType === "number" && min !== null && (
          <>
            <span>Min: <span style={{ color: T.text, fontWeight: 600 }}>{Number(min).toLocaleString()}</span></span>
            <span>Max: <span style={{ color: T.text, fontWeight: 600 }}>{Number(max).toLocaleString()}</span></span>
          </>
        )}
      </div>
      <div>
        <div className="mb-1.5 font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Top values</div>
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
  { id: "preview", label: "Preview",       icon: Table2   },
  { id: "join",    label: "Join Builder",  icon: GitMerge },
  { id: "api",     label: "API Connectors", icon: Wifi    },
];

export default function DataSource() {
  const T               = useTheme();
  const setData         = useStore((s) => s.setData);
  const columnAliases   = useStore((s) => s.columnAliases);
  const renameColumn    = useStore((s) => s.renameColumn);
  const resetColumnAlias= useStore((s) => s.resetColumnAlias);
  const { rows, columns, dataTypes, calcFieldNames } = useEffectiveData({ applyScenario: false });

  const [importOpen,   setImportOpen]   = useState(false);
  const [expandedCol,  setExpandedCol]  = useState(null);
  const [rightTab,     setRightTab]     = useState("preview");
  // column rename state
  const [renamingCol,  setRenamingCol]  = useState(null);
  const [renameVal,    setRenameVal]    = useState("");
  // AI data cleaning
  const [showCleaning, setShowCleaning] = useState(false);

  const preview = useMemo(() => rows.slice(0, 10), [rows]);

  const nullPcts = useMemo(() => {
    const result = {};
    columns.forEach((col) => {
      const n = rows.filter((r) => r[col] === null || r[col] === undefined || r[col] === "").length;
      result[col] = rows.length > 0 ? (n / rows.length) * 100 : 0;
    });
    return result;
  }, [rows, columns]);

  const startRename = (col) => {
    setRenamingCol(col);
    setRenameVal(columnAliases[col] || col);
  };

  const commitRename = (col) => {
    const v = renameVal.trim();
    if (v && v !== col) renameColumn(col, v);
    else if (!v) resetColumnAlias(col);
    setRenamingCol(null);
  };

  const displayCol = (col) => columnAliases[col] || col;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={({ rows, columns, types }) => {
            setData(rows, columns, types);
            setShowCleaning(true);
          }}
        />

        {/* ── Page header ── */}
        <div className="rounded-xl border px-4 py-3 shadow-sm flex items-center justify-between gap-4"
          style={{ background: T.surface, borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <Database size={16} color={T.accent} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold leading-none" style={{ color: T.text }}>Data Source</h1>
              <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>Manage datasets · Join · REST API · Column profiler</p>
            </div>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold btn-primary shrink-0"
            style={{ background: T.accent, color: "#000" }}
          >
            <Upload size={13} /> Replace Dataset
          </button>
        </div>

        {/* ── Dataset slots ── */}
        <DatasetSlots />

        {/* ── AI Data Cleaning Panel (shown after import) ── */}
        {showCleaning && columns.length > 0 && rows.length > 0 && (
          <DataCleaningPanel
            columns={columns}
            dataTypes={dataTypes}
            rows={rows}
            onClose={() => setShowCleaning(false)}
          />
        )}

        {/* ── Main 2-column grid ── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(260px,320px) 1fr" }}>

          {/* ── Left: summary + calc fields ── */}
          <div className="space-y-4 min-w-0">
            <div className="rounded-xl border p-4 shadow-sm" style={{ background: T.surface, borderColor: T.border }}>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0" style={{ background: T.accentDim }}>
                  <Database size={14} color={T.accent} />
                </div>
                <div>
                  <h2 className="text-[13px] font-semibold leading-none" style={{ color: T.text }}>Active Dataset</h2>
                  <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>Auto-detected columns & types</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {[["Rows", rows.length.toLocaleString()], ["Columns", columns.length]].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-xl border px-3 py-2"
                    style={{ background: T.s2, borderColor: T.border }}>
                    <span className="text-sm mono" style={{ color: T.dim }}>{k}</span>
                    <span className="text-sm font-semibold mono" style={{ color: T.text }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Column Profiler */}
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                Column Profiler — click to inspect · pencil to rename
              </div>
              <div className="space-y-1">
                {columns.length ? columns.map((col) => {
                  const isCalc    = calcFieldNames?.has(col);
                  const hasWarn   = nullPcts[col] > 20;
                  const isExp     = expandedCol === col;
                  const isRenaming = renamingCol === col;
                  return (
                    <div key={col}>
                      <div className="flex items-center gap-1.5">
                        {/* Main expand button */}
                        <button
                          onClick={() => { setExpandedCol((p) => (p === col ? null : col)); setRenamingCol(null); }}
                          className="flex flex-1 min-w-0 items-center justify-between rounded-xl border px-3 py-2 text-left transition hover:opacity-90"
                          style={{ background: T.s2, borderColor: isExp ? T.accent : T.border }}
                        >
                          <span className="flex items-center gap-2 text-sm min-w-0" style={{ color: T.text }}>
                            <span className="truncate">{displayCol(col)}</span>
                            {col !== displayCol(col) && (
                              <span className="shrink-0 text-[10px]" style={{ color: T.muted }}>({col})</span>
                            )}
                            {isCalc && (
                              <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase mono"
                                style={{ background: T.accentDim, color: T.accent }}>calc</span>
                            )}
                            {hasWarn && (
                              <span className="shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                                style={{ background: "rgba(245,158,11,0.14)", color: T.accent }}>
                                <AlertTriangle size={9} />{nullPcts[col].toFixed(0)}% null
                              </span>
                            )}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5 ml-2">
                            <span className="rounded-md px-2 py-1 text-[11px] uppercase mono"
                              style={{ background: T.s3, color: dataTypes[col] === "number" ? T.blue : dataTypes[col] === "date" ? T.success : dataTypes[col] === "boolean" ? T.accent : T.dim }}>
                              {dataTypes[col]}
                            </span>
                            {isExp ? <ChevronUp size={12} style={{ color: T.dim }} /> : <ChevronDown size={12} style={{ color: T.dim }} />}
                          </div>
                        </button>

                        {/* Rename button */}
                        {!isCalc && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(col); }}
                            className="shrink-0 rounded-lg border p-1.5 transition hover:opacity-80"
                            style={{ background: T.s2, borderColor: T.border, color: T.dim }}
                            title="Rename column">
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>

                      {/* Inline rename form */}
                      {isRenaming && (
                        <div className="mt-1 flex items-center gap-1.5 rounded-xl border px-3 py-2"
                          style={{ background: T.surface, borderColor: T.accent }}>
                          <input
                            autoFocus
                            value={renameVal}
                            onChange={(e) => setRenameVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(col);
                              if (e.key === "Escape") setRenamingCol(null);
                            }}
                            className="flex-1 bg-transparent text-sm outline-none"
                            style={{ color: T.text }}
                            placeholder={col}
                          />
                          <button onClick={() => commitRename(col)}
                            className="rounded-lg p-1" style={{ color: T.success }}><Check size={13} /></button>
                          <button onClick={() => setRenamingCol(null)}
                            className="rounded-lg p-1" style={{ color: T.dim }}><X size={13} /></button>
                          {columnAliases[col] && (
                            <button onClick={() => { resetColumnAlias(col); setRenamingCol(null); }}
                              className="text-[10px] rounded-lg px-2 py-1 border"
                              style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
                              Reset
                            </button>
                          )}
                        </div>
                      )}

                      {isExp && (
                        <ColumnProfiler col={col} dataType={dataTypes[col]} rows={rows} T={T} />
                      )}
                    </div>
                  );
                }) : (
                  <div className="rounded-xl border px-4 py-6 text-center text-sm"
                    style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
                    No dataset loaded yet
                  </div>
                )}
              </div>
            </div>

            <CalcFieldManager />
          </div>

          {/* ── Right: tabbed panel ── */}
          <div className="rounded-xl border shadow-sm min-w-0 flex flex-col" style={{ background: T.surface, borderColor: T.border }}>
            {/* Tab bar */}
            <div className="flex gap-1 border-b px-4 pt-3 shrink-0" style={{ borderColor: T.border }}>
              {RIGHT_TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setRightTab(id)}
                  className="flex items-center gap-1.5 rounded-t-xl px-4 py-2 text-sm font-medium transition"
                  style={{
                    background: rightTab === id ? T.s2 : "transparent",
                    color: rightTab === id ? T.text : T.muted,
                    borderBottom: rightTab === id ? `2px solid ${T.accent}` : "2px solid transparent",
                    marginBottom: "-1px",
                  }}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 p-4 overflow-auto">
              {rightTab === "preview" && (
                <>
                  <div className="mb-3">
                    <h2 className="text-base font-semibold" style={{ color: T.text }}>Data Preview</h2>
                    <p className="text-xs mt-0.5" style={{ color: T.dim }}>
                      First {preview.length} rows · {columns.length} columns
                    </p>
                  </div>
                  {/* Horizontally scrollable table container */}
                  <div className="overflow-x-auto overflow-y-auto rounded-xl border"
                    style={{ borderColor: T.border, maxHeight: 440 }}>
                    {preview.length ? (
                      <table className="text-sm" style={{ minWidth: "100%", borderCollapse: "collapse", whiteSpace: "nowrap" }}>
                        <thead style={{ background: T.s2, position: "sticky", top: 0, zIndex: 1 }}>
                          <tr>
                            {columns.map((col) => (
                              <th key={col}
                                className="border-b px-4 py-2.5 text-left font-semibold"
                                style={{ borderColor: T.border, color: T.text }}>
                                <div className="flex items-center gap-1.5">
                                  <span>{displayCol(col)}</span>
                                  {col !== displayCol(col) && (
                                    <span className="text-[10px]" style={{ color: T.muted }}>({col})</span>
                                  )}
                                  {nullPcts[col] > 20 && (
                                    <AlertTriangle size={10} style={{ color: T.accent }} />
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
                                <td key={i} className="border-b px-4 py-2.5"
                                  style={{ borderColor: T.border, color: T.dim }}>
                                  {String(row[col] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex h-52 flex-col items-center justify-center gap-3">
                        <Database size={32} color={T.muted} />
                        <div className="text-sm" style={{ color: T.dim }}>Import a dataset to preview</div>
                        <button onClick={() => setImportOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                          style={{ background: T.accent, color: "#000" }}>
                          <Upload size={13} /> Import
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {rightTab === "join" && <JoinBuilder />}
              {rightTab === "api"  && <ApiConnectorPanel />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
