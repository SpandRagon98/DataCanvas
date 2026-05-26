import { AgGridReact } from "ag-grid-react";
import { useEffect, useMemo } from "react";
import { Database, Download, Undo2, Redo2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useStore } from "../store/useStore";
import { useEffectiveData } from "../hooks/useEffectiveData";
import { useTheme } from "../styles/theme";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

export default function DataTable() {
  const T = useTheme();
  const themeMode = useStore((s) => s.themeMode);
  const updateCell = useStore((s) => s.updateCell);
  const undoEdit = useStore((s) => s.undoEdit);
  const redoEdit = useStore((s) => s.redoEdit);
  const undoStack = useStore((s) => s.undoStack);
  const redoStack = useStore((s) => s.redoStack);

  const { rows, columns, dataTypes, calcFieldNames } = useEffectiveData({ applyScenario: false });

  // Ctrl+Z / Ctrl+Y keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoEdit();
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redoEdit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undoEdit, redoEdit]);

  const exportCSV = () => {
    const header = columns.join(",");
    const csvRows = rows.map((row) =>
      columns.map((c) => {
        const val = String(row[c] ?? "");
        return val.includes(",") || val.includes('"') || val.includes("\n")
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(",")
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "datacanvas-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const data = rows.map((r) => {
      const out = {};
      columns.forEach((c) => { out[c] = r[c]; });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, "datacanvas-export.xlsx");
  };

  const columnDefs = useMemo(
    () =>
      columns.map((field) => {
        const isCalc = calcFieldNames?.has(field);
        return {
          field,
          headerName: isCalc ? `${field} (calc)` : field,
          editable: !isCalc,
          sortable: true,
          filter: true,
          resizable: true,
          cellStyle: isCalc ? { fontStyle: "italic", opacity: 0.88 } : undefined,
          valueParser: (params) => {
            const fieldType = dataTypes[field];
            const newValue = params.newValue;
            if (fieldType === "number") return newValue === "" ? "" : Number(newValue);
            if (fieldType === "boolean") {
              if (String(newValue).toLowerCase() === "true") return true;
              if (String(newValue).toLowerCase() === "false") return false;
            }
            return newValue;
          },
        };
      }),
    [columns, dataTypes, calcFieldNames]
  );

  const rowData = useMemo(
    () => rows.map((row, idx) => ({ ...row, __rowIndex: idx })),
    [rows]
  );

  const gridThemeClass = themeMode === "light" ? "ag-theme-quartz" : "ag-theme-quartz-dark";

  return (
    <div className="h-[calc(100vh-32px)]">
      <div
        className="mb-4 rounded-[20px] border p-5 shadow-sm"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: T.accentDim }}
            >
              <Database size={18} color={T.accent} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: T.text }}>Data Table</h1>
              <p className="mt-1 text-sm" style={{ color: T.dim }}>
                Edit raw data and visuals update automatically. Calculated fields are read-only.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={undoEdit}
              disabled={!undoStack.length}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition"
              style={{
                borderColor: T.border,
                background: T.s2,
                color: undoStack.length ? T.text : T.muted,
                cursor: undoStack.length ? "pointer" : "not-allowed",
              }}
              title="Undo last cell edit (Ctrl+Z)"
            >
              <Undo2 size={14} /> Undo
            </button>

            <button
              onClick={redoEdit}
              disabled={!redoStack.length}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition"
              style={{
                borderColor: T.border,
                background: T.s2,
                color: redoStack.length ? T.text : T.muted,
                cursor: redoStack.length ? "pointer" : "not-allowed",
              }}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={14} /> Redo
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: T.border, background: T.s2, color: T.text }}
              title="Export as CSV"
            >
              <Download size={14} /> CSV
            </button>

            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: T.border, background: T.s2, color: T.text }}
              title="Export as Excel"
            >
              <Download size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      <div
        className="h-[calc(100%-120px)] rounded-[20px] border p-4 shadow-sm"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div className={`${gridThemeClass} h-full w-full`}>
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            getRowId={(params) => String(params.data.__rowIndex)}
            onCellValueChanged={(params) => {
              if (calcFieldNames?.has(params.colDef.field)) return;
              updateCell({
                rowIndex: params.data.__rowIndex,
                field: params.colDef.field,
                value: params.newValue,
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
