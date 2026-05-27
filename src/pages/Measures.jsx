import { useEffect, useMemo, useState } from "react";
import {
  Sigma, Plus, Trash2, Copy, AlertCircle, CheckCircle2,
  Play, FileText, BookOpen, Search, Hash,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useTheme } from "../styles/theme";
import { useEffectiveData } from "../hooks/useEffectiveData";
import { applyGlobalFilters } from "../utils/filterEngine";
import {
  evaluateMeasure,
  validateFormula,
  listFunctions,
} from "../utils/dax";
import { formatValue } from "../utils/formatValue";
import DaxEditor from "../components/measures/DaxEditor";

const FORMATS = [
  { id: "number",   label: "Number",   sample: { type: "number",  decimals: 2 } },
  { id: "whole",    label: "Whole",    sample: { type: "whole" } },
  { id: "decimal",  label: "Decimal",  sample: { type: "decimal", decimals: 2 } },
  { id: "currency", label: "Currency", sample: { type: "currency", decimals: 2, currencySymbol: "$" } },
  { id: "percent",  label: "Percent",  sample: { type: "percent",  decimals: 1 } },
  { id: "compact",  label: "Compact",  sample: { type: "compact",  decimals: 1 } },
];

export default function Measures() {
  const T              = useTheme();
  const measures       = useStore((s) => s.measures);
  const addMeasure     = useStore((s) => s.addMeasure);
  const updateMeasure  = useStore((s) => s.updateMeasure);
  const deleteMeasure  = useStore((s) => s.deleteMeasure);
  const duplicateMeasure = useStore((s) => s.duplicateMeasure);
  const filters        = useStore((s) => s.filters);
  const { rawData }    = useEffectiveData({ applyScenario: false });

  const [selectedId,   setSelectedId]   = useState(measures[0]?.id ?? null);
  const [search,       setSearch]       = useState("");
  const [showRef,      setShowRef]      = useState(false);

  // Keep selectedId valid
  useEffect(() => {
    if (selectedId && !measures.some((m) => m.id === selectedId)) {
      setSelectedId(measures[0]?.id ?? null);
    } else if (!selectedId && measures.length) {
      setSelectedId(measures[0].id);
    }
  }, [measures, selectedId]);

  const selected = measures.find((m) => m.id === selectedId) ?? null;

  // Rows after global filters — measure preview uses these
  const filteredRows = useMemo(
    () => applyGlobalFilters(rawData, filters),
    [rawData, filters]
  );

  // Live evaluation of currently selected measure
  const liveResult = useMemo(() => {
    if (!selected) return null;
    const val = validateFormula(selected.formula);
    if (!val.valid) return { ok: false, error: val.error };
    const res = evaluateMeasure(selected, {
      rows: filteredRows,
      fullRows: rawData,
      measures,
    });
    if (res.error) return { ok: false, error: res.error };
    return { ok: true, value: res.value };
  }, [selected, filteredRows, rawData, measures]);

  const filteredMeasures = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return measures;
    return measures.filter((m) =>
      m.name.toLowerCase().includes(s) ||
      m.formula.toLowerCase().includes(s) ||
      (m.description || "").toLowerCase().includes(s)
    );
  }, [measures, search]);

  const handleCreate = () => {
    const id = `measure_${Date.now()}`;
    let name = "New Measure";
    let n = 2;
    while (measures.some((m) => m.name === name)) name = `New Measure ${n++}`;
    addMeasure({ id, name, formula: "= SUM ( [Revenue] )", description: "", format: "number" });
    setSelectedId(id);
  };

  return (
    <div className="flex flex-col" style={{ height: "100%", background: T.bg }}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0 border-b"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <Sigma size={16} style={{ color: T.accent }} />
        <span className="text-sm font-bold tracking-tight" style={{ color: T.text }}>
          Measures
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: T.accent + "22", color: T.accent }}
        >
          {measures.length}
        </span>

        <div className="flex-1" />

        <button
          onClick={() => setShowRef((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[11px] font-semibold transition"
          style={{
            background: showRef ? T.accent + "22" : T.s2,
            borderColor: showRef ? T.accent : T.border,
            color: showRef ? T.accent : T.muted,
          }}
        >
          <BookOpen size={11} />
          Function reference
        </button>

        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition"
          style={{ background: T.accent, color: "#000" }}
        >
          <Plus size={12} strokeWidth={2.5} />
          New Measure
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* List */}
        <div
          className="flex flex-col shrink-0"
          style={{
            width: 260,
            borderRight: `1px solid ${T.border}`,
            background: T.surface,
          }}
        >
          <div className="p-3 border-b shrink-0" style={{ borderColor: T.border }}>
            <div
              className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
              style={{ background: T.s2, borderColor: T.border }}
            >
              <Search size={11} style={{ color: T.muted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search measures…"
                className="w-full bg-transparent text-[12px] outline-none"
                style={{ color: T.text }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {filteredMeasures.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <Sigma size={22} style={{ color: T.border }} className="mx-auto mb-2" />
                <div className="text-xs" style={{ color: T.muted }}>
                  {measures.length === 0 ? "No measures yet" : "No matches"}
                </div>
              </div>
            ) : (
              filteredMeasures.map((m) => {
                const isSelected = m.id === selectedId;
                const val = validateFormula(m.formula);
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className="w-full text-left rounded-xl border px-3 py-2 transition"
                    style={{
                      background:  isSelected ? T.accent + "22" : T.s2,
                      borderColor: isSelected ? T.accent : T.border,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Sigma size={11} style={{ color: isSelected ? T.accent : T.muted }} />
                      <span
                        className="text-[12px] font-semibold truncate flex-1"
                        style={{ color: isSelected ? T.accent : T.text }}
                      >
                        {m.name}
                      </span>
                      {val.valid
                        ? <CheckCircle2 size={10} style={{ color: T.success }} />
                        : <AlertCircle  size={10} style={{ color: "#ef4444" }} />
                      }
                    </div>
                    <div
                      className="mt-1 text-[10px] truncate font-mono"
                      style={{ color: isSelected ? T.accent : T.muted, opacity: 0.7 }}
                    >
                      {m.formula || "(empty)"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {selected ? (
            <MeasureEditPanel
              key={selected.id}
              measure={selected}
              measures={measures}
              liveResult={liveResult}
              filteredRows={filteredRows}
              onUpdate={(patch) => updateMeasure(selected.id, patch)}
              onDelete={() => { deleteMeasure(selected.id); }}
              onDuplicate={() => duplicateMeasure(selected.id)}
              T={T}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ background: T.bg }}>
              <Sigma size={36} style={{ color: T.border }} className="mb-3" />
              <div className="text-sm font-medium" style={{ color: T.muted }}>No measure selected</div>
              <div className="text-xs mt-1 mb-4" style={{ color: T.dim }}>
                Create your first DAX measure to get started
              </div>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold transition"
                style={{ background: T.accent, color: "#000" }}
              >
                <Plus size={13} strokeWidth={2.5} />
                Create Measure
              </button>
            </div>
          )}
        </div>

        {/* Function reference drawer */}
        {showRef && <FunctionReference T={T} onClose={() => setShowRef(false)} />}
      </div>
    </div>
  );
}

/* ─── Measure edit panel ─────────────────────────────────────────────────── */
function MeasureEditPanel({
  measure, measures, liveResult, filteredRows,
  onUpdate, onDelete, onDuplicate, T,
}) {
  const [name, setName] = useState(measure.name);
  const [formula, setFormula] = useState(measure.formula);
  const [description, setDescription] = useState(measure.description ?? "");
  const [format, setFormat] = useState(measure.format ?? "number");

  // Persist on change (debounced trivially by React batching)
  useEffect(() => { onUpdate({ name }); /* eslint-disable-next-line */ }, [name]);
  useEffect(() => { onUpdate({ formula }); /* eslint-disable-next-line */ }, [formula]);
  useEffect(() => { onUpdate({ description }); /* eslint-disable-next-line */ }, [description]);
  useEffect(() => { onUpdate({ format }); /* eslint-disable-next-line */ }, [format]);

  const nameError = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return "Name cannot be empty";
    const dup = measures.find((m) => m.name === trimmed && m.id !== measure.id);
    if (dup) return "A measure with this name already exists";
    return null;
  }, [name, measures, measure.id]);

  const formatSpec = FORMATS.find((f) => f.id === format)?.sample ?? { type: "number" };

  const renderResult = () => {
    if (!liveResult) return "—";
    if (!liveResult.ok) return liveResult.error;
    const v = liveResult.value;
    if (v === null || v === undefined) return "(blank)";
    if (typeof v === "number") return formatValue(v, formatSpec);
    if (v instanceof Date) return v.toLocaleString();
    if (Array.isArray(v)) return `(${v.length} rows)`;
    return String(v);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-y-auto p-5 gap-5" style={{ background: T.bg }}>
      {/* Header — name + actions */}
      <div className="flex items-center gap-3">
        <Sigma size={18} style={{ color: T.accent }} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 text-base font-bold bg-transparent outline-none border-b transition"
          style={{
            color: T.text,
            borderColor: nameError ? "#ef4444" : "transparent",
            paddingBottom: 2,
          }}
        />
        <button
          onClick={onDuplicate}
          title="Duplicate"
          className="rounded-lg p-1.5 hover:opacity-80"
          style={{ color: T.muted, background: T.surface, border: `1px solid ${T.border}` }}
        >
          <Copy size={13} />
        </button>
        <button
          onClick={() => { if (confirm(`Delete measure "${measure.name}"?`)) onDelete(); }}
          title="Delete"
          className="rounded-lg p-1.5 hover:opacity-80"
          style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {nameError && (
        <div className="text-[11px] -mt-3" style={{ color: "#ef4444" }}>{nameError}</div>
      )}

      {/* Formula editor */}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
          Formula
        </div>
        <DaxEditor
          value={formula}
          onChange={setFormula}
          placeholder="= SUM ( [Revenue] ) / DISTINCTCOUNT ( [Region] )"
          minRows={8}
        />
        <div className="mt-1.5 text-[10px]" style={{ color: T.dim }}>
          Tip: Type a function name (e.g. <span style={{ color: "#a78bfa" }}>SUM</span>) — autocomplete will offer suggestions. Use Tab or Enter to accept.
        </div>
      </div>

      {/* Live result */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: liveResult?.ok ? T.surface : "rgba(239,68,68,0.06)",
          borderColor: liveResult?.ok ? T.border : "rgba(239,68,68,0.25)",
        }}
      >
        <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold uppercase tracking-widest"
             style={{ color: liveResult?.ok ? T.muted : "#ef4444" }}>
          {liveResult?.ok
            ? <Play size={10} />
            : <AlertCircle size={10} />}
          {liveResult?.ok ? "Live Result" : "Error"}
          <span className="ml-auto font-mono text-[10px]" style={{ color: T.dim, textTransform: "none", letterSpacing: 0 }}>
            against {filteredRows.length.toLocaleString()} rows
          </span>
        </div>
        <div
          className="font-mono text-base font-bold"
          style={{ color: liveResult?.ok ? T.text : "#ef4444", wordBreak: "break-word" }}
        >
          {renderResult()}
        </div>
      </div>

      {/* Format + description in a 2-col row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
            Format
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className="rounded-lg border py-1.5 text-[11px] font-semibold transition"
                style={{
                  background:  format === f.id ? T.accent + "22" : T.s2,
                  borderColor: format === f.id ? T.accent : T.border,
                  color:       format === f.id ? T.accent : T.muted,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
            Description (optional)
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Profit ÷ Revenue"
            className="w-full rounded-xl border bg-transparent px-3 py-2 text-[12px] outline-none"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}
          />
        </div>
      </div>

      {/* Footer info card */}
      <div
        className="rounded-xl border p-3 text-[11px]"
        style={{ background: T.surface, borderColor: T.border, color: T.muted }}
      >
        <div className="flex items-start gap-2">
          <FileText size={12} className="mt-0.5 shrink-0" />
          <div className="leading-snug">
            Once saved, this measure appears in the <span style={{ color: T.accent, fontWeight: 600 }}>Fields panel</span>
            {" "}under <span style={{ color: T.accent }}>Measures (DAX)</span>. Drag it into any visual's Y-axis like a regular field.
            Visual filters, global filters, and cross-filters all apply automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Function reference drawer ──────────────────────────────────────────── */
function FunctionReference({ T, onClose }) {
  const [search, setSearch] = useState("");
  const fns = useMemo(() => listFunctions(), []);
  const filtered = useMemo(() => {
    const s = search.trim().toUpperCase();
    if (!s) return fns;
    return fns.filter((f) => f.name.includes(s));
  }, [fns, search]);

  // Group by category
  const groups = useMemo(() => {
    const map = {};
    for (const f of filtered) {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    }
    return map;
  }, [filtered]);

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: 320,
        borderLeft: `1px solid ${T.border}`,
        background: T.surface,
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: T.border }}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={14} style={{ color: T.accent }} />
          <span className="text-sm font-bold" style={{ color: T.text }}>Functions</span>
          <span className="text-[10px]" style={{ color: T.muted }}>({filtered.length})</span>
        </div>
        <button onClick={onClose} style={{ color: T.muted }}>✕</button>
      </div>

      <div className="p-3 border-b shrink-0" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
             style={{ background: T.s2, borderColor: T.border }}>
          <Search size={11} style={{ color: T.muted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search functions…"
            className="w-full bg-transparent text-[12px] outline-none"
            style={{ color: T.text }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                 style={{ color: T.accent }}>
              {cat}
            </div>
            <div className="space-y-1.5">
              {items.map((f) => (
                <div
                  key={f.name}
                  className="rounded-lg border p-2.5"
                  style={{ background: T.s2, borderColor: T.border }}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-bold text-[12px]" style={{ color: "#a78bfa" }}>
                      {f.name}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] leading-snug" style={{ color: T.text }}>
                    {f.describe}
                  </div>
                  {f.example && (
                    <div className="mt-1 font-mono text-[10.5px]" style={{ color: T.muted }}>
                      {f.example}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-6 text-xs" style={{ color: T.muted }}>
            No matches
          </div>
        )}
      </div>
    </div>
  );
}
