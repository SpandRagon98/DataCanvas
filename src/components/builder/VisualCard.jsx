import { useRef, useMemo, useState } from "react";
import {
  Check, LayoutDashboard, Trash2, Copy, Download, AlertTriangle,
  Settings2, ChevronDown, ChevronUp, Plus, X, Filter, Minimize2,
} from "lucide-react";
import ColorPickerInput from "./ColorPickerInput";
import html2canvas from "html2canvas";
import { useStore } from "../../store/useStore";
import { useEffectiveData } from "../../hooks/useEffectiveData";
import { applyGlobalFilters, getUniqueValues } from "../../utils/filterEngine";
import { buildVisualData } from "../../utils/chartEngine";
import { COLOR_PALETTES, PALETTE_LABELS, getPalette } from "../../styles/theme";
import DropZone from "./DropZone";
import VisualToolbar from "./VisualToolbar";
import VisualRenderer from "./VisualRenderer";
import AIChartSuggestion from "../ai/AIChartSuggestion";
import AIInsightsPanel from "../ai/AIInsightsPanel";
import { useTheme } from "../../styles/theme";

const OPERATORS = [">", "<", ">=", "<=", "=="];

export default function VisualCard({ visual, onCollapse }) {
  const T = useTheme();
  const { rows: effectiveRows, columns, dataTypes } = useEffectiveData();

  const filters = useStore((s) => s.filters);
  const crossFilter = useStore((s) => s.crossFilter);
  const setCrossFilter = useStore((s) => s.setCrossFilter);
  const dashboards = useStore((s) => s.dashboards);
  const activeDashboardId = useStore((s) => s.activeDashboardId);
  const assignFieldToVisual = useStore((s) => s.assignFieldToVisual);
  const removeFieldFromVisual = useStore((s) => s.removeFieldFromVisual);
  const updateVisual = useStore((s) => s.updateVisual);
  const removeVisual = useStore((s) => s.removeVisual);
  const duplicateVisual = useStore((s) => s.duplicateVisual);
  const setActiveVisual = useStore((s) => s.setActiveVisual);
  const activeVisualId = useStore((s) => s.activeVisualId);
  const addVisualToDashboard = useStore((s) => s.addVisualToDashboard);

  const [targetDashboardId, setTargetDashboardId] = useState(activeDashboardId || dashboards[0]?.id || "");
  const [addedState, setAddedState] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Reference line form state
  const [rlValue, setRlValue] = useState("");
  const [rlLabel, setRlLabel] = useState("");
  const [rlColor, setRlColor] = useState("#ef4444");

  // Conditional rule form state
  const [crField, setCrField] = useState(visual.yFields?.[0] || "");
  const [crOp, setCrOp] = useState(">");
  const [crThreshold, setCrThreshold] = useState("");
  const [crColor, setCrColor] = useState("#ef4444");

  // Visual-level filter form state
  const [vfField, setVfField] = useState(columns.filter(c => dataTypes[c] !== "number")[0] || "");
  const [vfValue, setVfValue] = useState("");

  const chartRef = useRef(null);
  const isActive = activeVisualId === visual.id;

  const referenceLines = visual.referenceLines || [];
  const conditionalRules = visual.conditionalRules || [];
  const visualFilters = visual.filters || {};

  // Filterable (non-numeric) columns for visual-level filters
  const filterableCols = columns.filter((c) => dataTypes[c] !== "number");

  // Compute health warnings
  const healthWarnings = useMemo(() => {
    const w = [];
    if (!visual.xFields?.length) w.push("No X field assigned");
    if (!visual.yFields?.length) w.push("No Y field assigned");
    if (
      visual.xFields?.length &&
      visual.yFields?.length &&
      visual.chartType !== "kpi" &&
      visual.chartType !== "scatter"
    ) {
      const filtered = applyGlobalFilters(effectiveRows, filters);
      const data = buildVisualData({
        rows: filtered,
        xFields: visual.xFields,
        yFields: visual.yFields,
        legendField: visual.legendField,
        aggregation: visual.aggregation,
        sortDirection: visual.sortDirection,
      });
      if (!data.length) w.push("No data matches current filters");
    }
    return w;
  }, [visual, effectiveRows, filters]);

  const handleAddToDashboard = (e) => {
    e.stopPropagation();
    const dashboardId = targetDashboardId || dashboards[0]?.id;
    if (!dashboardId) return;
    addVisualToDashboard({ visualId: visual.id, dashboardId });
    setAddedState(true);
    window.setTimeout(() => setAddedState(false), 1200);
  };

  const handleExportPNG = async (e) => {
    e.stopPropagation();
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: T.surface,
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${visual.title || "chart"}.png`;
      a.click();
    } catch {
      // fail silently
    }
  };

  // Reference line helpers
  const addReferenceLine = () => {
    const val = parseFloat(rlValue);
    if (isNaN(val)) return;
    const next = [...referenceLines, { id: Date.now().toString(), value: val, label: rlLabel, color: rlColor }];
    updateVisual(visual.id, { referenceLines: next });
    setRlValue("");
    setRlLabel("");
  };
  const removeReferenceLine = (id) => updateVisual(visual.id, { referenceLines: referenceLines.filter((r) => r.id !== id) });

  // Conditional rule helpers
  const addConditionalRule = () => {
    if (!crField || crThreshold === "") return;
    const val = parseFloat(crThreshold);
    if (isNaN(val)) return;
    const next = [...conditionalRules, { id: Date.now().toString(), field: crField, operator: crOp, threshold: val, color: crColor }];
    updateVisual(visual.id, { conditionalRules: next });
    setCrThreshold("");
  };
  const removeConditionalRule = (id) => updateVisual(visual.id, { conditionalRules: conditionalRules.filter((r) => r.id !== id) });

  // Visual-level filter helpers
  const addVisualFilter = () => {
    if (!vfField || !vfValue) return;
    updateVisual(visual.id, { filters: { ...visualFilters, [vfField]: vfValue } });
    setVfValue("");
  };
  const removeVisualFilter = (field) => {
    const next = { ...visualFilters };
    delete next[field];
    updateVisual(visual.id, { filters: next });
  };

  const selectStyle = { background: T.s2, borderColor: T.border, color: T.text };
  const palette = getPalette(visual.colorPalette);

  return (
    <div
      onClick={() => setActiveVisual(visual.id)}
      className="rounded-xl border p-4 transition"
      style={{
        background: T.surface,
        borderColor: isActive ? T.accent : T.border,
        boxShadow: isActive
          ? "0 0 0 2px rgba(var(--dc-accent-rgb),0.14), 0 8px 24px rgba(0,0,0,0.20)"
          : "0 4px 16px rgba(0,0,0,0.12)",
        transition: "box-shadow 200ms ease, border-color 200ms ease",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={visual.title}
            onChange={(e) => updateVisual(visual.id, { title: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-semibold outline-none transition hover:border-current focus:border-current"
            style={{ color: T.text }}
            placeholder="Visual title…"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={handleExportPNG}
            className="inline-flex items-center rounded-xl border px-2.5 py-1.5"
            style={{ borderColor: T.border, color: T.dim, background: T.s2 }} title="Export PNG">
            <Download size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); duplicateVisual(visual.id); }}
            className="inline-flex items-center rounded-xl border px-2.5 py-1.5"
            style={{ borderColor: T.border, color: T.dim, background: T.s2 }} title="Duplicate">
            <Copy size={12} />
          </button>
          {onCollapse && (
            <button onClick={(e) => { e.stopPropagation(); onCollapse(); }}
              className="inline-flex items-center rounded-xl border px-2.5 py-1.5"
              style={{ borderColor: T.border, color: T.dim, background: T.s2 }} title="Collapse visual">
              <Minimize2 size={12} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); removeVisual(visual.id); }}
            className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs"
            style={{ borderColor: T.border, color: T.dim, background: T.s2 }}>
            <Trash2 size={12} /> Remove
          </button>
        </div>
      </div>

      {/* Health warnings */}
      {healthWarnings.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {healthWarnings.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium"
              style={{ background: "rgba(var(--dc-accent-rgb),0.10)", borderColor: "rgba(var(--dc-accent-rgb),0.28)", color: T.accent }}>
              <AlertTriangle size={11} />{w}
            </span>
          ))}
        </div>
      )}

      {/* Drop zones */}
      <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <DropZone label="X Axis" value={visual.xFields}
          onDropField={(field) => assignFieldToVisual({ visualId: visual.id, zone: "xFields", field })}
          onRemoveField={(field) => removeFieldFromVisual({ visualId: visual.id, zone: "xFields", field })} />
        <DropZone label="Y Axis" value={visual.yFields}
          onDropField={(field) => assignFieldToVisual({ visualId: visual.id, zone: "yFields", field })}
          onRemoveField={(field) => removeFieldFromVisual({ visualId: visual.id, zone: "yFields", field })} />
        <DropZone label="Legend" value={visual.legendField}
          onDropField={(field) => assignFieldToVisual({ visualId: visual.id, zone: "legendField", field })}
          onRemoveField={() => removeFieldFromVisual({ visualId: visual.id, zone: "legendField", field: visual.legendField })} />
        <DropZone label="Tooltip" value={visual.tooltipFields}
          onDropField={(field) => assignFieldToVisual({ visualId: visual.id, zone: "tooltipFields", field })}
          onRemoveField={(field) => removeFieldFromVisual({ visualId: visual.id, zone: "tooltipFields", field })} />
      </div>

      {/* Toolbar */}
      <div className="mb-3">
        <VisualToolbar
          chartType={visual.chartType}
          aggregation={visual.aggregation}
          sortDirection={visual.sortDirection}
          onChange={(patch) => updateVisual(visual.id, patch)}
        />
      </div>

      {/* AI Chart Suggestion */}
      {visual.xFields?.length > 0 && visual.yFields?.length > 0 && (
        <div className="mb-3">
          <AIChartSuggestion
            fields={[...(visual.xFields || []), ...(visual.yFields || [])]}
            dataTypes={dataTypes}
            sampleValues={(() => {
              const sv = {};
              [...(visual.xFields || []), ...(visual.yFields || [])].forEach((f) => {
                sv[f] = effectiveRows.slice(0, 5).map((r) => r[f]);
              });
              return sv;
            })()}
            onApply={(patch) => updateVisual(visual.id, patch)}
          />
        </div>
      )}

      {/* ── Advanced Settings — moved to the far-right pane (AdvancedSettingsPane) ── */}
      {false && (
      <div
        className="mb-3 rounded-xl border"
        style={{ background: T.s2, borderColor: T.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-semibold"
          style={{ color: T.text }}
        >
          <span className="flex items-center gap-2">
            <Settings2 size={12} style={{ color: T.accent }} />
            Advanced Settings
          </span>
          {advancedOpen ? <ChevronUp size={12} style={{ color: T.dim }} /> : <ChevronDown size={12} style={{ color: T.dim }} />}
        </button>

        {advancedOpen && (
          <div className="space-y-5 border-t px-4 pb-4 pt-4" style={{ borderColor: T.border }}>

            {/* ─ Chart Style ─ */}
            {["line","area","bar","stackedBar"].includes(visual.chartType) && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Chart Style</div>
                <div className="grid grid-cols-2 gap-3">

                  {/* Gridlines */}
                  <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                    <span className="text-xs" style={{ color: T.text }}>Gridlines</span>
                    <button onClick={() => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), showGridlines: (visual.chartStyle?.showGridlines ?? true) ? false : true } })}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                      style={{ background: (visual.chartStyle?.showGridlines ?? true) ? T.accent : T.border }}>
                      <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                        style={{ transform: (visual.chartStyle?.showGridlines ?? true) ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                    <span className="text-xs" style={{ color: T.text }}>Legend</span>
                    <button onClick={() => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), showLegend: (visual.chartStyle?.showLegend ?? true) ? false : true } })}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                      style={{ background: (visual.chartStyle?.showLegend ?? true) ? T.accent : T.border }}>
                      <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                        style={{ transform: (visual.chartStyle?.showLegend ?? true) ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                    </button>
                  </div>

                  {/* Axis Labels */}
                  <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                    <span className="text-xs" style={{ color: T.text }}>Axis Labels</span>
                    <button onClick={() => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), showAxisLabels: (visual.chartStyle?.showAxisLabels ?? true) ? false : true } })}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                      style={{ background: (visual.chartStyle?.showAxisLabels ?? true) ? T.accent : T.border }}>
                      <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                        style={{ transform: (visual.chartStyle?.showAxisLabels ?? true) ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                    </button>
                  </div>

                  {/* Markers (line/area) */}
                  {["line","area"].includes(visual.chartType) && (
                    <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                      <span className="text-xs" style={{ color: T.text }}>Markers</span>
                      <button onClick={() => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), showMarkers: !(visual.chartStyle?.showMarkers) } })}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                        style={{ background: visual.chartStyle?.showMarkers ? T.accent : T.border }}>
                        <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                          style={{ transform: visual.chartStyle?.showMarkers ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                      </button>
                    </div>
                  )}

                  {/* Area fill */}
                  {visual.chartType === "area" && (
                    <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                      <span className="text-xs" style={{ color: T.text }}>Area Fill</span>
                      <button onClick={() => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), areaFill: (visual.chartStyle?.areaFill ?? true) ? false : true } })}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                        style={{ background: (visual.chartStyle?.areaFill ?? true) ? T.accent : T.border }}>
                        <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                          style={{ transform: (visual.chartStyle?.areaFill ?? true) ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                      </button>
                    </div>
                  )}

                  {/* Smooth line */}
                  {["line","area"].includes(visual.chartType) && (
                    <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                      <span className="text-xs" style={{ color: T.text }}>Smooth Curve</span>
                      <button onClick={() => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), lineSmooth: (visual.chartStyle?.lineSmooth ?? true) ? false : true } })}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                        style={{ background: (visual.chartStyle?.lineSmooth ?? true) ? T.accent : T.border }}>
                        <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                          style={{ transform: (visual.chartStyle?.lineSmooth ?? true) ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                      </button>
                    </div>
                  )}
                </div>

                {["line","area"].includes(visual.chartType) && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {/* Line style */}
                    <div>
                      <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Line Style</div>
                      <select value={visual.chartStyle?.lineStyle || "solid"}
                        onChange={(e) => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), lineStyle: e.target.value } })}
                        className="w-full rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
                        <option value="solid">Solid ———</option>
                        <option value="dashed">Dashed - - -</option>
                        <option value="dotted">Dotted · · ·</option>
                      </select>
                    </div>
                    {/* Line thickness */}
                    <div>
                      <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Line Width: {visual.chartStyle?.lineWidth ?? 2}px</div>
                      <input type="range" min={1} max={8} value={visual.chartStyle?.lineWidth ?? 2}
                        onChange={(e) => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), lineWidth: +e.target.value } })}
                        style={{ width: "100%", accentColor: T.accent }} />
                    </div>
                    {/* Marker size (when markers on) */}
                    {visual.chartStyle?.showMarkers && (
                      <div>
                        <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Marker Size: {visual.chartStyle?.markerSize ?? 4}px</div>
                        <input type="range" min={2} max={12} value={visual.chartStyle?.markerSize ?? 4}
                          onChange={(e) => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), markerSize: +e.target.value } })}
                          style={{ width: "100%", accentColor: T.accent }} />
                      </div>
                    )}
                    {/* Area fill opacity */}
                    {visual.chartType === "area" && (visual.chartStyle?.areaFill ?? true) && (
                      <div>
                        <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Fill Opacity: {Math.round((visual.chartStyle?.areaFillOpacity ?? 0.18) * 100)}%</div>
                        <input type="range" min={5} max={80} value={Math.round((visual.chartStyle?.areaFillOpacity ?? 0.18) * 100)}
                          onChange={(e) => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), areaFillOpacity: +e.target.value / 100 } })}
                          style={{ width: "100%", accentColor: T.accent }} />
                      </div>
                    )}
                    {/* Axis font size */}
                    <div>
                      <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Axis Font: {visual.chartStyle?.axisFontSize ?? 11}px</div>
                      <input type="range" min={8} max={18} value={visual.chartStyle?.axisFontSize ?? 11}
                        onChange={(e) => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), axisFontSize: +e.target.value } })}
                        style={{ width: "100%", accentColor: T.accent }} />
                    </div>
                  </div>
                )}

                {/* Series color overrides */}
                {visual.yFields?.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 text-[11px] font-medium" style={{ color: T.dim }}>Series Colors</div>
                    <div className="space-y-1.5">
                      {visual.yFields.map((field, i) => (
                        <div key={field} className="flex items-center gap-2">
                          <ColorPickerInput
                            value={(visual.chartStyle?.seriesColors?.[field]) || getPalette(visual.colorPalette)[i % getPalette(visual.colorPalette).length]}
                            onChange={(c) => updateVisual(visual.id, { chartStyle: { ...(visual.chartStyle||{}), seriesColors: { ...(visual.chartStyle?.seriesColors||{}), [field]: c } } })}
                          />
                          <span className="text-xs truncate" style={{ color: T.text }}>{field}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─ Color Palette ─ */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Color Palette</div>
              <div className="flex flex-wrap gap-2">
                {PALETTE_LABELS.map(({ id, label }) => {
                  const pal = COLOR_PALETTES[id];
                  const isActive = (visual.colorPalette || "default") === id;
                  return (
                    <button
                      key={id}
                      onClick={() => updateVisual(visual.id, { colorPalette: id })}
                      className="flex flex-col items-center gap-1 rounded-xl border p-2 transition"
                      style={{
                        borderColor: isActive ? T.accent : T.border,
                        background: isActive ? T.accentDim : T.surface,
                      }}
                      title={label}
                    >
                      <div className="flex gap-0.5">
                        {pal.slice(0, 5).map((c, ci) => (
                          <span key={ci} className="h-3 w-3 rounded-full" style={{ background: c }} />
                        ))}
                      </div>
                      <span className="text-[9px] font-medium" style={{ color: isActive ? T.accent : T.muted }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─ Running Total + Trendline + AI toggles ─ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                <span className="text-xs" style={{ color: T.text }}>Running Total</span>
                <button
                  onClick={() => updateVisual(visual.id, { showRunningTotal: !visual.showRunningTotal })}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                  style={{ background: visual.showRunningTotal ? T.accent : T.border }}
                >
                  <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                    style={{ transform: visual.showRunningTotal ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                <span className="text-xs" style={{ color: T.text }}>Trendline</span>
                <button
                  onClick={() => updateVisual(visual.id, { showTrendline: !visual.showTrendline })}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                  style={{ background: visual.showTrendline ? T.accent : T.border }}
                >
                  <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                    style={{ transform: visual.showTrendline ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                <span className="text-xs" style={{ color: T.text }}>Anomaly Detection</span>
                <button
                  onClick={() => updateVisual(visual.id, { showAnomalies: !visual.showAnomalies })}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                  style={{ background: visual.showAnomalies ? T.accent : T.border }}
                >
                  <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                    style={{ transform: visual.showAnomalies ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                <span className="text-xs" style={{ color: T.text }}>Forecast</span>
                <button
                  onClick={() => updateVisual(visual.id, { showForecast: !visual.showForecast })}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                  style={{ background: visual.showForecast ? T.accent : T.border }}
                >
                  <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                    style={{ transform: visual.showForecast ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                </button>
              </div>
            </div>

            {/* ─ Forecast Settings (shown when forecast is on) ─ */}
            {visual.showForecast && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Forecast Periods</div>
                  <input
                    type="number" min={1} max={24}
                    value={visual.forecastPeriods || 6}
                    onChange={(e) => updateVisual(visual.id, { forecastPeriods: Math.max(1, Math.min(24, +e.target.value)) })}
                    className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none"
                    style={selectStyle}
                  />
                </div>
                <div>
                  <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Method</div>
                  <select
                    value={visual.forecastMethod || "linear"}
                    onChange={(e) => updateVisual(visual.id, { forecastMethod: e.target.value })}
                    className="w-full rounded-xl border px-2 py-1.5 text-sm outline-none"
                    style={selectStyle}
                  >
                    <option value="linear">Linear Regression</option>
                    <option value="ses">Exponential Smoothing</option>
                  </select>
                </div>
              </div>
            )}

            {/* ─ Visual-Level Filters ─ */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Filter size={11} style={{ color: T.accent }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Visual Filters</span>
                <span className="text-[10px]" style={{ color: T.muted }}>(per-visual override)</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <select value={vfField} onChange={(e) => { setVfField(e.target.value); setVfValue(""); }}
                  className="rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
                  {filterableCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={vfValue} onChange={(e) => setVfValue(e.target.value)}
                  className="flex-1 rounded-xl border px-2 py-1.5 text-sm outline-none" style={{ ...selectStyle, minWidth: 80 }}>
                  <option value="">— select —</option>
                  {getUniqueValues(effectiveRows, vfField).map((v) => (
                    <option key={String(v)} value={String(v)}>{String(v)}</option>
                  ))}
                </select>
                <button onClick={addVisualFilter}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium"
                  style={{ background: T.accentDim, borderColor: "rgba(var(--dc-accent-rgb),0.25)", color: T.accent }}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {Object.keys(visualFilters).length > 0 ? (
                <div className="space-y-1.5">
                  {Object.entries(visualFilters).map(([field, val]) => (
                    <div key={field} className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
                      style={{ background: T.surface, borderColor: T.border }}>
                      <span className="flex-1 text-sm mono" style={{ color: T.text }}>{field} = {String(val)}</span>
                      <button onClick={() => removeVisualFilter(field)} style={{ color: T.muted }}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: T.muted }}>No visual filters active.</p>
              )}
            </div>

            {/* ─ Reference Lines ─ */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Reference Lines</div>
              <div className="flex flex-wrap gap-2 mb-3">
                <input value={rlValue} onChange={(e) => setRlValue(e.target.value)} placeholder="Y value"
                  type="number" className="w-24 rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
                <input value={rlLabel} onChange={(e) => setRlLabel(e.target.value)} placeholder="Label (opt)"
                  className="flex-1 rounded-xl border px-3 py-1.5 text-sm outline-none" style={{ ...selectStyle, minWidth: 80 }} />
                <ColorPickerInput value={rlColor} onChange={setRlColor} />
                <button onClick={addReferenceLine}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium"
                  style={{ background: T.accentDim, borderColor: "rgba(var(--dc-accent-rgb),0.25)", color: T.accent }}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {referenceLines.length > 0 ? (
                <div className="space-y-1.5">
                  {referenceLines.map((rl) => (
                    <div key={rl.id} className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
                      style={{ background: T.surface, borderColor: T.border }}>
                      <span className="h-3 w-3 rounded-full" style={{ background: rl.color }} />
                      <span className="flex-1 text-sm" style={{ color: T.text }}>
                        {rl.label ? `${rl.label} (${rl.value})` : rl.value}
                      </span>
                      <button onClick={() => removeReferenceLine(rl.id)} style={{ color: T.muted }}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: T.muted }}>No reference lines. Renders on bar, line, and area charts.</p>
              )}
            </div>

            {/* ─ Conditional Formatting ─ */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Conditional Formatting</div>
              <div className="flex flex-wrap gap-2 mb-3">
                <select value={crField} onChange={(e) => setCrField(e.target.value)}
                  className="rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
                  {visual.yFields.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={crOp} onChange={(e) => setCrOp(e.target.value)}
                  className="rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
                  {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
                <input value={crThreshold} onChange={(e) => setCrThreshold(e.target.value)} placeholder="Threshold"
                  type="number" className="w-28 rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
                <ColorPickerInput value={crColor} onChange={setCrColor} />
                <button onClick={addConditionalRule}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium"
                  style={{ background: T.accentDim, borderColor: "rgba(var(--dc-accent-rgb),0.25)", color: T.accent }}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {conditionalRules.length > 0 ? (
                <div className="space-y-1.5">
                  {conditionalRules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
                      style={{ background: T.surface, borderColor: T.border }}>
                      <span className="h-3 w-3 rounded-full" style={{ background: rule.color }} />
                      <span className="flex-1 text-sm mono" style={{ color: T.text }}>
                        {rule.field} {rule.operator} {rule.threshold}
                      </span>
                      <button onClick={() => removeConditionalRule(rule.id)} style={{ color: T.muted }}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: T.muted }}>No rules. Colors bars based on value thresholds.</p>
              )}
            </div>

            {/* ─ Number Formatting ─ */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                Number Formatting
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Type</div>
                  <select
                    value={(visual.numFormat?.type) || "number"}
                    onChange={(e) => updateVisual(visual.id, { numFormat: { ...(visual.numFormat || {}), type: e.target.value } })}
                    className="w-full rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
                    <option value="number">Default</option>
                    <option value="whole">Whole Number</option>
                    <option value="decimal">Decimal</option>
                    <option value="percent">Percentage</option>
                    <option value="currency">Currency</option>
                    <option value="compact">Compact (K/M/B)</option>
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Decimal Places</div>
                  <input
                    type="number" min={0} max={10}
                    value={(visual.numFormat?.decimals) ?? 2}
                    onChange={(e) => updateVisual(visual.id, { numFormat: { ...(visual.numFormat || {}), decimals: Math.max(0, +e.target.value) } })}
                    className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
                </div>
                {(visual.numFormat?.type) === "currency" && (
                  <div>
                    <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Currency Symbol</div>
                    <input
                      value={(visual.numFormat?.currencySymbol) || "₹"}
                      onChange={(e) => updateVisual(visual.id, { numFormat: { ...(visual.numFormat || {}), currencySymbol: e.target.value } })}
                      className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
                  </div>
                )}
                <div>
                  <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Prefix</div>
                  <input
                    value={(visual.numFormat?.prefix) || ""}
                    onChange={(e) => updateVisual(visual.id, { numFormat: { ...(visual.numFormat || {}), prefix: e.target.value } })}
                    placeholder="e.g. $ "
                    className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
                </div>
                <div>
                  <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Suffix</div>
                  <input
                    value={(visual.numFormat?.suffix) || ""}
                    onChange={(e) => updateVisual(visual.id, { numFormat: { ...(visual.numFormat || {}), suffix: e.target.value } })}
                    placeholder="e.g. %"
                    className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Add to Dashboard */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5"
        style={{ background: T.s2, borderColor: T.border }}>
        <span className="text-xs font-semibold shrink-0" style={{ color: T.text }}>Add to Dashboard:</span>
        <select value={targetDashboardId} onChange={(e) => setTargetDashboardId(e.target.value)}
          className="flex-1 min-w-[140px] rounded-xl border px-2.5 py-1.5 text-xs outline-none"
          style={{ background: T.surface, borderColor: T.border, color: T.text }}
          onClick={(e) => e.stopPropagation()}>
          {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={handleAddToDashboard}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold btn-primary"
          style={{ background: addedState ? T.success : T.accent, color: addedState ? "#04120d" : "#000" }}>
          {addedState ? <Check size={12} /> : <LayoutDashboard size={12} />}
          {addedState ? "Added!" : "Add"}
        </button>
      </div>

      {/* Chart area */}
      <div ref={chartRef}>
        <VisualRenderer
          visual={visual}
          rawData={effectiveRows}
          filters={filters}
          crossFilter={crossFilter}
          onCrossFilter={(field, value) => setCrossFilter(field, value)}
        />
      </div>

      {/* AI Insights */}
      {visual.xFields?.length > 0 && visual.yFields?.length > 0 && (
        <AIInsightsPanel
          visual={visual}
          chartData={(() => {
            try {
              const filtered = applyGlobalFilters(effectiveRows, filters);
              return buildVisualData({
                rows: filtered,
                xFields: visual.xFields,
                yFields: visual.yFields,
                legendField: visual.legendField,
                aggregation: visual.aggregation,
                sortDirection: visual.sortDirection,
              });
            } catch {
              return [];
            }
          })()}
        />
      )}
    </div>
  );
}
