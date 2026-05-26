import { Plus, BarChart3, Zap, X } from "lucide-react";
import { useStore } from "../store/useStore";
import FieldPane    from "../components/fields/FieldPane";
import FilterPanel  from "../components/filters/FilterPanel";
import VisualCard   from "../components/builder/VisualCard";
import { useTheme } from "../styles/theme";

export default function ReportBuilder() {
  const T = useTheme();
  const visuals      = useStore((s) => s.visuals);
  const addVisual    = useStore((s) => s.addVisual);
  const crossFilter  = useStore((s) => s.crossFilter);
  const clearCF      = useStore((s) => s.clearCrossFilter);

  const cfEntries  = Object.entries(crossFilter);
  const hasCF      = cfEntries.length > 0;

  return (
    /* Full-height flex column — fills the sidebar main content area */
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
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasCF && (
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-1.5 anim-scale-in"
              style={{
                background: "rgba(245,158,11,0.08)",
                borderColor: "rgba(245,158,11,0.22)",
              }}
            >
              <Zap size={12} style={{ color: T.accent }} />
              <span className="text-xs font-medium" style={{ color: T.accent }}>
                Cross-filter:&nbsp;
                {cfEntries.map(([f, v]) => (
                  <span key={f} className="font-bold">{f}={v} </span>
                ))}
              </span>
              <button
                onClick={clearCF}
                className="ml-0.5 rounded-full p-0.5 hover:opacity-70"
                style={{ color: T.accent }}
              >
                <X size={11} />
              </button>
            </div>
          )}

          <button
            onClick={addVisual}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: T.accent, color: "#000", boxShadow: "0 2px 10px rgba(245,158,11,0.22)" }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Visual
          </button>
        </div>
      </div>

      {/* ── 3-column grid ── */}
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
          {visuals.length === 0 ? (
            <div
              className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed anim-fade-in"
              style={{ borderColor: T.border, background: T.surface }}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ background: T.s2 }}
              >
                <BarChart3 size={26} style={{ color: T.muted }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: T.dim }}>
                  No visuals yet
                </p>
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
          ) : (
            <div className="space-y-4 stagger">
              {visuals.map((visual) => (
                <VisualCard key={visual.id} visual={visual} />
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
