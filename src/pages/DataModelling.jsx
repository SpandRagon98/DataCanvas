import { useState } from "react";
import { GitBranch, Link, Info } from "lucide-react";
import { useStore } from "../store/useStore";
import { useTheme } from "../styles/theme";
import ModelCanvas from "../components/modelling/ModelCanvas";
import RelationshipPanel from "../components/modelling/RelationshipPanel";

export default function DataModelling() {
  const T             = useTheme();
  const datasets      = useStore((s) => s.datasets);
  const relationships = useStore((s) => s.relationships);
  const [selectedRelId, setSelectedRelId] = useState(null);

  const selectedRel = relationships.find((r) => r.id === selectedRelId) ?? null;

  // Keep selectedRelId valid — clear it if the rel was deleted
  const handleSelectRel = (id) => {
    setSelectedRelId(id);
  };

  const activeCount   = relationships.filter((r) => r.active !== false).length;
  const inactiveCount = relationships.length - activeCount;

  return (
    <div className="flex flex-col" style={{ height: "100%", background: T.bg }}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0 border-b"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <GitBranch size={16} style={{ color: T.accent }} />
        <span className="text-sm font-bold tracking-tight" style={{ color: T.text }}>
          Data Model
        </span>

        <div className="flex items-center gap-1.5 ml-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: T.accent + "22", color: T.accent }}
          >
            {datasets.length} table{datasets.length !== 1 ? "s" : ""}
          </span>
          {relationships.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "#60a5fa22", color: "#60a5fa" }}
            >
              {activeCount} active rel{activeCount !== 1 ? "s" : ""}
            </span>
          )}
          {inactiveCount > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "#4b556322", color: T.muted }}
            >
              {inactiveCount} inactive
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Help tip */}
        <div
          className="flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10px]"
          style={{ background: T.s2, borderColor: T.border, color: T.muted }}
        >
          <Info size={10} />
          <span>Drag a column's port dot to another table to define a relationship</span>
        </div>
      </div>

      {/* ── Canvas + panel ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <ModelCanvas
          selectedRelId={selectedRelId}
          onSelectRel={handleSelectRel}
        />

        {selectedRel && (
          <RelationshipPanel
            key={selectedRel.id}
            relationship={selectedRel}
            onClose={() => setSelectedRelId(null)}
          />
        )}
      </div>
    </div>
  );
}
