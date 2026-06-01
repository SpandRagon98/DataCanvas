/**
 * MetricVisual — renders a metric item on the dashboard as an editable table
 * (input metrics) or a chart (bar/column/line/table). Mirrors the visual-tile
 * chrome so it supports move/resize/delete/select like other dashboard items.
 *
 * Exports:
 *   default MetricVisual  — full tile (edit mode)
 *   MetricBody            — content only (used by presentation mode)
 */

import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Trash2, GripVertical, AlertCircle } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";
import { getPalette } from "../../styles/theme";
import { computeAllMetrics, buildGrid, metricChartData } from "../../utils/metricsEngine";

function fmtNum(v, dataType) {
  if (v === undefined || v === null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (dataType === "percent")  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ── Content (no chrome) ───────────────────────────────────────────────────────
export function MetricBody({ item, T, readOnly = false }) {
  const metrics          = useStore((s) => s.metrics);
  const setMetricCellValue = useStore((s) => s.setMetricCellValue);
  const palette          = getPalette(item.visualConfig?.colorPalette);

  const metric = metrics.find((m) => m.id === item.metricId) || null;

  const { values, cycle } = useMemo(() => {
    if (!metric) return { values: {}, cycle: null };
    const { valuesById, cycle } = computeAllMetrics(metrics);
    return { values: valuesById[metric.id] || {}, cycle };
  }, [metrics, metric]);

  const grid = useMemo(
    () => (metric ? buildGrid(metric.dimensions || [], metric.membersByDim || {}) : null),
    [metric]
  );

  if (!metric) {
    return (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: T.muted }}>
        <AlertCircle size={14} className="mr-1.5" /> Metric not found
      </div>
    );
  }

  const inCycle = cycle && cycle.includes(metric.name);
  const editable = !readOnly && !metric.isCalculated;
  const displayAs = item.displayAs || "table";
  const chartType = item.chartType || "bar";

  if (inCycle) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-xs" style={{ color: "#ef4444" }}>
        <div>
          <AlertCircle size={16} className="mx-auto mb-1" />
          Circular reference: {cycle.join(" → ")}
        </div>
      </div>
    );
  }

  // ── Chart display ──
  if (displayAs === "chart") {
    const data = metricChartData(metric, values);
    if (!data.length) {
      return <div className="flex h-full items-center justify-center text-xs" style={{ color: T.muted }}>No data</div>;
    }
    const axisStyle = { tick: { fill: T.dim, fontSize: 11 }, stroke: T.border };
    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={(v) => fmtNum(v, metric.dataType)} />
            <Tooltip contentStyle={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12 }}
              formatter={(v) => [fmtNum(v, metric.dataType), metric.name]} />
            <Line type="monotone" dataKey="value" stroke={palette[0]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    // bar (horizontal) or column (vertical)
    const horizontal = chartType === "bar";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
          {horizontal ? (
            <>
              <XAxis type="number" {...axisStyle} tickFormatter={(v) => fmtNum(v, metric.dataType)} />
              <YAxis type="category" dataKey="x" {...axisStyle} width={90} />
            </>
          ) : (
            <>
              <XAxis dataKey="x" {...axisStyle} />
              <YAxis {...axisStyle} tickFormatter={(v) => fmtNum(v, metric.dataType)} />
            </>
          )}
          <Tooltip contentStyle={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12 }}
            formatter={(v) => [fmtNum(v, metric.dataType), metric.name]} />
          <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Table display ──
  const thBase = { background: T.s2, borderColor: T.border, color: T.muted };
  return (
    <div className="h-full overflow-auto">
      <table className="border-collapse text-xs" style={{ color: T.text }}>
        <thead>
          <tr>
            <th className="border px-2.5 py-1 text-left font-semibold sticky top-0 left-0 z-10"
              style={{ ...thBase, position: "sticky" }}>
              {grid.rowDims.join(" / ") || metric.name}
            </th>
            {grid.columns.map((c) => (
              <th key={c} className="border px-2.5 py-1 text-right font-semibold whitespace-nowrap sticky top-0"
                style={{ ...thBase, position: "sticky" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, ri) => (
            <tr key={ri}>
              <td className="border px-2.5 py-1 font-medium whitespace-nowrap sticky left-0"
                style={{ background: T.surface, borderColor: T.border, color: T.text, position: "sticky" }}>
                {row.label}
              </td>
              {grid.columns.map((col, ci) => {
                const key = grid.cellKey(row.members, col);
                const v = values[key];
                if (editable) {
                  return (
                    <td key={ci} className="border p-0" style={{ borderColor: T.border }}>
                      <input
                        defaultValue={v === undefined ? "" : v}
                        onBlur={(e) => setMetricCellValue(metric.id, key, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        inputMode="decimal"
                        className="w-full bg-transparent px-2 py-1 text-right text-xs outline-none tabular-nums focus:bg-black/5"
                        style={{ color: T.text, minWidth: 64 }}
                      />
                    </td>
                  );
                }
                return (
                  <td key={ci} className="border px-2.5 py-1 text-right tabular-nums" style={{ borderColor: T.border }}>
                    {fmtNum(v, metric.dataType)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Full tile (edit mode) ─────────────────────────────────────────────────────
export default function MetricVisual({
  item, dashboardId, isSelected, onSelect, onBeginMove, onBeginResize, onRemove, T: passedT,
}) {
  const themeT = useTheme();
  const T = passedT || themeT;
  const metrics = useStore((s) => s.metrics);
  const metric  = metrics.find((m) => m.id === item.metricId);
  const ts = item.tileStyle || {};
  const borderOn = ts.borderEnabled !== false;
  const title = item.name || metric?.name || "Metric";

  return (
    <div
      className="absolute group dc-dash-tile"
      style={{
        left: item.layout.x, top: item.layout.y, width: item.layout.w, height: item.layout.h,
        borderRadius: ts.borderRadius ?? 12,
        border: `${borderOn ? (ts.borderWidth ?? 1) : 0}px solid ${borderOn ? (ts.borderColor || T.border) : "transparent"}`,
        background: ts.bgColor || T.surface,
        boxShadow: isSelected
          ? `0 0 0 2px ${T.accent}, 0 8px 28px rgba(0,0,0,0.16)`
          : ts.shadow !== false ? "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)" : "none",
        opacity: ts.transparency ?? 1,
        zIndex: isSelected ? 5 : 2, overflow: "hidden",
        display: "flex", flexDirection: "column",
        transition: "box-shadow 160ms ease, transform 160ms ease",
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 cursor-move items-center gap-1.5 px-3"
        style={{ height: 38, borderBottom: `1px solid ${borderOn ? (ts.borderColor || T.border) : T.border}`,
          background: "linear-gradient(180deg, rgba(127,127,127,0.04), transparent)" }}
        onMouseDown={(e) => onBeginMove(e)}
      >
        <GripVertical size={13} className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: T.muted }} />
        <div className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize: ts.titleSize ?? 13, color: ts.titleColor || T.text }}>
          {title}
          {metric && (
            <span className="ml-1.5 text-[9px] font-normal rounded px-1 py-0.5" style={{ background: T.s3, color: T.muted }}>
              {metric.isCalculated ? "calc" : "input"} · {item.displayAs || "table"}
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Remove metric"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition opacity-0 group-hover:opacity-100"
          style={{ color: T.muted }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.muted; }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0" style={{ padding: ts.padding ?? 8 }}>
        <MetricBody item={item} T={T} />
      </div>

      {/* Resize handle */}
      <button
        className={`absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm transition-opacity ${isSelected ? "opacity-70" : "opacity-0 group-hover:opacity-60"}`}
        style={{ borderRight: `2px solid ${T.accent}`, borderBottom: `2px solid ${T.accent}` }}
        onMouseDown={(e) => { e.stopPropagation(); onBeginResize(e); }}
        title="Resize"
      />
    </div>
  );
}
