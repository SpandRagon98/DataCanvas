import { X, Trash2, ArrowRight, ArrowLeftRight, Link } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

const CARDINALITIES = [
  { id: "one-to-one",   label: "1 : 1",  from: "1", to: "1" },
  { id: "one-to-many",  label: "1 : ∞",  from: "1", to: "∞" },
  { id: "many-to-one",  label: "∞ : 1",  from: "∞", to: "1" },
  { id: "many-to-many", label: "∞ : ∞",  from: "∞", to: "∞" },
];

export default function RelationshipPanel({ relationship: rel, onClose }) {
  const T = useTheme();
  const datasets       = useStore((s) => s.datasets);
  const updateRel      = useStore((s) => s.updateRelationship);
  const deleteRel      = useStore((s) => s.deleteRelationship);

  const fromDs = datasets.find((d) => d.id === rel.fromDataset);
  const toDs   = datasets.find((d) => d.id === rel.toDataset);

  const patch = (p) => updateRel(rel.id, p);

  const handleDelete = () => {
    deleteRel(rel.id);
    onClose();
  };

  const row = (label, content) => (
    <div className="mb-4">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
        {label}
      </div>
      {content}
    </div>
  );

  const selectBtn = (current, value, label, extra) => (
    <button
      key={value}
      onClick={() => patch({ [current]: value })}
      className="flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-all"
      style={{
        background:   rel[current] === value ? T.accent + "22" : T.s2,
        borderColor:  rel[current] === value ? T.accent : T.border,
        color:        rel[current] === value ? T.accent : T.muted,
      }}
    >
      {label}{extra}
    </button>
  );

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: 280,
        borderLeft: `1px solid ${T.border}`,
        background: T.surface,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: T.border }}
      >
        <div className="flex items-center gap-2">
          <Link size={14} style={{ color: T.accent }} />
          <span className="text-sm font-semibold" style={{ color: T.text }}>
            Relationship
          </span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 hover:opacity-70" style={{ color: T.muted }}>
          <X size={14} />
        </button>
      </div>

      <div className="p-4 flex-1">
        {/* Tables summary */}
        <div
          className="mb-5 rounded-xl border p-3"
          style={{ background: T.s2, borderColor: T.border }}
        >
          <div className="flex items-center gap-2 text-[12px]">
            <div className="flex flex-col min-w-0">
              <span className="font-semibold truncate" style={{ color: T.text }}>
                {fromDs?.name ?? rel.fromDataset}
              </span>
              <span className="text-[11px] font-mono truncate mt-0.5" style={{ color: T.accent }}>
                {rel.fromColumn}
              </span>
            </div>
            <ArrowRight size={13} className="shrink-0" style={{ color: T.muted }} />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold truncate" style={{ color: T.text }}>
                {toDs?.name ?? rel.toDataset}
              </span>
              <span className="text-[11px] font-mono truncate mt-0.5" style={{ color: T.accent }}>
                {rel.toColumn}
              </span>
            </div>
          </div>
        </div>

        {/* Cardinality */}
        {row("Cardinality",
          <div className="grid grid-cols-2 gap-1.5">
            {CARDINALITIES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => patch({ cardinality: id })}
                className="rounded-lg border py-2 text-[12px] font-bold transition-all font-mono"
                style={{
                  background:  rel.cardinality === id ? T.accent + "22" : T.s2,
                  borderColor: rel.cardinality === id ? T.accent : T.border,
                  color:       rel.cardinality === id ? T.accent : T.muted,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Direction */}
        {row("Direction",
          <div className="flex gap-1.5">
            <button
              onClick={() => patch({ direction: "single" })}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-semibold transition-all"
              style={{
                background:  rel.direction === "single" ? T.accent + "22" : T.s2,
                borderColor: rel.direction === "single" ? T.accent : T.border,
                color:       rel.direction === "single" ? T.accent : T.muted,
              }}
            >
              <ArrowRight size={12} />
              Single
            </button>
            <button
              onClick={() => patch({ direction: "bidirectional" })}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-semibold transition-all"
              style={{
                background:  rel.direction === "bidirectional" ? T.accent + "22" : T.s2,
                borderColor: rel.direction === "bidirectional" ? T.accent : T.border,
                color:       rel.direction === "bidirectional" ? T.accent : T.muted,
              }}
            >
              <ArrowLeftRight size={12} />
              Both ways
            </button>
          </div>
        )}

        {/* Active toggle */}
        {row("Status",
          <div className="flex gap-1.5">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                onClick={() => patch({ active: val })}
                className="flex-1 rounded-lg border py-2 text-[11px] font-semibold transition-all"
                style={{
                  background:  rel.active === val ? (val ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)") : T.s2,
                  borderColor: rel.active === val ? (val ? "#22c55e" : "#ef4444") : T.border,
                  color:       rel.active === val ? (val ? "#22c55e" : "#ef4444") : T.muted,
                }}
              >
                {val ? "● Active" : "○ Inactive"}
              </button>
            ))}
          </div>
        )}

        {/* Delete */}
        <div className="mt-6 pt-4 border-t" style={{ borderColor: T.border }}>
          <button
            onClick={handleDelete}
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[12px] font-semibold transition-all hover:opacity-80"
            style={{
              background: "rgba(239,68,68,0.08)",
              borderColor: "rgba(239,68,68,0.3)",
              color: "#ef4444",
            }}
          >
            <Trash2 size={13} />
            Delete Relationship
          </button>
        </div>
      </div>
    </div>
  );
}
