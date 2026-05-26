/**
 * SQL query builders for DuckDB.
 * These replace the JS loop aggregations in chartEngine.js for large datasets.
 *
 * All functions return plain JS arrays (same shape as chartEngine equivalents)
 * so the rest of the rendering pipeline is unchanged.
 */

import { queryRows, loadTable } from "../lib/duckdb";

// ── Aggregation function map ───────────────────────────────────────────────

const AGG_SQL = {
  sum:          (f) => `SUM(TRY_CAST("${f}" AS DOUBLE))`,
  avg:          (f) => `AVG(TRY_CAST("${f}" AS DOUBLE))`,
  count:        ()  => `COUNT(*)`,
  distinctCount:(f) => `COUNT(DISTINCT "${f}")`,
  min:          (f) => `MIN(TRY_CAST("${f}" AS DOUBLE))`,
  max:          (f) => `MAX(TRY_CAST("${f}" AS DOUBLE))`,
  median:       (f) => `MEDIAN(TRY_CAST("${f}" AS DOUBLE))`,
  stddev:       (f) => `STDDEV_POP(TRY_CAST("${f}" AS DOUBLE))`,
};

// ── Filter → WHERE clause ─────────────────────────────────────────────────

const RELATIVE_DATE_KEYS = new Set([
  "last7days","last30days","last90days","thismonth","lastmonth","thisyear",
]);

function relativeDateRange(key) {
  const now = new Date();
  const fmt  = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const today = fmt(now);

  switch (key) {
    case "last7days":  { const d = new Date(now); d.setDate(d.getDate()-7);  return [fmt(d), today]; }
    case "last30days": { const d = new Date(now); d.setDate(d.getDate()-30); return [fmt(d), today]; }
    case "last90days": { const d = new Date(now); d.setDate(d.getDate()-90); return [fmt(d), today]; }
    case "thismonth": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return [fmt(d), today];
    }
    case "lastmonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return [fmt(start), fmt(end)];
    }
    case "thisyear":   return [`${now.getFullYear()}-01-01`, today];
    default:           return [null, null];
  }
}

function escVal(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildWhereClause(filters) {
  if (!filters || !Object.keys(filters).length) return "";

  const conditions = [];

  for (const [field, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;

    const col = `"${field}"`;

    if (typeof value === "object" && !Array.isArray(value)) {
      // Date range { from?, to? }
      if (value.from) conditions.push(`${col} >= ${escVal(value.from)}`);
      if (value.to)   conditions.push(`${col} <= ${escVal(value.to + "T23:59:59")}`);
    } else if (typeof value === "string" && RELATIVE_DATE_KEYS.has(value)) {
      const [from, to] = relativeDateRange(value);
      if (from) conditions.push(`${col} >= ${escVal(from)}`);
      if (to)   conditions.push(`${col} <= ${escVal(to)}`);
    } else if (Array.isArray(value)) {
      conditions.push(`CAST(${col} AS VARCHAR) IN (${value.map(escVal).join(",")})`);
    } else {
      conditions.push(`CAST(${col} AS VARCHAR) = ${escVal(value)}`);
    }
  }

  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

// ── Main SQL aggregation ───────────────────────────────────────────────────

/**
 * SQL equivalent of buildVisualData() in chartEngine.js.
 *
 * @param {string} tableName - DuckDB table name (already loaded)
 * @param {object} opts
 * @returns {Promise<Array>} - Same shape as buildVisualData output
 */
export async function buildVisualDataSQL(tableName, opts) {
  const {
    xFields        = [],
    yFields        = [],
    legendField    = "",
    aggregation    = "sum",
    sortDirection  = "asc",
    globalFilters  = {},
    visualFilters  = {},
    crossFilter    = {},
  } = opts;

  if (!xFields.length || !yFields.length) return [];

  const aggFn = AGG_SQL[aggregation] || AGG_SQL.sum;
  const allFilters = { ...globalFilters, ...visualFilters, ...crossFilter };
  const where = buildWhereClause(allFilters);
  const orderDir = sortDirection === "desc" ? "DESC" : "ASC";

  // X expression: single field or composite (CONCAT)
  const xExpr =
    xFields.length === 1
      ? `COALESCE(CAST("${xFields[0]}" AS VARCHAR), '(Blank)')`
      : `CONCAT(${xFields
          .map((f) => `COALESCE(CAST("${f}" AS VARCHAR), '(Blank)')`)
          .join(`, ' / ', `)})`;

  try {
    if (legendField) {
      // ── With legend: GROUP BY x + legend, then pivot in JS ──
      const legendExpr = `COALESCE(CAST("${legendField}" AS VARCHAR), '(Blank)')`;

      const sql = `
        SELECT
          ${xExpr} AS __x,
          ${legendExpr} AS __legend,
          ${yFields.map((f) => `COALESCE(${aggFn(f)}, 0) AS ${JSON.stringify(f)}`).join(", ")}
        FROM "${tableName}"
        ${where}
        GROUP BY __x, __legend
        ORDER BY __x ${orderDir}
      `;

      const raw = await queryRows(sql);
      if (!raw) return [];

      // Pivot raw → { x, "legendVal | fieldName": value }
      const pivoted = {};
      for (const row of raw) {
        const x = row.__x ?? "(Blank)";
        if (!pivoted[x]) pivoted[x] = { x };
        for (const f of yFields) {
          pivoted[x][`${row.__legend} | ${f}`] = Number(row[f] ?? 0);
        }
      }
      return Object.values(pivoted);
    } else {
      // ── Simple GROUP BY x ──
      const sql = `
        SELECT
          ${xExpr} AS x,
          ${yFields.map((f) => `COALESCE(${aggFn(f)}, 0) AS ${JSON.stringify(f)}`).join(", ")}
        FROM "${tableName}"
        ${where}
        GROUP BY x
        ORDER BY x ${orderDir}
      `;

      const raw = await queryRows(sql);
      if (!raw) return [];

      return raw.map((row) => {
        const out = { x: row.x ?? "(Blank)" };
        for (const f of yFields) out[f] = Number(row[f] ?? 0);
        return out;
      });
    }
  } catch (e) {
    console.warn("[sqlEngine] buildVisualDataSQL error:", e.message);
    return [];
  }
}

/**
 * SQL-based filter: returns the filtered rows from a DuckDB table.
 * Used when rawData is too large for JS filter.
 *
 * NOTE: This returns rows from DuckDB, not the original JS objects.
 * For large datasets the caller should use the DuckDB data throughout.
 *
 * @param {string} tableName
 * @param {object} filters
 * @returns {Promise<Array | null>} - Filtered rows, or null on failure
 */
export async function applyFiltersSQL(tableName, filters) {
  const where = buildWhereClause(filters);
  return queryRows(`SELECT * FROM "${tableName}" ${where}`);
}

/**
 * SQL equivalent of evaluateFormula: evaluates a calc field expression for
 * all rows in a table via DuckDB SQL.
 *
 * formulaSQL must be valid DuckDB SQL that references columns by quoted name.
 * Example: '"[Revenue]" - "[Cost]"' → '("Revenue" - "Cost")'
 *
 * For simplicity we accept a pre-transformed SQL expression, falling back to
 * the JS evaluator if the expression is not SQL-safe.
 *
 * @param {string} tableName
 * @param {string} cfName    - Output column name
 * @param {string} formulaSQL - DuckDB-compatible SQL expression
 * @returns {Promise<Array | null>} - All rows with the new column appended
 */
export async function addCalcFieldSQL(tableName, cfName, formulaSQL) {
  try {
    const escapedName = JSON.stringify(cfName);
    const sql = `
      SELECT *, (${formulaSQL}) AS ${escapedName}
      FROM "${tableName}"
    `;
    return queryRows(sql);
  } catch (e) {
    console.warn("[sqlEngine] addCalcFieldSQL error:", e.message);
    return null;
  }
}

/**
 * Convert a [Field] formula to a DuckDB SQL expression.
 * Returns null if the formula contains unsafe tokens.
 */
export function formulaToSQL(formula) {
  if (/\b(?:window|document|globalThis|Function|eval|process|require|import|fetch)\b/i.test(formula)) {
    return null;
  }
  // Replace [Field Name] → "Field Name"
  let expr = String(formula || "").trim();
  expr = expr.replace(/\[([^\]]+)\]/g, (_, name) => `"${name}"`);
  return expr || null;
}
