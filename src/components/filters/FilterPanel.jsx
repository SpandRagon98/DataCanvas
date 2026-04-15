import { useStore } from '../../store/useStore'
import { getUniqueValues } from '../../utils/filterEngine'

export default function FilterPanel() {
  const rawData = useStore((s) => s.rawData)
  const columns = useStore((s) => s.columns)
  const dataTypes = useStore((s) => s.dataTypes)
  const filters = useStore((s) => s.filters)
  const setGlobalFilter = useStore((s) => s.setGlobalFilter)
  const clearGlobalFilters = useStore((s) => s.clearGlobalFilters)

  const filterableFields = columns.filter((c) => dataTypes[c] !== 'number')

  return (
    <div className="h-full rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Filters</h2>
          <p className="text-sm text-slate-500">Global report filters</p>
        </div>
        <button
          onClick={clearGlobalFilters}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Clear all
        </button>
      </div>

      <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-1">
        {filterableFields.map((field) => {
          const values = getUniqueValues(rawData, field)

          return (
            <div key={field}>
              <label className="mb-1 block text-sm font-medium text-slate-700">{field}</label>
              <select
                value={filters[field] ?? ''}
                onChange={(e) => setGlobalFilter(field, e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                {values.map((v) => (
                  <option key={String(v)} value={v}>
                    {String(v)}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
