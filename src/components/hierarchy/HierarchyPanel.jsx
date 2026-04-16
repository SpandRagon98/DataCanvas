import { useStore } from "../../store/useStore";

export default function HierarchyPanel() {
  const hierarchies = useStore((s) => s.hierarchies);
  const removeHierarchy = useStore((s) => s.removeHierarchy);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Saved Hierarchies</h2>

      <div className="mt-4 space-y-3">
        {hierarchies.length === 0 ? (
          <div className="text-sm text-slate-400">No hierarchies created yet</div>
        ) : (
          hierarchies.map((hierarchy) => (
            <div
              key={hierarchy.name}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">{hierarchy.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {hierarchy.levels.join(" → ")}
                  </div>
                </div>

                <button
                  onClick={() => removeHierarchy(hierarchy.name)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
