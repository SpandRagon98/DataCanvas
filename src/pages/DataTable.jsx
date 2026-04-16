import { AgGridReact } from "ag-grid-react";
import { useMemo } from "react";
import { Database } from "lucide-react";
import { useStore } from "../store/useStore";
import { T } from "../styles/theme";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

export default function DataTable() {
  const rawData = useStore((s) => s.rawData);
  const columns = useStore((s) => s.columns);
  const updateCell = useStore((s) => s.updateCell);
  const dataTypes = useStore((s) => s.dataTypes);

  const columnDefs = useMemo(
    () =>
      columns.map((field) => ({
        field,
        editable: true,
        sortable: true,
        filter: true,
        resizable: true,
        valueParser: (params) => {
          const fieldType = dataTypes[field];
          const newValue = params.newValue;

          if (fieldType === "number") {
            return newValue === "" ? "" : Number(newValue);
          }

          if (fieldType === "boolean") {
            if (String(newValue).toLowerCase() === "true") return true;
            if (String(newValue).toLowerCase() === "false") return false;
          }

          return newValue;
        },
      })),
    [columns, dataTypes]
  );

  const rowData = useMemo(
    () => rawData.map((row, idx) => ({ ...row, __rowIndex: idx })),
    [rawData]
  );

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
            <h1 className="text-2xl font-bold" style={{ color: T.text }}>
              Data Table
            </h1>
            <p className="mt-1 text-sm" style={{ color: T.dim }}>
              Edit raw data and visuals will update automatically
            </p>
          </div>
        </div>
      </div>

      <div
        className="h-[calc(100%-110px)] rounded-[20px] border p-4 shadow-sm"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div className="ag-theme-quartz-dark h-full w-full">
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            getRowId={(params) => String(params.data.__rowIndex)}
            onCellValueChanged={(params) => {
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
