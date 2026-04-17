import { AgGridReact } from "ag-grid-react";
import { useMemo } from "react";
import { Database } from "lucide-react";
import { useStore } from "../store/useStore";
import { useEffectiveData } from "../hooks/useEffectiveData";
import { useTheme } from "../styles/theme";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

export default function DataTable() {
  const T = useTheme();
  const themeMode = useStore((s) => s.themeMode);
  const updateCell = useStore((s) => s.updateCell);

  // DataTable shows raw (editable) data with calc fields merged in read-only.
  // Scenarios are NOT applied here to avoid confusing users into thinking
  // their data has been mutated.
  const { rows, columns, dataTypes, calcFieldNames } = useEffectiveData({
    applyScenario: false,
  });

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
        className="mb-4 rounded-[20px] border p-6 shadow-sm"
        style={{ background: T.surface, borderColor: T.border }}
      >
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
              Edit raw data and visuals will update automatically. Calculated fields are read-only.
            </p>
          </div>
        </div>
      </div>

      <div
        className="h-[calc(100%-110px)] rounded-[20px] border p-4 shadow-sm"
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
