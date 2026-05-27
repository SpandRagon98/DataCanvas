import { Search, Hash, Type, Calendar, ToggleLeft, Layers3, Sigma, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore }          from "../../store/useStore";
import { useEffectiveData }  from "../../hooks/useEffectiveData";
import { useTheme }          from "../../styles/theme";
import { validateFormula }   from "../../utils/dax";

function TypeIcon({ type, T }) {
  if (type === "number")  return <Hash      size={10} strokeWidth={2.2} color={T.blue}    />;
  if (type === "date")    return <Calendar  size={10} strokeWidth={2.2} color={T.success} />;
  if (type === "boolean") return <ToggleLeft size={10} strokeWidth={2.2} color={T.accent}  />;
  return <Type size={10} strokeWidth={2.2} color={T.dim} />;
}

function FieldChip({ field, type, label, isCalculated = false, T }) {
  const handleDragStart = (e) => e.dataTransfer.setData("fieldName", field);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="drag-chip rounded-xl border px-2.5 py-1.5"
      style={{
        background: T.s2,
        borderColor: T.border,
        color: T.text,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <TypeIcon type={type} T={T} />
          <span className="truncate text-[12.5px]">{label || field}</span>
          {isCalculated && (
            <span
              className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase"
              style={{ background: T.accentDim, color: T.accent }}
            >
              fx
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ title, icon, T }) {
  return (
    <div
      className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: T.muted }}
    >
      {icon}
      {title}
    </div>
  );
}

/** A draggable chip for a DAX measure — drags the measure name like a column. */
function MeasureChip({ measure, T }) {
  const valid = useMemo(() => validateFormula(measure.formula).valid, [measure.formula]);
  const handleDragStart = (e) => {
    if (!valid) { e.preventDefault(); return; }
    e.dataTransfer.setData("fieldName", measure.name);
  };
  return (
    <div
      draggable={valid}
      onDragStart={handleDragStart}
      title={measure.description || measure.formula}
      className="drag-chip rounded-xl border px-2.5 py-1.5"
      style={{
        background: T.s2,
        borderColor: valid ? T.border : "rgba(239,68,68,0.4)",
        color: T.text,
        opacity: valid ? 1 : 0.7,
        cursor: valid ? "grab" : "not-allowed",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <Sigma size={10} strokeWidth={2.2} color={T.accent} />
          <span className="truncate text-[12.5px]">{measure.name}</span>
        </div>
        {!valid && <AlertCircle size={10} style={{ color: "#ef4444", flexShrink: 0 }} />}
      </div>
    </div>
  );
}

export default function FieldPane() {
  const T             = useTheme();
  const { columns, dataTypes, calcFieldNames } = useEffectiveData({ applyScenario: false });
  const hierarchies   = useStore((s) => s.hierarchies);
  const columnAliases = useStore((s) => s.columnAliases);
  const daxMeasures   = useStore((s) => s.measures);
  const [search, setSearch] = useState("");

  const displayCol = (col) => columnAliases[col] || col;

  const filtered = useMemo(
    () => columns.filter((c) =>
      c.toLowerCase().includes(search.toLowerCase()) ||
      (columnAliases[c] || "").toLowerCase().includes(search.toLowerCase())
    ),
    [columns, search, columnAliases]
  );

  const dimensions = filtered.filter((c) => dataTypes[c] !== "number");
  const measures   = filtered.filter((c) => dataTypes[c] === "number");

  const hierarchyFields = hierarchies.flatMap((h) =>
    h.levels.map((level, idx) => ({
      id: `${h.name}_${idx}`,
      label: `${h.name}: ${level}`,
      field: level,
      type: dataTypes[level] || "string",
    }))
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3">
        <h2 className="text-[13px] font-semibold leading-none" style={{ color: T.text }}>Fields</h2>
        <p className="mt-1 text-[11px]" style={{ color: T.muted }}>Drag into visual zones</p>
      </div>

      {/* Search */}
      <div className="shrink-0 mx-3 mb-3">
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ background: T.s2, borderColor: T.border }}
        >
          <Search size={12} strokeWidth={2} color={T.muted} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full bg-transparent text-[12.5px] outline-none"
            style={{ color: T.text }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ color: T.muted, display: "flex" }}>
              <Search size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-4">

        {hierarchyFields.length > 0 && (
          <div>
            <SectionLabel title="Hierarchies" icon={<Layers3 size={10} color={T.accent} />} T={T} />
            <div className="space-y-1">
              {hierarchyFields.map((item) => (
                <FieldChip key={item.id} field={item.field} type={item.type} label={item.label} T={T} />
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionLabel title="Dimensions" icon={<Type size={10} color={T.dim} />} T={T} />
          <div className="space-y-1">
            {dimensions.length ? (
              dimensions.map((f) => (
                <FieldChip key={f} field={f} type={dataTypes[f]} label={displayCol(f)} isCalculated={calcFieldNames.has(f)} T={T} />
              ))
            ) : (
              <p className="text-[11px] px-1" style={{ color: T.muted }}>No matches</p>
            )}
          </div>
        </div>

        <div>
          <SectionLabel title="Measures" icon={<Hash size={10} color={T.blue} />} T={T} />
          <div className="space-y-1">
            {measures.length ? (
              measures.map((f) => (
                <FieldChip key={f} field={f} type={dataTypes[f]} label={displayCol(f)} isCalculated={calcFieldNames.has(f)} T={T} />
              ))
            ) : (
              <p className="text-[11px] px-1" style={{ color: T.muted }}>No matches</p>
            )}
          </div>
        </div>

        {[...calcFieldNames].length > 0 && (
          <div>
            <SectionLabel title="Calculated" icon={<Sigma size={10} color={T.accent} />} T={T} />
            <div className="space-y-1">
              {[...calcFieldNames]
                .filter((f) => f.toLowerCase().includes(search.toLowerCase()))
                .map((f) => (
                  <FieldChip key={f} field={f} type={dataTypes[f]} isCalculated T={T} />
                ))}
            </div>
          </div>
        )}

        {daxMeasures.length > 0 && (
          <div>
            <SectionLabel title="Measures (DAX)" icon={<Sigma size={10} color={T.accent} />} T={T} />
            <div className="space-y-1">
              {daxMeasures
                .filter((m) =>
                  m.name.toLowerCase().includes(search.toLowerCase()) ||
                  (m.description || "").toLowerCase().includes(search.toLowerCase())
                )
                .map((m) => (
                  <MeasureChip key={m.id} measure={m} T={T} />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
