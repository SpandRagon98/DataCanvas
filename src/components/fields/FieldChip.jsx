export default function FieldChip({ field, type }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('fieldName', field)
  }

  const typeIcon = {
    string: 'Aa',
    number: '123',
    date: '📅',
    boolean: '✓',
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex cursor-grab items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-slate-300 active:cursor-grabbing"
    >
      <span className="truncate">{field}</span>
      <span className="ml-3 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        {typeIcon[type] || 'Aa'}
      </span>
    </div>
  )
}
