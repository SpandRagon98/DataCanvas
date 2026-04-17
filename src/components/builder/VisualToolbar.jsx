import { ChevronDown } from "lucide-react";
import { useTheme } from "../../styles/theme";

function StyledSelect({ value, onChange, children, ariaLabel, T }) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none"
        style={{
          borderColor: T.border,
          background: T.s2,
          color: T.text,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.01)",
          backgroundImage: "none",
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: T.dim }}
      />
    </div>
  );
}

export default function VisualToolbar({
  chartType,
  aggregation,
  sortDirection,
  onChange,
}) {
  const T = useTheme();

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <StyledSelect
        T={T}
        ariaLabel="Select chart type"
        value={chartType}
        onChange={(e) => onChange({ chartType: e.target.value })}
      >
        <option value="bar">Bar</option>
        <option value="stackedBar">Stacked Bar</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
        <option value="pie">Pie</option>
        <option value="donut">Donut</option>
        <option value="table">Table</option>
        <option value="kpi">KPI</option>
      </StyledSelect>

      <StyledSelect
        T={T}
        ariaLabel="Select aggregation"
        value={aggregation}
        onChange={(e) => onChange({ aggregation: e.target.value })}
      >
        <option value="sum">Sum</option>
        <option value="avg">Average</option>
        <option value="count">Count</option>
        <option value="distinctCount">Distinct Count</option>
        <option value="min">Min</option>
        <option value="max">Max</option>
      </StyledSelect>

      <StyledSelect
        T={T}
        ariaLabel="Select sort direction"
        value={sortDirection}
        onChange={(e) => onChange({ sortDirection: e.target.value })}
      >
        <option value="asc">Sort Asc</option>
        <option value="desc">Sort Desc</option>
      </StyledSelect>
    </div>
  );
}
