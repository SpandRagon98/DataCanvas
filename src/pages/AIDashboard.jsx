/**
 * AIDashboard — two-mode AI-powered dashboard generator.
 *
 * Mode 1 — "Do Your Own Thing":
 *   Fully automatic. Runs the rule engine over the loaded schema,
 *   previews the generated layout, then deploys it to the Dashboard tab.
 *   Zero LLM calls for generation. Optional LLM call only to rename visuals.
 *
 * Mode 2 — "Customize":
 *   Node-based visual builder. User drags fields from a list onto
 *   chart-builder cards, picks chart types, and uses AI Suggest for
 *   type/aggregation recommendations. Generates real dashboard items.
 */

import {
  Sparkles, Wand2, Settings2, BarChart3, TrendingUp, PieChart,
  Plus, X, Trash2, ArrowRight, Check, Loader2, AlertCircle,
  ChevronDown, Hash, Calendar, Type as TypeIcon, ToggleLeft,
  Filter, Layers, MousePointer, Layout, Eye, RefreshCw,
  Database,
} from "lucide-react";
import {
  useState, useMemo, useCallback, useRef, useEffect,
} from "react";
import { useNavigate } from "react-router-dom";
import { useStore }           from "../store/useStore";
import { useEffectiveData }   from "../hooks/useEffectiveData";
import { useTheme }           from "../styles/theme";
import { analyzeSchema, getColumnMeta } from "../utils/schemaAnalyzer";
import { generateDashboard, suggestForPair } from "../utils/dashboardRuleEngine";
import { callAI, AI_ENABLED } from "../services/aiClient";
import VisualRenderer from "../components/builder/VisualRenderer";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const uid = (p) =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const CAT_ICON = {
  measure:   <Hash      size={11} style={{ color: "#60a5fa" }} />,
  date:      <Calendar  size={11} style={{ color: "#34d399" }} />,
  dimension: <TypeIcon  size={11} style={{ color: "#f59e0b" }} />,
  boolean:   <ToggleLeft size={11} style={{ color: "#a78bfa" }} />,
  id:        <Hash      size={11} style={{ color: "#6b7280" }} />,
  text:      <TypeIcon  size={11} style={{ color: "#94a3b8" }} />,
};

const CAT_COLOR = {
  measure:   "#3b82f622",
  date:      "#10b98122",
  dimension: "#f59e0b22",
  boolean:   "#8b5cf622",
  id:        "#6b728022",
  text:      "#94a3b822",
};

const CHART_TYPES = [
  { value: "bar",      label: "Bar" },
  { value: "line",     label: "Line" },
  { value: "area",     label: "Area" },
  { value: "pie",      label: "Pie" },
  { value: "donut",    label: "Donut" },
  { value: "kpi",      label: "KPI Card" },
  { value: "scatter",  label: "Scatter" },
  { value: "table",    label: "Table" },
  { value: "treemap",  label: "Treemap" },
];

// ── FieldChip (draggable) ─────────────────────────────────────────────────────

function FieldChip({ meta, T, onDragStart, onClick, selected }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("fieldMeta", JSON.stringify(meta));
        onDragStart?.(meta);
      }}
      onClick={() => onClick?.(meta)}
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs cursor-grab select-none transition hover:opacity-80"
      style={{
        background: selected ? (CAT_COLOR[meta.category] || T.s3) : T.s2,
        borderColor: selected ? T.accent : T.border,
        color: T.text,
      }}
      title={`${meta.category} · ${meta.cardinality} unique values`}
    >
      {CAT_ICON[meta.category] || <Hash size={11} />}
      <span className="truncate max-w-[110px]">{meta.name}</span>
    </div>
  );
}

// ── Mini preview of a visual ──────────────────────────────────────────────────

function MiniChart({ vc, rows, filters, T }) {
  return (
    <div style={{ height: 160, pointerEvents: "none" }}>
      <VisualRenderer
        visual={vc}
        rawData={rows}
        filters={filters}
        compact
      />
    </div>
  );
}

// ── DropZone for the node builder ─────────────────────────────────────────────

function FieldDropZone({ label, value, onDrop, onClear, T }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        try {
          const meta = JSON.parse(e.dataTransfer.getData("fieldMeta"));
          onDrop(meta);
        } catch {}
      }}
      className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs"
      style={{
        background: over ? T.accentDim : T.s2,
        borderColor: over ? T.accent : (value ? T.accent + "55" : T.border),
        minHeight: 32,
        transition: "all 120ms",
      }}
    >
      <span style={{ color: value ? T.text : T.muted }}>
        {value ? <><strong>{value.name}</strong> <span style={{ color: T.muted, fontSize: 10 }}>({value.category})</span></> : label}
      </span>
      {value && (
        <button onClick={onClear} className="ml-1 rounded p-0.5 opacity-50 hover:opacity-100" style={{ color: T.dim }}>
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ── Chart Builder Card (Customize mode) ───────────────────────────────────────

function ChartBuilderCard({ card, allMeta, effectiveRows, filters, onUpdate, onRemove, T }) {
  const [suggesting, setSuggesting] = useState(false);

  const xMeta  = allMeta.find((m) => m.name === card.xField);
  const yMeta  = allMeta.find((m) => m.name === card.yField);

  const handleSuggest = async () => {
    if (!xMeta || !yMeta) return;
    setSuggesting(true);
    const { chartType, aggregation } = suggestForPair(xMeta, yMeta);

    // Optional: ask AI just for a title (cheap)
    let title = card.title || `${yMeta.name} by ${xMeta.name}`;
    if (AI_ENABLED) {
      try {
        const res = await callAI({
          task: "insights",
          payload: {
            chartType,
            xAxis: xMeta.name,
            yAxis: yMeta.name,
            aggregation,
            data: [],
            hint: "Respond with ONLY a short chart title (4-8 words). No extra text.",
          },
        });
        if (res && res.length < 80) title = res.replace(/^["']|["']$/g, "");
      } catch {}
    }
    onUpdate({ chartType, aggregation, title });
    setSuggesting(false);
  };

  const vc = useMemo(() => ({
    id: card.id + "_preview",
    title: card.title,
    chartType:    card.chartType || "bar",
    xFields:      card.xField  ? [card.xField]  : [],
    yFields:      card.yField  ? [card.yField]  : [],
    legendField:  "",
    tooltipFields: [],
    aggregation:  card.aggregation || "sum",
    sortDirection: "desc",
    filters: {},
    referenceLines: [],
    conditionalRules: [],
    colorPalette: "default",
    showGridlines: true,
    showLegend: true,
    showAxisLabels: true,
  }), [card]);

  const iLabel = { display: "block", fontSize: 10, color: T.muted, marginBottom: 2 };
  const iBase  = { background: T.s2, borderColor: T.border, color: T.text, fontSize: 12, padding: "4px 8px", borderRadius: 8, border: `1px solid ${T.border}`, outline: "none", width: "100%" };

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ background: T.surface, borderColor: T.border, minWidth: 300, maxWidth: 380 }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: T.border }}>
        <input
          value={card.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Chart title…"
          className="flex-1 bg-transparent text-xs font-semibold outline-none"
          style={{ color: T.text }}
        />
        <button
          onClick={handleSuggest}
          disabled={!xMeta || !yMeta || suggesting}
          title="AI Suggest"
          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition hover:opacity-80"
          style={{
            background: T.accentDim, borderColor: T.accent + "44", color: T.accent,
            opacity: (!xMeta || !yMeta) ? 0.4 : 1,
          }}
        >
          {suggesting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          Suggest
        </button>
        <button onClick={onRemove} className="rounded p-0.5 opacity-40 hover:opacity-100" style={{ color: T.dim }}>
          <Trash2 size={12} />
        </button>
      </div>

      {/* Fields + chart type */}
      <div className="px-3 py-2.5 space-y-2">
        <div>
          <label style={iLabel}>X Axis / Category</label>
          <FieldDropZone
            label="Drop a field here"
            value={xMeta || null}
            onDrop={(meta) => onUpdate({ xField: meta.name })}
            onClear={() => onUpdate({ xField: "" })}
            T={T}
          />
        </div>
        <div>
          <label style={iLabel}>Y Axis / Measure</label>
          <FieldDropZone
            label="Drop a field here"
            value={yMeta || null}
            onDrop={(meta) => onUpdate({ yField: meta.name })}
            onClear={() => onUpdate({ yField: "" })}
            T={T}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label style={iLabel}>Chart Type</label>
            <select value={card.chartType || "bar"} onChange={(e) => onUpdate({ chartType: e.target.value })} style={iBase}>
              {CHART_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          <div>
            <label style={iLabel}>Aggregation</label>
            <select value={card.aggregation || "sum"} onChange={(e) => onUpdate({ aggregation: e.target.value })} style={iBase}>
              {["sum","avg","count","min","max","distinctCount"].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Mini chart preview */}
      {card.xField && card.yField && (
        <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: T.border }}>
          <MiniChart vc={vc} rows={effectiveRows} filters={filters} T={T} />
        </div>
      )}
    </div>
  );
}

// ── Filter Builder Card ────────────────────────────────────────────────────────

function FilterBuilderCard({ card, allMeta, onUpdate, onRemove, T }) {
  const colMeta = allMeta.find((m) => m.name === card.column);
  const iBase   = { background: T.s2, borderColor: T.border, color: T.text, fontSize: 12, padding: "4px 8px", borderRadius: 8, border: `1px solid ${T.border}`, outline: "none", width: "100%" };
  const iLabel  = { display: "block", fontSize: 10, color: T.muted, marginBottom: 2 };

  return (
    <div className="rounded-xl border" style={{ background: T.surface, borderColor: T.border, minWidth: 220, maxWidth: 280 }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.text }}>
          <Filter size={11} style={{ color: T.accent }} /> Filter Slicer
        </div>
        <button onClick={onRemove} className="rounded p-0.5 opacity-40 hover:opacity-100" style={{ color: T.dim }}>
          <Trash2 size={12} />
        </button>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div>
          <label style={iLabel}>Column</label>
          <FieldDropZone
            label="Drop a field here"
            value={colMeta || null}
            onDrop={(meta) => onUpdate({ column: meta.name })}
            onClear={() => onUpdate({ column: "" })}
            T={T}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label style={iLabel}>Mode</label>
            <select value={card.mode || "dropdown"} onChange={(e) => onUpdate({ mode: e.target.value })} style={iBase}>
              <option value="dropdown">Dropdown</option>
              <option value="list">List</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={() => onUpdate({ multiSelect: !card.multiSelect })}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition"
              style={{ background: card.multiSelect ? T.accent : T.border }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                style={{ transform: card.multiSelect ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
            </button>
            <span className="text-[10px]" style={{ color: T.text }}>Multi</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DO YOUR OWN THING mode ────────────────────────────────────────────────────

function DoYourOwnThing({ schema, effectiveRows, storeFilters, T, onDeployed }) {
  const createDashboard       = useStore((s) => s.createDashboard);
  const renameDashboard       = useStore((s) => s.renameDashboard);
  const dashboards            = useStore((s) => s.dashboards);
  const updateDashboardItem   = useStore((s) => s.updateDashboardItem);
  const addSlicerToDashboard  = useStore((s) => s.addSlicerToDashboard);
  const removeDashboardItem   = useStore((s) => s.removeDashboardItem);
  const setActiveDashboard    = useStore((s) => s.setActiveDashboard);

  const [generated,   setGenerated]   = useState(null);
  const [deploying,   setDeploying]   = useState(false);
  const [deployed,    setDeployed]    = useState(false);
  const [generating,  setGenerating]  = useState(false);

  const run = useCallback(async () => {
    setGenerating(true);
    setDeployed(false);
    // Small yield so UI updates
    await new Promise((r) => setTimeout(r, 80));
    const result = generateDashboard(schema);
    setGenerated(result);
    setGenerating(false);
  }, [schema]);

  // Auto-run on mount
  useEffect(() => { run(); }, [run]);

  const deploy = useCallback(async () => {
    if (!generated) return;
    setDeploying(true);

    // Use the Zustand store's internal ID creator via the action
    const dashId = uid("dash");

    // Insert a new dashboard directly into the store
    const { dashboards: currentDashes } = useStore.getState();
    const newDash = {
      id:    dashId,
      name:  generated.dashboardName,
      items: [
        ...generated.visuals,
        ...generated.slicers,
      ],
      annotations: [],
    };

    useStore.setState((state) => ({
      dashboards:       [...state.dashboards, newDash],
      activeDashboardId: dashId,
    }));

    setDeploying(false);
    setDeployed(true);
    onDeployed();
  }, [generated, onDeployed]);

  const hasMeasures = schema.measures.length > 0;

  if (!hasMeasures) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full py-16">
        <AlertCircle size={36} style={{ color: T.muted }} />
        <div className="text-base font-semibold" style={{ color: T.text }}>No numeric columns detected</div>
        <div className="text-sm text-center max-w-xs" style={{ color: T.muted }}>
          Import a dataset with at least one numeric column to generate a dashboard automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto px-6 py-4">
      {/* Schema summary */}
      <div className="rounded-xl border p-4 shrink-0" style={{ background: T.s2, borderColor: T.border }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T.muted }}>
          Detected Schema
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Measures",   items: schema.measures,   color: "#60a5fa" },
            { label: "Dimensions", items: schema.dimensions, color: "#f59e0b" },
            { label: "Dates",      items: schema.dates,      color: "#34d399" },
          ].map(({ label, items, color }) =>
            items.length > 0 ? (
              <div key={label} className="flex items-start gap-2">
                <span className="text-[10px] font-semibold shrink-0 mt-1" style={{ color, minWidth: 72 }}>{label}</span>
                <div className="flex flex-wrap gap-1">
                  {items.slice(0, 8).map((m) => (
                    <span key={m.name} className="rounded-md border px-2 py-0.5 text-[11px]"
                      style={{ background: color + "18", borderColor: color + "44", color }}>
                      {m.name}
                    </span>
                  ))}
                  {items.length > 8 && <span className="text-[11px]" style={{ color: T.muted }}>+{items.length - 8} more</span>}
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Generation status */}
      {generating && (
        <div className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ background: T.s2, borderColor: T.border }}>
          <Loader2 size={16} className="animate-spin" style={{ color: T.accent }} />
          <span className="text-sm" style={{ color: T.text }}>Analyzing schema and generating dashboard…</span>
        </div>
      )}

      {/* Preview */}
      {generated && !generating && (
        <>
          <div className="flex items-center justify-between shrink-0">
            <div>
              <div className="text-sm font-semibold" style={{ color: T.text }}>
                {generated.dashboardName}
              </div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                {generated.visuals.length} charts · {generated.slicers.length} slicers
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={run}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium"
                style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
                <RefreshCw size={11} /> Regenerate
              </button>
              <button
                onClick={deploy}
                disabled={deploying || deployed}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-90"
                style={{ background: deployed ? "#22c55e" : T.accent, color: "#000", minWidth: 140 }}>
                {deploying ? (
                  <><Loader2 size={13} className="animate-spin" /> Deploying…</>
                ) : deployed ? (
                  <><Check size={13} /> Deployed!</>
                ) : (
                  <><LayoutDashboard size={13} /> Deploy to Dashboard</>
                )}
              </button>
            </div>
          </div>

          {/* Visual previews grid */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {generated.visuals.map((item) => (
              <div key={item.id} className="rounded-xl border flex flex-col overflow-hidden"
                style={{ background: T.surface, borderColor: T.border }}>
                <div className="border-b px-3 py-2 shrink-0" style={{ borderColor: T.border }}>
                  <div className="text-xs font-semibold truncate" style={{ color: T.text }}>
                    {item.visualConfig.title}
                  </div>
                  <div className="text-[10px] mt-0.5 capitalize" style={{ color: T.muted }}>
                    {item.visualConfig.chartType} · {item.visualConfig.aggregation}
                  </div>
                </div>
                <div style={{ height: 180, padding: 8 }}>
                  <VisualRenderer
                    visual={item.visualConfig}
                    rawData={effectiveRows}
                    filters={storeFilters}
                    compact
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Slicer list */}
          {generated.slicers.length > 0 && (
            <div className="rounded-xl border p-3 shrink-0" style={{ background: T.s2, borderColor: T.border }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: T.muted }}>
                Filter Slicers
              </div>
              <div className="flex flex-wrap gap-2">
                {generated.slicers.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                    style={{ background: T.surface, borderColor: T.border, color: T.text }}>
                    <Filter size={10} style={{ color: T.accent }} />
                    {s.slicerConfig.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── CUSTOMIZE mode ─────────────────────────────────────────────────────────────

function CustomizeMode({ schema, allMeta, effectiveRows, storeFilters, T, onDeployed }) {
  const [chartCards,  setChartCards]  = useState([]);
  const [filterCards, setFilterCards] = useState([]);
  const [deploying,   setDeploying]   = useState(false);
  const [deployed,    setDeployed]    = useState(false);
  const [dashName,    setDashName]    = useState("Custom AI Dashboard");

  const addChartCard = () =>
    setChartCards((prev) => [...prev, {
      id: uid("card"), title: "", xField: "", yField: "",
      chartType: "bar", aggregation: "sum",
    }]);

  const addFilterCard = () =>
    setFilterCards((prev) => [...prev, {
      id: uid("fc"), column: "", mode: "dropdown", multiSelect: false,
    }]);

  const updateChart  = (id, patch) => setChartCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  const removeChart  = (id) => setChartCards((prev) => prev.filter((c) => c.id !== id));
  const updateFilter = (id, patch) => setFilterCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  const removeFilter = (id) => setFilterCards((prev) => prev.filter((c) => c.id !== id));

  // Lay out generated visuals
  const CHART_W = 520, CHART_H = 300, GAP = 16;
  const buildLayout = (index) => ({
    x: 16 + (index % 2) * (CHART_W + GAP),
    y: 20 + Math.floor(index / 2) * (CHART_H + GAP),
    w: CHART_W, h: CHART_H, minW: 200, minH: 160,
  });
  const buildSlicerLayout = (index, chartCount) => ({
    x: 16 + index * (200 + 12),
    y: 20 + Math.ceil(chartCount / 2) * (CHART_H + GAP) + 20,
    w: 196, h: 46, minW: 100, minH: 36,
  });

  const deploy = useCallback(async () => {
    const validCharts  = chartCards.filter((c) => c.xField && c.yField);
    const validFilters = filterCards.filter((f) => f.column);
    if (!validCharts.length) return;

    setDeploying(true);

    const visuals = validCharts.map((c, i) => ({
      id:   uid("v"),
      type: "visual",
      layout: buildLayout(i),
      visualConfig: {
        id:    uid("vc"),
        title: c.title || `${c.yField} by ${c.xField}`,
        chartType:     c.chartType,
        xFields:       [c.xField],
        yFields:       [c.yField],
        legendField:   "",
        tooltipFields: [],
        aggregation:   c.aggregation,
        sortDirection: "desc",
        filters: {},
        referenceLines: [],
        conditionalRules: [],
        colorPalette:   "default",
        showGridlines:  true,
        showLegend:     true,
        showAxisLabels: true,
      },
    }));

    const slicers = validFilters.map((f, i) => ({
      id:   uid("slicer"),
      type: "slicer",
      layout: buildSlicerLayout(i, validCharts.length),
      slicerConfig: { column: f.column, label: f.column, mode: f.mode, multiSelect: f.multiSelect },
      selectedValues: [],
    }));

    const newDash = {
      id:    uid("dash"),
      name:  dashName,
      items: [...visuals, ...slicers],
      annotations: [],
    };

    useStore.setState((state) => ({
      dashboards:        [...state.dashboards, newDash],
      activeDashboardId: newDash.id,
    }));

    setDeploying(false);
    setDeployed(true);
    onDeployed();
  }, [chartCards, filterCards, dashName, onDeployed]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">

      {/* ── Left: field panel ── */}
      <div
        className="shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ width: 220, borderColor: T.border, background: T.sidebarBg }}
      >
        <div className="px-3 py-3 border-b" style={{ borderColor: T.border }}>
          <div className="text-xs font-bold" style={{ color: T.text }}>Fields</div>
          <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>Drag onto chart cards</div>
        </div>

        {[
          { key: "measures",   label: "Measures",   items: schema.measures },
          { key: "dates",      label: "Dates",      items: schema.dates },
          { key: "dimensions", label: "Dimensions", items: schema.dimensions },
        ].map(({ key, label, items }) =>
          items.length > 0 ? (
            <div key={key} className="px-3 py-2">
              <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                {label}
              </div>
              <div className="space-y-1">
                {items.map((m) => (
                  <FieldChip key={m.name + m.datasetId} meta={m} T={T} />
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* ── Center: node canvas ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b px-4 py-2.5 shrink-0"
          style={{ borderColor: T.border, background: T.surface }}>
          <input
            value={dashName}
            onChange={(e) => setDashName(e.target.value)}
            className="rounded-lg border px-2.5 py-1.5 text-sm font-semibold outline-none"
            style={{ background: T.s2, borderColor: T.border, color: T.text, width: 240 }}
          />
          <button
            onClick={addChartCard}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}>
            <Plus size={12} /> Add Chart
          </button>
          <button
            onClick={addFilterCard}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}>
            <Filter size={12} /> Add Slicer
          </button>
          <div className="flex-1" />
          <button
            onClick={deploy}
            disabled={deploying || deployed || (!chartCards.some((c) => c.xField && c.yField))}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{
              background: deployed ? "#22c55e" : T.accent,
              color: "#000",
              opacity: (deploying || deployed || !chartCards.some(c => c.xField && c.yField)) ? 0.6 : 1,
            }}>
            {deploying ? <><Loader2 size={13} className="animate-spin" /> Deploying…</>
              : deployed ? <><Check size={13} /> Deployed!</>
              : <><LayoutDashboard size={13} /> Deploy to Dashboard</>}
          </button>
        </div>

        {/* Cards canvas */}
        <div className="flex-1 overflow-auto p-4">
          {chartCards.length === 0 && filterCards.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto"
                  style={{ background: T.accentDim }}>
                  <Layout size={28} style={{ color: T.accent }} />
                </div>
                <div className="text-sm font-semibold" style={{ color: T.text }}>Start building your dashboard</div>
                <div className="text-xs" style={{ color: T.muted }}>
                  Click <strong>Add Chart</strong> to create a chart card,<br />
                  then drag fields from the left panel onto it.
                </div>
                <div className="flex gap-2 justify-center mt-2">
                  <button
                    onClick={addChartCard}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                    style={{ background: T.accent, color: "#000" }}>
                    <Plus size={12} /> Add Chart
                  </button>
                  <button
                    onClick={addFilterCard}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium"
                    style={{ background: T.s2, borderColor: T.border, color: T.text }}>
                    <Filter size={12} /> Add Slicer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 items-start">
              {chartCards.map((card) => (
                <ChartBuilderCard
                  key={card.id}
                  card={card}
                  allMeta={allMeta}
                  effectiveRows={effectiveRows}
                  filters={storeFilters}
                  onUpdate={(patch) => updateChart(card.id, patch)}
                  onRemove={() => removeChart(card.id)}
                  T={T}
                />
              ))}
              {filterCards.map((card) => (
                <FilterBuilderCard
                  key={card.id}
                  card={card}
                  allMeta={allMeta}
                  onUpdate={(patch) => updateFilter(card.id, patch)}
                  onRemove={() => removeFilter(card.id)}
                  T={T}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Missing LayoutDashboard icon alias ────────────────────────────────────────
function LayoutDashboard(props) {
  return <BarChart3 {...props} />;
}

// ── Main AIDashboard page ─────────────────────────────────────────────────────

export default function AIDashboard() {
  const T        = useTheme();
  const navigate = useNavigate();
  const datasets = useStore((s) => s.datasets);
  const filters  = useStore((s) => s.filters);
  const { rows: effectiveRows } = useEffectiveData();

  const [mode, setMode] = useState(null); // null | "auto" | "customize"
  const [deployed, setDeployed] = useState(false);

  const schema = useMemo(() => analyzeSchema(datasets), [datasets]);
  const allMeta = useMemo(
    () => schema.datasets.flatMap((ds) => ds.columns),
    [schema]
  );

  const hasData = (schema.measures.length + schema.dimensions.length + schema.dates.length) > 0;

  const handleDeployed = useCallback(() => {
    setDeployed(true);
    setTimeout(() => navigate("/dashboard"), 800);
  }, [navigate]);

  // ── Landing screen ──
  if (!mode) {
    return (
      <div
        className="flex flex-col h-full items-center justify-center gap-8 px-6"
        style={{ background: T.bg }}
      >
        {/* Header */}
        <div className="text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4"
            style={{ background: T.accent, boxShadow: "0 4px 20px rgba(245,158,11,0.4)" }}>
            <Wand2 size={26} color="#000" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>AI Dashboard</h1>
          <p className="mt-1.5 text-sm" style={{ color: T.muted }}>
            Generate a complete dashboard from your data — automatically or with full control.
          </p>
        </div>

        {!hasData && (
          <div className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
            style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)", color: T.accent }}>
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
            className="flex-1 rounded-2xl border p-6 text-left transition hover:shadow-xl group"
            style={{
              background: T.surface,
              borderColor: T.border,
              opacity: hasData ? 1 : 0.5,
              cursor: hasData ? "pointer" : "not-allowed",
            }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
              style={{ background: T.accentDim }}>
              <Wand2 size={22} style={{ color: T.accent }} />
            </div>
            <div className="text-base font-bold mb-1.5" style={{ color: T.text }}>
              Do Your Own Thing
            </div>
            <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
              AI analyzes your dataset and instantly generates a full dashboard — KPI cards,
              trend charts, category breakdowns, and filters. Zero configuration needed.
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.accent }}>
              Generate automatically <ArrowRight size={12} />
            </div>
          </button>

          {/* Customize mode */}
          <button
            onClick={() => hasData && setMode("customize")}
            disabled={!hasData}
            className="flex-1 rounded-2xl border p-6 text-left transition hover:shadow-xl group"
            style={{
              background: T.surface,
              borderColor: T.border,
              opacity: hasData ? 1 : 0.5,
              cursor: hasData ? "pointer" : "not-allowed",
            }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
              style={{ background: "#8b5cf622" }}>
              <Settings2 size={22} style={{ color: "#8b5cf6" }} />
            </div>
            <div className="text-base font-bold mb-1.5" style={{ color: T.text }}>
              Customize
            </div>
            <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
              Build your dashboard visually. Drag fields onto chart cards, pick chart types,
              add filters, and use AI suggestions to fine-tune each visual.
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#8b5cf6" }}>
              Build with control <ArrowRight size={12} />
            </div>
          </button>
        </div>

        {/* Schema summary pills */}
        {hasData && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: schema.measures.length   + " measures",   color: "#60a5fa" },
              { label: schema.dimensions.length + " dimensions", color: "#f59e0b" },
              { label: schema.dates.length      + " date cols",  color: "#34d399" },
              { label: schema.rowCount.toLocaleString() + " rows", color: "#94a3b8" },
            ].map(({ label, color }) => (
              <span key={label} className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{ background: color + "18", borderColor: color + "44", color }}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Mode header ──
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: T.bg }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 border-b px-5 py-3"
        style={{ background: T.surface, borderColor: T.border }}>
        <button
          onClick={() => { setMode(null); setDeployed(false); }}
          className="text-xs font-medium rounded-lg border px-2.5 py-1.5"
          style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
          ← Back
        </button>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: T.accentDim }}>
          {mode === "auto" ? <Wand2 size={14} style={{ color: T.accent }} /> : <Settings2 size={14} style={{ color: "#8b5cf6" }} />}
        </div>
        <div>
          <span className="text-sm font-bold" style={{ color: T.text }}>
            {mode === "auto" ? "Do Your Own Thing" : "Customize"}
          </span>
          <span className="ml-2 text-xs" style={{ color: T.muted }}>
            {schema.primaryDataset?.name} · {schema.rowCount.toLocaleString()} rows
          </span>
        </div>
        {deployed && (
          <div className="ml-auto flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold"
            style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)", color: "#22c55e" }}>
            <Check size={12} /> Deployed — redirecting to Dashboard…
          </div>
        )}
      </div>

      {/* Mode content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === "auto" ? (
          <DoYourOwnThing
            schema={schema}
            effectiveRows={effectiveRows}
            storeFilters={filters}
            T={T}
            onDeployed={handleDeployed}
          />
        ) : (
          <CustomizeMode
            schema={schema}
            allMeta={allMeta}
            effectiveRows={effectiveRows}
            storeFilters={filters}
            T={T}
            onDeployed={handleDeployed}
          />
        )}
      </div>
    </div>
  );
}
