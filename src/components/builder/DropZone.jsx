export default function DropZone({ label, value, onDropField }) {
  const handleDrop = (e) => {
    e.preventDefault()
    const field = e.dataTransfer.getData('fieldName')
    if (field) onDropField(field)
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="min-h-[72px] rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-slate-400"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-sm">
        {Array.isArray(value) ? (
          value.length ? (
            <div className="flex flex-wrap gap-2">
              {value.map((v) => (
                <span key={v} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-sm">
                  {v}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400">Drop field here</span>
          )
        ) : value ? (
          <span className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-sm">
            {value}
          </span>
        ) : (
          <span className="text-slate-400">Drop field here</span>
        )}
      </div>
    </div>
  )
}
