import { Layers3 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

export default function HierarchyPanel() {
  const T = useTheme();
  const hierarchies = useStore((s) => s.hierarchies);
  const removeHierarchy = useStore((s) => s.removeHierarchy);

  return (
    <div
      className="rounded-[24px] border p-6 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: T.accentDim }}
        >
          <Layers3 size={18} color={T.accent} />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: T.text }}>
            Saved Hierarchies
          </h2>
          <p className="mt-1 text-sm" style={{ color: T.dim }}>
            Manage your hierarchy definitions
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {hierarchies.length === 0 ? (
          <div className="text-sm" style={{ color: T.dim }}>
            No hierarchies created yet
          </div>
        ) : (
          hierarchies.map((hierarchy) => (
            <div
              key={hierarchy.name}
              className="rounded-2xl border p-4"
              style={{ background: T.s2, borderColor: T.border }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold" style={{ color: T.text }}>
                    {hierarchy.name}
                  </div>
                  <div className="mt-1 text-sm" style={{ color: T.dim }}>
                    {hierarchy.levels.join(" → ")}
                  </div>
                </div>

                <button
                  onClick={() => removeHierarchy(hierarchy.name)}
                  className="rounded-xl border px-3 py-2 text-sm transition"
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
