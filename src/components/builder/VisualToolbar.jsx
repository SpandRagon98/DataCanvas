export default function VisualToolbar({
  chartType,
  aggregation,
  sortDirection,
  onChange,
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <select
        value={chartType}
        onChange={(e) => onChange({ chartType: e.target.value })}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
      >
        <option value="bar">Bar</option>
        <option value="stackedBar">Stacked Bar</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
        <option value="pie">Pie</option>
        <option value="donut">Donut</option>
        <option value="table">Table</option>
        <option value="kpi">KPI</option>
      </select>

      <select
        value={aggregation}
        onChange={(e) => onChange({ aggregation: e.target.value })}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
      >
        <option value="sum">Sum</option>
        <option value="avg">Average</option>
        <option value="count">Count</option>
        <option value="distinctCount">Distinct Count</option>
        <option value="min">Min</option>
        <option value="max">Max</option>
      </select>

      <select
        value={sortDirection}
        onChange={(e) => onChange({ sortDirection: e.target.value })}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
      >
        <option value="asc">Sort Asc</option>
        <option value="desc">Sort Desc</option>
      </select>
    </div>
  );
}
