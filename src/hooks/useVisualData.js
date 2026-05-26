/**
 * useVisualData — unified data preparation hook for VisualRenderer.
 *
 * Routing logic:
 *  • < DUCKDB_THRESHOLD rows  → synchronous JS engine (zero latency)
 *  • ≥ DUCKDB_THRESHOLD rows  → async DuckDB SQL engine (non-blocking, fast)
 *
 * Falls back to JS engine transparently if DuckDB is unavailable (offline, etc).
 *
 * Returns:
 *   { baseChartData, filteredRows, legendKeys, loading }
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { DUCKDB_THRESHOLD, getDuckDB, loadTable, hashRows } from "../lib/duckdb";
import { buildVisualDataSQL } from "../utils/sqlEngine";
import {
  buildVisualData,
  getLegendKeys,
} from "../utils/chartEngine";
import { applyGlobalFilters } from "../utils/filterEngine";

// Shared table name — all visuals share one table (the active dataset)
const TABLE = "dc_active";
// Track what data is currently loaded
let _loadedHash = null;
let _loadPromise = null;

function applyCross(rows, crossFilter) {
  if (!crossFilter || !Object.keys(crossFilter).length) return rows;
  return rows.filter((row) =>
    Object.entries(crossFilter).every(
      ([f, v]) => String(row[f] ?? "") === String(v)
    )
  );
}

export function useVisualData({ visual, rawData, filters, crossFilter = {} }) {
  const [sqlData,  setSqlData]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const abortRef  = useRef(0);
  const isLarge   = rawData?.length >= DUCKDB_THRESHOLD;

  // ── Always compute synchronous JS data (instant fallback / small data) ──
  const { filteredRows, baseChartDataJS } = useMemo(() => {
    const gf  = applyGlobalFilters(rawData, filters);
    const vf  = applyGlobalFilters(gf, visual.filters || {});
    const cf  = applyCross(vf, crossFilter);
    const base = buildVisualData({
      rows: cf,
      xFields: visual.xFields,
      yFields: visual.yFields,
      legendField: visual.legendField,
      aggregation: visual.aggregation,
      sortDirection: visual.sortDirection,
    });
    return { filteredRows: cf, baseChartDataJS: base };
  }, [rawData, filters, visual, crossFilter]);

  // ── Async DuckDB path for large datasets ──
  useEffect(() => {
    if (!isLarge || !visual.xFields?.length || !visual.yFields?.length) {
      setSqlData(null);
      return;
    }

    const reqId = ++abortRef.current;
    setLoading(true);

    (async () => {
      const ddb = await getDuckDB();
      if (!ddb || reqId !== abortRef.current) {
        setLoading(false);
        return;
      }

      // Load data if it changed
      const h = hashRows(rawData);
      if (_loadedHash !== h) {
        if (_loadPromise) await _loadPromise;
        _loadPromise = loadTable(TABLE, rawData);
        const ok = await _loadPromise;
        _loadPromise = null;
        if (!ok || reqId !== abortRef.current) {
          setLoading(false);
          return;
        }
        _loadedHash = h;
      }

      // Run the SQL aggregation
      const data = await buildVisualDataSQL(TABLE, {
        xFields:       visual.xFields,
        yFields:       visual.yFields,
        legendField:   visual.legendField,
        aggregation:   visual.aggregation,
        sortDirection: visual.sortDirection,
        globalFilters: filters,
        visualFilters: visual.filters || {},
        crossFilter,
      });

      if (reqId === abortRef.current) {
        setSqlData(data ?? null);
        setLoading(false);
      }
    })();

    return () => {
      abortRef.current = reqId + 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rawData,
    filters,
    crossFilter,
    isLarge,
    visual.xFields?.join(),
    visual.yFields?.join(),
    visual.legendField,
    visual.aggregation,
    visual.sortDirection,
    JSON.stringify(visual.filters),
  ]);

  const baseChartData = isLarge && sqlData !== null ? sqlData : baseChartDataJS;
  const legendKeys    = getLegendKeys(baseChartData);

  return { baseChartData, filteredRows, legendKeys, loading: isLarge && loading };
}
