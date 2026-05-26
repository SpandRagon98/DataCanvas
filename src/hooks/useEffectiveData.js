/**
 * useEffectiveData — returns the active dataset enriched with:
 *   1. Active scenario adjustments (optional)
 *   2. Calculated fields
 *
 * Phase 6.4 — Incremental Calculation:
 *   When a single cell is edited, only the calc fields for that specific row
 *   are re-evaluated rather than re-processing the entire dataset.
 *   This is O(calcFields) per edit instead of O(rows × calcFields).
 */

import { useRef, useMemo } from "react";
import { useStore }         from "../store/useStore";
import { evaluateFormula }  from "../utils/calcFields";
import { applyScenario }    from "../utils/scenarioEngine";

export function useEffectiveData({ applyScenario: includeScenario = true } = {}) {
  const rawData          = useStore((s) => s.rawData);
  const columns          = useStore((s) => s.columns);
  const dataTypes        = useStore((s) => s.dataTypes);
  const calculatedFields = useStore((s) => s.calculatedFields);
  const scenarios        = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  // lastEditRowIndex is set by updateCell; -1 means a bulk change occurred
  const lastEditRowIndex = useStore((s) => s.lastEditRowIndex);

  // ── Incremental calc cache ──────────────────────────────────────────────
  const cacheRef = useRef({
    prevBase:  null, // last rawData (post-scenario, pre-calc)
    prevCalc:  null, // last calculated rows output
    prevCFs:   null, // last calculatedFields ref (detect CF changes)
  });

  return useMemo(() => {
    const activeScenario = includeScenario
      ? scenarios.find((sc) => sc.id === activeScenarioId) || null
      : null;

    const base = activeScenario ? applyScenario(rawData, activeScenario) : rawData;

    // ── Column metadata (unchanged path) ──────────────────────────────────
    const existing = new Set(columns);
    const mergedColumns = [...columns];
    const mergedTypes   = { ...dataTypes };
    for (const cf of calculatedFields || []) {
      if (!existing.has(cf.name)) {
        mergedColumns.push(cf.name);
        existing.add(cf.name);
      }
      mergedTypes[cf.name] = cf.type || "number";
    }
    const calcFieldNames = new Set((calculatedFields || []).map((c) => c.name));

    // ── Short-circuit when no calc fields are configured ──────────────────
    if (!calculatedFields?.length) {
      cacheRef.current = { prevBase: base, prevCalc: base, prevCFs: calculatedFields };
      return { rows: base, columns: mergedColumns, dataTypes: mergedTypes, calcFieldNames, activeScenario };
    }

    const cache = cacheRef.current;

    // ── Incremental path: only one row changed (single cell edit) ─────────
    if (
      lastEditRowIndex >= 0 &&
      cache.prevBase   !== null &&
      cache.prevCalc   !== null &&
      cache.prevCFs    === calculatedFields && // calc fields definition unchanged
      base.length      === cache.prevBase.length
    ) {
      // Verify that ONLY the edited row actually changed
      let onlyEditedRowChanged = true;
      for (let i = 0; i < base.length; i++) {
        if (i === lastEditRowIndex) continue;
        if (base[i] !== cache.prevBase[i]) {
          onlyEditedRowChanged = false;
          break;
        }
      }

      if (onlyEditedRowChanged) {
        // Clone the cached output and only recompute the changed row
        const nextCalc = [...cache.prevCalc];
        const row      = base[lastEditRowIndex];
        const out      = { ...row };
        for (const cf of calculatedFields) {
          out[cf.name] = evaluateFormula(cf.formula, out);
        }
        nextCalc[lastEditRowIndex] = out;

        cacheRef.current = { prevBase: base, prevCalc: nextCalc, prevCFs: calculatedFields };
        return { rows: nextCalc, columns: mergedColumns, dataTypes: mergedTypes, calcFieldNames, activeScenario };
      }
    }

    // ── Full recompute path ────────────────────────────────────────────────
    const rows = base.map((row) => {
      const out = { ...row };
      for (const cf of calculatedFields) {
        out[cf.name] = evaluateFormula(cf.formula, out);
      }
      return out;
    });

    cacheRef.current = { prevBase: base, prevCalc: rows, prevCFs: calculatedFields };
    return { rows, columns: mergedColumns, dataTypes: mergedTypes, calcFieldNames, activeScenario };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, columns, dataTypes, calculatedFields, scenarios, activeScenarioId, includeScenario, lastEditRowIndex]);
}
