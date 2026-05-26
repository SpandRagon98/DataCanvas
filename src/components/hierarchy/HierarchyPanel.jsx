import { Layers3 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

export default function HierarchyPanel() {
  const T = useTheme();
  const hierarchies = useStore((s) => s.hierarchies);
  const removeHierarchy = useStore((s) => s.removeHierarchy);

  return (
    <div
      className="rounded-xl border p-5 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: T.accentDim }}
        >
          <Layers3 size={16} color={T.accent} />
        </div>
        <div>
          <h2 className="text-[14px] font-bold leading-none" style={{ color: T.text }}>
            Saved Hierarchies
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>
            Manage your hierarchy definitions
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {hierarchies.length === 0 ? (
          <div
            className="rounded-xl border border-dashed px-4 py-6 text-center text-sm"
            style={{ borderColor: T.border, background: T.s2, color: T.dim }}
          >
            No hierarchies created yet
          </div>
        ) : (
          hierarchies.map((hierarchy) => (
            <div
              key={hierarchy.name}
              className="rounded-xl border px-3 py-2.5"
              style={{ background: T.s2, borderColor: T.border }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold" style={{ color: T.text }}>
                    {hierarchy.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs mono" style={{ color: T.dim }}>
                    {hierarchy.levels.join(" → ")}
                  </div>
                </div>

                <button
                  onClick={() => removeHierarchy(hierarchy.name)}
                  className="shrink-0 rounded-xl border px-2.5 py-1.5 text-xs transition"
                  style={{
                    borderColor: T.border,
                    background: T.surface,
                    color: T.dim,
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
