/**
 * MetricBuilder — Pigment-style metric editor modal.
 *
 * Lets the user pick 2+ dimensions, choose input vs calculated, and either
 * edit a multidimensional value grid (input) or write a formula referencing
 * other metrics (calculated). Supports copy/paste/clear on the grid.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  X, Grid3x3, Plus, Check, AlertCircle, Trash2, Hash, Calendar,
  Type as TypeIcon, ToggleLeft, Sigma, Table2,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";
import {
  getMembers, buildGrid, validateMetricFormula, computeAllMetrics,
} from "../../utils/metricsEngine";

const DATA_TYPES = [
  { id: "number",   label: "Number" },
  { id: "currency", label: "Currency" },
  { id: "percent",  label: "Percent" },
];

function dimIcon(type) {
  if (type === "date")    return Calendar;
  if (type === "boolean") return ToggleLeft;
  if (type === "number")  return Hash;
  return TypeIcon;
}

/** Order selected dims by the first hierarchy that references them, else selection order. */
function orderDimensions(selected, hierarchies) {
  if (!hierarchies?.length || selected.length < 2) return selected;
  for (const h of hierarchies) {
    const levels = h.levels || [];
    const inH = selected.filter((d) => levels.includes(d));
    if (inH.length >= 2) {
      const ordered = levels.filter((l) => selected.includes(l));
      const rest = selected.filter((d) => !ordered.includes(d));
      return [...ordered, ...rest];
    }
  }
  return selected;
}

export default function MetricBuilder({ open, onClose, metric, rows, columns, dataTypes, hierarchies }) {
  const T          = useTheme();
  const metrics    = useStore((s) => s.metrics);
  const addMetric  = useStore((s) => s.addMetric);
  const updateMetric = useStore((s) => s.updateMetric);

  const isEdit = !!metric;

  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [dataType,    setDataType]    = useState("number");
  const [isCalculated, setIsCalculated] = useState(false);
  const [selectedDims, setSelectedDims] = useState([]);
  const [formula,     setFormula]     = useState("");
  const [values,      setValues]      = useState({});   // local working copy
  const [error,       setError]       = useState("");
  const [focusCell,   setFocusCell]   = useState(null); // {r,c}

  // Available dimension columns (non-numeric)
  const dimensionCols = useMemo(
    () => (columns || []).filter((c) => dataTypes?.[c] !== "number" && !c.startsWith("_sort_")),
    [columns, dataTypes]
  );

  // Seed state when opening
  useEffect(() => {
    if (!open) return;
    if (metric) {
      setName(metric.name || "");
      setDescription(metric.description || "");
      setDataType(metric.dataType || "number");
      setIsCalculated(!!metric.isCalculated);
      setSelectedDims(metric.dimensions || []);
      setFormula(metric.formula || "");
      setValues({ ...(metric.values || {}) });
    } else {
      setName("");
      setDescription("");
      setDataType("number");
      setIsCalculated(false);
      setSelectedDims([]);
      setFormula("");
      setValues({});
    }
    setError("");
    setFocusCell(null);
  }, [open, metric]);

  // Ordered dimensions (hierarchy-aware)
  const orderedDims = useMemo(
    () => orderDimensions(selectedDims, hierarchies),
    [selectedDims, hierarchies]
  );

  // Members per dimension from data
  const membersByDim = useMemo(() => {
    const out = {};
    orderedDims.forEach((d) => { out[d] = getMembers(rows, d); });
    return out;
  }, [orderedDims, rows]);

  const grid = useMemo(() => buildGrid(orderedDims, membersByDim), [orderedDims, membersByDim]);

  // For calculated preview, compute with a draft version of this metric
  const draftMetric = useMemo(() => ({
    id: metric?.id || "__draft__",
    name: name || "__draft__",
    dataType, dimensions: orderedDims, membersByDim,
    values, isCalculated, formula,
  }), [metric, name, dataType, orderedDims, membersByDim, values, isCalculated, formula]);

  const computed = useMemo(() => {
    const others = metrics.filter((m) => m.id !== draftMetric.id);
    const all = [...others, draftMetric];
    return computeAllMetrics(all);
  }, [metrics, draftMetric]);

  const computedValues = computed.valuesById[draftMetric.id] || {};

  const otherMetricNames = useMemo(
    () => metrics.filter((m) => m.id !== metric?.id).map((m) => m.name),
    [metrics, metric]
  );

  // ── Grid editing ──
  const setCell = useCallback((key, raw) => {
    setValues((prev) => {
      const next = { ...prev };
      if (raw === "" || raw === null || raw === undefined || isNaN(Number(raw))) delete next[key];
      else next[key] = Number(raw);
      return next;
    });
  }, []);

  const handlePaste = useCallback((e, startR, startC) => {
    const text = e.clipboardData?.getData("text");
    if (!text || !text.includes("\t") && !text.includes("\n")) return; // single value → default behaviour
    e.preventDefault();
    const matrix = text.replace(/\r/g, "").split("\n").filter((l, i, a) => !(i === a.length - 1 && l === "")).map((l) => l.split("\t"));
    setValues((prev) => {
      const next = { ...prev };
      matrix.forEach((rowVals, dr) => {
        rowVals.forEach((cellVal, dc) => {
          const row = grid.rows[startR + dr];
          const col = grid.columns[startC + dc];
          if (!row || col === undefined) return;
          const key = grid.cellKey(row.members, col);
          const num = Number(String(cellVal).replace(/[^0-9.\-]/g, ""));
          if (cellVal === "" || isNaN(num)) delete next[key];
          else next[key] = num;
        });
      });
      return next;
    });
  }, [grid]);

  const clearAll = () => setValues({});

  // ── Validation + save ──
  const handleSave = () => {
    if (!name.trim()) { setError("Metric name is required."); return; }
    if (selectedDims.length < 2) { setError("Select at least two dimensions."); return; }
    if (otherMetricNames.includes(name.trim()) && name.trim() !== metric?.name) {
      setError("A metric with this name already exists."); return;
    }
    if (isCalculated) {
      const v = validateMetricFormula(formula, otherMetricNames, name.trim());
      if (!v.valid) { setError(v.error); return; }
      // Cycle check against the full set
      const draft = { ...draftMetric, name: name.trim() };
      const all = [...metrics.filter((m) => m.id !== metric?.id), draft];
      const { cycle } = computeAllMetrics(all);
      if (cycle && cycle.includes(name.trim())) {
        setError(`Circular reference detected: ${cycle.join(" → ")}`); return;
      }
    }

    const payload = {
      name: name.trim(),
      description,
      dataType,
      dimensions: orderedDims,
      membersByDim,
      values: isCalculated ? {} : values,
      isCalculated,
      formula: isCalculated ? formula : "",
    };

    if (isEdit) updateMetric(metric.id, payload);
    else addMetric(payload);
    onClose();
  };

  const insertRef = (mName) => setFormula((f) => `${f}${f && !/[\s(+\-*/]$/.test(f) ? " " : ""}[${mName}]`);

  if (!open) return null;

  const fmt = (v) => {
    if (v === undefined || v === null || v === "") return "";
    const n = Number(v);
    if (dataType === "percent")  return `${(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    if (dataType === "currency") return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };
  const tooManyCols = grid.columns.length > 60;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-5xl flex-col rounded-2xl border shadow-2xl"
        style={{ background: T.surface, borderColor: T.border, maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3 shrink-0" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <Grid3x3 size={15} style={{ color: T.accent }} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: T.text }}>
                {isEdit ? "Edit Metric" : "Create Metric"}
              </div>
              <div className="text-[11px]" style={{ color: T.muted }}>Multidimensional metric builder</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left config */}
          <div className="w-72 shrink-0 overflow-y-auto border-r p-4 space-y-4" style={{ borderColor: T.border }}>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: T.muted }}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Plan"
                className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: T.muted }}>Type</label>
              <div className="flex gap-1.5">
                <button onClick={() => setIsCalculated(false)}
                  className="flex-1 rounded-lg border py-1.5 text-xs font-medium transition"
                  style={{ background: !isCalculated ? T.accentDim : T.s2, borderColor: !isCalculated ? T.accent : T.border, color: !isCalculated ? T.accent : T.text }}>
                  <Table2 size={11} className="inline mr-1" /> Input
                </button>
                <button onClick={() => setIsCalculated(true)}
                  className="flex-1 rounded-lg border py-1.5 text-xs font-medium transition"
                  style={{ background: isCalculated ? T.accentDim : T.s2, borderColor: isCalculated ? T.accent : T.border, color: isCalculated ? T.accent : T.text }}>
                  <Sigma size={11} className="inline mr-1" /> Calculated
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: T.muted }}>Data type</label>
              <select value={dataType} onChange={(e) => setDataType(e.target.value)}
                className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none" style={inputStyle}>
                {DATA_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: T.muted }}>
                Dimensions <span style={{ color: T.dim }}>({selectedDims.length} selected)</span>
              </label>
              <div className="rounded-lg border max-h-48 overflow-y-auto" style={{ borderColor: T.border, background: T.s2 }}>
                {dimensionCols.length === 0 ? (
                  <div className="px-3 py-3 text-xs" style={{ color: T.muted }}>No dimensions available</div>
                ) : dimensionCols.map((c) => {
                  const Icon = dimIcon(dataTypes?.[c]);
                  const active = selectedDims.includes(c);
                  return (
                    <button key={c}
                      onClick={() => setSelectedDims((prev) => active ? prev.filter((d) => d !== c) : [...prev, c])}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-left transition"
                      style={{ background: active ? T.accentDim : "transparent", color: active ? T.accent : T.text }}>
                      <span className="h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center"
                        style={{ borderColor: active ? T.accent : T.border, background: active ? T.accent : "transparent" }}>
                        {active && <Check size={9} color="#000" />}
                      </span>
                      <Icon size={11} style={{ flexShrink: 0 }} />
                      <span className="truncate">{c}</span>
                    </button>
                  );
                })}
              </div>
              {orderedDims.length >= 2 && (
                <p className="mt-1.5 text-[10px]" style={{ color: T.muted }}>
                  Columns: <strong>{orderedDims[0]}</strong> · Rows: {orderedDims.slice(1).join(" / ")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: T.muted }}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none resize-none" style={inputStyle} />
            </div>
          </div>

          {/* Right: grid or formula */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {isCalculated ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="border-b p-4 shrink-0" style={{ borderColor: T.border }}>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: T.muted }}>
                    Formula <span style={{ color: T.dim }}>— reference metrics with [Name], use + − × ÷ %</span>
                  </label>
                  <textarea value={formula} onChange={(e) => setFormula(e.target.value)} rows={3}
                    placeholder="e.g. ( [Revenue] - [Cost] ) / [Revenue] * 100"
                    className="w-full rounded-lg border px-2.5 py-2 text-sm outline-none resize-none mono" style={inputStyle} />
                  {otherMetricNames.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {otherMetricNames.map((mn) => (
                        <button key={mn} onClick={() => insertRef(mn)}
                          className="rounded-md border px-2 py-0.5 text-[11px] font-medium transition hover:opacity-80"
                          style={{ background: T.accentDim, borderColor: T.accent + "44", color: T.accent }}>
                          [{mn}]
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Computed preview */}
                <div className="flex-1 overflow-auto p-4">
                  <div className="text-[11px] font-semibold mb-2" style={{ color: T.muted }}>Preview (read-only)</div>
                  {orderedDims.length < 2 ? (
                    <p className="text-xs" style={{ color: T.muted }}>Select at least two dimensions to preview.</p>
                  ) : (
                    <MetricGridTable grid={grid} fmt={fmt} valueFor={(k) => computedValues[k]} readOnly T={T} />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-2 shrink-0" style={{ borderColor: T.border }}>
                  <div className="text-[11px] font-semibold" style={{ color: T.muted }}>
                    Enter values — paste from Excel supported
                  </div>
                  <button onClick={clearAll}
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px]"
                    style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
                    <Trash2 size={10} /> Clear all
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {orderedDims.length < 2 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-xs text-center" style={{ color: T.muted }}>
                        Select at least two dimensions to build the value grid.
                      </p>
                    </div>
                  ) : tooManyCols ? (
                    <p className="text-xs" style={{ color: T.error }}>
                      Too many columns ({grid.columns.length}). Choose a lower-cardinality dimension as the first dimension.
                    </p>
                  ) : (
                    <MetricGridTable
                      grid={grid} fmt={fmt}
                      valueFor={(k) => values[k]}
                      onCell={(k, v) => setCell(k, v)}
                      onPaste={handlePaste}
                      focusCell={focusCell}
                      setFocusCell={setFocusCell}
                      T={T}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t px-5 py-3 shrink-0" style={{ borderColor: T.border }}>
          <div className="flex-1">
            {error && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}>
                <AlertCircle size={11} /> {error}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}>Cancel</button>
          <button onClick={handleSave} className="rounded-lg px-4 py-2 text-sm font-bold"
            style={{ background: T.accent, color: "#000" }}>
            {isEdit ? "Save Changes" : "Create Metric"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grid table (shared by input editor + calculated preview) ──────────────────
function MetricGridTable({ grid, fmt, valueFor, onCell, onPaste, focusCell, setFocusCell, readOnly, T }) {
  const thBase = { background: T.s2, borderColor: T.border, color: T.muted };
  return (
    <table className="border-collapse text-xs" style={{ color: T.text }}>
      <thead>
        <tr>
          <th className="sticky left-0 z-10 border px-3 py-1.5 text-left font-semibold"
            style={{ ...thBase, position: "sticky", left: 0 }}>
            {grid.rowDims.join(" / ") || ""}
          </th>
          {grid.columns.map((c) => (
            <th key={c} className="border px-3 py-1.5 text-right font-semibold whitespace-nowrap" style={thBase}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grid.rows.map((row, ri) => (
          <tr key={ri}>
            <td className="sticky left-0 z-10 border px-3 py-1 font-medium whitespace-nowrap"
              style={{ background: T.surface, borderColor: T.border, color: T.text, position: "sticky", left: 0 }}>
              {row.label}
            </td>
            {grid.columns.map((col, ci) => {
              const key = grid.cellKey(row.members, col);
              const v = valueFor(key);
              if (readOnly) {
                return (
                  <td key={ci} className="border px-3 py-1 text-right tabular-nums" style={{ borderColor: T.border }}>
                    {v === undefined ? "" : fmt(v)}
                  </td>
                );
              }
              const focused = focusCell && focusCell.r === ri && focusCell.c === ci;
              return (
                <td key={ci} className="border p-0" style={{ borderColor: T.border, background: focused ? T.accentDim : "transparent" }}>
                  <input
                    value={v === undefined ? "" : v}
                    onChange={(e) => onCell(key, e.target.value)}
                    onFocus={() => setFocusCell({ r: ri, c: ci })}
                    onPaste={(e) => onPaste(e, ri, ci)}
                    onKeyDown={(e) => { if (e.key === "Delete" || e.key === "Backspace") { if (!e.currentTarget.value) onCell(key, ""); } }}
                    inputMode="decimal"
                    className="w-full bg-transparent px-2.5 py-1 text-right text-xs outline-none tabular-nums"
                    style={{ color: T.text, minWidth: 70 }}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
