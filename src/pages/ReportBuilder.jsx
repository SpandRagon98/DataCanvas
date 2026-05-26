import { Plus, BarChart3, Zap, X } from "lucide-react";
import { useStore } from "../store/useStore";
import FieldPane from "../components/fields/FieldPane";
import FilterPanel from "../components/filters/FilterPanel";
import VisualCard from "../components/builder/VisualCard";
import { useTheme } from "../styles/theme";

export default function ReportBuilder() {
  const T = useTheme();
  const visuals = useStore((s) => s.visuals);
  const addVisual = useStore((s) => s.addVisual);
  const crossFilter = useStore((s) => s.crossFilter);
  const clearCrossFilter = useStore((s) => s.clearCrossFilter);

  const crossFilterEntries = Object.entries(crossFilter);
  const hasCrossFilter = crossFilterEntries.length > 0;

  return (
    <div className="h-[calc(100vh-32px)]">
      <div className="grid h-full grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-2">
          <FieldPane />
        </div>

        <div className="col-span-12 xl:col-span-8">
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border px-5 py-4 shadow-sm"
            style={{ background: T.surface, borderColor: T.border }}
          >
            <div>
              <h1 className="text-xl font-semibold" style={{ color: T.text }}>
                Report Builder
              </h1>
              <p className="text-sm" style={{ color: T.dim }}>
                Create interactive visuals by dragging fields into zones
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Cross-filter badge */}
              {hasCrossFilter && (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2"
                  style={{
                    background: "rgba(245,158,11,0.10)",
                    borderColor: "rgba(245,158,11,0.28)",
                  }}
                >
                  <Zap size={13} style={{ color: T.accent }} />
                  {crossFilterEntries.map(([field, value]) => (
                    <span key={field} className="text-xs font-medium" style={{ color: T.accent }}>
                      {field}: <strong>{value}</strong>
                    </span>
                  ))}
                  <button
                    onClick={clearCrossFilter}
                    className="ml-1 rounded-full p-0.5"
                    style={{ color: T.accent }}
                    title="Clear cross-filter"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              <button
                onClick={addVisual}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold"
                style={{ background: T.accent, color: "#000" }}
              >
                <Plus size={14} />
                Add Visual
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-140px)] space-y-4 overflow-y-auto pr-1">
            {visuals.length === 0 ? (
              <div
                className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed shadow-sm"
                style={{
                  background: T.surface,
                  borderColor: T.border,
                }}
              >
                <BarChart3 size={36} color={T.muted} />
                <div className="text-sm" style={{ color: T.dim }}>
                  Click <span style={{ color: T.accent, fontWeight: 600 }}>Add Visual</span> to start building
                </div>
              </div>
            ) : (
              visuals.map((visual) => <VisualCard key={visual.id} visual={visual} />)
            )}
          </div>
        </div>

        <div className="col-span-12 xl:col-span-2">
          <FilterPanel />
        </div>
      </div>
    </div>
  );
}
