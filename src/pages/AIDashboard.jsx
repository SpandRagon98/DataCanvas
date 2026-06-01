/**
 * AIDashboard — AI-powered dashboard generator.
 *
 * Mode 1 — "Do Your Own Thing":
 *   Sends dataset metadata to ChatGPT (via existing /api/ai endpoint).
 *   ChatGPT acts as a BI consultant and returns structured JSON:
 *     { dashboardTitle, kpis, visuals, filters }
 *   The response is parsed and converted into real dashboard items
 *   that appear immediately in the Dashboard tab.
 *
 * Mode 2 — "Customize":
 *   A clean, simple form: X axis + Y axis + aggregation + chart type + title.
 *   Clicking "Generate Chart" creates one visual and adds it to the
 *   active dashboard. No preview, no complexity.
 */

import {
  Wand2, Settings2, ArrowRight, Loader2, AlertCircle,
  Check, LayoutDashboard, Plus, ChevronDown, Database,
  BarChart3, Sparkles,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStore }          from "../store/useStore";
import { useEffectiveData }  from "../hooks/useEffectiveData";
import { useTheme }          from "../styles/theme";
import { analyzeSchema, buildSchemaPayload } from "../utils/schemaAnalyzer";
import { callAI, safeParseJSON, AI_ENABLED } from "../services/aiClient";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const uid = (p) =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const CHART_TYPES = [
  { value: "line",       label: "Line"        },
  { value: "bar",        label: "Bar"         },
  { value: "stackedBar", label: "Stacked Bar" },
  { value: "area",       label: "Area"        },
  { value: "pie",        label: "Pie"         },
  { value: "donut",      label: "Donut"       },
  { value: "kpi",        label: "KPI Card"    },
  { value: "table",      label: "Table"       },
  { value: "treemap",    label: "Treemap"     },
  { value: "scatter",    label: "Scatter"     },
];

const AGGREGATIONS = [
  { value: "sum",           label: "Sum"           },
  { value: "avg",           label: "Average"       },
  { value: "count",         label: "Count"         },
  { value: "distinctCount", label: "Distinct Count"},
  { value: "min",           label: "Min"           },
  { value: "max",           label: "Max"           },
];

// ── Layout helpers (converts AI spec → pixel positions) ──────────────────────

// ── Layout grid constants ─────────────────────────────────────────────────────
const PAD        = 24;   // outer padding
const GAP        = 16;   // gap between tiles
const CANVAS_W   = 1320; // target working width (fits a standard dashboard viewport)
const SLICER_W   = 200, SLICER_H = 48;
const KPI_H      = 116;
const CHART_H    = 320;

/**
 * Convert the AI JSON spec into dashboard items with an optimized,
 * non-overlapping executive layout:
 *
 *   ┌──────────────────────────────────────────┐
 *   │  [slicer] [slicer] [slicer]   ← filter bar │
 *   │  [ KPI ] [ KPI ] [ KPI ] [ KPI ]           │
 *   │  ┌──────────────┐ ┌──────────────┐         │
 *   │  │    chart      │ │    chart      │  ← grid│
 *   │  └──────────────┘ └──────────────┘         │
 *   └──────────────────────────────────────────┘
 *
 * Everything is placed by a running Y cursor so tiles never overlap.
 */
function aiResponseToItems(aiData) {
  const { kpis = [], visuals = [], filters = [] } = aiData;
  const items = [];
  const innerW = CANVAS_W - PAD * 2;
  let cursorY  = PAD;

  // ── 1. Filter bar (slicers) ──
  if (filters.length > 0) {
    const perRow = Math.max(1, Math.floor((innerW + GAP) / (SLICER_W + GAP)));
    filters.forEach((f, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      items.push({
        id:   uid("slicer"),
        type: "slicer",
        layout: {
          x: PAD + col * (SLICER_W + GAP),
          y: cursorY + row * (SLICER_H + GAP),
          w: SLICER_W, h: SLICER_H, minW: 120, minH: 40,
        },
        slicerConfig: { column: f.column, label: f.label || f.column, mode: "dropdown", multiSelect: false },
        selectedValues: [],
      });
    });
    const slicerRows = Math.ceil(filters.length / perRow);
    cursorY += slicerRows * (SLICER_H + GAP) + GAP / 2;
  }

  // ── 2. KPI row(s) — evenly distribute across the full width ──
  if (kpis.length > 0) {
    const perRow = Math.min(kpis.length, Math.max(1, Math.floor((innerW + GAP) / (200 + GAP))));
    const kpiW   = Math.floor((innerW - (perRow - 1) * GAP) / perRow);
    kpis.forEach((kpi, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      items.push({
        id:   uid("v"),
        type: "visual",
        layout: {
          x: PAD + col * (kpiW + GAP),
          y: cursorY + row * (KPI_H + GAP),
          w: kpiW, h: KPI_H, minW: 120, minH: 80,
        },
        visualConfig: {
          id: uid("vc"), title: kpi.title || kpi.field, chartType: "kpi",
          xFields: [], yFields: [kpi.field], legendField: "", tooltipFields: [],
          aggregation: kpi.aggregation || "sum", sortDirection: "desc", filters: {},
          referenceLines: [], conditionalRules: [], colorPalette: "default",
          showGridlines: true, showLegend: false, showAxisLabels: true,
        },
      });
    });
    const kpiRows = Math.ceil(kpis.length / perRow);
    cursorY += kpiRows * (KPI_H + GAP);
  }

  // ── 3. Chart grid (2 columns; a lone chart spans full width) ──
  if (visuals.length > 0) {
    const cols      = visuals.length === 1 ? 1 : 2;
    const chartW    = Math.floor((innerW - (cols - 1) * GAP) / cols);
    visuals.forEach((vis, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      items.push({
        id:   uid("v"),
        type: "visual",
        layout: {
          x: PAD + col * (chartW + GAP),
          y: cursorY + row * (CHART_H + GAP),
          w: chartW, h: CHART_H, minW: 220, minH: 180,
        },
        visualConfig: {
          id: uid("vc"),
          title: vis.title || `${vis.yField} by ${vis.xField}`,
          chartType:   vis.chartType || "bar",
          xFields:     vis.xField ? [vis.xField] : [],
          yFields:     vis.yField ? [vis.yField] : [],
          legendField: "", tooltipFields: [],
          aggregation:   vis.aggregation || "sum",
          sortDirection: "desc", filters: {},
          referenceLines: [], conditionalRules: [], colorPalette: "default",
          showGridlines: true, showLegend: true, showAxisLabels: true,
          chartStyle: vis.chartType === "line" ? { lineSmooth: true, showMarkers: false, lineWidth: 2 } : undefined,
        },
      });
    });
  }

  return items;
}

// ── Step progress indicator ───────────────────────────────────────────────────

function StepRow({ step, label, status, T }) {
  // status: "pending" | "active" | "done" | "error"
  const colors = {
    pending: T.border,
    active:  T.accent,
    done:    "#22c55e",
    error:   "#ef4444",
  };
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold"
        style={{ background: colors[status] + "22", color: colors[status], border: `1.5px solid ${colors[status]}` }}
      >
        {status === "done"   ? <Check size={12} /> :
         status === "error"  ? <AlertCircle size={12} /> :
         status === "active" ? <Loader2 size={12} className="animate-spin" /> :
         step}
      </div>
      <span className="text-sm" style={{ color: status === "active" ? T.text : status === "done" ? "#22c55e" : T.muted }}>
        {label}
      </span>
    </div>
  );
}

// ── MODE 1: Do Your Own Thing ─────────────────────────────────────────────────

function DoYourOwnThing({ schema, T, onDeployed }) {
  const [phase,     setPhase]     = useState("idle"); // idle | collecting | thinking | building | done | error
  const [aiResult,  setAIResult]  = useState(null);
  const [errMsg,    setErrMsg]    = useState("");
  const [deployed,  setDeployed]  = useState(false);

  const steps = [
    { id: 1, label: "Collecting dataset metadata",     active: phase === "collecting" },
    { id: 2, label: "Sending to ChatGPT for analysis", active: phase === "thinking"   },
    { id: 3, label: "Building dashboard layout",       active: phase === "building"   },
    { id: 4, label: "Deploying to Dashboard tab",      active: phase === "done"       },
  ];

  const stepStatus = (id) => {
    const order = ["idle","collecting","thinking","building","done","error"];
    const cur   = order.indexOf(phase);
    if (phase === "error") return id < 4 ? "done" : "error";
    if (cur  < id)  return "pending";
    if (cur === id) return "active";
    return "done";
  };

  const run = useCallback(async () => {
    setPhase("collecting");
    setAIResult(null);
    setErrMsg("");
    setDeployed(false);

    try {
      // Build compact metadata payload — NO actual data rows
      const payload = {
        datasetName: schema.primaryDataset?.name || "Dataset",
        rowCount:    schema.rowCount,
        columns: [
          ...schema.measures,
          ...schema.dates,
          ...schema.dimensions,
          ...schema.booleans,
        ].map((m) => ({
          name:         m.name,
          dataType:     m.dataType,
          category:     m.category,
          cardinality:  m.cardinality,
          sampleValues: m.sampleValues.slice(0, 5),
        })),
      };

      setPhase("thinking");
      const rawResult = await callAI({ task: "dashboard_generation", payload });

      setPhase("building");
      const { ok, data, error } = safeParseJSON(rawResult);
      if (!ok) throw new Error(`ChatGPT returned invalid JSON: ${error}`);
      if (!data.visuals && !data.kpis) throw new Error("ChatGPT response missing required fields.");

      setAIResult(data);
      setPhase("done");
    } catch (err) {
      setErrMsg(err.message || "Unknown error");
      setPhase("error");
    }
  }, [schema]);

  const deploy = useCallback(() => {
    if (!aiResult) return;

    const items      = aiResponseToItems(aiResult);
    const dashName   = aiResult.dashboardTitle || `AI Dashboard — ${schema.primaryDataset?.name || "Data"}`;
    const newDash    = { id: uid("dash"), name: dashName, items, annotations: [] };

    useStore.setState((state) => ({
      dashboards:        [...state.dashboards, newDash],
      activeDashboardId: newDash.id,
    }));

    setDeployed(true);
    onDeployed();
  }, [aiResult, schema, onDeployed]);

  if (!AI_ENABLED) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full py-16 px-6">
        <AlertCircle size={36} style={{ color: T.muted }} />
        <div className="text-base font-semibold text-center" style={{ color: T.text }}>
          AI not configured
        </div>
        <div className="text-sm text-center max-w-sm" style={{ color: T.muted }}>
          Set <code className="rounded px-1 py-0.5 text-xs" style={{ background: T.s3 }}>OPENAI_API_KEY</code> in your Vercel environment variables to enable ChatGPT-powered dashboard generation.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full px-6 py-8">

      {/* Schema pill summary */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { label: schema.measures.length   + " measures",   color: "#60a5fa" },
          { label: schema.dimensions.length + " dimensions", color: "var(--dc-accent)" },
          { label: schema.dates.length      + " date cols",  color: "#34d399" },
          { label: schema.rowCount.toLocaleString() + " rows", color: "#94a3b8" },
        ].filter(({ label }) => !label.startsWith("0 ")).map(({ label, color }) => (
          <span key={label} className="rounded-full border px-3 py-1 text-xs font-medium"
            style={{ background: color + "18", borderColor: color + "44", color }}>
            {label}
          </span>
        ))}
      </div>

      {/* Step progress */}
      {phase !== "idle" && (
        <div
          className="w-full max-w-md rounded-2xl border p-6 space-y-4"
          style={{ background: T.surface, borderColor: T.border }}
        >
          <div className="text-sm font-semibold mb-1" style={{ color: T.text }}>Generating dashboard…</div>
          {steps.map(({ id, label }) => (
            <StepRow key={id} step={id} label={label} status={stepStatus(id)} T={T} />
          ))}
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div
          className="w-full max-w-md rounded-xl border px-4 py-3 text-sm flex items-start gap-2"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Generation failed</div>
            <div className="mt-0.5 text-xs opacity-80">{errMsg}</div>
          </div>
        </div>
      )}

      {/* AI result preview */}
      {phase === "done" && aiResult && !deployed && (
        <div className="w-full max-w-2xl rounded-2xl border p-6 space-y-4" style={{ background: T.surface, borderColor: T.border }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold" style={{ color: T.text }}>
                {aiResult.dashboardTitle || "AI Generated Dashboard"}
              </div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                {aiResult.kpis?.length || 0} KPIs · {aiResult.visuals?.length || 0} charts · {aiResult.filters?.length || 0} slicers
              </div>
            </div>
            <button
              onClick={run}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
              Regenerate
            </button>
          </div>

          {/* KPI list */}
          {aiResult.kpis?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: T.muted }}>KPI Cards</div>
              <div className="flex flex-wrap gap-2">
                {aiResult.kpis.map((k, i) => (
                  <span key={i} className="rounded-lg border px-3 py-1.5 text-xs"
                    style={{ background: "#60a5fa18", borderColor: "#60a5fa44", color: "#60a5fa" }}>
                    {k.title || k.field} ({k.aggregation})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Visual list */}
          {aiResult.visuals?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: T.muted }}>Charts</div>
              <div className="space-y-1.5">
                {aiResult.visuals.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    style={{ background: T.s2, borderColor: T.border }}>
                    <span className="text-[10px] font-bold rounded px-1.5 py-0.5 uppercase"
                      style={{ background: T.s3, color: T.muted, minWidth: 40, textAlign: "center" }}>
                      {v.chartType}
                    </span>
                    <span className="text-xs font-medium" style={{ color: T.text }}>{v.title}</span>
                    <span className="text-[10px] ml-auto" style={{ color: T.muted }}>
                      {v.yField} ({v.aggregation}) by {v.xField}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Slicer list */}
          {aiResult.filters?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: T.muted }}>Filter Slicers</div>
              <div className="flex flex-wrap gap-2">
                {aiResult.filters.map((f, i) => (
                  <span key={i} className="rounded-lg border px-3 py-1.5 text-xs"
                    style={{ background: "rgba(var(--dc-accent-rgb),0.10)", borderColor: "rgba(var(--dc-accent-rgb),0.27)", color: "var(--dc-accent)" }}>
                    {f.label || f.column}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Deploy button */}
          <button
            onClick={deploy}
            className="w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition"
            style={{ background: T.accent, color: "#000" }}>
            <BarChart3 size={14} /> Deploy to Dashboard Tab
          </button>
        </div>
      )}

      {/* Deployed state */}
      {deployed && (
        <div className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
          style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)", color: "#22c55e" }}>
          <Check size={14} /> Dashboard deployed — redirecting…
        </div>
      )}

      {/* Start button */}
      {phase === "idle" && (
        <button
          onClick={run}
          className="inline-flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-base font-bold hover:opacity-90 transition"
          style={{ background: T.accent, color: "#000", boxShadow: "0 4px 20px rgba(var(--dc-accent-rgb),0.35)" }}>
          <Sparkles size={18} /> Analyze & Generate Dashboard
        </button>
      )}

      {phase === "error" && (
        <button
          onClick={run}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition"
          style={{ background: T.accent, color: "#000" }}>
          <Sparkles size={14} /> Try Again
        </button>
      )}
    </div>
  );
}

// ── MODE 2: Customize — simple chart builder form ─────────────────────────────

function CustomizeMode({ columns, dataTypes, T }) {
  const dashboards        = useStore((s) => s.dashboards);
  const activeDashboardId = useStore((s) => s.activeDashboardId);

  const [xField,      setXField]      = useState("");
  const [yField,      setYField]      = useState("");
  const [aggregation, setAggregation] = useState("sum");
  const [chartType,   setChartType]   = useState("bar");
  const [title,       setTitle]       = useState("");
  const [added,       setAdded]       = useState(false);

  const navigate = useNavigate();

  // Numeric columns for Y axis
  const numericCols = useMemo(
    () => columns.filter((c) => dataTypes[c] === "number"),
    [columns, dataTypes]
  );

  const canGenerate = xField && yField;

  const handleGenerate = () => {
    if (!canGenerate) return;

    const dashId = activeDashboardId || dashboards[0]?.id;
    if (!dashId) return;

    // Find how many visuals already exist on the dashboard
    const state       = useStore.getState();
    const dash        = state.dashboards.find((d) => d.id === dashId);
    const existing    = (dash?.items || []).filter((i) => i.type === "visual");
    const idx         = existing.length;

    const chartTitle = title.trim() || `${yField} by ${xField}`;

    const newItem = {
      id:   uid("v"),
      type: "visual",
      layout: {
        x: 16 + (idx % 2) * (CHART_W + CHART_GAP),
        y: 20 + Math.floor(idx / 2) * (CHART_H + CHART_GAP),
        w: CHART_W, h: CHART_H, minW: 200, minH: 160,
      },
      visualConfig: {
        id:          uid("vc"),
        title:       chartTitle,
        chartType,
        xFields:     [xField],
        yFields:     [yField],
        legendField: "",
        tooltipFields: [],
        aggregation,
        sortDirection: "desc",
        filters: {},
        referenceLines: [],
        conditionalRules: [],
        colorPalette:   "default",
        showGridlines:  true,
        showLegend:     true,
        showAxisLabels: true,
        chartStyle: chartType === "line" ? { lineSmooth: true, showMarkers: false, lineWidth: 2 } : undefined,
      },
    };

    useStore.setState((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id !== dashId ? d : { ...d, items: [...d.items, newItem] }
      ),
      activeDashboardId: dashId,
    }));

    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      navigate("/dashboard");
    }, 700);
  };

  const selectStyle = {
    background:  T.s2,
    borderColor: T.border,
    color:       T.text,
    borderRadius: 8,
    border:      `1px solid ${T.border}`,
    outline:     "none",
    padding:     "8px 12px",
    width:       "100%",
    fontSize:    13,
  };

  const labelStyle = {
    display:     "block",
    fontSize:    11,
    fontWeight:  600,
    color:       T.muted,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    <div className="flex items-start justify-center h-full overflow-y-auto py-10 px-6">
      <div
        className="w-full max-w-lg rounded-2xl border p-8 space-y-6"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div>
          <div className="text-lg font-bold" style={{ color: T.text }}>Configure Chart</div>
          <div className="text-sm mt-0.5" style={{ color: T.muted }}>
            Set the fields and click Generate to add the chart to your dashboard.
          </div>
        </div>

        {/* X Axis */}
        <div>
          <label style={labelStyle}>X Axis · Category</label>
          <div className="relative">
            <select value={xField} onChange={(e) => setXField(e.target.value)} style={selectStyle}>
              <option value="">— select column —</option>
              {columns.map((c) => (
                <option key={c} value={c}>{c} ({dataTypes[c] || "string"})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Y Axis */}
        <div>
          <label style={labelStyle}>Y Axis · Measure</label>
          <select value={yField} onChange={(e) => setYField(e.target.value)} style={selectStyle}>
            <option value="">— select numeric column —</option>
            {numericCols.length > 0
              ? numericCols.map((c) => <option key={c} value={c}>{c}</option>)
              : columns.map((c) => <option key={c} value={c}>{c}</option>)
            }
          </select>
          {numericCols.length === 0 && (
            <p className="mt-1 text-xs" style={{ color: T.muted }}>
              No numeric columns detected — all columns are shown.
            </p>
          )}
        </div>

        {/* Aggregation */}
        <div>
          <label style={labelStyle}>Aggregation</label>
          <select value={aggregation} onChange={(e) => setAggregation(e.target.value)} style={selectStyle}>
            {AGGREGATIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Chart Type */}
        <div>
          <label style={labelStyle}>Chart Type</label>
          <div className="grid grid-cols-3 gap-2">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setChartType(ct.value)}
                className="rounded-xl border py-2 text-xs font-medium transition hover:opacity-80"
                style={{
                  background:  chartType === ct.value ? T.accentDim : T.s2,
                  borderColor: chartType === ct.value ? T.accent    : T.border,
                  color:       chartType === ct.value ? T.accent    : T.text,
                }}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Title */}
        <div>
          <label style={labelStyle}>Chart Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={xField && yField ? `${yField} by ${xField}` : "e.g. Revenue Trend"}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || added}
          className="w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 transition hover:opacity-90"
          style={{
            background:   added ? "#22c55e" : (!canGenerate ? T.s3 : T.accent),
            color:        added ? "#fff"    : (!canGenerate ? T.muted : "#000"),
            cursor:       canGenerate ? "pointer" : "not-allowed",
          }}
        >
          {added
            ? <><Check size={15} /> Chart added — going to Dashboard…</>
            : <><BarChart3 size={15} /> Generate Chart</>
          }
        </button>

        {!canGenerate && (
          <p className="text-xs text-center" style={{ color: T.muted }}>
            Select both X Axis and Y Axis to enable generation.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main AIDashboard page ─────────────────────────────────────────────────────

export default function AIDashboard() {
  const T        = useTheme();
  const navigate = useNavigate();
  const datasets = useStore((s) => s.datasets);

  const { rows: effectiveRows, columns, dataTypes } = useEffectiveData();

  const [mode, setMode] = useState(null); // null | "auto" | "customize"

  const schema = useMemo(() => analyzeSchema(datasets), [datasets]);

  const hasData = columns.length > 0 && effectiveRows.length > 0;

  const handleDeployed = useCallback(() => {
    setTimeout(() => navigate("/dashboard"), 900);
  }, [navigate]);

  // ── Mode header bar ──
  const Header = mode ? (
    <div className="shrink-0 flex items-center gap-3 border-b px-5 py-3"
      style={{ background: T.surface, borderColor: T.border }}>
      <button
        onClick={() => setMode(null)}
        className="text-xs font-medium rounded-lg border px-2.5 py-1.5"
        style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
        ← Back
      </button>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: mode === "auto" ? T.accentDim : "#8b5cf622" }}>
        {mode === "auto"
          ? <Wand2 size={14} style={{ color: T.accent }} />
          : <Settings2 size={14} style={{ color: "#8b5cf6" }} />}
      </div>
      <div className="text-sm font-bold" style={{ color: T.text }}>
        {mode === "auto" ? "Do Your Own Thing" : "Customize"}
      </div>
      <span className="text-xs" style={{ color: T.muted }}>
        {schema.primaryDataset?.name} · {schema.rowCount.toLocaleString()} rows
      </span>
    </div>
  ) : null;

  // ── Landing screen ──
  if (!mode) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-8 px-6"
        style={{ background: T.bg }}>

        {/* Logo */}
        <div className="text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4"
            style={{ background: T.accent, boxShadow: "0 4px 20px rgba(var(--dc-accent-rgb),0.4)" }}>
            <Wand2 size={26} color="#000" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>AI Dashboard</h1>
          <p className="mt-1.5 text-sm" style={{ color: T.muted }}>
            Generate a complete dashboard from your data.
          </p>
        </div>

        {/* No data warning */}
        {!hasData && (
          <div className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
            style={{ background: "rgba(var(--dc-accent-rgb),0.08)", borderColor: "rgba(var(--dc-accent-rgb),0.3)", color: T.accent }}>
            <AlertCircle size={14} />
            No dataset loaded. Go to Data Source first to import data.
          </div>
        )}

        {/* Mode cards */}
        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl">

          {/* Auto mode */}
          <button
            onClick={() => hasData && setMode("auto")}
            disabled={!hasData}
            className="flex-1 rounded-2xl border p-6 text-left transition hover:shadow-xl"
            style={{
              background:  T.surface,
              borderColor: T.border,
              opacity:     hasData ? 1 : 0.5,
              cursor:      hasData ? "pointer" : "not-allowed",
            }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
              style={{ background: T.accentDim }}>
              <Wand2 size={22} style={{ color: T.accent }} />
            </div>
            <div className="text-base font-bold mb-2" style={{ color: T.text }}>
              Do Your Own Thing
            </div>
            <div className="text-sm leading-relaxed mb-4" style={{ color: T.muted }}>
              ChatGPT analyzes your dataset as a BI consultant and automatically generates
              a complete dashboard — KPI cards, trend charts, breakdowns, and filters.
              Zero configuration needed.
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.accent }}>
              Generate with ChatGPT <ArrowRight size={12} />
            </div>
          </button>

          {/* Customize mode */}
          <button
            onClick={() => hasData && setMode("customize")}
            disabled={!hasData}
            className="flex-1 rounded-2xl border p-6 text-left transition hover:shadow-xl"
            style={{
              background:  T.surface,
              borderColor: T.border,
              opacity:     hasData ? 1 : 0.5,
              cursor:      hasData ? "pointer" : "not-allowed",
            }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
              style={{ background: "#8b5cf622" }}>
              <Settings2 size={22} style={{ color: "#8b5cf6" }} />
            </div>
            <div className="text-base font-bold mb-2" style={{ color: T.text }}>
              Customize
            </div>
            <div className="text-sm leading-relaxed mb-4" style={{ color: T.muted }}>
              Pick X axis, Y axis, aggregation, chart type, and title.
              Click Generate Chart to add it directly to the Dashboard.
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#8b5cf6" }}>
              Build manually <ArrowRight size={12} />
            </div>
          </button>
        </div>

        {/* Schema summary */}
        {hasData && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { n: schema.measures.length,   label: "measures",   color: "#60a5fa" },
              { n: schema.dimensions.length, label: "dimensions", color: "var(--dc-accent)" },
              { n: schema.dates.length,      label: "date cols",  color: "#34d399" },
              { n: schema.rowCount,          label: "rows",       color: "#94a3b8", fmt: (v) => v.toLocaleString() },
            ].filter(({ n }) => n > 0).map(({ n, label, color, fmt }) => (
              <span key={label} className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{ background: color + "18", borderColor: color + "44", color }}>
                {fmt ? fmt(n) : n} {label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: T.bg }}>
      {Header}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === "auto" ? (
          <DoYourOwnThing schema={schema} T={T} onDeployed={handleDeployed} />
        ) : (
          <CustomizeMode columns={columns} dataTypes={dataTypes} T={T} />
        )}
      </div>
    </div>
  );
}
