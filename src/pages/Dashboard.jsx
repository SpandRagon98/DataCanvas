import {
  Plus, Pencil, Trash2, LayoutDashboard, Grid3x3, Maximize2, X,
  ChevronLeft, ChevronRight, StickyNote, Download, Type as TypeIcon,
  Palette, Hash, AlignLeft, Settings2, Sparkles,
  Loader2, RefreshCw, AlertCircle, Filter, MousePointer, GripVertical, Layers,
} from "lucide-react";
import {
  useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import DashboardSlicer from "../components/dashboard/DashboardSlicer";
import DashboardButton from "../components/dashboard/DashboardButton";
import MetricVisual, { MetricBody } from "../components/dashboard/MetricVisual";
import LayersPanel from "../components/dashboard/LayersPanel";
import html2canvas        from "html2canvas";
import { useStore }       from "../store/useStore";
import { DEFAULT_TILE_STYLE } from "../store/useStore";
import { useEffectiveData }   from "../hooks/useEffectiveData";
import VisualRenderer     from "../components/builder/VisualRenderer";
import VirtualDashboardItem   from "../components/dashboard/VirtualDashboardItem";
import ColorPickerInput   from "../components/builder/ColorPickerInput";
import { useTheme }       from "../styles/theme";
import { callAI, AI_ENABLED } from "../services/aiClient";

const GRID_SIZE = 40;
const snap = (v) => Math.round(v / GRID_SIZE) * GRID_SIZE;

const ANNOTATION_COLORS = [
  "rgba(20,184,166,0.18)", "rgba(96,165,250,0.18)",
  "rgba(16,185,129,0.18)", "rgba(239,68,68,0.18)",
  "rgba(167,139,250,0.18)",
];

// ── ResponsiveChart: uses ResizeObserver so charts fill the tile exactly ─────
function ResponsiveChart({ visual, rawData, filters, crossFilter }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 60, overflow: "hidden" }}>
      {size.w > 0 && size.h > 0 && (
        <VisualRenderer
          visual={visual}
          rawData={rawData}
          filters={filters}
          crossFilter={crossFilter}
          compact
          containerWidth={size.w}
          containerHeight={size.h}
        />
      )}
    </div>
  );
}

// ── AI Insights popup button (corner icon → fixed popup) ─────────────────────
function TileAIInsightsButton({ visual, chartData, T }) {
  const btnRef     = useRef(null);
  const [open,     setOpen]     = useState(false);
  const [pos,      setPos]      = useState({ top: 0, right: 0 });
  const [insights, setInsights] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const cacheKeyRef = useRef("");

  const cacheKey = JSON.stringify({
    chartType:   visual?.chartType,
    xFields:     visual?.xFields,
    yFields:     visual?.yFields,
    aggregation: visual?.aggregation,
    dataLen:     chartData?.length,
  });

  const fetchInsights = useCallback(async (force = false) => {
    if (!force && cacheKeyRef.current === cacheKey && insights) return;
    setLoading(true);
    setError("");
    try {
      const result = await callAI({
        task: "insights",
        payload: {
          chartType:   visual?.chartType,
          xAxis:       visual?.xFields?.join(", ") || "",
          yAxis:       visual?.yFields?.join(", ") || "",
          aggregation: visual?.aggregation || "sum",
          data:        (chartData || []).slice(0, 30),
        },
      });
      setInsights(result);
      cacheKeyRef.current = cacheKey;
    } catch (err) {
      setError(err.message || "Failed to generate insights.");
    } finally {
      setLoading(false);
    }
  }, [cacheKey, chartData, visual, insights]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest("[data-ai-popup]") && !e.target.closest("[data-ai-btn]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!AI_ENABLED || !chartData?.length) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) {
        setPos({
          top:   rect.bottom + 6,
          right: window.innerWidth - rect.right,
        });
      }
      if (!insights && !loading) fetchInsights();
    }
    setOpen((o) => !o);
  };

  return (
    <>
      {/* Sparkle button */}
      <button
        ref={btnRef}
        data-ai-btn="1"
        onClick={handleClick}
        title="AI Insights"
        className="flex h-6 w-6 items-center justify-center rounded-md border transition hover:opacity-90"
        style={{
          background: open ? T.accent + "22" : T.s2,
          borderColor: open ? T.accent : T.border,
          color: T.accent,
          flexShrink: 0,
        }}
      >
        <Sparkles size={11} />
      </button>

      {/* Floating popup — rendered in document.body via portal */}
      {open && createPortal(
        <div
          data-ai-popup="1"
          className="fixed z-[9999] rounded-xl border shadow-2xl flex flex-col"
          style={{
            top:       pos.top,
            right:     pos.right,
            width:     320,
            maxHeight: 420,
            background: T.surface,
            borderColor: T.border,
          }}
        >
          {/* Popup header */}
          <div
            className="flex items-center justify-between gap-2 px-4 py-2.5 border-b shrink-0"
            style={{ borderColor: T.border }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: T.accent }} />
              <span className="text-xs font-semibold" style={{ color: T.text }}>
                AI Insights
              </span>
              {visual?.title && (
                <span className="text-[10px] truncate max-w-[120px]" style={{ color: T.muted }}>
                  · {visual.title}
                </span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="rounded-md p-0.5 opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: T.text }}
            >
              <X size={12} />
            </button>
          </div>

          {/* Popup body */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {loading && (
              <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
                <Loader2 size={12} className="animate-spin" />
                Generating insights…
              </div>
            )}
            {error && !loading && (
              <div
                className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}
              >
                <AlertCircle size={11} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            {insights && !loading && (
              <div className="space-y-1.5">
                {insights.split("\n").filter(Boolean).map((line, i) => (
                  <p key={i} className="text-xs leading-relaxed" style={{ color: T.dim }}>{line}</p>
                ))}
              </div>
            )}
            {!insights && !loading && !error && (
              <div className="text-center py-4">
                <p className="text-xs mb-3" style={{ color: T.muted }}>
                  Get AI-powered observations about this chart.
                </p>
                <button
                  onClick={() => fetchInsights()}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  style={{ background: T.accentDim, borderColor: T.accent + "44", color: T.accent }}
                >
                  <Sparkles size={11} /> Generate Insights
                </button>
              </div>
            )}
          </div>

          {/* Popup footer — refresh */}
          {insights && !loading && (
            <div className="px-4 py-2 border-t shrink-0" style={{ borderColor: T.border }}>
              <button
                onClick={() => fetchInsights(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium"
                style={{ color: T.accent }}
              >
                <RefreshCw size={10} /> Refresh
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Annotation sticky note ────────────────────────────────────────────────────
function Annotation({ ann, dashboardId, snapEnabled, T }) {
  const updateDashboardAnnotation = useStore((s) => s.updateDashboardAnnotation);
  const removeDashboardAnnotation = useStore((s) => s.removeDashboardAnnotation);
  const [editing,  setEditing]  = useState(false);
  const [colorIdx, setColorIdx] = useState(
    Math.max(0, ANNOTATION_COLORS.indexOf(ann.color))
  );

  const beginDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sp = { x: ann.x, y: ann.y };
    const onMove = (mv) => {
      let nx = Math.max(0, sp.x + mv.clientX - sx);
      let ny = Math.max(0, sp.y + mv.clientY - sy);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const cycleColor = (e) => {
    e.stopPropagation();
    const next = (colorIdx + 1) % ANNOTATION_COLORS.length;
    setColorIdx(next);
    updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { color: ANNOTATION_COLORS[next] } });
  };

  return (
    <div className="absolute rounded-lg border shadow-md"
      style={{ left: ann.x, top: ann.y, width: ann.w || 220, background: ann.color || ANNOTATION_COLORS[0], borderColor: T.border, zIndex: 10 }}>
      <div className="flex cursor-move items-center justify-between gap-2 rounded-t-[14px] px-3 py-2"
        style={{ background: "rgba(0,0,0,0.08)" }} onMouseDown={beginDrag}>
        <button onClick={cycleColor} className="h-4 w-4 rounded-full border-2 border-white"
          style={{ background: ann.color }} title="Change color" />
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing((o) => !o)}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(0,0,0,0.15)", color: T.text }}>{editing ? "Done" : "Edit"}</button>
          <button onClick={() => removeDashboardAnnotation({ dashboardId, annotationId: ann.id })}
            className="rounded-md p-0.5" style={{ color: T.muted }}><X size={12} /></button>
        </div>
      </div>
      {editing ? (
        <textarea autoFocus value={ann.text}
          onChange={(e) => updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { text: e.target.value } })}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full resize-none rounded-b-[14px] bg-transparent px-3 py-2 text-sm outline-none"
          style={{ color: T.text, minHeight: 72 }} />
      ) : (
        <div className="cursor-text whitespace-pre-wrap break-words px-3 py-2 text-sm"
          style={{ color: T.text, minHeight: 56 }} onDoubleClick={() => setEditing(true)}>
          {ann.text || "Double-click to edit"}
        </div>
      )}
    </div>
  );
}

// ── Enhanced TextboxItem ──────────────────────────────────────────────────────
function TextboxItem({ item, dashboardId, snapEnabled, isSelected, onSelect, canvasRef, T }) {
  const updateDashboardItem        = useStore((s) => s.updateDashboardItem);
  const updateDashboardItemLayout  = useStore((s) => s.updateDashboardItemLayout);
  const removeDashboardItem        = useStore((s) => s.removeDashboardItem);
  const [editing, setEditing] = useState(false);

  const ts   = item.textStyle || {};
  const tile = item.tileStyle || {};

  const bgColor      = tile.bgColor || "transparent";
  const borderWidth  = tile.borderWidth ?? 1;
  const borderColor  = tile.borderEnabled !== false ? (tile.borderColor || T.border) : "transparent";
  const borderRadius = tile.borderRadius ?? 8;
  const shadow       = tile.shadow !== false ? (tile.shadowValue || "0 2px 8px rgba(0,0,0,0.12)") : "none";
  const padding      = tile.padding ?? 12;
  const opacity      = tile.transparency ?? 1;

  const beginMove = (e) => {
    e.preventDefault(); e.stopPropagation();
    onSelect();
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds) return;
      let nx = Math.max(0, Math.min(sl.x + mv.clientX - sx, bounds.width - sl.w));
      let ny = Math.max(0, sl.y + mv.clientY - sy);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardItemLayout({ dashboardId, itemId: item.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const beginResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds) return;
      const nw = Math.max(sl.minW || 80,  Math.min(sl.w + mv.clientX - sx, bounds.width - sl.x));
      const nh = Math.max(sl.minH || 40,  sl.h + mv.clientY - sy);
      updateDashboardItemLayout({ dashboardId, itemId: item.id, patch: { w: nw, h: nh } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const textContentStyle = {
    padding,
    color:       ts.color      || tile.textColor || T.text,
    fontFamily:  ts.fontFamily || tile.fontFamily || "inherit",
    fontSize:    ts.fontSize   || 15,
    fontWeight:  ts.fontWeight || 400,
    fontStyle:   ts.italic     ? "italic" : "normal",
    textAlign:   ts.align      || "left",
    lineHeight:  ts.lineHeight || 1.5,
    wordBreak:   ts.noWrap     ? "normal" : "break-word",
    whiteSpace:  ts.noWrap     ? "nowrap" : "pre-wrap",
  };

  return (
    <div
      onClick={onSelect}
      className="absolute"
      style={{
        left: item.layout.x, top: item.layout.y,
        width: item.layout.w, height: item.layout.h,
        background: bgColor, borderRadius,
        border: `${tile.borderEnabled !== false ? borderWidth : 0}px solid ${borderColor}`,
        boxShadow: isSelected ? `0 0 0 2px ${T.accent}, ${shadow}` : shadow,
        opacity, overflow: "hidden",
        zIndex: isSelected ? 5 : 2,
      }}
    >
      {/* Drag handle */}
      <div
        className="flex cursor-move items-center justify-between gap-2 px-2 py-1"
        style={{ background: "rgba(0,0,0,0.06)", minHeight: 28 }}
        onMouseDown={beginMove}
      >
        <TypeIcon size={10} style={{ color: T.muted, flexShrink: 0 }} />
        <button
          onClick={(e) => { e.stopPropagation(); removeDashboardItem({ dashboardId, itemId: item.id }); }}
          className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: T.dim }}><X size={11} /></button>
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={item.text}
          onChange={(e) => updateDashboardItem({ dashboardId, itemId: item.id, patch: { text: e.target.value } })}
          onBlur={() => setEditing(false)}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full resize-none bg-transparent outline-none"
          style={{ ...textContentStyle, height: "calc(100% - 28px)" }}
        />
      ) : (
        <div
          className="cursor-text overflow-auto"
          style={{ ...textContentStyle, height: "calc(100% - 28px)" }}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
        >
          {item.text || <span style={{ opacity: 0.35 }}>Double-click to edit text…</span>}
        </div>
      )}

      {/* Resize handle */}
      <button
        className="absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm"
        style={{ borderRight: `2px solid ${T.accent}`, borderBottom: `2px solid ${T.accent}`, opacity: 0.7 }}
        onMouseDown={beginResize} title="Resize" />
    </div>
  );
}

// ── Tile Format Panel ─────────────────────────────────────────────────────────
function TileFormatPanel({ item, dashboardId, T }) {
  const updateDashboardItem = useStore((s) => s.updateDashboardItem);

  if (!item) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 py-8 text-center">
      <Settings2 size={28} style={{ color: T.muted }} />
      <p className="text-xs" style={{ color: T.muted }}>Select a tile on the canvas to format it</p>
    </div>
  );

  const tile = item.tileStyle   || {};
  const ts   = item.textStyle   || {};
  const vc   = item.visualConfig || {};
  const nf   = vc.numFormat     || {};
  const bc   = item.buttonConfig || {};

  const patchTile   = (patch) => updateDashboardItem({ dashboardId, itemId: item.id, patch: { tileStyle: { ...DEFAULT_TILE_STYLE, ...tile, ...patch } } });
  const patchText   = (patch) => updateDashboardItem({ dashboardId, itemId: item.id, patch: { textStyle: { ...ts, ...patch } } });
  const patchButton = (patch) => updateDashboardItem({ dashboardId, itemId: item.id, patch: { buttonConfig: { ...bc, ...patch } } });
  const patchVisual = (patch) => {
    if (item.type !== "visual") return;
    updateDashboardItem({ dashboardId, itemId: item.id, patch: { visualConfig: { ...vc, ...patch } } });
  };
  const patchNumFmt = (patch) => {
    if (item.type !== "visual") return;
    updateDashboardItem({ dashboardId, itemId: item.id, patch: { visualConfig: { ...vc, numFormat: { ...nf, ...patch } } } });
  };
  const patchItem = (patch) => updateDashboardItem({ dashboardId, itemId: item.id, patch });

  const iLabel  = { display: "block", fontSize: 11, color: T.muted, marginBottom: 3 };
  const iSelect = { background: T.s2, borderColor: T.border, color: T.text, width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 8, border: `1px solid ${T.border}`, outline: "none" };
  const Toggle  = ({ val, onChange }) => (
    <button onClick={() => onChange(!val)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0"
      style={{ background: val ? T.accent : T.border }}>
      <span className="inline-block h-3 w-3 rounded-full bg-white transition"
        style={{ transform: val ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
    </button>
  );

  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{ fontSize: 12, color: T.text }}>
      <div className="sticky top-0 px-4 py-2.5 border-b shrink-0"
        style={{ background: T.surface, borderColor: T.border }}>
        <div className="font-semibold" style={{ color: T.text }}>Format Tile</div>
        <div className="text-[11px]" style={{ color: T.muted }}>
          {item.type === "textbox" ? "Text Box"
            : item.type === "metric" ? "Metric"
            : item.type === "dbutton" ? "Button"
            : item.type === "slicer" ? "Slicer"
            : (vc.title || "Visual")}
        </div>
      </div>

      <div className="px-4 py-3 space-y-5">

        {/* ── Metric display options ── */}
        {item.type === "metric" && (
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: T.muted }}><Settings2 size={10} /> Metric Display</div>
            <div className="space-y-2.5">
              <div>
                <label style={iLabel}>Display as</label>
                <div className="flex gap-1.5">
                  {["table", "chart"].map((d) => (
                    <button key={d} onClick={() => patchItem({ displayAs: d })}
                      className="flex-1 rounded-lg border py-1.5 text-xs capitalize transition"
                      style={{ background: (item.displayAs || "table") === d ? T.accent : T.s2, color: (item.displayAs || "table") === d ? "#000" : T.text, borderColor: T.border }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {item.displayAs === "chart" && (
                <div>
                  <label style={iLabel}>Chart type</label>
                  <select value={item.chartType || "bar"} onChange={(e) => patchItem({ chartType: e.target.value })} style={iSelect}>
                    <option value="column">Column</option>
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                  </select>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Tile Styling ── */}
        <section>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
            style={{ color: T.muted }}><Palette size={10} /> Tile Style</div>
          <div className="space-y-2.5">
            <div>
              <label style={iLabel}>Background</label>
              <ColorPickerInput value={tile.bgColor || "#1a1a2e"} onChange={(c) => patchTile({ bgColor: c })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label style={{ ...iLabel, marginBottom: 0 }}>Border</label>
                <Toggle val={tile.borderEnabled !== false} onChange={(v) => patchTile({ borderEnabled: v })} />
              </div>
              {tile.borderEnabled !== false && (
                <div className="mt-1.5 space-y-1.5">
                  <ColorPickerInput value={tile.borderColor || T.border} onChange={(c) => patchTile({ borderColor: c })} />
                  <div>
                    <label style={iLabel}>Border Width: {tile.borderWidth ?? 1}px</label>
                    <input type="range" min={1} max={6} value={tile.borderWidth ?? 1}
                      onChange={(e) => patchTile({ borderWidth: +e.target.value })}
                      style={{ width: "100%", accentColor: T.accent }} />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label style={iLabel}>Corner Radius: {tile.borderRadius ?? 8}px</label>
              <input type="range" min={0} max={32} value={tile.borderRadius ?? 8}
                onChange={(e) => patchTile({ borderRadius: +e.target.value })}
                style={{ width: "100%", accentColor: T.accent }} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label style={{ ...iLabel, marginBottom: 0 }}>Shadow</label>
                <Toggle val={tile.shadow !== false} onChange={(v) => patchTile({ shadow: v })} />
              </div>
            </div>
            <div>
              <label style={iLabel}>Opacity: {Math.round((tile.transparency ?? 1) * 100)}%</label>
              <input type="range" min={10} max={100} value={Math.round((tile.transparency ?? 1) * 100)}
                onChange={(e) => patchTile({ transparency: +e.target.value / 100 })}
                style={{ width: "100%", accentColor: T.accent }} />
            </div>
            <div>
              <label style={iLabel}>Padding: {tile.padding ?? 0}px</label>
              <input type="range" min={0} max={32} value={tile.padding ?? 0}
                onChange={(e) => patchTile({ padding: +e.target.value })}
                style={{ width: "100%", accentColor: T.accent }} />
            </div>
          </div>
        </section>

        {/* ── Title (visual tiles) ── */}
        {item.type === "visual" && (
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: T.muted }}><TypeIcon size={10} /> Title</div>
            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <label style={{ ...iLabel, marginBottom: 0 }}>Show Title</label>
                  <Toggle val={tile.showTitle !== false} onChange={(v) => patchTile({ showTitle: v })} />
                </div>
              </div>
              {tile.showTitle !== false && (
                <>
                  <div>
                    <label style={iLabel}>Title Text</label>
                    <input
                      value={vc.title || ""}
                      onChange={(e) => patchVisual({ title: e.target.value })}
                      className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                      style={{ background: T.s2, borderColor: T.border, color: T.text }}
                    />
                  </div>
                  <div>
                    <label style={iLabel}>Title Size: {tile.titleSize ?? 13}px</label>
                    <input type="range" min={10} max={28} value={tile.titleSize ?? 13}
                      onChange={(e) => patchTile({ titleSize: +e.target.value })}
                      style={{ width: "100%", accentColor: T.accent }} />
                  </div>
                  <div>
                    <label style={iLabel}>Title Color</label>
                    <ColorPickerInput value={tile.titleColor || T.text} onChange={(c) => patchTile({ titleColor: c })} />
                  </div>
                  <div>
                    <label style={iLabel}>Title Align</label>
                    <div className="flex gap-1.5">
                      {["left","center","right"].map((a) => (
                        <button key={a} onClick={() => patchTile({ titleAlign: a })}
                          className="flex-1 rounded-lg border py-1 text-xs capitalize transition"
                          style={{ background: (tile.titleAlign || "left") === a ? T.accent : T.s2, color: (tile.titleAlign || "left") === a ? "#000" : T.text, borderColor: T.border }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* ── Chart Options (visual tiles) ── */}
        {item.type === "visual" && (
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: T.muted }}><Settings2 size={10} /> Chart Options</div>
            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <label style={{ ...iLabel, marginBottom: 0 }}>Gridlines</label>
                  <Toggle val={vc.showGridlines !== false} onChange={(v) => patchVisual({ showGridlines: v })} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label style={{ ...iLabel, marginBottom: 0 }}>Legend</label>
                  <Toggle val={vc.showLegend !== false} onChange={(v) => patchVisual({ showLegend: v })} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label style={{ ...iLabel, marginBottom: 0 }}>Axis Labels</label>
                  <Toggle val={vc.showAxisLabels !== false} onChange={(v) => patchVisual({ showAxisLabels: v })} />
                </div>
              </div>
              <div>
                <label style={iLabel}>Axis Font Size: {vc.axisFontSize ?? 11}px</label>
                <input type="range" min={8} max={18} value={vc.axisFontSize ?? 11}
                  onChange={(e) => patchVisual({ axisFontSize: +e.target.value })}
                  style={{ width: "100%", accentColor: T.accent }} />
              </div>
            </div>
          </section>
        )}

        {/* ── Font / Text Style ── */}
        <section>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
            style={{ color: T.muted }}><TypeIcon size={10} /> Text / Font</div>
          <div className="space-y-2.5">
            <div>
              <label style={iLabel}>Font Family</label>
              <select value={tile.fontFamily || "inherit"} onChange={(e) => patchTile({ fontFamily: e.target.value })} style={iSelect}>
                <option value="inherit">Default</option>
                <option value="'Inter', sans-serif">Inter</option>
                <option value="'Roboto', sans-serif">Roboto</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Arial', sans-serif">Arial</option>
              </select>
            </div>
            <div>
              <label style={iLabel}>Font Size: {tile.fontSize ?? "auto"}px</label>
              <input type="range" min={10} max={48} step={1} value={tile.fontSize ?? 14}
                onChange={(e) => patchTile({ fontSize: +e.target.value })}
                style={{ width: "100%", accentColor: T.accent }} />
            </div>
            <div>
              <label style={iLabel}>Font Weight</label>
              <select value={tile.fontWeight ?? 400} onChange={(e) => patchTile({ fontWeight: +e.target.value })} style={iSelect}>
                <option value={300}>Light (300)</option>
                <option value={400}>Regular (400)</option>
                <option value={500}>Medium (500)</option>
                <option value={600}>Semi-Bold (600)</option>
                <option value={700}>Bold (700)</option>
              </select>
            </div>
            <div>
              <label style={iLabel}>Text Color</label>
              <ColorPickerInput value={tile.textColor || T.text} onChange={(c) => patchTile({ textColor: c })} />
            </div>
          </div>
        </section>

        {/* ── Textbox-specific style ── */}
        {item.type === "textbox" && (
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: T.muted }}><AlignLeft size={10} /> Text Options</div>
            <div className="space-y-2.5">
              <div>
                <label style={iLabel}>Align</label>
                <div className="flex gap-1.5">
                  {["left","center","right"].map((a) => (
                    <button key={a} onClick={() => patchText({ align: a })}
                      className="flex-1 rounded-lg border py-1.5 text-xs capitalize transition"
                      style={{ background: ts.align === a ? T.accent : T.s2, color: ts.align === a ? "#000" : T.text, borderColor: T.border }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={iLabel}>Font Size: {ts.fontSize ?? 15}px</label>
                <input type="range" min={10} max={64} value={ts.fontSize ?? 15}
                  onChange={(e) => patchText({ fontSize: +e.target.value })}
                  style={{ width: "100%", accentColor: T.accent }} />
              </div>
              <div>
                <label style={iLabel}>Font Weight</label>
                <select value={ts.fontWeight ?? 400} onChange={(e) => patchText({ fontWeight: +e.target.value })} style={iSelect}>
                  <option value={300}>Light</option><option value={400}>Regular</option>
                  <option value={600}>Semi-Bold</option><option value={700}>Bold</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label style={{ ...iLabel, marginBottom: 0 }}>Italic</label>
                <Toggle val={!!ts.italic} onChange={(v) => patchText({ italic: v })} />
              </div>
              <div className="flex items-center justify-between">
                <label style={{ ...iLabel, marginBottom: 0 }}>No Wrap</label>
                <Toggle val={!!ts.noWrap} onChange={(v) => patchText({ noWrap: v })} />
              </div>
              <div>
                <label style={iLabel}>Line Height: {ts.lineHeight ?? 1.5}</label>
                <input type="range" min={1} max={3} step={0.1} value={ts.lineHeight ?? 1.5}
                  onChange={(e) => patchText({ lineHeight: +e.target.value })}
                  style={{ width: "100%", accentColor: T.accent }} />
              </div>
              <div>
                <label style={iLabel}>Text Color</label>
                <ColorPickerInput value={ts.color || T.text} onChange={(c) => patchText({ color: c })} />
              </div>
            </div>
          </section>
        )}

        {/* ── Button settings ── */}
        {item.type === "dbutton" && (
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: T.muted }}><MousePointer size={10} /> Button</div>
            <div className="space-y-2.5">
              <div>
                <label style={iLabel}>Label</label>
                <input value={bc.label || ""} onChange={(e) => patchButton({ label: e.target.value })}
                  className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                  style={{ background: T.s2, borderColor: T.border, color: T.text }} />
              </div>
              <div>
                <label style={iLabel}>Background</label>
                <ColorPickerInput value={bc.bgColor || "#14b8a6"} onChange={(c) => patchButton({ bgColor: c })} />
              </div>
              <div>
                <label style={iLabel}>Text Color</label>
                <ColorPickerInput value={bc.textColor || "#000000"} onChange={(c) => patchButton({ textColor: c })} />
              </div>
              <div>
                <label style={iLabel}>Corner Radius: {bc.borderRadius ?? 8}px</label>
                <input type="range" min={0} max={24} value={bc.borderRadius ?? 8}
                  onChange={(e) => patchButton({ borderRadius: +e.target.value })}
                  style={{ width: "100%", accentColor: T.accent }} />
              </div>
              <div>
                <label style={iLabel}>Font Size: {bc.fontSize ?? 13}px</label>
                <input type="range" min={10} max={24} value={bc.fontSize ?? 13}
                  onChange={(e) => patchButton({ fontSize: +e.target.value })}
                  style={{ width: "100%", accentColor: T.accent }} />
              </div>
              <div>
                <label style={iLabel}>Action</label>
                <select value={bc.action || "none"} onChange={(e) => patchButton({ action: e.target.value })} style={iSelect}>
                  <option value="none">None</option>
                  <option value="toggle-visual">Toggle Visual</option>
                  <option value="navigate-page">Navigate Page</option>
                </select>
              </div>
              {(bc.action === "toggle-visual" || bc.action === "navigate-page") && (
                <div>
                  <label style={iLabel}>{bc.action === "toggle-visual" ? "Target Item ID" : "Target Page ID"}</label>
                  <input value={bc.targetId || ""} onChange={(e) => patchButton({ targetId: e.target.value })}
                    placeholder="Paste item / dashboard id"
                    className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                    style={{ background: T.s2, borderColor: T.border, color: T.text }} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Number Format (visual tiles) ── */}
        {item.type !== "textbox" && item.type !== "dbutton" && item.type !== "slicer" && (
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: T.muted }}><Hash size={10} /> Number Format</div>
            <div className="space-y-2">
              <div>
                <label style={iLabel}>Type</label>
                <select value={nf.type || "number"} onChange={(e) => patchNumFmt({ type: e.target.value })} style={iSelect}>
                  <option value="number">Default</option>
                  <option value="whole">Whole Number</option>
                  <option value="decimal">Decimal</option>
                  <option value="percent">Percentage</option>
                  <option value="currency">Currency</option>
                  <option value="compact">Compact (K/M/B)</option>
                </select>
              </div>
              <div>
                <label style={iLabel}>Decimal Places</label>
                <input type="number" min={0} max={10} value={nf.decimals ?? 2}
                  onChange={(e) => patchNumFmt({ decimals: Math.max(0, +e.target.value) })}
                  style={{ ...iSelect, width: 80 }} />
              </div>
              {nf.type === "currency" && (
                <div>
                  <label style={iLabel}>Currency Symbol</label>
                  <input value={nf.currencySymbol || "₹"} onChange={(e) => patchNumFmt({ currencySymbol: e.target.value })}
                    style={{ ...iSelect, width: 60 }} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label style={iLabel}>Prefix</label>
                  <input value={nf.prefix || ""} onChange={(e) => patchNumFmt({ prefix: e.target.value })}
                    placeholder="e.g. $" style={iSelect} />
                </div>
                <div>
                  <label style={iLabel}>Suffix</label>
                  <input value={nf.suffix || ""} onChange={(e) => patchNumFmt({ suffix: e.target.value })}
                    placeholder="e.g. %" style={iSelect} />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Visual Tile (live chart) ──────────────────────────────────────────────────
function VisualTile({
  item, isSelected, dashboardId, snapEnabled, effectiveRows, filters,
  onSelect, onBeginMove, onBeginResize, onRemove, T,
}) {
  const ts = item.tileStyle || {};
  const vc = item.visualConfig || {};

  // Sample of rows for AI insights (30 max, cheap to compute)
  const chartSample = useMemo(() =>
    (effectiveRows || []).slice(0, 30),
    [effectiveRows]
  );

  const titleSize  = ts.titleSize ?? 13;
  const titleColor = ts.titleColor || T.text;
  const titleAlign = ts.titleAlign || "left";
  const showTitle  = ts.showTitle !== false;

  const borderOn = ts.borderEnabled !== false;

  return (
    <VirtualDashboardItem
      className="absolute group dc-dash-tile"
      style={{
        left: item.layout.x, top: item.layout.y,
        width: item.layout.w, height: item.layout.h,
        borderRadius: ts.borderRadius ?? 12,
        border: `${borderOn ? (ts.borderWidth ?? 1) : 0}px solid ${borderOn ? (ts.borderColor || T.border) : "transparent"}`,
        background:  ts.bgColor || T.surface,
        boxShadow: isSelected
          ? `0 0 0 2px ${T.accent}, 0 8px 28px rgba(0,0,0,0.16)`
          : ts.shadow !== false ? "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)" : "none",
        opacity:    ts.transparency ?? 1,
        fontFamily: ts.fontFamily   || "inherit",
        fontSize:   ts.fontSize     ? ts.fontSize + "px" : undefined,
        fontWeight: ts.fontWeight   || undefined,
        color:      ts.textColor    || T.text,
        zIndex: isSelected ? 5 : 2,
        overflow: "hidden",
        transition: "box-shadow 160ms ease, transform 160ms ease",
      }}
      title={vc.title}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Header — drag handle + title + controls */}
      {showTitle && (
        <div
          className="flex shrink-0 cursor-move items-center gap-1.5 px-3"
          style={{
            height: 38,
            borderBottom: `1px solid ${borderOn ? (ts.borderColor || T.border) : T.border}`,
            background: "linear-gradient(180deg, rgba(127,127,127,0.04), transparent)",
          }}
          onMouseDown={(e) => onBeginMove(e)}
        >
          {/* Grip — subtle, brightens on hover */}
          <GripVertical
            size={13}
            className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity"
            style={{ color: T.muted }}
          />

          {/* Title */}
          <div
            className="min-w-0 flex-1 truncate font-semibold"
            style={{ fontSize: titleSize, color: titleColor, textAlign: titleAlign }}
          >
            {vc.title}
          </div>

          {/* AI Insights button */}
          <div onMouseDown={(e) => e.stopPropagation()}>
            <TileAIInsightsButton visual={vc} chartData={chartSample} T={T} />
          </div>

          {/* Remove — icon button, red on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Remove visual"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition opacity-0 group-hover:opacity-100"
            style={{ color: T.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.muted; }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Chart area — grows to fill tile */}
      <div className="flex-1 min-h-0 relative" style={{ padding: ts.padding ?? 8 }}>
        <ResponsiveChart
          visual={vc}
          rawData={effectiveRows}
          filters={filters}
        />
      </div>

      {/* Resize handle — appears on hover/selection */}
      <button
        className={`absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm transition-opacity ${isSelected ? "opacity-70" : "opacity-0 group-hover:opacity-60"}`}
        style={{ borderRight: `2px solid ${T.accent}`, borderBottom: `2px solid ${T.accent}` }}
        onMouseDown={(e) => { e.stopPropagation(); onBeginResize(e); }}
        title="Resize"
      />
    </VirtualDashboardItem>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const T                    = useTheme();
  const { rows: effectiveRows } = useEffectiveData();
  const filters              = useStore((s) => s.filters);
  const dashboards           = useStore((s) => s.dashboards);
  const activeDashboardId    = useStore((s) => s.activeDashboardId);
  const createDashboard      = useStore((s) => s.createDashboard);
  const renameDashboard      = useStore((s) => s.renameDashboard);
  const removeDashboard      = useStore((s) => s.removeDashboard);
  const setActiveDashboard   = useStore((s) => s.setActiveDashboard);
  const updateDashboardItemLayout  = useStore((s) => s.updateDashboardItemLayout);
  const removeDashboardItem        = useStore((s) => s.removeDashboardItem);
  const addDashboardAnnotation     = useStore((s) => s.addDashboardAnnotation);
  const addTextboxToDashboard      = useStore((s) => s.addTextboxToDashboard);
  const addSlicerToDashboard       = useStore((s) => s.addSlicerToDashboard);
  const addButtonToDashboard       = useStore((s) => s.addButtonToDashboard);
  const datasets                   = useStore((s) => s.datasets);
  const metrics                    = useStore((s) => s.metrics);
  const addMetricVisualToDashboard = useStore((s) => s.addMetricVisualToDashboard);
  const reorderDashboardItem       = useStore((s) => s.reorderDashboardItem);
  const toggleDashboardItemVisibility = useStore((s) => s.toggleDashboardItemVisibility);
  const themeMode                  = useStore((s) => s.themeMode);

  const activeDashboard = useMemo(() =>
    dashboards?.length
      ? dashboards.find((d) => d.id === activeDashboardId) || dashboards[0]
      : null,
    [dashboards, activeDashboardId]
  );

  const canvasRef        = useRef(null);
  const canvasContentRef = useRef(null);
  const [editingTabId,    setEditingTabId]    = useState(null);
  const [draftTabName,    setDraftTabName]    = useState("");
  const [snapEnabled,     setSnapEnabled]     = useState(false);
  const [presentMode,     setPresentMode]     = useState(false);
  const [presentIndex,    setPresentIndex]    = useState(0);
  const [selectedItemId,  setSelectedItemId]  = useState(null);
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [layersOpen,      setLayersOpen]      = useState(false);
  // Metric add choice (after drop or asset-click)
  const [metricChoice,    setMetricChoice]    = useState(null); // { metricId }
  const [metricAssetOpen, setMetricAssetOpen] = useState(false);
  // Slicer add modal
  const [slicerModalOpen, setSlicerModalOpen] = useState(false);
  const [slicerColumn,    setSlicerColumn]    = useState("");
  const [slicerMulti,     setSlicerMulti]     = useState(false);
  const [slicerMode,      setSlicerMode]      = useState("dropdown");
  // Hidden visual ids (button toggle-visual action)
  const [hiddenVisualIds, setHiddenVisualIds] = useState(new Set());

  const selectedItem = useMemo(() =>
    activeDashboard?.items?.find((item) => item.id === selectedItemId) || null,
    [activeDashboard, selectedItemId]
  );

  // ── Slicer-driven dashboard filters (merged with global filters) ──────────
  const slicerFilters = useMemo(() => {
    if (!activeDashboard?.items?.length) return {};
    const result = {};
    for (const item of activeDashboard.items) {
      if (item.type === "slicer" && item.selectedValues?.length > 0) {
        const col = item.slicerConfig?.column;
        if (col) result[col] = item.selectedValues; // array → multi-select via applyGlobalFilters
      }
    }
    return result;
  }, [activeDashboard]);

  // Merge global store filters + slicer filters for visuals
  const mergedFilters = useMemo(
    () => ({ ...filters, ...slicerFilters }),
    [filters, slicerFilters]
  );

  // Toggle visibility of a visual tile from a button action
  const handleToggleVisual = useCallback((targetItemId) => {
    setHiddenVisualIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetItemId)) next.delete(targetItemId);
      else next.add(targetItemId);
      return next;
    });
  }, []);

  // Add a metric to the dashboard as table or chart
  const handleAddMetric = useCallback((metricId, displayAs) => {
    if (!activeDashboard) return;
    addMetricVisualToDashboard({ dashboardId: activeDashboard.id, metricId, displayAs });
    setMetricChoice(null);
    setMetricAssetOpen(false);
  }, [activeDashboard, addMetricVisualToDashboard]);

  // Drop a metric chip onto the canvas → ask Table/Chart
  const handleCanvasDrop = useCallback((e) => {
    const metricId = e.dataTransfer.getData("metricId");
    if (metricId) { e.preventDefault(); setMetricChoice({ metricId }); }
  }, []);

  // Available columns for slicer (non-system datasets)
  const slicerColumns = useMemo(() => {
    const cols = new Set();
    (datasets || []).filter((d) => !d.isSystemTable).forEach((d) =>
      (d.columns || []).forEach((c) => cols.add(c))
    );
    return [...cols].sort();
  }, [datasets]);

  const handleAddSlicer = () => {
    if (!slicerColumn || !activeDashboard) return;
    addSlicerToDashboard(activeDashboard.id, {
      column:      slicerColumn,
      label:       slicerColumn,
      mode:        slicerMode,
      multiSelect: slicerMulti,
    });
    setSlicerModalOpen(false);
    setSlicerColumn("");
  };

  useEffect(() => {
    if (!presentMode) return;
    const onKey = (e) => {
      if (e.key === "Escape") { setPresentMode(false); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setPresentIndex((i) => (i + 1) % dashboards.length);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setPresentIndex((i) => (i - 1 + dashboards.length) % dashboards.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [presentMode, dashboards.length]);

  const handleCommitRename = () => {
    if (editingTabId) renameDashboard(editingTabId, draftTabName.trim() || "Untitled Dashboard");
    setEditingTabId(null); setDraftTabName("");
  };

  const handleExportPNG = useCallback(async () => {
    const target = canvasContentRef.current;
    if (!target) return;
    try {
      const canvas = await html2canvas(target, { backgroundColor: T.surface, scale: 1.5, logging: false, useCORS: true });
      const url    = canvas.toDataURL("image/png");
      Object.assign(document.createElement("a"), { href: url, download: `${activeDashboard?.name || "dashboard"}.png` }).click();
    } catch { /* fail silently */ }
  }, [T.surface, activeDashboard?.name]);

  const beginMove = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedItemId(item.id);
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds || !activeDashboard) return;
      let nx = Math.max(0, Math.min(sl.x + mv.clientX - sx, bounds.width - sl.w));
      let ny = Math.max(0, sl.y + mv.clientY - sy);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardItemLayout({ dashboardId: activeDashboard.id, itemId: item.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const beginResize = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds || !activeDashboard) return;
      let nw = Math.max(sl.minW || 160, sl.w + mv.clientX - sx);
      let nh = Math.max(sl.minH || 120, sl.h + mv.clientY - sy);
      const aw = Math.min(nw, bounds.width - sl.x);
      if (snapEnabled) { nw = snap(aw); nh = snap(nh); } else { nw = aw; }
      updateDashboardItemLayout({ dashboardId: activeDashboard.id, itemId: item.id, patch: { w: nw, h: nh } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  // ── Presentation mode ──
  if (presentMode) {
    const currentDash = dashboards[presentIndex] || dashboards[0];
    if (!currentDash) return null;
    const visibleItems = currentDash.items.filter((i) => !i.hidden);
    const minH = Math.max(560, ...visibleItems.map((i) => (i.layout?.y || 0) + (i.layout?.h || 300) + 24));
    // Pure white background in light mode; app background in dark.
    const presentBg = themeMode === "light" ? "#ffffff" : T.bg;
    return (
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: presentBg }}>
        <div className="flex items-center justify-between gap-4 px-5 py-2.5"
          style={{ background: presentBg, borderBottom: `1px solid ${T.border}` }}>
          <div className="text-base font-bold" style={{ color: T.text }}>{currentDash.name}</div>
          <div className="flex items-center gap-2">
            <span className="text-sm mr-1" style={{ color: T.dim }}>{presentIndex + 1} / {dashboards.length}</span>
            <button onClick={() => setPresentIndex((i) => (i - 1 + dashboards.length) % dashboards.length)} disabled={dashboards.length <= 1}
              className="rounded-xl border px-3 py-2" style={{ background: T.s2, borderColor: T.border, color: T.text }}><ChevronLeft size={16} /></button>
            <button onClick={() => setPresentIndex((i) => (i + 1) % dashboards.length)} disabled={dashboards.length <= 1}
              className="rounded-xl border px-3 py-2" style={{ background: T.s2, borderColor: T.border, color: T.text }}><ChevronRight size={16} /></button>
            <button onClick={() => setPresentMode(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}><X size={14} /> Exit</button>
          </div>
        </div>
        <div className="relative flex-1 overflow-auto" style={{ background: presentBg }}>
          <div className="relative mx-auto" style={{ minHeight: minH, maxWidth: 1400 }}>
            {visibleItems.map((item) => {
              // Metric visual — read-only
              if (item.type === "metric") {
                return (
                  <div key={item.id} className="absolute flex flex-col" style={{
                    left: item.layout.x, top: item.layout.y, width: item.layout.w, height: item.layout.h,
                    background: themeMode === "light" ? "#ffffff" : T.surface, borderRadius: 10,
                    border: `1px solid ${T.border}`, overflow: "hidden",
                  }}>
                    <div className="border-b px-3 py-1.5 shrink-0" style={{ borderColor: T.border }}>
                      <div className="truncate text-sm font-semibold" style={{ color: T.text }}>
                        {item.name || metrics.find((m) => m.id === item.metricId)?.name || "Metric"}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 p-2"><MetricBody item={item} T={T} readOnly /></div>
                  </div>
                );
              }
              // Textbox
              if (item.type === "textbox") {
                return (
                  <div key={item.id} className="absolute" style={{
                    left: item.layout.x, top: item.layout.y,
                    width: item.layout.w, height: item.layout.h,
                    padding: item.tileStyle?.padding ?? 12, overflow: "auto",
                    background: item.tileStyle?.bgColor || "transparent",
                    borderRadius: item.tileStyle?.borderRadius ?? 8,
                  }}>
                    <span style={{ color: (item.textStyle?.color) || T.text }}>{item.text}</span>
                  </div>
                );
              }
              // Slicer — static read-only display in present mode
              if (item.type === "slicer") {
                const sel = item.selectedValues || [];
                return (
                  <div key={item.id} className="absolute flex items-center gap-2 px-3" style={{
                    left: item.layout.x, top: item.layout.y,
                    width: item.layout.w, height: item.layout.h,
                    background: T.surface, borderRadius: item.tileStyle?.borderRadius ?? 8,
                    border: `1px solid ${T.border}`,
                  }}>
                    <Filter size={11} style={{ color: T.accent, flexShrink: 0 }} />
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: T.muted }}>
                      {item.slicerConfig?.label || item.slicerConfig?.column}
                    </span>
                    <span className="text-xs truncate" style={{ color: T.text }}>
                      {sel.length === 0 ? "All" : sel.length === 1 ? sel[0] : `${sel.length} selected`}
                    </span>
                  </div>
                );
              }
              // Button
              if (item.type === "dbutton") {
                const bc = item.buttonConfig || {};
                return (
                  <div key={item.id} className="absolute flex items-center justify-center font-semibold" style={{
                    left: item.layout.x, top: item.layout.y,
                    width: item.layout.w, height: item.layout.h,
                    background: bc.bgColor || "#14b8a6", color: bc.textColor || "#000",
                    borderRadius: bc.borderRadius ?? 8, fontSize: bc.fontSize ?? 13,
                    fontWeight: bc.fontWeight ?? 600,
                    border: bc.borderWidth ? `${bc.borderWidth}px solid ${bc.borderColor || "transparent"}` : "none",
                  }}>
                    {bc.label || "Button"}
                  </div>
                );
              }
              // Visual
              return (
                <div key={item.id} className="absolute flex flex-col" style={{
                  left: item.layout.x, top: item.layout.y,
                  width: item.layout.w, height: item.layout.h,
                  background: themeMode === "light" ? "#ffffff" : T.surface, borderRadius: 10,
                  border: `1px solid ${T.border}`, overflow: "hidden",
                }}>
                  <div className="border-b px-4 py-2 shrink-0" style={{ borderColor: T.border }}>
                    <div className="truncate text-sm font-semibold" style={{ color: T.text }}>{item.visualConfig?.title}</div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveChart visual={item.visualConfig} rawData={effectiveRows} filters={mergedFilters} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {dashboards.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-3">
            {dashboards.map((_, i) => (
              <button key={i} onClick={() => setPresentIndex(i)} className="rounded-full transition"
                style={{ width: i === presentIndex ? 22 : 8, height: 8, background: i === presentIndex ? T.accent : T.border }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Normal view ──
  const canvasMinHeight = activeDashboard?.items?.length
    ? Math.max(560,
        ...activeDashboard.items.map((i) => (i.layout?.y || 0) + (i.layout?.h || 300) + 24),
        ...(activeDashboard.annotations || []).map((a) => a.y + 160))
    : 560;

  const isEmpty = !activeDashboard ||
    (!activeDashboard.items?.length && !(activeDashboard.annotations || []).length);

  return (
    <div className="flex flex-1 overflow-hidden p-3 gap-2.5">

      {/* ── Main canvas area ── */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-hidden min-w-0">
        <div
          ref={canvasRef}
          className="relative flex-1 overflow-auto rounded-xl border"
          onClick={() => setSelectedItemId(null)}
          onDragOver={(e) => { if (e.dataTransfer.types.includes("metricId")) e.preventDefault(); }}
          onDrop={handleCanvasDrop}
          style={{
            background: T.surface, borderColor: T.border, minHeight: 400,
            backgroundImage: snapEnabled ? `radial-gradient(circle, ${T.border} 1px, transparent 1px)` : "none",
            backgroundSize:  snapEnabled ? `${GRID_SIZE}px ${GRID_SIZE}px` : "auto",
          }}
        >
          {isEmpty ? (
            <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed"
              style={{ borderColor: T.border, background: T.s2, color: T.dim }}>
              <LayoutDashboard size={38} color={T.muted} />
              <div className="text-base font-semibold" style={{ color: T.text }}>{activeDashboard?.name || "Dashboard"}</div>
              <div className="text-sm" style={{ color: T.dim }}>No visuals added yet.</div>
              <div className="text-sm" style={{ color: T.dim }}>
                Go to <span style={{ color: T.accent, fontWeight: 600 }}>Report Builder</span> and click{" "}
                <span style={{ color: T.accent, fontWeight: 600 }}>Add to Dashboard</span>.
              </div>
            </div>
          ) : (
            <div ref={canvasContentRef} className="relative" style={{ minHeight: canvasMinHeight }}>
              {activeDashboard.items.map((item) => {
                const isSelected = selectedItemId === item.id;

                // Hidden via Layers panel — skip everywhere
                if (item.hidden) return null;

                if (item.type === "textbox") {
                  return (
                    <TextboxItem
                      key={item.id}
                      item={item}
                      dashboardId={activeDashboard.id}
                      snapEnabled={snapEnabled}
                      isSelected={isSelected}
                      onSelect={() => setSelectedItemId(item.id)}
                      canvasRef={canvasRef}
                      T={T}
                    />
                  );
                }

                // Metric visual
                if (item.type === "metric") {
                  return (
                    <MetricVisual
                      key={item.id}
                      item={item}
                      dashboardId={activeDashboard.id}
                      isSelected={isSelected}
                      onSelect={() => setSelectedItemId(item.id)}
                      onBeginMove={(e) => beginMove(e, item)}
                      onBeginResize={(e) => beginResize(e, item)}
                      onRemove={() => removeDashboardItem({ dashboardId: activeDashboard.id, itemId: item.id })}
                      T={T}
                    />
                  );
                }

                // Slicers and buttons are rendered in their own passes below.
                if (item.type === "slicer" || item.type === "dbutton") return null;

                // Hidden by button action
                if (hiddenVisualIds.has(item.id)) return null;

                return (
                  <VisualTile
                    key={item.id}
                    item={item}
                    isSelected={isSelected}
                    dashboardId={activeDashboard.id}
                    snapEnabled={snapEnabled}
                    effectiveRows={effectiveRows}
                    filters={mergedFilters}
                    onSelect={() => setSelectedItemId(item.id)}
                    onBeginMove={(e) => beginMove(e, item)}
                    onBeginResize={(e) => beginResize(e, item)}
                    onRemove={() => removeDashboardItem({ dashboardId: activeDashboard.id, itemId: item.id })}
                    T={T}
                  />
                );
              })}

              {/* Slicer items */}
              {activeDashboard.items.filter((i) => i.type === "slicer" && !i.hidden).map((item) => (
                <DashboardSlicer
                  key={item.id}
                  item={item}
                  dashboardId={activeDashboard.id}
                  isSelected={selectedItemId === item.id}
                  onSelect={() => setSelectedItemId(item.id)}
                  snapEnabled={snapEnabled}
                  canvasRef={canvasRef}
                  T={T}
                />
              ))}

              {/* Button items */}
              {activeDashboard.items.filter((i) => i.type === "dbutton" && !i.hidden).map((item) => (
                <DashboardButton
                  key={item.id}
                  item={item}
                  dashboardId={activeDashboard.id}
                  isSelected={selectedItemId === item.id}
                  onSelect={() => setSelectedItemId(item.id)}
                  snapEnabled={snapEnabled}
                  canvasRef={canvasRef}
                  onToggleVisual={handleToggleVisual}
                  T={T}
                />
              ))}

              {(activeDashboard.annotations || []).map((ann) => (
                <Annotation key={ann.id} ann={ann} dashboardId={activeDashboard.id} snapEnabled={snapEnabled} T={T} />
              ))}
            </div>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className="shrink-0 rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
          <div className="flex flex-wrap items-center gap-2">
            {dashboards.map((dashboard) => {
              const isActive = dashboard.id === activeDashboard?.id;
              return (
                <div key={dashboard.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
                  style={{ background: isActive ? T.accentDim : T.s2, borderColor: isActive ? "rgba(20,184,166,0.28)" : T.border }}>
                  {editingTabId === dashboard.id ? (
                    <input autoFocus value={draftTabName} onChange={(e) => setDraftTabName(e.target.value)}
                      onBlur={handleCommitRename}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCommitRename(); if (e.key === "Escape") { setEditingTabId(null); setDraftTabName(""); } }}
                      className="rounded-lg border px-2 py-0.5 text-xs outline-none"
                      style={{ background: T.surface, borderColor: T.border, color: T.text, width: 100 }} />
                  ) : (
                    <button onClick={() => setActiveDashboard(dashboard.id)} className="text-xs font-semibold"
                      style={{ color: isActive ? T.accent : T.text }}>{dashboard.name}</button>
                  )}
                  <button onClick={() => { setEditingTabId(dashboard.id); setDraftTabName(dashboard.name); }}
                    className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity" style={{ color: T.dim }}><Pencil size={11} /></button>
                  {dashboards.length > 1 && (
                    <button onClick={() => removeDashboard(dashboard.id)}
                      className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity" style={{ color: T.dim }}><Trash2 size={11} /></button>
                  )}
                </div>
              );
            })}

            <button onClick={createDashboard}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: T.accent, color: "#000" }}>
              <Plus size={12} /> New
            </button>
            <div className="mx-0.5 h-5 w-px" style={{ background: T.border }} />
            <button onClick={() => activeDashboard && addDashboardAnnotation({ dashboardId: activeDashboard.id })}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
              <StickyNote size={12} /> Note
            </button>
            <button onClick={() => activeDashboard && addTextboxToDashboard(activeDashboard.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
              <TypeIcon size={12} /> Text Box
            </button>
            <button onClick={() => setSlicerModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}
              title="Add filter slicer">
              <Filter size={12} /> Slicer
            </button>
            <button onClick={() => activeDashboard && addButtonToDashboard(activeDashboard.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}
              title="Add button">
              <MousePointer size={12} /> Button
            </button>

            {/* Metric asset dropdown */}
            <div className="relative">
              <button onClick={() => setMetricAssetOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
                style={{ background: metricAssetOpen ? T.accentDim : T.s2, borderColor: metricAssetOpen ? "rgba(20,184,166,0.28)" : T.border, color: metricAssetOpen ? T.accent : T.dim }}
                title="Add a metric">
                <Grid3x3 size={12} /> Metric
              </button>
              {metricAssetOpen && (
                <div className="absolute left-0 bottom-full z-[60] mb-1.5 w-60 rounded-xl border shadow-2xl overflow-hidden"
                  style={{ background: T.surface, borderColor: T.border }}
                  onMouseLeave={() => setMetricAssetOpen(false)}>
                  <div className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-widest"
                    style={{ borderColor: T.border, color: T.muted }}>Add metric to dashboard</div>
                  <div className="max-h-64 overflow-y-auto p-1.5">
                    {metrics.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-center" style={{ color: T.muted }}>
                        No metrics yet — create one in the Measures tab
                      </div>
                    ) : metrics.map((m) => (
                      <button key={m.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("metricId", m.id); e.dataTransfer.effectAllowed = "copy"; }}
                        onClick={() => setMetricChoice({ metricId: m.id })}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:opacity-80 cursor-grab"
                        style={{ background: T.s2 }}
                        title="Click to add, or drag onto the canvas">
                        <Grid3x3 size={12} style={{ color: T.accent, flexShrink: 0 }} />
                        <span className="flex-1 truncate text-xs font-medium" style={{ color: T.text }}>{m.name}</span>
                        <span className="text-[10px]" style={{ color: T.muted }}>{m.isCalculated ? "calc" : "input"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setLayersOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: layersOpen ? T.accentDim : T.s2, borderColor: layersOpen ? "rgba(20,184,166,0.28)" : T.border, color: layersOpen ? T.accent : T.dim }}
              title="Layers / Selection">
              <Layers size={12} /> Layers
            </button>

            <button onClick={() => setSnapEnabled((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: snapEnabled ? T.accentDim : T.s2, borderColor: snapEnabled ? "rgba(20,184,166,0.28)" : T.border, color: snapEnabled ? T.accent : T.dim }}>
              <Grid3x3 size={12} /> Snap
            </button>
            <button onClick={() => setFormatPanelOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: formatPanelOpen ? T.accentDim : T.s2, borderColor: formatPanelOpen ? "rgba(20,184,166,0.28)" : T.border, color: formatPanelOpen ? T.accent : T.dim }}>
              <Palette size={12} /> Format
            </button>
            <button onClick={handleExportPNG}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
              <Download size={12} /> Export
            </button>
            <button onClick={() => { setPresentIndex(dashboards.findIndex((d) => d.id === activeDashboard?.id) || 0); setPresentMode(true); }}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
              <Maximize2 size={12} /> Present
            </button>
          </div>
        </div>
      </div>

      {/* ── Layers Panel ── */}
      {layersOpen && activeDashboard && (
        <div className="shrink-0 rounded-xl border shadow-sm overflow-hidden flex flex-col"
          style={{ width: 244, background: T.surface, borderColor: T.border }}>
          <LayersPanel
            dashboard={activeDashboard}
            selectedItemId={selectedItemId}
            onSelect={setSelectedItemId}
            onClose={() => setLayersOpen(false)}
            T={T}
          />
        </div>
      )}

      {/* ── Format Panel ── */}
      {formatPanelOpen && (
        <div className="shrink-0 rounded-xl border shadow-sm overflow-hidden flex flex-col"
          style={{ width: 252, background: T.surface, borderColor: T.border }}>
          <TileFormatPanel item={selectedItem} dashboardId={activeDashboard?.id} T={T} />
        </div>
      )}

      {/* ── Metric display-type choice ── */}
      {metricChoice && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
          onClick={(e) => e.target === e.currentTarget && setMetricChoice(null)}>
          <div className="w-72 rounded-xl border shadow-2xl overflow-hidden" style={{ background: T.surface, borderColor: T.border }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-2">
                <Grid3x3 size={13} style={{ color: T.accent }} />
                <span className="text-sm font-semibold" style={{ color: T.text }}>Add metric as…</span>
              </div>
              <button onClick={() => setMetricChoice(null)} style={{ color: T.muted }}><X size={14} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <button onClick={() => handleAddMetric(metricChoice.metricId, "table")}
                className="flex flex-col items-center gap-2 rounded-xl border py-4 transition hover:opacity-80"
                style={{ background: T.s2, borderColor: T.border, color: T.text }}>
                <TypeIcon size={22} style={{ color: T.accent }} />
                <span className="text-xs font-semibold">Table</span>
              </button>
              <button onClick={() => handleAddMetric(metricChoice.metricId, "chart")}
                className="flex flex-col items-center gap-2 rounded-xl border py-4 transition hover:opacity-80"
                style={{ background: T.s2, borderColor: T.border, color: T.text }}>
                <Palette size={22} style={{ color: T.accent }} />
                <span className="text-xs font-semibold">Chart</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add Slicer Modal ── */}
      {slicerModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
          onClick={(e) => e.target === e.currentTarget && setSlicerModalOpen(false)}
        >
          <div className="w-80 rounded-xl border shadow-2xl overflow-hidden"
            style={{ background: T.surface, borderColor: T.border }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-2">
                <Filter size={13} style={{ color: T.accent }} />
                <span className="text-sm font-semibold" style={{ color: T.text }}>Add Filter Slicer</span>
              </div>
              <button onClick={() => setSlicerModalOpen(false)} style={{ color: T.muted }}>
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: T.dim }}>Dataset Column</label>
                <select value={slicerColumn} onChange={(e) => setSlicerColumn(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ background: T.s2, borderColor: T.border, color: T.text }}>
                  <option value="">— select column —</option>
                  {slicerColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: T.dim }}>Mode</label>
                  <select value={slicerMode} onChange={(e) => setSlicerMode(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ background: T.s2, borderColor: T.border, color: T.text }}>
                    <option value="dropdown">Dropdown</option>
                    <option value="list">List</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <button
                    onClick={() => setSlicerMulti((m) => !m)}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                    style={{ background: slicerMulti ? T.accent : T.border }}>
                    <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                      style={{ transform: slicerMulti ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                  </button>
                  <span className="text-xs" style={{ color: T.text }}>Multi</span>
                </div>
              </div>
              <button
                onClick={handleAddSlicer}
                disabled={!slicerColumn}
                className="w-full rounded-lg py-2 text-sm font-semibold"
                style={{ background: T.accent, color: "#000", opacity: slicerColumn ? 1 : 0.5 }}>
                Add Slicer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
