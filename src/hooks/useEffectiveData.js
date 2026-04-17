import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { evaluateFormula } from "../utils/calcFields";
import { applyScenario } from "../utils/scenarioEngine";

// Returns the dataset enriched with calculated fields (always) and
// (by default) with the active scenario's adjustments applied.
// Pass { applyScenario: false } when the caller is editing raw data
// (DataTable) or displaying raw values.
export function useEffectiveData({ applyScenario: includeScenario = true } = {}) {
  const rawData = useStore((s) => s.rawData);
  const columns = useStore((s) => s.columns);
  const dataTypes = useStore((s) => s.dataTypes);
  const calculatedFields = useStore((s) => s.calculatedFields);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);

  return useMemo(() => {
    const activeScenario = includeScenario
      ? scenarios.find((sc) => sc.id === activeScenarioId) || null
      : null;

    const base = activeScenario ? applyScenario(rawData, activeScenario) : rawData;

    const rows =
      calculatedFields?.length
        ? base.map((row) => {
            const out = { ...row };
            for (const cf of calculatedFields) {
              out[cf.name] = evaluateFormula(cf.formula, out);
            }
            return out;
          })
        : base;

    const existing = new Set(columns);
    const mergedColumns = [...columns];
    const mergedTypes = { ...dataTypes };

    for (const cf of calculatedFields || []) {
      if (!existing.has(cf.name)) {
        mergedColumns.push(cf.name);
        existing.add(cf.name);
      }
      mergedTypes[cf.name] = cf.type || "number";
    }

    const calcFieldNames = new Set((calculatedFields || []).map((c) => c.name));

    return {
      rows,
      columns: mergedColumns,
      dataTypes: mergedTypes,
      calcFieldNames,
      activeScenario,
    };
  }, [rawData, columns, dataTypes, calculatedFields, scenarios, activeScenarioId, includeScenario]);
}
