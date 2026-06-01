import { useState } from "react";
import {
  Plus, BarChart3, Zap, X, Maximize2, Trash2,
} from "lucide-react";
import { useStore } from "../store/useStore";
import FieldPane    from "../components/fields/FieldPane";
import FilterPanel  from "../components/filters/FilterPanel";
import VisualCard   from "../components/builder/VisualCard";
import { useTheme } from "../styles/theme";

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
              style={{ background: "rgba(20,184,166,0.08)", borderColor: "rgba(20,184,166,0.22)" }}
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
            style={{ background: T.accent, color: "#000", boxShadow: "0 2px 10px rgba(20,184,166,0.22)" }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Visual
          </button>
        </div>
      </div>

      {/* ── 3-column layout ── */}
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">

        {/* Field pane */}
        <div
          className="w-[200px] shrink-0 border-r overflow-hidden flex flex-col"
          style={{ borderColor: T.border, background: T.surface }}
        >
          <FieldPane />
        </div>

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

        {/* Filter panel */}
        <div
          className="w-[210px] shrink-0 border-l overflow-hidden flex flex-col"
          style={{ borderColor: T.border, background: T.surface }}
        >
          <FilterPanel />
        </div>
      </div>
    </div>
  );
}
