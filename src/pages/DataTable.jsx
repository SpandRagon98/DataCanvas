import { AgGridReact } from "ag-grid-react";
import { useEffect, useMemo, useState } from "react";
import { Database, Download, Undo2, Redo2, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useStore }          from "../store/useStore";
import { useEffectiveData }  from "../hooks/useEffectiveData";
import { useTheme }          from "../styles/theme";
import CheckboxSetFilter     from "../components/datatable/CheckboxSetFilter";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// ── Find & Replace modal ──────────────────────────────────────────────────
function FindReplaceModal({ open, onClose, rows, columns, dataTypes, updateCell, columnAliases, T }) {
  const [targetCol,     setTargetCol]     = useState(columns[0] || "");
  const [findVal,       setFindVal]       = useState("");
  const [replaceVal,    setReplaceVal]    = useState("");
  const [matchCount,    setMatchCount]    = useState(null);
  const [caseSensitive, setCaseSensitive] = useState(false);

  useEffect(() => { setMatchCount(null); }, [targetCol, findVal, caseSensitive]);

  if (!open) return null;

  const normalize = (v) => caseSensitive ? String(v ?? "") : String(v ?? "").toLowerCase();
  const needle    = caseSensitive ? findVal : findVal.toLowerCase();
  const getMatches = () => rows.reduce((acc, row, idx) => {
    if (normalize(row[targetCol]) === needle) acc.push(idx);
    return acc;
  }, []);

  const handlePreview = () => setMatchCount(getMatches().length);
  const handleReplace = () => {
    const matches  = getMatches();
    setMatchCount(matches.length);
    const ft = dataTypes[targetCol];
    let parsed = replaceVal;
    if (ft === "number") parsed = replaceVal === "" ? "" : Number(replaceVal);
    else if (ft === "boolean") {
      if (replaceVal.toLowerCase() === "true") parsed = true;
      else if (replaceVal.toLowerCase() === "false") parsed = false;
    }
    matches.forEach((rowIndex) => updateCell({ rowIndex, field: targetCol, value: parsed }));
  };

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };
  const label = (col) => columnAliases?.[col] || col;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: T.surface, borderColor: T.border }}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <Search size={16} color={T.accent} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: T.text }}>Find & Replace</h2>
              <p className="text-xs" style={{ color: T.dim }}>Replace exact cell values in a column</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border p-2" style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: T.text }}>Column</label>
            <select value={targetCol} onChange={(e) => setTargetCol(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={inputStyle}>
              {columns.map((c) => <option key={c} value={c}>{label(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: T.text }}>Find</label>
            <input value={findVal} onChange={(e) => setFindVal(e.target.value)} placeholder="Value to find…"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none mono" style={inputStyle} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: T.text }}>Replace with</label>
            <input value={replaceVal} onChange={(e) => setReplaceVal(e.target.value)} placeholder="Replacement value…"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none mono" style={inputStyle} />
          </div>
          <label className="flex cursor-pointer items-center gap-3 select-none">
            <div onClick={() => setCaseSensitive((c) => !c)}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition"
              style={{ background: caseSensitive ? T.accent : T.border }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                style={{ transform: caseSensitive ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
            </div>
            <span className="text-sm" style={{ color: T.dim }}>Case sensitive</span>
          </label>
          {matchCount !== null && (
            <div className="rounded-xl border px-3 py-2 text-sm" style={{
              background: matchCount > 0 ? "rgba(16,185,129,0.08)" : "rgba(20,184,166,0.08)",
              borderColor: matchCount > 0 ? "rgba(16,185,129,0.25)" : "rgba(20,184,166,0.25)",
              color: matchCount > 0 ? T.success : T.accent,
            }}>
              {matchCount > 0 ? `${matchCount} match${matchCount !== 1 ? "es" : ""} found` : "No matches found"}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={handlePreview} disabled={!findVal}
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium"
            style={{ background: T.s2, borderColor: T.border, color: findVal ? T.text : T.muted, cursor: findVal ? "pointer" : "not-allowed" }}>
            Preview matches
          </button>
          <button onClick={handleReplace} disabled={!findVal}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: findVal ? T.accent : T.border, color: findVal ? "#000" : T.muted, cursor: findVal ? "pointer" : "not-allowed" }}>
            Replace all
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main DataTable ────────────────────────────────────────────────────────
export default function DataTable() {
  const T             = useTheme();
  const themeMode     = useStore((s) => s.themeMode);
  const updateCell    = useStore((s) => s.updateCell);
  const undoEdit      = useStore((s) => s.undoEdit);
  const redoEdit      = useStore((s) => s.redoEdit);
  const undoStack     = useStore((s) => s.undoStack);
  const redoStack     = useStore((s) => s.redoStack);
  const rawData       = useStore((s) => s.rawData);          // unfiltered, for filter values
  const columnAliases = useStore((s) => s.columnAliases);

  const { rows, columns, dataTypes, calcFieldNames } = useEffectiveData({ applyScenario: false, joinCalendar: false });
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undoEdit(); }
      if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault(); redoEdit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undoEdit, redoEdit]);

  /* ── Exports ── */
  const exportCSV = () => {
    const header  = columns.map((c) => columnAliases[c] || c).join(",");
    const csvRows = rows.map((row) =>
      columns.map((c) => {
        const val = String(row[c] ?? "");
        return val.includes(",") || val.includes('"') || val.includes("\n")
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(",")
    );
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "vizora-export.csv" }).click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const data = rows.map((r) => {
      const out = {};
      columns.forEach((c) => { out[columnAliases[c] || c] = r[c]; });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, "vizora-export.xlsx");
  };

  /* ── Column definitions (with CheckboxSetFilter for string columns) ── */
  const columnDefs = useMemo(() => {
    return columns.map((field) => {
      const isCalc      = calcFieldNames?.has(field);
      const type        = dataTypes[field];
      const isString    = type !== "number" && type !== "date" && type !== "boolean";
      const alias       = columnAliases[field] || field;

      // Build unique values from UNFILTERED rawData for filter dropdown
      const uniqueVals = isString
        ? [...new Set(rawData.map((r) => String(r[field] ?? "")))].sort()
        : [];

      return {
        field,
        headerName:  isCalc ? `${alias} (calc)` : alias,
        editable:    !isCalc,
        sortable:    true,
        resizable:   true,
        // Use custom CheckboxSetFilter for string columns; built-in for numeric
        filter:      isString ? CheckboxSetFilter : "agNumberColumnFilter",
        filterParams: isString ? { values: uniqueVals } : {},
        cellStyle:   isCalc ? { fontStyle: "italic", opacity: 0.88 } : undefined,
        valueParser: (params) => {
          const ft  = dataTypes[field];
          const nv  = params.newValue;
          if (ft === "number")  return nv === "" ? "" : Number(nv);
          if (ft === "boolean") {
            if (String(nv).toLowerCase() === "true")  return true;
            if (String(nv).toLowerCase() === "false") return false;
          }
          return nv;
        },
      };
    });
  }, [columns, dataTypes, calcFieldNames, columnAliases, rawData]);

  const rowData       = useMemo(() => rows.map((row, idx) => ({ ...row, __rowIndex: idx })), [rows]);
  const gridThemeClass = themeMode === "light" ? "ag-theme-quartz" : "ag-theme-quartz-dark";

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-3 gap-2.5">
      <FindReplaceModal
        open={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
        rows={rows}
        columns={columns.filter((c) => !calcFieldNames?.has(c))}
        dataTypes={dataTypes}
        updateCell={updateCell}
        columnAliases={columnAliases}
        T={T}
      />

      {/* ── Toolbar ── */}
      <div className="shrink-0 rounded-xl border px-4 py-2 shadow-sm"
        style={{ background: T.surface, borderColor: T.border }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <Database size={16} color={T.accent} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold leading-none" style={{ color: T.text }}>Data Table</h1>
              <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>
                Edit cells · Click column header funnel to filter · Ctrl+Z / Ctrl+Y
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={undoEdit} disabled={!undoStack.length}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition"
              style={{ borderColor: T.border, background: T.s2, color: undoStack.length ? T.text : T.muted, cursor: undoStack.length ? "pointer" : "not-allowed" }}
              title="Undo (Ctrl+Z)"><Undo2 size={12} /> Undo</button>

            <button onClick={redoEdit} disabled={!redoStack.length}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition"
              style={{ borderColor: T.border, background: T.s2, color: redoStack.length ? T.text : T.muted, cursor: redoStack.length ? "pointer" : "not-allowed" }}
              title="Redo (Ctrl+Y)"><Redo2 size={12} /> Redo</button>

            <div className="mx-1 h-4 w-px" style={{ background: T.border }} />

            <button onClick={() => setFindReplaceOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs"
              style={{ borderColor: T.border, background: T.s2, color: T.text }}><Search size={12} /> Find & Replace</button>

            <button onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs"
              style={{ borderColor: T.border, background: T.s2, color: T.text }}><Download size={12} /> CSV</button>

            <button onClick={exportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs"
              style={{ borderColor: T.border, background: T.s2, color: T.text }}><Download size={12} /> Excel</button>
          </div>
        </div>
      </div>

      {/* ── AG Grid ── */}
      <div className="flex-1 min-h-0 rounded-xl border p-3 shadow-sm"
        style={{ background: T.surface, borderColor: T.border }}>
        <div className={`${gridThemeClass} h-full w-full`}>
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            getRowId={(params) => String(params.data.__rowIndex)}
            onCellValueChanged={(params) => {
              if (calcFieldNames?.has(params.colDef.field)) return;
              updateCell({
                rowIndex: params.data.__rowIndex,
                field:    params.colDef.field,
                value:    params.newValue,
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
