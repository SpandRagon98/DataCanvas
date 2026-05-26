import { useMemo, useState } from "react";
import { X, Plus, Trash2, Sparkles, Check } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

export default function ScenarioPanel({ open, onClose }) {
  const T = useTheme();
  const columns = useStore((s) => s.columns);
  const dataTypes = useStore((s) => s.dataTypes);
  const calculatedFields = useStore((s) => s.calculatedFields);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const addScenario = useStore((s) => s.addScenario);
  const removeScenario = useStore((s) => s.removeScenario);
  const renameScenario = useStore((s) => s.renameScenario);
  const setActiveScenario = useStore((s) => s.setActiveScenario);
  const addScenarioAdjustment = useStore((s) => s.addScenarioAdjustment);
  const updateScenarioAdjustment = useStore((s) => s.updateScenarioAdjustment);
  const removeScenarioAdjustment = useStore((s) => s.removeScenarioAdjustment);

  // Adjustable fields = numeric raw columns only (calc fields are derived;
  // applying scenarios to them would be overwritten on next evaluation).
  const calcNames = new Set(calculatedFields.map((c) => c.name));
  const adjustableFields = useMemo(
    () => columns.filter((c) => dataTypes[c] === "number" && !calcNames.has(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, dataTypes, calculatedFields]
  );

  const [selectedId, setSelectedId] = useState(
    activeScenarioId || scenarios[0]?.id || null
  );

  if (!open) return null;

  const selected = scenarios.find((s) => s.id === selectedId) || scenarios[0] || null;

  const handleCreate = () => {
    addScenario();
    setTimeout(() => {
      const s = useStore.getState().scenarios;
      setSelectedId(s[s.length - 1]?.id || null);
    }, 0);
  };

  const handleRemove = (id) => {
    removeScenario(id);
    if (selectedId === id) {
      const remaining = scenarios.filter((s) => s.id !== id);
      setSelectedId(remaining[0]?.id || null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.74)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in w-full max-w-4xl overflow-hidden rounded-[22px] border"
        style={{ background: T.surface, borderColor: T.border, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: T.border }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: T.accentDim }}
            >
              <Sparkles size={16} color={T.accent} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold leading-none" style={{ color: T.text }}>
                What-If Scenarios
              </h2>
              <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>
                Adjust numeric fields to model downstream impact on visuals
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border p-1.5"
            style={{ color: T.muted, background: T.s2, borderColor: T.border }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-[240px_1fr]">
          <div
            className="border-b p-4 md:border-b-0 md:border-r"
            style={{ borderColor: T.border, background: T.s2 }}
          >
            <button
              onClick={handleCreate}
              className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ background: T.accent, color: "#000" }}
            >
              <Plus size={14} />
              New Scenario
            </button>

            <button
              onClick={() => setActiveScenario(null)}
              className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm"
              style={{
                background: activeScenarioId === null ? T.accentDim : T.surface,
                borderColor: activeScenarioId === null ? T.accent : T.border,
                color: activeScenarioId === null ? T.accent : T.dim,
              }}
            >
              {activeScenarioId === null && <Check size={12} />}
              Baseline (off)
            </button>

            <div className="space-y-2">
              {scenarios.length === 0 ? (
                <div className="text-xs" style={{ color: T.dim }}>
                  No scenarios defined
                </div>
              ) : (
                scenarios.map((s) => {
                  const isSelected = selected?.id === s.id;
                  const isActive = activeScenarioId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm"
                      style={{
                        background: isSelected ? T.surface : "transparent",
                        borderColor: isSelected ? T.accent : T.border,
                        color: T.text,
                      }}
                    >
                      <span className="truncate">{s.name}</span>
                      {isActive && (
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                          style={{ background: T.accentDim, color: T.accent }}
                        >
                          Active
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-5">
            {!selected ? (
              <div
                className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm"
                style={{ borderColor: T.border, background: T.s2, color: T.dim }}
              >
                <Sparkles size={26} color={T.muted} />
                Create a scenario to start modeling "what if"
              </div>
            ) : (
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <input
                    value={selected.name}
                    onChange={(e) => renameScenario(selected.id, e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none sm:max-w-sm"
                    style={{ background: T.s2, borderColor: T.border, color: T.text }}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setActiveScenario(activeScenarioId === selected.id ? null : selected.id)
                      }
                      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
                      style={{
                        background: activeScenarioId === selected.id ? T.success : T.accent,
                        color: "#000",
                      }}
                    >
                      <Check size={14} />
                      {activeScenarioId === selected.id ? "Applied" : "Apply"}
                    </button>

                    <button
                      onClick={() => handleRemove(selected.id)}
                      className="rounded-xl border px-3 py-2 text-sm"
                      style={{ background: T.s2, borderColor: T.border, color: T.dim }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {adjustableFields.length === 0 ? (
                  <div
                    className="rounded-xl border px-3 py-4 text-sm"
                    style={{ background: T.s2, borderColor: T.border, color: T.dim }}
                  >
                    No numeric fields available to adjust. Import data with numeric columns first.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {selected.adjustments.length === 0 ? (
                        <div
                          className="rounded-xl border border-dashed px-3 py-4 text-center text-sm"
                          style={{ background: T.s2, borderColor: T.border, color: T.dim }}
                        >
                          No adjustments yet. Add one below.
                        </div>
                      ) : (
                        selected.adjustments.map((adj) => (
                          <div
                            key={adj.id}
                            className="grid grid-cols-1 items-center gap-2 rounded-xl border px-3 py-2 md:grid-cols-[2fr_1.4fr_1.2fr_auto]"
                            style={{ background: T.s2, borderColor: T.border }}
                          >
                            <select
                              value={adj.field}
                              onChange={(e) =>
                                updateScenarioAdjustment(selected.id, adj.id, {
                                  field: e.target.value,
                                })
                              }
                              className="rounded-lg border px-2 py-2 text-sm outline-none"
                              style={{ background: T.surface, borderColor: T.border, color: T.text }}
                            >
                              <option value="">Select field</option>
                              {adjustableFields.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>

                            <select
                              value={adj.operation}
                              onChange={(e) =>
                                updateScenarioAdjustment(selected.id, adj.id, {
                                  operation: e.target.value,
                                })
                              }
                              className="rounded-lg border px-2 py-2 text-sm outline-none"
                              style={{ background: T.surface, borderColor: T.border, color: T.text }}
                            >
                              <option value="multiply">Multiply by</option>
                              <option value="add">Add</option>
                              <option value="set">Set to</option>
                            </select>

                            <input
                              type="number"
                              value={adj.value}
                              onChange={(e) =>
                                updateScenarioAdjustment(selected.id, adj.id, {
                                  value: e.target.value,
                                })
                              }
                              className="rounded-lg border px-2 py-2 text-sm outline-none mono"
                              style={{ background: T.surface, borderColor: T.border, color: T.text }}
                              step="any"
                            />

                            <button
                              onClick={() => removeScenarioAdjustment(selected.id, adj.id)}
                              className="rounded-lg border px-2 py-2"
                              style={{ background: T.surface, borderColor: T.border, color: T.dim }}
                              title="Remove adjustment"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      onClick={() =>
                        addScenarioAdjustment(selected.id, {
                          field: adjustableFields[0],
                          operation: "multiply",
                          value: 1,
                        })
                      }
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                      style={{ background: T.s2, borderColor: T.border, color: T.text }}
                    >
                      <Plus size={14} />
                      Add Adjustment
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
