import { Search, Hash, Type, Calendar, ToggleLeft, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "../../store/useStore";
import { T } from "../../styles/theme";

function TypeIcon({ type }) {
  if (type === "number") return <Hash size={12} color={T.blue} />;
  if (type === "date") return <Calendar size={12} color={T.success} />;
  if (type === "boolean") return <ToggleLeft size={12} color={T.accent} />;
  return <Type size={12} color={T.dim} />;
}

function FieldChip({ field, type, label }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData("fieldName", field);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab rounded-xl border px-3 py-2 text-sm transition active:cursor-grabbing"
      style={{
        background: T.s2,
        borderColor: T.border,
        color: T.text,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate">{label || field}</div>
          {label && label !== field && (
            <div className="mt-0.5 truncate text-[11px] mono" style={{ color: T.muted }}>
              {field}
            </div>
          )}
        </div>

        <div className="inline-flex items-center gap-1 rounded-md px-2 py-1 mono text-[10px]" style={{ background: T.s3 }}>
          <TypeIcon type={type} />
          <span style={{ color: T.dim }}>{type}</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="mb-5 rounded-2xl border p-3" style={{ background: T.surface, borderColor: T.border }}>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function FieldPane() {
  const columns = useStore((s) => s.columns);
  const dataTypes = useStore((s) => s.dataTypes);
  const hierarchies = useStore((s) => s.hierarchies);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return columns.filter((c) => c.toLowerCase().includes(search.toLowerCase()));
  }, [columns, search]);

  const dimensions = filtered.filter((c) => dataTypes[c] !== "number");
  const measures = filtered.filter((c) => dataTypes[c] === "number");

  const hierarchyFields = hierarchies.flatMap((h) =>
    h.levels.map((level, idx) => ({
      id: `${h.name}_${idx}`,
      label: `${h.name}: ${level}`,
      field: level,
      type: dataTypes[level] || "string",
    }))
  );

  return (
    <div
      className="h-full rounded-[20px] border p-4 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: T.text }}>
          Fields
        </h2>
        <p className="text-sm" style={{ color: T.dim }}>
          Search and drag into visual zones
        </p>
      </div>

      <div
        className="mb-5 flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{ background: T.s2, borderColor: T.border }}
      >
        <Search size={14} color={T.muted} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fields..."
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: T.text }}
        />
      </div>

      <div className="max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
        {hierarchyFields.length > 0 && (
          <Section title="Hierarchies" icon={<Layers3 size={12} color={T.accent} />}>
            {hierarchyFields.map((item) => (
              <FieldChip
                key={item.id}
                field={item.field}
                type={item.type}
                label={item.label}
              />
            ))}
          </Section>
        )}

        <Section title="Dimensions" icon={<Type size={12} color={T.dim} />}>
          {dimensions.length ? (
            dimensions.map((field) => (
              <FieldChip key={field} field={field} type={dataTypes[field]} />
            ))
          ) : (
            <div className="text-sm" style={{ color: T.muted }}>
              No matching dimensions
            </div>
          )}
        </Section>

        <Section title="Measures" icon={<Hash size={12} color={T.blue} />}>
          {measures.length ? (
            measures.map((field) => (
              <FieldChip key={field} field={field} type={dataTypes[field]} />
            ))
          ) : (
            <div className="text-sm" style={{ color: T.muted }}>
              No matching measures
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
