import {
  Search, Hash, Type, Calendar, ToggleLeft, Sigma, AlertCircle,
  Grid3x3, Table2, ChevronRight, Database,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useStore }          from "../../store/useStore";
import { useEffectiveData }  from "../../hooks/useEffectiveData";
import { useTheme }          from "../../styles/theme";
import { validateFormula }   from "../../utils/dax";
import { effectiveRichType, isDimensionType } from "../../utils/columnTypes";

function FieldTypeIcon({ type, T }) {
  if (type === "number")  return <Hash       size={10} strokeWidth={2.2} color={T.blue}    />;
  if (type === "date")    return <Calendar   size={10} strokeWidth={2.2} color={T.success} />;
  if (type === "boolean") return <ToggleLeft size={10} strokeWidth={2.2} color={T.accent}  />;
  return <Type size={10} strokeWidth={2.2} color={T.dim} />;
}

function FieldChip({ field, type, label, isCalculated = false, datasetId, tableName, onDragStart, T }) {
  const handleDragStart = (e) => {
    onDragStart?.();
    e.dataTransfer.setData("fieldName", field);
    try {
      e.dataTransfer.setData("vizora/field", JSON.stringify({ field, datasetId, tableName, dataType: type }));
    } catch { /* ignore */ }
    e.dataTransfer.effectAllowed = "copy";
  };
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="drag-chip rounded-lg border px-2.5 py-1.5"
      style={{ background: T.s2, borderColor: T.border, color: T.text }}
    >
      <div className="min-w-0 flex items-center gap-1.5">
        <FieldTypeIcon type={type} T={T} />
        <span className="truncate text-[12.5px]">{label || field}</span>
        {isCalculated && (
          <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase"
            style={{ background: T.accentDim, color: T.accent }}>fx</span>
        )}
      </div>
    </div>
  );
}

function MeasureChip({ measure, onDragStart, T }) {
  const valid = useMemo(() => validateFormula(measure.formula).valid, [measure.formula]);
  const handleDragStart = (e) => {
    if (!valid) { e.preventDefault(); return; }
    onDragStart?.();
    e.dataTransfer.setData("fieldName", measure.name);
  };
  return (
    <div
      draggable={valid}
      onDragStart={handleDragStart}
      title={measure.description || measure.formula}
      className="drag-chip rounded-lg border px-2.5 py-1.5"
      style={{ background: T.s2, borderColor: valid ? T.border : "rgba(239,68,68,0.4)",
        color: T.text, opacity: valid ? 1 : 0.7, cursor: valid ? "grab" : "not-allowed" }}
    >
      <div className="min-w-0 flex items-center gap-1.5">
        <Sigma size={10} strokeWidth={2.2} color={T.accent} />
        <span className="truncate text-[12.5px]">{measure.name}</span>
        {!valid && <AlertCircle size={10} style={{ color: "#ef4444", flexShrink: 0 }} />}
      </div>
    </div>
  );
}

// Collapsible group header (chevron rotates)
function GroupHeader({ open, onToggle, icon, title, count, T, indent = false, accent = false }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition hover:opacity-90"
      style={{ paddingLeft: indent ? 14 : 6 }}
    >
      <ChevronRight
        size={12}
        style={{ color: T.muted, transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms" }}
      />
      {icon}
      <span className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: accent ? T.accent : T.text }}>{title}</span>
      {count != null && (
        <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ background: T.s3, color: T.muted }}>{count}</span>
      )}
    </button>
  );
}

export default function FieldPane() {
  const T              = useTheme();
  const datasets       = useStore((s) => s.datasets);
  const activeDatasetId = useStore((s) => s.activeDatasetId);
  const activateDataset = useStore((s) => s.activateDataset);
  const columnAliases  = useStore((s) => s.columnAliases);
  const columnFormats  = useStore((s) => s.columnFormats);
  const daxMeasures    = useStore((s) => s.measures);
  const metrics        = useStore((s) => s.metrics);

  // Effective columns for the ACTIVE dataset (incl. calc fields + calendar join)
  const eff = useEffectiveData({ applyScenario: false });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState({}); // section id → bool
  const isOpen = (id, dflt = false) => open[id] ?? dflt;
  const toggle = (id, dflt = false) => setOpen((o) => ({ ...o, [id]: !(o[id] ?? dflt) }));

  const displayCol = (col) => columnAliases[col] || col;
  const matchesSearch = (s) => !search || s.toLowerCase().includes(search.toLowerCase());

  // Show every table; native Calendar (system) first.
  const allDatasets = [...datasets].sort(
    (a, b) => (b.isSystemTable ? 1 : 0) - (a.isSystemTable ? 1 : 0)
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2.5">
        <h2 className="text-[13px] font-semibold leading-none" style={{ color: T.text }}>Fields</h2>
        <p className="mt-1 text-[11px]" style={{ color: T.muted }}>Drag dimensions & measures into visuals</p>
      </div>

      {/* Search */}
      <div className="shrink-0 mx-3 mb-2">
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ background: T.s2, borderColor: T.border }}>
          <Search size={12} strokeWidth={2} color={T.muted} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
            className="w-full bg-transparent text-[12.5px] outline-none" style={{ color: T.text }} />
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4 space-y-1">

        {/* Datasets label */}
        <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
          Datasets
        </div>

        {allDatasets.map((ds) => {
          const isActive = ds.id === activeDatasetId;
          const isSystem = !!ds.isSystemTable;

          // Active fact dataset → effective columns (its own raw cols + calc
          // fields), EXCLUDING calendar-joined columns (those live under the
          // Calendar table section). Others → their own columns.
          let cols, dts, calcNames;
          if (isActive) {
            dts = eff.dataTypes; calcNames = eff.calcFieldNames;
            cols = eff.columns.filter(
              (c) => !c.startsWith("_sort_") && (ds.columns?.includes(c) || calcNames.has(c))
            );
          } else {
            dts = ds.dataTypes || {}; calcNames = new Set();
            cols = (ds.columns || []).filter((c) => !c.startsWith("_sort_"));
          }

          const rich = (c) => effectiveRichType(c, dts[c], columnFormats, isSystem);
          const dims = cols.filter((c) => isDimensionType(rich(c)) && matchesSearch(displayCol(c)));
          const meas = cols.filter((c) => dts[c] === "number" && !isDimensionType(rich(c)) && matchesSearch(displayCol(c)));

          const dsOpen   = isOpen(`ds_${ds.id}`, isActive || isSystem);
          const dimsOpen = isOpen(`dim_${ds.id}`, true);
          const measOpen = isOpen(`mea_${ds.id}`, true);

          // Calendar fields resolve via the active dataset's join — don't switch
          // the active dataset when dragging them. Fact datasets activate on drag.
          const onChipDrag = () => { if (!isSystem && !isActive) activateDataset(ds.id); };

          return (
            <div key={ds.id} className="rounded-xl border" style={{
              borderColor: isActive ? "rgba(var(--dc-accent-rgb),0.35)" : T.border,
              background: isActive ? "rgba(var(--dc-accent-rgb),0.04)" : "transparent",
            }}>
              {/* Dataset header */}
              <button
                onClick={() => { if (!isSystem && !isActive) activateDataset(ds.id); toggle(`ds_${ds.id}`, isActive || isSystem); }}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left"
              >
                <ChevronRight size={12} style={{ color: T.muted, transform: dsOpen ? "rotate(90deg)" : "none", transition: "transform 150ms" }} />
                {isSystem
                  ? <Calendar size={12} style={{ color: isActive ? T.accent : T.dim, flexShrink: 0 }} />
                  : <Database size={12} style={{ color: isActive ? T.accent : T.dim, flexShrink: 0 }} />}
                <span className="truncate text-[12.5px] font-semibold" style={{ color: isActive ? T.accent : T.text }}>{ds.name}</span>
                {isSystem && <span className="ml-auto rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase"
                  style={{ background: "rgba(var(--dc-accent-rgb),0.18)", color: T.accent }}>Native</span>}
                {isActive && !isSystem && <span className="ml-auto rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase"
                  style={{ background: T.accent, color: "#000" }}>Active</span>}
              </button>

              {dsOpen && (
                <div className="pb-1.5">
                  {/* Dimensions group */}
                  <GroupHeader open={dimsOpen} onToggle={() => toggle(`dim_${ds.id}`, true)}
                    icon={<Type size={10} color={T.dim} />} title="Dimensions" count={dims.length} indent T={T} />
                  {dimsOpen && (
                    <div className="space-y-1 pl-5 pr-2 pb-1">
                      {dims.length ? dims.map((f) => (
                        <FieldChip key={f} field={f} type={dts[f]} label={displayCol(f)}
                          datasetId={ds.id} tableName={ds.name}
                          isCalculated={calcNames.has(f)} onDragStart={onChipDrag} T={T} />
                      )) : <p className="text-[10.5px] px-1" style={{ color: T.muted }}>No dimensions</p>}
                    </div>
                  )}

                  {/* Measures group */}
                  <GroupHeader open={measOpen} onToggle={() => toggle(`mea_${ds.id}`, true)}
                    icon={<Hash size={10} color={T.blue} />} title="Measures"
                    count={meas.length + (isActive ? daxMeasures.length : 0)} indent T={T} />
                  {measOpen && (
                    <div className="space-y-1 pl-5 pr-2 pb-1">
                      {meas.map((f) => (
                        <FieldChip key={f} field={f} type="number" label={displayCol(f)}
                          datasetId={ds.id} tableName={ds.name}
                          isCalculated={calcNames.has(f)} onDragStart={onChipDrag} T={T} />
                      ))}
                      {isActive && daxMeasures
                        .filter((m) => matchesSearch(m.name))
                        .map((m) => <MeasureChip key={m.id} measure={m} onDragStart={onChipDrag} T={T} />)}
                      {meas.length === 0 && (!isActive || daxMeasures.length === 0) && (
                        <p className="text-[10.5px] px-1" style={{ color: T.muted }}>No measures</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Metrics — separate section, outside datasets ── */}
        {metrics.length > 0 && (
          <div className="pt-2">
            <GroupHeader open={isOpen("metrics", true)} onToggle={() => toggle("metrics", true)}
              icon={<Grid3x3 size={11} color={T.accent} />} title="Metrics" count={metrics.length} accent T={T} />
            {isOpen("metrics", true) && (
              <div className="space-y-1 pl-5 pr-2 pt-1">
                {metrics.filter((m) => matchesSearch(m.name)).map((m) => (
                  <div key={m.id} draggable
                    onDragStart={(e) => { e.dataTransfer.setData("metricId", m.id); e.dataTransfer.effectAllowed = "copy"; }}
                    title="Drag onto a dashboard"
                    className="drag-chip rounded-lg border px-2.5 py-1.5"
                    style={{ background: T.s2, borderColor: T.border, color: T.text }}>
                    <div className="flex items-center gap-1.5">
                      {m.isCalculated
                        ? <Sigma size={10} strokeWidth={2.2} color={T.purple} />
                        : <Table2 size={10} strokeWidth={2.2} color={T.blue} />}
                      <span className="truncate text-[12.5px]">{m.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
