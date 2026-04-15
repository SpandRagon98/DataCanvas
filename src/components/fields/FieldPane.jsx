import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import FieldChip from './FieldChip'

export default function FieldPane() {
  const columns = useStore((s) => s.columns)
  const dataTypes = useStore((s) => s.dataTypes)
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => columns.filter((c) => c.toLowerCase().includes(search.toLowerCase())),
    [columns, search],
  )

  const dimensions = filtered.filter((f) => dataTypes[f] !== 'number')
  const measures = filtered.filter((f) => dataTypes[f] === 'number')

  return (
    <div className="h-full w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Fields</h2>
        <p className="text-sm text-slate-500">Search and drag fields into builder zones</p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search fields..."
        className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
      />

      <div className="max-h-[calc(100vh-220px)] space-y-6 overflow-y-auto pr-1">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Dimensions</h3>
          <div className="space-y-2">
            {dimensions.map((field) => (
              <FieldChip key={field} field={field} type={dataTypes[field]} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Measures</h3>
          <div className="space-y-2">
            {measures.map((field) => (
              <FieldChip key={field} field={field} type={dataTypes[field]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
