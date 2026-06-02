import { useState, useEffect, useCallback } from "react";
import {
  Plus, BarChart3, Zap, X, Maximize2, Trash2,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Filter,
} from "lucide-react";
import { useStore } from "../store/useStore";
import FieldPane    from "../components/fields/FieldPane";
import FilterPanel  from "../components/filters/FilterPanel";
import VisualCard   from "../components/builder/VisualCard";
import AdvancedSettingsPane from "../components/builder/AdvancedSettingsPane";
import { Settings2 } from "lucide-react";
import { useTheme } from "../styles/theme";

// ── Pane sizing ──
const FIELDS_MIN = 200;   // current width = minimum
const FIELDS_MAX = 380;
const FIELDS_RAIL = 48;
const ADV_MIN = 250, ADV_MAX = 440, ADV_DEFAULT = 290;
const FILTER_MIN = 200, FILTER_MAX = 380, FILTER_DEFAULT = 220;

// Chart-type icon labels for collapsed chips
const CHART_LABELS = {
  bar: "Bar", hbar: "H-Bar", line: "Line", area: "Area",
  scatter: "Scatter", pie: "Pie", donut: "Donut", radar: "Radar",
  treemap: "Treemap", heatmap: "Heatmap", waterfall: "Waterfall",
  funnel: "Funnel", gauge: "Gauge", kpi: "KPI",
};

/** Compact chip shown for a collapsed visual */
function CollapsedChip({ visual, onExpand, onDelete, T }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <span className="text-xs font-semibold max-w-[120px] truncate" style={{ color: T.text }}>
        {visual.title || "Untitled"}
      </span>
      <span
        className="rounded-md px-1.5 py-0.5 text-[10px] mono uppercase"
        style={{ background: T.s3, color: T.muted }}
      >
        {CHART_LABELS[visual.chartType] || visual.chartType}
      </span>
      <button
        onClick={onExpand}
        title="Restore"
        className="rounded-md p-0.5 transition hover:opacity-80"
        style={{ color: T.accent }}
      >
        <Maximize2 size={11} />
      </button>
      <button
        onClick={onDelete}
        title="Delete"
        className="rounded-md p-0.5 transition hover:opacity-80"
        style={{ color: T.dim }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export default function ReportBuilder() {
  const T           = useTheme();
  const visuals     = useStore((s) => s.visuals);
  const addVisual   = useStore((s) => s.addVisual);
  const removeVisual= useStore((s) => s.removeVisual);
  const crossFilter = useStore((s) => s.crossFilter);
  const clearCF     = useStore((s) => s.clearCrossFilter);

  // Collapsed visual IDs — local state, intentionally not persisted
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const collapse = (id)   => setCollapsedIds((prev) => new Set([...prev, id]));
  const expand   = (id)   => setCollapsedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });

  // ── Resizable / collapsible panes (persisted UI prefs) ──
  const [fieldsWidth, setFieldsWidth] = useState(() => {
    const v = parseInt(localStorage.getItem("dc.rbFieldsWidth") || "", 10);
    return isNaN(v) ? FIELDS_MIN : Math.max(FIELDS_MIN, Math.min(FIELDS_MAX, v));
  });
  const [fieldsCollapsed, setFieldsCollapsed] = useState(() => localStorage.getItem("dc.rbFieldsCollapsed") === "true");
  const [filterCollapsed, setFilterCollapsed] = useState(() => localStorage.getItem("dc.rbFilterCollapsed") === "true");
  const [dragging, setDragging] = useState(false);

  const [advWidth, setAdvWidth] = useState(() => {
    const v = parseInt(localStorage.getItem("dc.rbAdvWidth") || "", 10);
    return isNaN(v) ? ADV_DEFAULT : Math.max(ADV_MIN, Math.min(ADV_MAX, v));
  });
  const [advCollapsed, setAdvCollapsed] = useState(() => localStorage.getItem("dc.rbAdvCollapsed") !== "false");
  const [advDragging, setAdvDragging] = useState(false);

  const [filterWidth, setFilterWidth] = useState(() => {
    const v = parseInt(localStorage.getItem("dc.rbFilterWidth") || "", 10);
    return isNaN(v) ? FILTER_DEFAULT : Math.max(FILTER_MIN, Math.min(FILTER_MAX, v));
  });
  const [filterDragging, setFilterDragging] = useState(false);
  useEffect(() => { localStorage.setItem("dc.rbFilterWidth", String(filterWidth)); }, [filterWidth]);

  const onFilterResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX, startW = filterWidth;
    setFilterDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (mv) => {
      // filter pane sits left of the advanced pane; dragging left widens it
      const w = Math.max(FILTER_MIN, Math.min(FILTER_MAX, startW - (mv.clientX - startX)));
      setFilterWidth(w);
    };
    const onUp = () => {
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      setFilterDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [filterWidth]);

  useEffect(() => { localStorage.setItem("dc.rbFieldsWidth", String(fieldsWidth)); }, [fieldsWidth]);
  useEffect(() => { localStorage.setItem("dc.rbFieldsCollapsed", String(fieldsCollapsed)); }, [fieldsCollapsed]);
  useEffect(() => { localStorage.setItem("dc.rbFilterCollapsed", String(filterCollapsed)); }, [filterCollapsed]);
  useEffect(() => { localStorage.setItem("dc.rbAdvWidth", String(advWidth)); }, [advWidth]);
  useEffect(() => { localStorage.setItem("dc.rbAdvCollapsed", String(advCollapsed)); }, [advCollapsed]);

  const onAdvResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX, startW = advWidth;
    setAdvDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (mv) => {
      // far-right pane: dragging left widens it
      const w = Math.max(ADV_MIN, Math.min(ADV_MAX, startW - (mv.clientX - startX)));
      setAdvWidth(w);
    };
    const onUp = () => {
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      setAdvDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [advWidth]);

  const onFieldsResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX, startW = fieldsWidth;
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (mv) => {
      const w = Math.max(FIELDS_MIN, Math.min(FIELDS_MAX, startW + mv.clientX - startX));
      setFieldsWidth(w);
    };
    const onUp = () => {
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [fieldsWidth]);

  const cfEntries = Object.entries(crossFilter);
  const hasCF     = cfEntries.length > 0;

  const collapsedVisuals = visuals.filter((v) => collapsedIds.has(v.id));
  const expandedVisuals  = visuals.filter((v) => !collapsedIds.has(v.id));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      {/* ── Header bar ── */}
      <div
        className="shrink-0 flex items-center justify-between gap-3 border-b px-5 py-3"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div>
          <h1 className="text-[15px] font-semibold leading-none" style={{ color: T.text }}>
            Report Builder
          </h1>
          <p className="mt-1 text-xs" style={{ color: T.muted }}>
            Drag fields into visual zones · {visuals.length} visual{visuals.length !== 1 ? "s" : ""}
            {collapsedIds.size > 0 && ` · ${collapsedIds.size} collapsed`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasCF && (
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
              style={{ background: "rgba(var(--dc-accent-rgb),0.08)", borderColor: "rgba(var(--dc-accent-rgb),0.22)" }}
            >
              <Zap size={12} style={{ color: T.accent }} />
              <span className="text-xs font-medium" style={{ color: T.accent }}>
                Cross-filter:&nbsp;
                {cfEntries.map(([f, v]) => (
                  <span key={f} className="font-bold">{f}={v} </span>
                ))}
              </span>
              <button onClick={clearCF} className="ml-0.5 rounded-full p-0.5 hover:opacity-70" style={{ color: T.accent }}>
                <X size={11} />
              </button>
            </div>
          )}

          <button
            onClick={addVisual}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: T.accent, color: "#000", boxShadow: "0 2px 10px rgba(var(--dc-accent-rgb),0.22)" }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Visual
          </button>
        </div>
      </div>

      {/* ── 3-column layout ── */}
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">

        {/* Field pane (resizable + collapsible) */}
        {fieldsCollapsed ? (
          <div
            className="shrink-0 flex flex-col items-center gap-2 border-r py-2"
            style={{ width: FIELDS_RAIL, background: T.surface, borderColor: T.border }}
          >
            <button onClick={() => setFieldsCollapsed(false)} title="Expand Fields"
              className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: T.muted }}>
              <PanelLeftOpen size={16} />
            </button>
            <BarChart3 size={15} style={{ color: T.accent }} />
            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, color: T.dim, letterSpacing: "0.06em", marginTop: 4 }}>
              Fields
            </span>
          </div>
        ) : (
          <div
            className="relative shrink-0 border-r overflow-hidden flex flex-col"
            style={{ width: fieldsWidth, borderColor: T.border, background: T.surface, transition: dragging ? "none" : "width 160ms ease" }}
          >
            <button onClick={() => setFieldsCollapsed(true)} title="Collapse Fields"
              className="absolute right-1.5 top-3 z-10 rounded-lg p-1 transition hover:opacity-80"
              style={{ color: T.muted, background: T.surface }}>
              <PanelLeftClose size={14} />
            </button>
            <FieldPane />
            {/* Resize handle */}
            <div
              onMouseDown={onFieldsResizeStart}
              title="Drag to resize"
              className={`sidebar-resize-handle ${dragging ? "is-dragging" : ""}`}
            />
          </div>
        )}

        {/* Visuals canvas */}
        <div
          className="flex-1 min-w-0 overflow-y-auto px-4 py-4 space-y-4"
          style={{ background: T.bg }}
        >
          {/* ── Collapsed visuals strip ── */}
          {collapsedVisuals.length > 0 && (
            <div
              className="rounded-xl border p-3"
              style={{ background: T.surface, borderColor: T.border }}
            >
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-2"
                style={{ color: T.muted }}>
                <Maximize2 size={10} />
                Collapsed visuals — click restore to expand
              </div>
              <div className="flex flex-wrap gap-2">
                {collapsedVisuals.map((v) => (
                  <CollapsedChip
                    key={v.id}
                    visual={v}
                    onExpand={() => expand(v.id)}
                    onDelete={() => { expand(v.id); removeVisual(v.id); }}
                    T={T}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Expanded visuals ── */}
          {visuals.length === 0 ? (
            <div
              className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed"
              style={{ borderColor: T.border, background: T.surface }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl" style={{ background: T.s2 }}>
                <BarChart3 size={26} style={{ color: T.muted }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: T.dim }}>No visuals yet</p>
                <p className="mt-1 text-xs" style={{ color: T.muted }}>
                  Click <strong style={{ color: T.accent }}>Add Visual</strong> to start building
                </p>
              </div>
              <button
                onClick={addVisual}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: T.accent, color: "#000" }}
              >
                <Plus size={14} /> Add Visual
              </button>
            </div>
          ) : expandedVisuals.length === 0 ? (
            <div
              className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed"
              style={{ borderColor: T.border, background: T.surface, color: T.dim }}
            >
              <p className="text-sm">All visuals are collapsed.</p>
              <p className="text-xs" style={{ color: T.muted }}>
                Click <strong style={{ color: T.accent }}>Restore</strong> on any collapsed chip above.
              </p>
            </div>
          ) : (
            <div className="space-y-4 stagger">
              {expandedVisuals.map((visual) => (
                <VisualCard
                  key={visual.id}
                  visual={visual}
                  onCollapse={() => collapse(visual.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Filter panel (collapsible) */}
        {filterCollapsed ? (
          <div
            className="shrink-0 flex flex-col items-center gap-2 border-l py-2"
            style={{ width: FIELDS_RAIL, background: T.surface, borderColor: T.border }}
          >
            <button onClick={() => setFilterCollapsed(false)} title="Expand Filters"
              className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: T.muted }}>
              <PanelRightOpen size={16} />
            </button>
            <Filter size={15} style={{ color: T.accent }} />
            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, color: T.dim, letterSpacing: "0.06em", marginTop: 4 }}>
              Filters
            </span>
          </div>
        ) : (
          <div
            className="relative shrink-0 border-l overflow-hidden flex flex-col"
            style={{ width: filterWidth, borderColor: T.border, background: T.surface, transition: filterDragging ? "none" : "width 160ms ease" }}
          >
            {/* left-edge resize handle */}
            <div
              onMouseDown={onFilterResizeStart}
              title="Drag to resize"
              style={{ position: "absolute", left: -3, top: 0, bottom: 0, width: 7, cursor: "col-resize", zIndex: 20 }}
            >
              <div style={{ position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)", width: 1, height: 48,
                background: filterDragging ? T.accent : "transparent", borderRadius: 1 }} />
            </div>
            <button onClick={() => setFilterCollapsed(true)} title="Collapse Filters"
              className="absolute right-1.5 top-3 z-10 rounded-lg p-1 transition hover:opacity-80"
              style={{ color: T.muted, background: T.surface }}>
              <PanelRightClose size={14} />
            </button>
            <FilterPanel />
          </div>
        )}

        {/* Advanced Settings pane (far right, collapsible + resizable) */}
        {advCollapsed ? (
          <div
            className="shrink-0 flex flex-col items-center gap-2 border-l py-2"
            style={{ width: FIELDS_RAIL, background: T.surface, borderColor: T.border }}
          >
            <button onClick={() => setAdvCollapsed(false)} title="Expand Advanced Settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: T.muted }}>
              <PanelLeftOpen size={16} />
            </button>
            <Settings2 size={15} style={{ color: T.accent }} />
            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, color: T.dim, letterSpacing: "0.06em", marginTop: 4 }}>
              Settings
            </span>
          </div>
        ) : (
          <div
            className="relative shrink-0 border-l overflow-hidden flex flex-col"
            style={{ width: advWidth, borderColor: T.border, background: T.surface, transition: advDragging ? "none" : "width 160ms ease" }}
          >
            {/* left-edge resize handle */}
            <div
              onMouseDown={onAdvResizeStart}
              title="Drag to resize"
              style={{ position: "absolute", left: -3, top: 0, bottom: 0, width: 7, cursor: "col-resize", zIndex: 20 }}
            >
              <div style={{ position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)", width: 1, height: 48,
                background: advDragging ? T.accent : "transparent", borderRadius: 1 }} />
            </div>
            <button onClick={() => setAdvCollapsed(true)} title="Collapse Advanced Settings"
              className="absolute right-1.5 top-3 z-10 rounded-lg p-1 transition hover:opacity-80"
              style={{ color: T.muted, background: T.surface }}>
              <PanelRightClose size={14} />
            </button>
            <AdvancedSettingsPane T={T} />
          </div>
        )}
      </div>
    </div>
  );
}
