import { Layers3 } from "lucide-react";
import { useTheme } from "../styles/theme";
import HierarchyBuilder from "../components/hierarchy/HierarchyBuilder";
import HierarchyPanel from "../components/hierarchy/HierarchyPanel";

export default function Hierarchies() {
  const T = useTheme();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-5 space-y-5">

        {/* ── Page header ── */}
        <div
          className="rounded-xl border px-5 py-4 shadow-sm"
          style={{ background: T.surface, borderColor: T.border }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: T.accentDim }}
            >
              <Layers3 size={16} color={T.accent} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold leading-none" style={{ color: T.text }}>
                Hierarchies
              </h1>
              <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>
                Define drill-down structures · e.g. Region → Country → City
              </p>
            </div>
          </div>
        </div>

        {/* ── Builder + Panel ── */}
        <div className="grid gap-5 md:grid-cols-2">
          <HierarchyBuilder />
          <HierarchyPanel />
        </div>

      </div>
    </div>
  );
}
