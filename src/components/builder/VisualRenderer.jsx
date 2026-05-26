import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, XAxis, YAxis, Legend, CartesianGrid,
} from "recharts";
import { useMemo } from "react";
import { applyGlobalFilters } from "../../utils/filterEngine";
import { buildVisualData, getLegendKeys } from "../../utils/chartEngine";
import { CHART_COLORS, useTheme } from "../../styles/theme";

export default function VisualRenderer({ visual, rawData, filters, compact = false }) {
  const T = useTheme();

  const filteredRows = useMemo(
    () => applyGlobalFilters(rawData, filters),
    [rawData, filters]
  );

  const chartData = useMemo(
    () =>
      buildVisualData({
        rows: filteredRows,
        xFields: visual.xFields,
        yFields: visual.yFields,
        legendField: visual.legendField,
        aggregation: visual.aggregation,
        sortDirection: visual.sortDirection,
      }),
    [filteredRows, visual]
  );

  const legendKeys = getLegendKeys(chartData);
  const chartHeight = compact ? "100%" : 320;
  const minChartHeight = compact ? 240 : 320;

  const tooltipStyle = {
    contentStyle: {
      background: T.s2,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      color: T.text,
      fontSize: 12,
    },
  };

  const axisStyle = {
    tick: { fill: T.dim, fontSize: compact ? 10 : 11 },
    stroke: T.border,
  };

  const emptyState = (
    <div
      className="flex items-center justify-center rounded-2xl border border-dashed text-sm"
      style={{
        borderColor: T.border,
        background: T.s2,
        color: T.dim,
        height: compact ? "100%" : 260,
        minHeight: compact ? 220 : 260,
      }}
    >
      Assign X and Y fields to render the visual
    </div>
  );

  if (!visual.xFields?.length || !visual.yFields?.length) return emptyState;

  if (!chartData.length && visual.chartType !== "kpi" && visual.chartType !== "table" && visual.chartType !== "scatter") {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed text-sm"
        style={{
          borderColor: T.border,
          background: T.s2,
          color: T.dim,
          height: compact ? "100%" : 260,
          minHeight: compact ? 220 : 260,
        }}
      >
        No chart data available for this selection
      </div>
    );
  }

  // ── Table ──
  if (visual.chartType === "table") {
    return (
      <div
        className="overflow-auto rounded-2xl border"
        style={{ borderColor: T.border, height: compact ? "100%" : 320, minHeight: compact ? 220 : 320 }}
      >
        <table className="min-w-full text-sm">
          <thead style={{ background: T.s2 }}>
            <tr>
              {chartData[0] &&
                Object.keys(chartData[0]).map((key) => (
                  <th key={key} className="border-b px-4 py-3 text-left font-semibold" style={{ borderColor: T.border, color: T.text }}>
                    {key}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? T.surface : T.s2 }}>
                {Object.values(row).map((val, i) => (
                  <td key={i} className="border-b px-4 py-3" style={{ borderColor: T.border, color: T.dim }}>
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── KPI ──
  if (visual.chartType === "kpi") {
    const total = chartData.reduce(
      (sum, item) =>
        sum + Object.keys(item).filter((k) => k !== "x").reduce((s, k) => s + Number(item[k] || 0), 0),
      0
    );
    return (
      <div
        className="flex flex-col justify-center rounded-3xl border p-8"
        style={{ background: T.s2, borderColor: T.border, height: compact ? "100%" : 260, minHeight: compact ? 220 : 260 }}
      >
        <div className="text-sm" style={{ color: T.dim }}>{visual.yFields?.join(", ")}</div>
        <div className="mt-2 text-4xl font-bold tracking-tight" style={{ color: T.text }}>
          {total.toLocaleString()}
        </div>
        <div className="mt-2 text-sm" style={{ color: T.muted }}>Aggregation: {visual.aggregation}</div>
      </div>
    );
  }

  // ── Pie / Donut ──
  if (visual.chartType === "pie" || visual.chartType === "donut") {
    const pieKey = legendKeys[0] || visual.yFields?.[0];
    const pieData = chartData.map((d) => ({ name: d.x, value: Number(d[pieKey] || 0) }));
    return (
      <div style={{ height: chartHeight, minHeight: minChartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius={compact ? 80 : 110}
              innerRadius={visual.chartType === "donut" ? (compact ? 40 : 60) : 0}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Scatter ──
  if (visual.chartType === "scatter") {
    return (
      <div style={{ height: chartHeight, minHeight: minChartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" name={visual.xFields[0]} type="number" {...axisStyle} />
            <YAxis dataKey="y" type="number" {...axisStyle} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            {visual.yFields.map((yField, i) => (
              <Scatter
                key={yField}
                name={yField}
                data={filteredRows.map((row) => ({
                  x: Number(row[visual.xFields[0]] ?? 0),
                  y: Number(row[yField] ?? 0),
                }))}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Radar ──
  if (visual.chartType === "radar") {
    const radarData = chartData.map((d) => ({ subject: d.x, ...d }));
    return (
      <div style={{ height: chartHeight, minHeight: minChartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke={T.border} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: T.dim, fontSize: compact ? 10 : 11 }} />
            <PolarRadiusAxis tick={{ fill: T.dim, fontSize: 9 }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            {legendKeys.map((k, i) => (
              <Radar
                key={k}
                name={k}
                dataKey={k}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.25}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Line ──
  if (visual.chartType === "line") {
    return (
      <div style={{ height: chartHeight, minHeight: minChartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            {legendKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Area ──
  if (visual.chartType === "area") {
    return (
      <div style={{ height: chartHeight, minHeight: minChartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            {legendKeys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.18}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Bar (default, includes stackedBar) ──
  return (
    <div style={{ height: chartHeight, minHeight: minChartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
          <XAxis dataKey="x" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
          {legendKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              stackId={visual.chartType === "stackedBar" ? "a" : undefined}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
