import { AgGridReact } from "ag-grid-react";
import { useMemo } from "react";
import { useStore } from "../store/useStore";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

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
    <div className="h-[calc(100vh-32px)] rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Data Table</h1>
        <p className="text-sm text-slate-500">
          Edit raw data and visuals will update automatically
        </p>
      </div>

      <div className="ag-theme-alpine h-[calc(100%-56px)] w-full overflow-hidden rounded-xl">
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
  );
}
