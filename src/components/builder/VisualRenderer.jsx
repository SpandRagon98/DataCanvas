import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  FunnelChart, Funnel, LabelList,
  Treemap,
  RadialBarChart, RadialBar,
  ReferenceLine,
  Tooltip, XAxis, YAxis, Legend, CartesianGrid,
} from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyGlobalFilters }                   from "../../utils/filterEngine";
import {
  getLegendKeys, applyRunningTotal,
  buildWaterfallData, pearsonCorr,
}                                               from "../../utils/chartEngine";
import { getPalette, useTheme }                 from "../../styles/theme";
import { useVisualData }                        from "../../hooks/useVisualData";
import { useComputeWorker, WORKER_THRESHOLD }   from "../../hooks/useComputeWorker";

// ── Helpers ────────────────────────────────────────────────────────────────

const applyCrossFilter = (rows, crossFilter) => {
  if (!crossFilter || !Object.keys(crossFilter).length) return rows;
  return rows.filter((row) =>
    Object.entries(crossFilter).every(
      ([field, value]) => String(row[field] ?? "") === String(value)
    )
  );
};

const evalRule = (entry, rule) => {
  const val       = Number(entry[rule.field]);
  const threshold = Number(rule.threshold);
  if (isNaN(val) || isNaN(threshold)) return false;
  switch (rule.operator) {
    case ">":  return val >  threshold;
    case "<":  return val <  threshold;
    case ">=": return val >= threshold;
    case "<=": return val <= threshold;
    case "==": return val === threshold;
    default:   return false;
  }
};

const getCellColor = (entry, defaultColor, rules) => {
  if (!rules?.length) return defaultColor;
  for (const rule of rules) if (evalRule(entry, rule)) return rule.color || defaultColor;
  return defaultColor;
};

const corrColor = (r) => {
  const c = Math.max(-1, Math.min(1, r));
  if (c >= 0) {
    const t = c;
    return `rgb(${Math.round(245*t+255*(1-t))},${Math.round(158*t+255*(1-t))},${Math.round(11*t+255*(1-t))})`;
  } else {
    const t = -c;
    return `rgb(${Math.round(96*t+255*(1-t))},${Math.round(165*t+255*(1-t))},${Math.round(250*t+255*(1-t))})`;
  }
};

const computeTrendlineSync = (data, yKey) => {
  const n = data.length;
  if (n < 2) return data;
  const ys = data.map((d) => Number(d[yKey] || 0));
  const xs = data.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x)    => s + Math.pow(x - xMean, 2), 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return data.map((d, i) => ({ ...d, _trend: slope * i + intercept }));
};

// ── Loading overlay ────────────────────────────────────────────────────────

function LoadingOverlay({ T }) {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-xl text-xs"
      style={{ background: T.s2, color: T.muted, height: "100%", minHeight: 120 }}
    >
      <span
        className="h-3 w-3 rounded-full border-2 animate-spin"
        style={{ borderColor: T.accent, borderTopColor: "transparent" }}
      />
      Computing (DuckDB)…
    </div>
  );
}

// ── VisualRenderer ──────────────────────────────────────────────────────────

export default function VisualRenderer({
  visual,
  rawData,
  filters,
  compact     = false,
  crossFilter = {},
  onCrossFilter,
}) {
  const T       = useTheme();
  const palette = getPalette(visual.colorPalette);
  const { sendRequest } = useComputeWorker();

  // ── Phase 6.1 — DuckDB-backed async data for large datasets ──
  const { baseChartData: _baseChartData, filteredRows, loading: dbLoading } =
    useVisualData({ visual, rawData, filters, crossFilter });

  // ── Phase 6.2 — Web Worker for post-processing (running total, trendline) ──
  const [processedData, setProcessedData] = useState(null);
  const abortRef = useRef(0);
  const isLargePostProcess = rawData?.length >= WORKER_THRESHOLD;

  useEffect(() => {
    const needsProcessing = visual.showRunningTotal || visual.showTrendline;
    if (!needsProcessing || !_baseChartData?.length) {
      setProcessedData(null);
      return;
    }

    const reqId = ++abortRef.current;

    if (isLargePostProcess) {
      // Offload to Web Worker
      (async () => {
        try {
          let data = _baseChartData;
          if (visual.showRunningTotal) {
            const res = await sendRequest("RUNNING_TOTAL", { chartData: data });
            if (reqId !== abortRef.current) return;
            data = res.chartData;
          }
          if (visual.showTrendline) {
            const yKey = getLegendKeys(data)[0];
            if (yKey) {
              const res = await sendRequest("TRENDLINE", { chartData: data, yKey });
              if (reqId !== abortRef.current) return;
              data = res.chartData;
            }
          }
          if (reqId === abortRef.current) setProcessedData(data);
        } catch {
          // Worker failed — fall through to sync path below
          if (reqId === abortRef.current) setProcessedData(null);
        }
      })();
    } else {
      // Sync post-processing for small datasets
      let data = visual.showRunningTotal
        ? applyRunningTotal(_baseChartData, getLegendKeys(_baseChartData))
        : _baseChartData;
      const firstKey = getLegendKeys(data)[0];
      if (visual.showTrendline && firstKey) data = computeTrendlineSync(data, firstKey);
      setProcessedData(data);
    }

    return () => { abortRef.current = reqId + 1; };
  }, [_baseChartData, visual.showRunningTotal, visual.showTrendline, isLargePostProcess]);

  const chartData    = processedData ?? _baseChartData;
  const legendKeys   = getLegendKeys(_baseChartData); // base keys (no _trend)
  const chartHeight  = compact ? "100%" : 320;
  const minChartH    = compact ? 240 : 320;
  const conditionalRules = visual.conditionalRules || [];
  const referenceLines   = visual.referenceLines   || [];

  const tooltipStyle = {
    contentStyle: {
      background: T.s2, border: `1px solid ${T.border}`,
      borderRadius: 8, color: T.text, fontSize: 12,
    },
  };
  const axisStyle = {
    tick: { fill: T.dim, fontSize: compact ? 10 : 11 },
    stroke: T.border,
  };

  const emptyState = (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed text-sm"
      style={{
        borderColor: T.border, background: T.s2, color: T.dim,
        height: compact ? "100%" : 260, minHeight: compact ? 220 : 260,
      }}
    >
      Assign X and Y fields to render the visual
    </div>
  );

  if (!visual.xFields?.length || !visual.yFields?.length) return emptyState;

  if (dbLoading) return <LoadingOverlay T={T} />;

  if (
    !chartData.length &&
    visual.chartType !== "kpi"  &&
    visual.chartType !== "table" &&
    visual.chartType !== "scatter" &&
    visual.chartType !== "correlation"
  ) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed text-sm"
        style={{
          borderColor: T.border, background: T.s2, color: T.dim,
          height: compact ? "100%" : 260, minHeight: compact ? 220 : 260,
        }}
      >
        No chart data available for this selection
      </div>
    );
  }

  const trendLine = visual.showTrendline ? (
    <Line key="_trend" dataKey="_trend" stroke={T.dim} strokeDasharray="5 3"
      strokeWidth={1.5} dot={false} activeDot={false} legendType="none" name="Trend" />
  ) : null;

  // ── Table ──
  if (visual.chartType === "table") {
    const allKeys = chartData.length > 0 ? Object.keys(chartData[0]) : [];
    const totals  = {};
    allKeys.forEach((k) => {
      const vals   = chartData.map((r) => r[k]);
      const allNum = vals.every((v) => typeof v === "number");
      totals[k] = allNum ? vals.reduce((a, b) => a + b, 0) : k === "x" ? "Totals" : "—";
    });
    return (
      <div className="overflow-auto rounded-xl border"
        style={{ borderColor: T.border, height: compact ? "100%" : 320, minHeight: compact ? 220 : 320 }}>
        <table className="min-w-full text-sm">
          <thead style={{ background: T.s2 }}>
            <tr>
              {allKeys.map((key) => (
                <th key={key} className="border-b px-4 py-3 text-left font-semibold"
                  style={{ borderColor: T.border, color: T.text }}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? T.surface : T.s2 }}>
                {allKeys.map((key, i) => (
                  <td key={i} className="border-b px-4 py-3" style={{ borderColor: T.border, color: T.dim }}>
                    {typeof row[key] === "number" ? row[key].toLocaleString() : row[key]}
                  </td>
                ))}
              </tr>
            ))}
            {chartData.length > 0 && (
              <tr style={{ background: T.s3 }}>
                {allKeys.map((key, i) => (
                  <td key={i} className="border-b px-4 py-3 font-semibold"
                    style={{ borderColor: T.border, color: T.text }}>
                    {typeof totals[key] === "number" ? totals[key].toLocaleString() : totals[key]}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // ── KPI ──
  if (visual.chartType === "kpi") {
    const total = chartData.reduce(
      (sum, item) => sum + Object.keys(item).filter((k) => k !== "x")
        .reduce((s, k) => s + Number(item[k] || 0), 0),
      0
    );
    const sparkKey  = legendKeys[0];
    const sparkData = sparkKey ? chartData.map((d) => ({ x: d.x, v: Number(d[sparkKey] || 0) })) : [];
    const showSpark = !compact && sparkData.length > 1;
    return (
      <div className="flex flex-col justify-center rounded-3xl border p-8"
        style={{ background: T.s2, borderColor: T.border, height: compact ? "100%" : "auto", minHeight: compact ? 220 : 180 }}>
        <div className="text-sm" style={{ color: T.dim }}>{visual.yFields?.join(", ")}</div>
        <div className="mt-2 text-4xl font-bold tracking-tight" style={{ color: T.text }}>
          {total.toLocaleString()}
        </div>
        <div className="mt-1 text-sm" style={{ color: T.muted }}>Aggregation: {visual.aggregation}</div>
        {showSpark && (
          <div style={{ height: 64, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="v" stroke={palette[0]} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // ── Waterfall ──
  if (visual.chartType === "waterfall") {
    const yKey = legendKeys[0] || visual.yFields?.[0];
    const waterfallData = buildWaterfallData(chartData, yKey);
    return (
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={waterfallData}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle}
              formatter={(_, __, props) => [props?.payload?._origVal?.toLocaleString() ?? "", yKey]} />
            <Bar dataKey="_phantom" stackId="wf" fill="transparent" legendType="none" />
            <Bar dataKey="_value" stackId="wf" radius={[4,4,0,0]}
              onClick={(data) => onCrossFilter && onCrossFilter(visual.xFields[0], data.x)}
              style={{ cursor: onCrossFilter ? "pointer" : "default" }}>
              {waterfallData.map((entry, i) => (
                <Cell key={i} fill={entry._positive ? T.success : T.error} />
              ))}
            </Bar>
            {referenceLines.map((rl, i) => (
              <ReferenceLine key={i} y={rl.value} stroke={rl.color||T.accent} strokeDasharray="4 3"
                label={{ value: rl.label||"", fill: rl.color||T.accent, fontSize: 11 }} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Funnel ──
  if (visual.chartType === "funnel") {
    const yKey = legendKeys[0] || visual.yFields?.[0];
    const funnelData = chartData
      .map((d, i) => ({ value: Math.max(0, Number(d[yKey]||0)), name: d.x, fill: palette[i%palette.length] }))
      .sort((a, b) => b.value - a.value);
    return (
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart>
            <Tooltip {...tooltipStyle} />
            <Funnel dataKey="value" data={funnelData} isAnimationActive>
              <LabelList position="center" fill={T.text} stroke="none" dataKey="name"
                style={{ fontSize: compact ? 10 : 12 }} />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Treemap ──
  if (visual.chartType === "treemap") {
    const yKey = legendKeys[0] || visual.yFields?.[0];
    const tmData = chartData.map((d, i) => ({
      name: d.x, size: Math.max(0, Number(d[yKey]||0)), fill: palette[i%palette.length],
    }));
    const TreemapContent = ({ x, y, width, height, name, fill }) => {
      if (width < 20 || height < 20) return null;
      return (
        <g>
          <rect x={x} y={y} width={width} height={height} fill={fill} stroke={T.bg} strokeWidth={2} rx={4} />
          {height > 28 && (
            <text x={x+width/2} y={y+height/2} textAnchor="middle" dominantBaseline="middle"
              fill="#000" fontSize={compact?10:12} fontWeight={600}>{name}</text>
          )}
        </g>
      );
    };
    return (
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={tmData} dataKey="size" nameKey="name" aspectRatio={4/3} content={<TreemapContent />}>
            <Tooltip {...tooltipStyle} formatter={(v) => [v.toLocaleString(), yKey]} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Gauge (RadialBar) ──
  if (visual.chartType === "gauge") {
    const gaugeData = visual.yFields.map((yField, i) => ({
      name: yField,
      value: Math.round(chartData.reduce((s, d) => s + Number(d[yField]||0), 0)),
      fill: palette[i%palette.length],
    }));
    return (
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={gaugeData} innerRadius="30%" outerRadius="90%"
            startAngle={200} endAngle={-20} barSize={compact?14:18}>
            <RadialBar dataKey="value" background={{ fill: T.s2 }}
              label={{ position: "insideStart", fill: T.text, fontSize: compact?9:11 }} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            <Tooltip {...tooltipStyle} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Correlation Matrix ──
  if (visual.chartType === "correlation") {
    const numFields = visual.yFields.filter((f) =>
      filteredRows.map((r) => Number(r[f])).filter((v) => !isNaN(v)).length > 0
    );
    if (numFields.length < 2) {
      return (
        <div className="flex items-center justify-center rounded-xl border border-dashed text-sm"
          style={{ borderColor: T.border, background: T.s2, color: T.dim,
            height: compact?"100%":260, minHeight: compact?220:260 }}>
          Assign 2+ numeric Y fields for a correlation matrix
        </div>
      );
    }
    const matrix = numFields.map((fA) => {
      const xsA = filteredRows.map((r) => Number(r[fA])).filter((v) => !isNaN(v));
      return numFields.map((fB) => {
        const xsB = filteredRows.map((r) => Number(r[fB])).filter((v) => !isNaN(v));
        const len = Math.min(xsA.length, xsB.length);
        return pearsonCorr(xsA.slice(0, len), xsB.slice(0, len));
      });
    });
    const cs = compact ? 40 : 56;
    return (
      <div style={{ height: compact?"100%":320, minHeight: compact?220:320, overflow: "auto" }}>
        <table className="border-collapse text-center text-xs" style={{ color: T.text }}>
          <thead>
            <tr>
              <th className="p-2" style={{ color: T.muted }} />
              {numFields.map((f) => (
                <th key={f} className="p-2 font-semibold" style={{ color: T.dim }}>
                  {f.length > 8 ? f.slice(0, 7) + "…" : f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, ri) => (
              <tr key={ri}>
                <td className="pr-3 text-right font-semibold" style={{ color: T.dim }}>
                  {numFields[ri].length > 8 ? numFields[ri].slice(0, 7) + "…" : numFields[ri]}
                </td>
                {row.map((corr, ci) => (
                  <td key={ci} style={{ width: cs, height: cs, background: corrColor(corr),
                    color: "#000", fontWeight: 600, borderRadius: 4, border: `2px solid ${T.bg}` }}
                    title={`${numFields[ri]} vs ${numFields[ci]}: ${corr.toFixed(4)}`}>
                    {corr.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Pie / Donut ──
  if (visual.chartType === "pie" || visual.chartType === "donut") {
    const pieKey  = legendKeys[0] || visual.yFields?.[0];
    const pieData = chartData.map((d) => ({ name: d.x, value: Number(d[pieKey]||0) }));
    return (
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            <Pie data={pieData} dataKey="value" nameKey="name"
              outerRadius={compact?80:110}
              innerRadius={visual.chartType==="donut"?(compact?40:60):0}
              onClick={(entry) => onCrossFilter && onCrossFilter(visual.xFields[0], entry.name)}
              style={{ cursor: onCrossFilter?"pointer":"default" }}>
              {pieData.map((_, i) => <Cell key={i} fill={palette[i%palette.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Scatter ──
  if (visual.chartType === "scatter") {
    return (
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" name={visual.xFields[0]} type="number" {...axisStyle} />
            <YAxis dataKey="y" type="number" {...axisStyle} />
            <Tooltip cursor={{ strokeDasharray:"3 3" }} {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            {visual.yFields.map((yField, i) => (
              <Scatter key={yField} name={yField}
                data={filteredRows.map((row) => ({
                  x: Number(row[visual.xFields[0]]??0),
                  y: Number(row[yField]??0),
                }))}
                fill={palette[i%palette.length]} />
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
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke={T.border} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: T.dim, fontSize: compact?10:11 }} />
            <PolarRadiusAxis tick={{ fill: T.dim, fontSize: 9 }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            {legendKeys.map((k, i) => (
              <Radar key={k} name={k} dataKey={k}
                stroke={palette[i%palette.length]} fill={palette[i%palette.length]} fillOpacity={0.25} />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Line ──
  if (visual.chartType === "line") {
    return (
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            {legendKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={palette[i%palette.length]}
                strokeWidth={2} dot={false} />
            ))}
            {trendLine}
            {referenceLines.map((rl, i) => (
              <ReferenceLine key={i} y={rl.value} stroke={rl.color||T.accent} strokeDasharray="4 3"
                label={{ value: rl.label||"", fill: rl.color||T.accent, fontSize: 11 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Area ──
  if (visual.chartType === "area") {
    return (
      <div style={{ height: chartHeight, minHeight: minChartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="x" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
            {legendKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k}
                stroke={palette[i%palette.length]} fill={palette[i%palette.length]} fillOpacity={0.18} />
            ))}
            {trendLine}
            {referenceLines.map((rl, i) => (
              <ReferenceLine key={i} y={rl.value} stroke={rl.color||T.accent} strokeDasharray="4 3"
                label={{ value: rl.label||"", fill: rl.color||T.accent, fontSize: 11 }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Bar (default + stackedBar) ──
  return (
    <div style={{ height: chartHeight, minHeight: minChartH }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
          <XAxis dataKey="x" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ color: T.dim, fontSize: 11 }} />
          {legendKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={palette[i%palette.length]}
              stackId={visual.chartType==="stackedBar"?"a":undefined}
              radius={[4,4,0,0]}
              onClick={(data) => onCrossFilter && onCrossFilter(visual.xFields[0], data.x)}
              style={{ cursor: onCrossFilter?"pointer":"default" }}>
              {conditionalRules.length > 0 && chartData.map((entry, idx) => (
                <Cell key={idx} fill={getCellColor(entry, palette[i%palette.length], conditionalRules)} />
              ))}
            </Bar>
          ))}
          {trendLine}
          {referenceLines.map((rl, i) => (
            <ReferenceLine key={i} y={rl.value} stroke={rl.color||T.accent} strokeDasharray="4 3"
              label={{ value: rl.label||"", fill: rl.color||T.accent, fontSize: 11 }} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
