import { useMemo, useState } from "react";
import { Database, Upload } from "lucide-react";
import { useStore } from "../store/useStore";
import ImportModal from "../components/import/ImportModal";
import { T } from "../styles/theme";

export default function DataSource() {
  const rawData = useStore((s) => s.rawData);
  const columns = useStore((s) => s.columns);
  const dataTypes = useStore((s) => s.dataTypes);
  const setData = useStore((s) => s.setData);

  const [importOpen, setImportOpen] = useState(false);

  const preview = useMemo(() => rawData.slice(0, 8), [rawData]);

  return (
    <div className="mx-auto max-w-7xl p-2">
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={({ rows, columns, types }) => {
          setData(rows, columns, types);
        }}
      />

      <div
        className="rounded-[20px] border p-6 shadow-sm"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: T.text }}>
              Data Source
            </h1>
            <p className="mt-2 text-sm" style={{ color: T.dim }}>
              Import datasets and preview detected structure before building visuals
            </p>
          </div>

          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: T.accent, color: "#000" }}
          >
            <Upload size={15} />
            Import Data
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
        <div
          className="rounded-[20px] border p-5 shadow-sm"
          style={{ background: T.surface, borderColor: T.border }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: T.accentDim }}
            >
              <Database size={18} color={T.accent} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: T.text }}>
                Dataset Summary
              </h2>
              <p className="text-sm" style={{ color: T.dim }}>
                Auto-detected columns and types
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div
              className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ background: T.s2, borderColor: T.border }}
            >
              <span className="text-sm mono" style={{ color: T.dim }}>
                Rows
              </span>
              <span className="text-sm font-semibold mono" style={{ color: T.text }}>
                {rawData.length}
              </span>
            </div>

            <div
              className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ background: T.s2, borderColor: T.border }}
            >
              <span className="text-sm mono" style={{ color: T.dim }}>
                Columns
              </span>
              <span className="text-sm font-semibold mono" style={{ color: T.text }}>
                {columns.length}
              </span>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
              Column Types
            </div>

            <div className="space-y-2">
              {columns.length ? (
                columns.map((col) => (
                  <div
                    key={col}
                    className="flex items-center justify-between rounded-xl border px-3 py-2"
                    style={{ background: T.s2, borderColor: T.border }}
                  >
                    <span className="text-sm" style={{ color: T.text }}>
                      {col}
                    </span>
                    <span
                      className="rounded-md px-2 py-1 text-[11px] uppercase mono"
                      style={{
                        background: T.s3,
                        color:
                          dataTypes[col] === "number"
                            ? T.blue
                            : dataTypes[col] === "date"
                            ? T.success
                            : dataTypes[col] === "boolean"
                            ? T.accent
                            : T.dim,
                      }}
                    >
                      {dataTypes[col]}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border px-4 py-6 text-center text-sm" style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
                  No dataset loaded yet
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="rounded-[20px] border p-5 shadow-sm"
          style={{ background: T.surface, borderColor: T.border }}
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold" style={{ color: T.text }}>
              Data Preview
            </h2>
            <p className="mt-1 text-sm" style={{ color: T.dim }}>
              First few rows from the active dataset
            </p>
          </div>

          <div className="overflow-auto rounded-2xl border" style={{ borderColor: T.border }}>
            {preview.length ? (
              <table className="min-w-full text-sm">
                <thead style={{ background: T.s2 }}>
                  <tr>
                    {Object.keys(preview[0]).map((col) => (
                      <th
                        key={col}
                        className="border-b px-4 py-3 text-left font-semibold"
                        style={{ borderColor: T.border, color: T.text }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? T.surface : T.s2 }}>
                      {Object.values(row).map((val, i) => (
                        <td
                          key={i}
                          className="border-b px-4 py-3"
                          style={{ borderColor: T.border, color: T.dim }}
                        >
                          {String(val)}
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
                  <Upload size={14} />
                  Import Data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
