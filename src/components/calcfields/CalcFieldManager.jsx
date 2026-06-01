import { useState } from "react";
import { Calculator, Plus, Trash2, AlertCircle, Zap } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";
import { validateFormula, extractReferencedFields } from "../../utils/calcFields";
import AIFormulaAssistant from "../ai/AIFormulaAssistant";

/** Build smart presets from numeric column names */
function buildSmartPresets(numericColumns) {
  const presets = [];
  const cols = numericColumns;

  // Revenue - Cost → Profit
  const revCol = cols.find((c) => /revenue/i.test(c));
  const costCol = cols.find((c) => /cost/i.test(c));
  const profitCol = cols.find((c) => /profit/i.test(c));
  const unitsCol = cols.find((c) => /unit|qty|quantity/i.test(c));
  const priceCol = cols.find((c) => /price/i.test(c));

  if (revCol && costCol) {
    presets.push({ name: "Gross Profit", formula: `[${revCol}] - [${costCol}]` });
  }
  if (revCol && costCol) {
    presets.push({ name: "Margin %", formula: `([${revCol}] - [${costCol}]) / [${revCol}] * 100` });
  }
  if (revCol && profitCol) {
    presets.push({ name: "Profit Ratio", formula: `[${profitCol}] / [${revCol}] * 100` });
  }
  if (unitsCol && priceCol) {
    presets.push({ name: "Total Revenue", formula: `[${unitsCol}] * [${priceCol}]` });
  }

  return presets;
}

/** Generic formula presets (always available) */
const GENERIC_PRESETS = [
  {
    label: "A − B",
    getFormula: (cols) =>
      cols.length >= 2 ? `[${cols[0]}] - [${cols[1]}]` : `[Field1] - [Field2]`,
    getName: (cols) =>
      cols.length >= 2 ? `${cols[0]} minus ${cols[1]}` : "Difference",
  },
  {
    label: "A / B × 100",
    getFormula: (cols) =>
      cols.length >= 2 ? `[${cols[0]}] / [${cols[1]}] * 100` : `[Field1] / [Field2] * 100`,
    getName: (cols) =>
      cols.length >= 2 ? `${cols[0]} pct of ${cols[1]}` : "Percentage",
  },
  {
    label: "(A−B) / B × 100",
    getFormula: (cols) =>
      cols.length >= 2
        ? `([${cols[0]}] - [${cols[1]}]) / [${cols[1]}] * 100`
        : `([Field1] - [Field2]) / [Field2] * 100`,
    getName: (cols) =>
      cols.length >= 2 ? `Growth % (${cols[0]})` : "Growth %",
  },
  {
    label: "A + B",
    getFormula: (cols) =>
      cols.length >= 2 ? `[${cols[0]}] + [${cols[1]}]` : `[Field1] + [Field2]`,
    getName: (cols) =>
      cols.length >= 2 ? `${cols[0]} plus ${cols[1]}` : "Sum of two",
  },
];

export default function CalcFieldManager() {
  const T = useTheme();
  const columns = useStore((s) => s.columns);
  const dataTypes = useStore((s) => s.dataTypes);
  const calculatedFields = useStore((s) => s.calculatedFields);
  const addCalculatedField = useStore((s) => s.addCalculatedField);
  const removeCalculatedField = useStore((s) => s.removeCalculatedField);

  const [name, setName] = useState("");
  const [formula, setFormula] = useState("");
  const [error, setError] = useState("");

  const numericColumns = columns.filter((c) => dataTypes[c] === "number");

  const insertField = (field) => {
    setFormula((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}[${field}]`);
  };

  const handleAdd = () => {
    setError("");
    const trimmedName = name.trim();

    if (!trimmedName) { setError("Field name is required."); return; }
    if (columns.includes(trimmedName)) { setError("A column with this name already exists."); return; }
    if (calculatedFields.some((cf) => cf.name === trimmedName)) {
      setError("A calculated field with this name already exists.");
      return;
    }

    const validity = validateFormula(formula);
    if (!validity.valid) { setError(validity.message); return; }

    const referenced = extractReferencedFields(formula);
    const unknown = referenced.filter((r) => !columns.includes(r));
    if (unknown.length) { setError(`Unknown field(s): ${unknown.join(", ")}`); return; }

    addCalculatedField({ name: trimmedName, formula, type: "number" });
    setName("");
    setFormula("");
  };

  const applyPreset = (presetName, presetFormula) => {
    setName(presetName);
    setFormula(presetFormula);
    setError("");
  };

  const smartPresets = buildSmartPresets(numericColumns);

  return (
    <div
      className="rounded-xl border p-5 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: T.accentDim }}
        >
          <Calculator size={18} color={T.accent} />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: T.text }}>
            Calculated Fields
          </h2>
          <p className="text-sm" style={{ color: T.dim }}>
            Derive new measures from existing numeric fields
          </p>
        </div>
      </div>

      {/* Formula Presets */}
      {numericColumns.length >= 1 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
            <Zap size={11} style={{ color: T.accent }} />
            Quick presets
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Generic presets */}
            {GENERIC_PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => applyPreset(preset.getName(numericColumns), preset.getFormula(numericColumns))}
                className="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:opacity-90"
                style={{
                  background: T.accentDim,
                  borderColor: "rgba(20,184,166,0.20)",
                  color: T.accent,
                }}
                title={preset.getFormula(numericColumns)}
              >
                {preset.label}
              </button>
            ))}
            {/* Smart presets (data-aware) */}
            {smartPresets.map((preset, i) => (
              <button
                key={`smart-${i}`}
                onClick={() => applyPreset(preset.name, preset.formula)}
                className="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:opacity-90"
                style={{
                  background: "rgba(96,165,250,0.10)",
                  borderColor: "rgba(96,165,250,0.22)",
                  color: T.blue,
                }}
                title={preset.formula}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Formula Assistant */}
      {numericColumns.length > 0 && (
        <div className="mb-4">
          <AIFormulaAssistant
            columns={columns}
            dataTypes={dataTypes}
            onInsert={(formulaText) => {
              setFormula(formulaText);
              setError("");
            }}
          />
        </div>
      )}

      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Field name (e.g. Margin)"
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{ background: T.s2, borderColor: T.border, color: T.text }}
        />

        <textarea
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="[Revenue] - [Cost]"
          className="h-20 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none mono"
          style={{ background: T.s2, borderColor: T.border, color: T.text }}
        />

        {numericColumns.length > 0 && (
          <div>
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: T.muted }}
            >
              Insert numeric field
            </div>
            <div className="flex flex-wrap gap-2">
              {numericColumns.map((col) => (
                <button
                  key={col}
                  onClick={() => insertField(col)}
                  className="rounded-lg border px-2.5 py-1 text-xs mono"
                  style={{ background: T.s2, borderColor: T.border, color: T.dim }}
                >
                  [{col}]
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: T.accent, color: "#000" }}
        >
          <Plus size={14} />
          Add Calculated Field
        </button>

        {error && (
          <div
            className="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm"
            style={{
              background: "rgba(239,68,68,0.08)",
              borderColor: "rgba(239,68,68,0.25)",
              color: T.error,
            }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="mt-5">
        <div
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: T.muted }}
        >
          Defined ({calculatedFields.length})
        </div>

        {calculatedFields.length === 0 ? (
          <div
            className="rounded-xl border px-3 py-3 text-sm"
            style={{ background: T.s2, borderColor: T.border, color: T.dim }}
          >
            None yet. Example: <span className="mono">[Revenue] - [Cost]</span>
          </div>
        ) : (
          <div className="space-y-2">
            {calculatedFields.map((cf) => (
              <div
                key={cf.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                style={{ background: T.s2, borderColor: T.border }}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium" style={{ color: T.text }}>
                    {cf.name}
                  </div>
                  <div
                    className="truncate text-[11px] mono"
                    style={{ color: T.muted }}
                    title={cf.formula}
                  >
                    {cf.formula}
                  </div>
                </div>

                <button
                  onClick={() => removeCalculatedField(cf.id)}
                  className="rounded-lg border p-1.5"
                  style={{ background: T.surface, borderColor: T.border, color: T.dim }}
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
