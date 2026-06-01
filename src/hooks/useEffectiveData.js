/**
 * useEffectiveData — returns the active dataset enriched with:
 *   1. Active scenario adjustments (optional)
 *   2. Calendar dimension columns (joined via relationships)
 *   3. Calculated fields
 *
 * Calendar join:
 *   For every active relationship  fromDataset=activeDataset → toDataset=Calendar,
 *   each fact-table row is looked up against the Calendar by date (YYYY-MM-DD).
 *   Calendar columns (except "Date") are merged into each row so that they
 *   appear in the FieldPane and are usable as X-axis dimensions in visuals.
 *   Hidden sort-key columns (_sort_Month Year, _sort_Month Name, _sort_Day Name)
 *   are also added so that chartEngine can sort chronologically.
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
import { CALENDAR_DATASET_ID } from "../utils/calendarTable";

export function useEffectiveData({ applyScenario: includeScenario = true, joinCalendar = true } = {}) {
  const rawData          = useStore((s) => s.rawData);
  const columns          = useStore((s) => s.columns);
  const dataTypes        = useStore((s) => s.dataTypes);
  const calculatedFields = useStore((s) => s.calculatedFields);
  const scenarios        = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const lastEditRowIndex = useStore((s) => s.lastEditRowIndex);

  // For Calendar join
  const datasets        = useStore((s) => s.datasets);
  const relationships   = useStore((s) => s.relationships);
  const activeDatasetId = useStore((s) => s.activeDatasetId);

  // ── Incremental calc cache ──────────────────────────────────────────────
  const cacheRef = useRef({
    prevBase:  null,
    prevCalc:  null,
    prevCFs:   null,
  });

  return useMemo(() => {
    const activeScenario = includeScenario
      ? scenarios.find((sc) => sc.id === activeScenarioId) || null
      : null;

    let base = activeScenario ? applyScenario(rawData, activeScenario) : rawData;

    // ── Column metadata ────────────────────────────────────────────────────
    const existing      = new Set(columns);
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

    // ── Calendar join ──────────────────────────────────────────────────────
    // Find all active relationships: activeDataset → Calendar
    // Skipped entirely when joinCalendar is false (e.g. raw Data Table view).
    const calendarDs = joinCalendar
      ? datasets.find((d) => d.id === CALENDAR_DATASET_ID && d.isSystemTable)
      : null;

    if (calendarDs && calendarDs.rows.length > 0) {
      const calRels = (relationships || []).filter(
        (r) =>
          r.fromDataset === activeDatasetId &&
          r.toDataset   === CALENDAR_DATASET_ID &&
          r.active      !== false
      );

      if (calRels.length > 0) {
        // Build an O(1) lookup: "YYYY-MM-DD" → calendar row
        const calLookup = new Map();
        for (const row of calendarDs.rows) {
          const key = String(row["Date"]).slice(0, 10);
          if (!calLookup.has(key)) calLookup.set(key, row);
        }

        // Calendar columns to merge (skip "Date" itself to avoid collision)
        const calCols = calendarDs.columns.filter((c) => c !== "Date");

        // Add Calendar column metadata (skip if name already taken by fact table)
        for (const col of calCols) {
          if (!existing.has(col)) {
            mergedColumns.push(col);
            existing.add(col);
            mergedTypes[col] = calendarDs.dataTypes?.[col] ?? "string";
          }
        }

        // Enrich each fact-table row with Calendar columns + hidden sort keys
        base = base.map((row) => {
          // Each relationship specifies which fact column maps to Calendar[Date]
          // Use the first matching relationship (typically only one)
          const rel = calRels[0];
          const rawDate = row[rel.fromColumn];
          if (!rawDate) return row;

          const dateKey  = String(rawDate).slice(0, 10);
          const calRow   = calLookup.get(dateKey);
          if (!calRow) return row;

          const enriched = { ...row };
          for (const col of calCols) {
            if (!(col in row)) {          // don't override existing fact columns
              enriched[col] = calRow[col];
            }
          }

          // Hidden sort-key columns (prefixed with "_sort_") for chronological ordering
          // Used by chartEngine.buildVisualData to sort string-based Calendar fields
          enriched["_sort_Month Year"]  = calRow["Month Year Sort"];
          enriched["_sort_Month Name"]  = calRow["Month Number"];
          enriched["_sort_Quarter Name"] = calRow["Quarter"];
          enriched["_sort_Day Name"]    = calRow["Day of Week"];
          enriched["_sort_Day Short"]   = calRow["Day of Week"];
          enriched["_sort_Year Quarter"] = (calRow["Year"] ?? 0) * 10 + (calRow["Quarter"] ?? 0);

          return enriched;
        });
      }
    }

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
      cache.prevCFs    === calculatedFields &&
      base.length      === cache.prevBase.length
    ) {
      let onlyEditedRowChanged = true;
      for (let i = 0; i < base.length; i++) {
        if (i === lastEditRowIndex) continue;
        if (base[i] !== cache.prevBase[i]) {
          onlyEditedRowChanged = false;
          break;
        }
      }

      if (onlyEditedRowChanged) {
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
  }, [
    rawData, columns, dataTypes, calculatedFields,
    scenarios, activeScenarioId, includeScenario, lastEditRowIndex,
    datasets, relationships, activeDatasetId, joinCalendar,
  ]);
}
