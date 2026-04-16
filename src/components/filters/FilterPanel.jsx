import { useStore } from "../../store/useStore";
import { getUniqueValues } from "../../utils/filterEngine";
import { T } from "../../styles/theme";

export default function FilterPanel() {
  const rawData = useStore((s) => s.rawData);
  const columns = useStore((s) => s.columns);
  const dataTypes = useStore((s) => s.dataTypes);
  const filters = useStore((s) => s.filters);
  const setGlobalFilter = useStore((s) => s.setGlobalFilter);
  const clearGlobalFilters = useStore((s) => s.clearGlobalFilters);

  const filterableFields = columns.filter((c) => dataTypes[c] !== "number");

  return (
    <div
      className="h-full rounded-[20px] border p-4 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: T.text }}>
            Filters
          </h2>
          <p className="text-sm" style={{ color: T.dim }}>
            Global report filters
          </p>
        </div>

        <button
          onClick={clearGlobalFilters}
          className="rounded-xl border px-3 py-2 text-sm transition"
          style={{
            borderColor: T.border,
            background: T.s2,
            color: T.dim,
          }}
        >
          Clear all
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
        {filterableFields.map((field) => {
          const values = getUniqueValues(rawData, field);

          return (
            <div key={field}>
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: T.text }}
              >
                {field}
              </label>

              <select
                value={filters[field] ?? ""}
                onChange={(e) => setGlobalFilter(field, e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{
                  background: T.s2,
                  borderColor: T.border,
                  color: T.text,
                }}
              >
                <option value="">All</option>
                {values.map((v) => (
                  <option key={String(v)} value={v}>
                    {String(v)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
