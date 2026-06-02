/**
 * AdvancedSettingsPane — far-right Report Builder pane that edits the ACTIVE
 * visual's advanced settings, organized into collapsible groups:
 *   Chart Style · Visual Filters · Conditional Formatting · Number Formatting
 *
 * Moved out of VisualCard so every visual is configured from one consistent
 * place. All existing controls/behavior are preserved (updateVisual).
 */

import { useState } from "react";
import {
  Settings2, ChevronRight, Plus, X, Filter, BarChart3,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useEffectiveData } from "../../hooks/useEffectiveData";
import { getUniqueValues } from "../../utils/filterEngine";
import { COLOR_PALETTES, PALETTE_LABELS, getPalette } from "../../styles/theme";
import ColorPickerInput from "./ColorPickerInput";

const OPERATORS = [">", "<", ">=", "<=", "=="];

function Group({ id, title, openMap, setOpenMap, T, children }) {
  const open = openMap[id] ?? true;
  return (
    <div className="rounded-xl border" style={{ borderColor: T.border, background: T.s2 }}>
      <button
        onClick={() => setOpenMap((m) => ({ ...m, [id]: !(m[id] ?? true) }))}
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-xs font-semibold"
        style={{ color: T.text }}
      >
        <ChevronRight size={12} style={{ color: T.muted, transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms" }} />
        {title}
      </button>
      {open && <div className="border-t px-3 py-3 space-y-4" style={{ borderColor: T.border }}>{children}</div>}
    </div>
  );
}

function Toggle({ on, onClick, T }) {
  return (
    <button onClick={onClick}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0"
      style={{ background: on ? T.accent : T.border }}>
      <span className="inline-block h-3 w-3 rounded-full bg-white transition"
        style={{ transform: on ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
    </button>
  );
}

function VisualAdvancedSettings({ visual, T }) {
  const { rows: effectiveRows, columns, dataTypes } = useEffectiveData();
  const updateVisual = useStore((s) => s.updateVisual);

  const [openMap, setOpenMap] = useState({});
  const [rlValue, setRlValue] = useState("");
  const [rlLabel, setRlLabel] = useState("");
  const [rlColor, setRlColor] = useState("#ef4444");
  const [crField, setCrField] = useState(visual.yFields?.[0] || "");
  const [crOp, setCrOp]       = useState(">");
  const [crThreshold, setCrThreshold] = useState("");
  const [crColor, setCrColor] = useState("#ef4444");
  const [vfField, setVfField] = useState(columns.filter((c) => dataTypes[c] !== "number")[0] || "");
  const [vfValue, setVfValue] = useState("");

  const referenceLines   = visual.referenceLines || [];
  const conditionalRules = visual.conditionalRules || [];
  const visualFilters    = visual.filters || {};
  const filterableCols   = columns.filter((c) => dataTypes[c] !== "number");
  const selectStyle = { background: T.s2, borderColor: T.border, color: T.text };
  const cs = visual.chartStyle || {};
  const set = (patch) => updateVisual(visual.id, patch);
  const setCS = (patch) => set({ chartStyle: { ...cs, ...patch } });

  const addReferenceLine = () => {
    const val = parseFloat(rlValue); if (isNaN(val)) return;
    set({ referenceLines: [...referenceLines, { id: Date.now().toString(), value: val, label: rlLabel, color: rlColor }] });
    setRlValue(""); setRlLabel("");
  };
  const addConditionalRule = () => {
    if (!crField || crThreshold === "") return;
    const val = parseFloat(crThreshold); if (isNaN(val)) return;
    set({ conditionalRules: [...conditionalRules, { id: Date.now().toString(), field: crField, operator: crOp, threshold: val, color: crColor }] });
    setCrThreshold("");
  };
  const addVisualFilter = () => {
    if (!vfField || !vfValue) return;
    set({ filters: { ...visualFilters, [vfField]: vfValue } });
    setVfValue("");
  };

  const styleable = ["line", "area", "bar", "stackedBar"].includes(visual.chartType);
  const lineLike  = ["line", "area"].includes(visual.chartType);

  return (
    <div className="space-y-3">
      {/* ── Chart Style ── */}
      <Group id="style" title="Chart Style" openMap={openMap} setOpenMap={setOpenMap} T={T}>
        {styleable && (
          <div className="grid grid-cols-1 gap-2">
            {[
              ["Gridlines",   "showGridlines",  true],
              ["Legend",      "showLegend",     true],
              ["Axis Labels", "showAxisLabels", true],
              ...(lineLike ? [["Markers", "showMarkers", false], ["Smooth Curve", "lineSmooth", true]] : []),
              ...(visual.chartType === "area" ? [["Area Fill", "areaFill", true]] : []),
            ].map(([label, key, dflt]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
                <span className="text-xs" style={{ color: T.text }}>{label}</span>
                <Toggle on={cs[key] ?? dflt} onClick={() => setCS({ [key]: !(cs[key] ?? dflt) })} T={T} />
              </div>
            ))}
          </div>
        )}

        {lineLike && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Line Style</div>
              <select value={cs.lineStyle || "solid"} onChange={(e) => setCS({ lineStyle: e.target.value })}
                className="w-full rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
                <option value="solid">Solid ———</option>
                <option value="dashed">Dashed - - -</option>
                <option value="dotted">Dotted · · ·</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Line Width: {cs.lineWidth ?? 2}px</div>
              <input type="range" min={1} max={8} value={cs.lineWidth ?? 2}
                onChange={(e) => setCS({ lineWidth: +e.target.value })} style={{ width: "100%", accentColor: T.accent }} />
            </div>
            {cs.showMarkers && (
              <div>
                <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Marker Size: {cs.markerSize ?? 4}px</div>
                <input type="range" min={2} max={12} value={cs.markerSize ?? 4}
                  onChange={(e) => setCS({ markerSize: +e.target.value })} style={{ width: "100%", accentColor: T.accent }} />
              </div>
            )}
            {visual.chartType === "area" && (cs.areaFill ?? true) && (
              <div>
                <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Fill Opacity: {Math.round((cs.areaFillOpacity ?? 0.18) * 100)}%</div>
                <input type="range" min={5} max={80} value={Math.round((cs.areaFillOpacity ?? 0.18) * 100)}
                  onChange={(e) => setCS({ areaFillOpacity: +e.target.value / 100 })} style={{ width: "100%", accentColor: T.accent }} />
              </div>
            )}
            {styleable && (
              <div>
                <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Axis Font: {cs.axisFontSize ?? 11}px</div>
                <input type="range" min={8} max={18} value={cs.axisFontSize ?? 11}
                  onChange={(e) => setCS({ axisFontSize: +e.target.value })} style={{ width: "100%", accentColor: T.accent }} />
              </div>
            )}
          </div>
        )}

        {/* Series colors */}
        {visual.yFields?.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-medium" style={{ color: T.dim }}>Series Colors</div>
            <div className="space-y-1.5">
              {visual.yFields.map((field, i) => (
                <div key={field} className="flex items-center gap-2">
                  <ColorPickerInput
                    value={(cs.seriesColors?.[field]) || getPalette(visual.colorPalette)[i % getPalette(visual.colorPalette).length]}
                    onChange={(c) => setCS({ seriesColors: { ...(cs.seriesColors || {}), [field]: c } })}
                  />
                  <span className="text-xs truncate" style={{ color: T.text }}>{field}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Color palette */}
        <div>
          <div className="mb-2 text-[11px] font-medium" style={{ color: T.dim }}>Color Palette</div>
          <div className="flex flex-wrap gap-2">
            {PALETTE_LABELS.map(({ id, label }) => {
              const pal = COLOR_PALETTES[id];
              const isOn = (visual.colorPalette || "default") === id;
              return (
                <button key={id} onClick={() => set({ colorPalette: id })} title={label}
                  className="flex flex-col items-center gap-1 rounded-xl border p-2 transition"
                  style={{ borderColor: isOn ? T.accent : T.border, background: isOn ? T.accentDim : T.surface }}>
                  <div className="flex gap-0.5">
                    {pal.slice(0, 5).map((c, ci) => <span key={ci} className="h-3 w-3 rounded-full" style={{ background: c }} />)}
                  </div>
                  <span className="text-[9px] font-medium" style={{ color: isOn ? T.accent : T.muted }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Analytics toggles */}
        <div className="grid grid-cols-1 gap-2">
          {[
            ["Running Total",     "showRunningTotal"],
            ["Trendline",         "showTrendline"],
            ["Anomaly Detection", "showAnomalies"],
            ["Forecast",          "showForecast"],
          ].map(([label, key]) => (
            <div key={key} className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
              <span className="text-xs" style={{ color: T.text }}>{label}</span>
              <Toggle on={!!visual[key]} onClick={() => set({ [key]: !visual[key] })} T={T} />
            </div>
          ))}
        </div>
        {visual.showForecast && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Forecast Periods</div>
              <input type="number" min={1} max={24} value={visual.forecastPeriods || 6}
                onChange={(e) => set({ forecastPeriods: Math.max(1, Math.min(24, +e.target.value)) })}
                className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
            </div>
            <div>
              <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Method</div>
              <select value={visual.forecastMethod || "linear"} onChange={(e) => set({ forecastMethod: e.target.value })}
                className="w-full rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
                <option value="linear">Linear Regression</option>
                <option value="ses">Exponential Smoothing</option>
              </select>
            </div>
          </div>
        )}

        {/* Reference lines */}
        <div>
          <div className="mb-2 text-[11px] font-medium" style={{ color: T.dim }}>Reference Lines</div>
          <div className="flex flex-wrap gap-2 mb-2">
            <input value={rlValue} onChange={(e) => setRlValue(e.target.value)} placeholder="Y value" type="number"
              className="w-20 rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle} />
            <input value={rlLabel} onChange={(e) => setRlLabel(e.target.value)} placeholder="Label"
              className="flex-1 rounded-xl border px-2 py-1.5 text-sm outline-none" style={{ ...selectStyle, minWidth: 60 }} />
            <ColorPickerInput value={rlColor} onChange={setRlColor} />
            <button onClick={addReferenceLine}
              className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-sm font-medium"
              style={{ background: T.accentDim, borderColor: "rgba(var(--dc-accent-rgb),0.25)", color: T.accent }}>
              <Plus size={13} />
            </button>
          </div>
          {referenceLines.length > 0 && (
            <div className="space-y-1.5">
              {referenceLines.map((rl) => (
                <div key={rl.id} className="flex items-center gap-2 rounded-xl border px-3 py-1.5" style={{ background: T.surface, borderColor: T.border }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: rl.color }} />
                  <span className="flex-1 text-sm" style={{ color: T.text }}>{rl.label ? `${rl.label} (${rl.value})` : rl.value}</span>
                  <button onClick={() => set({ referenceLines: referenceLines.filter((r) => r.id !== rl.id) })} style={{ color: T.muted }}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Group>

      {/* ── Visual Filters ── */}
      <Group id="vfilters" title="Visual Filters" openMap={openMap} setOpenMap={setOpenMap} T={T}>
        <div className="flex flex-wrap gap-2">
          <select value={vfField} onChange={(e) => { setVfField(e.target.value); setVfValue(""); }}
            className="rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
            {filterableCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={vfValue} onChange={(e) => setVfValue(e.target.value)}
            className="flex-1 rounded-xl border px-2 py-1.5 text-sm outline-none" style={{ ...selectStyle, minWidth: 80 }}>
            <option value="">— select —</option>
            {getUniqueValues(effectiveRows, vfField).map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
          </select>
          <button onClick={addVisualFilter}
            className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-sm font-medium"
            style={{ background: T.accentDim, borderColor: "rgba(var(--dc-accent-rgb),0.25)", color: T.accent }}>
            <Plus size={13} />
          </button>
        </div>
        {Object.keys(visualFilters).length > 0 ? (
          <div className="space-y-1.5">
            {Object.entries(visualFilters).map(([field, val]) => (
              <div key={field} className="flex items-center gap-2 rounded-xl border px-3 py-1.5" style={{ background: T.surface, borderColor: T.border }}>
                <span className="flex-1 text-sm mono" style={{ color: T.text }}>{field} = {String(val)}</span>
                <button onClick={() => { const n = { ...visualFilters }; delete n[field]; set({ filters: n }); }} style={{ color: T.muted }}><X size={13} /></button>
              </div>
            ))}
          </div>
        ) : <p className="text-xs" style={{ color: T.muted }}>No visual filters active.</p>}
      </Group>

      {/* ── Conditional Formatting ── */}
      <Group id="cond" title="Conditional Formatting" openMap={openMap} setOpenMap={setOpenMap} T={T}>
        <div className="flex flex-wrap gap-2">
          <select value={crField} onChange={(e) => setCrField(e.target.value)}
            className="rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
            {(visual.yFields || []).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={crOp} onChange={(e) => setCrOp(e.target.value)}
            className="rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle}>
            {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          <input value={crThreshold} onChange={(e) => setCrThreshold(e.target.value)} placeholder="Threshold" type="number"
            className="w-24 rounded-xl border px-2 py-1.5 text-sm outline-none" style={selectStyle} />
          <ColorPickerInput value={crColor} onChange={setCrColor} />
          <button onClick={addConditionalRule}
            className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-sm font-medium"
            style={{ background: T.accentDim, borderColor: "rgba(var(--dc-accent-rgb),0.25)", color: T.accent }}>
            <Plus size={13} />
          </button>
        </div>
        {conditionalRules.length > 0 ? (
          <div className="space-y-1.5">
            {conditionalRules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-2 rounded-xl border px-3 py-1.5" style={{ background: T.surface, borderColor: T.border }}>
                <span className="h-3 w-3 rounded-full" style={{ background: rule.color }} />
                <span className="flex-1 text-sm mono" style={{ color: T.text }}>{rule.field} {rule.operator} {rule.threshold}</span>
                <button onClick={() => set({ conditionalRules: conditionalRules.filter((r) => r.id !== rule.id) })} style={{ color: T.muted }}><X size={13} /></button>
              </div>
            ))}
          </div>
        ) : <p className="text-xs" style={{ color: T.muted }}>No rules.</p>}
      </Group>

      {/* ── Number Formatting ── */}
      <Group id="numfmt" title="Number Formatting" openMap={openMap} setOpenMap={setOpenMap} T={T}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Type</div>
            <select value={(visual.numFormat?.type) || "number"}
              onChange={(e) => set({ numFormat: { ...(visual.numFormat || {}), type: e.target.value } })}
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
            <input type="number" min={0} max={10} value={(visual.numFormat?.decimals) ?? 2}
              onChange={(e) => set({ numFormat: { ...(visual.numFormat || {}), decimals: Math.max(0, +e.target.value) } })}
              className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
          </div>
          {(visual.numFormat?.type) === "currency" && (
            <div>
              <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Currency Symbol</div>
              <input value={(visual.numFormat?.currencySymbol) || "₹"}
                onChange={(e) => set({ numFormat: { ...(visual.numFormat || {}), currencySymbol: e.target.value } })}
                className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
            </div>
          )}
          <div>
            <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Prefix</div>
            <input value={(visual.numFormat?.prefix) || ""} placeholder="e.g. $"
              onChange={(e) => set({ numFormat: { ...(visual.numFormat || {}), prefix: e.target.value } })}
              className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
          </div>
          <div>
            <div className="mb-1 text-[11px]" style={{ color: T.dim }}>Suffix</div>
            <input value={(visual.numFormat?.suffix) || ""} placeholder="e.g. %"
              onChange={(e) => set({ numFormat: { ...(visual.numFormat || {}), suffix: e.target.value } })}
              className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle} />
          </div>
        </div>
      </Group>
    </div>
  );
}

export default function AdvancedSettingsPane({ T }) {
  const visuals        = useStore((s) => s.visuals);
  const activeVisualId = useStore((s) => s.activeVisualId);
  const active = visuals.find((v) => v.id === activeVisualId) || visuals[0] || null;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 flex items-center gap-2 px-4 pt-4 pb-2.5">
        <Settings2 size={13} style={{ color: T.accent }} />
        <div>
          <h2 className="text-[13px] font-semibold leading-none" style={{ color: T.text }}>Advanced Settings</h2>
          <p className="mt-1 text-[11px]" style={{ color: T.muted }}>
            {active ? (active.title || "Active visual") : "Select a visual"}
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
        {active ? (
          <VisualAdvancedSettings key={active.id} visual={active} T={T} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <BarChart3 size={24} style={{ color: T.border }} />
            <p className="text-xs" style={{ color: T.muted }}>Add or select a visual to edit its settings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
