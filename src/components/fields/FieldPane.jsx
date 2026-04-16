import { useStore } from "../../store/useStore";

/**
 * Individual draggable field chip
 */
function FieldChip({ field, type }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData("fieldName", field);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50 active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-700">{field}</span>
        <span className="text-[10px] uppercase text-slate-400">{type}</span>
      </div>
    </div>
  );
}

/**
 * Main Field Pane
 */
export default function FieldPane() {
  const columns = useStore((s) => s.columns);
  const dataTypes = useStore((s) => s.dataTypes);
  const hierarchies = useStore((s) => s.hierarchies);

  // Split into dimensions vs measures
  const dimensions = columns.filter(
    (c) => dataTypes[c] !== "number"
  );

  const measures = columns.filter(
    (c) => dataTypes[c] === "number"
  );

  // 🔥 Flatten hierarchy levels into usable fields
  const hierarchyFields = hierarchies.flatMap((h) =>
    h.levels.map((level, idx) => ({
      id: `${h.name}_${idx}`,
      label: `${h.name}: ${level}`,
      field: level,
    }))
  );

  return (
    <div className="h-full overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">
        Fields
      </h2>

      {/* 🔷 Hierarchies Section */}
      {hierarchies.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hierarchies
          </h3>

          <div className="space-y-2">
            {hierarchyFields.map((item) => (
              <FieldChip
                key={item.id}
                field={item.field}
                type="hierarchy"
              />
            ))}
          </div>
        </div>
      )}

      {/* 🔷 Dimensions */}
      <div className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Dimensions
        </h3>

        <div className="space-y-2">
          {dimensions.map((field) => (
            <FieldChip
              key={field}
              field={field}
              type={dataTypes[field]}
            />
          ))}
        </div>
      </div>

      {/* 🔷 Measures */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Measures
        </h3>

        <div className="space-y-2">
          {measures.map((field) => (
            <FieldChip
              key={field}
              field={field}
              type={dataTypes[field]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
