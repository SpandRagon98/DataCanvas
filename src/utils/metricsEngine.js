/**
 * metricsEngine.js — Pigment-style multidimensional metric engine.
 *
 * A "metric" is a cube of values over an ordered set of dimensions.
 *   - Input metrics:      values entered by the user, stored per cell.
 *   - Calculated metrics: values derived from a formula that references other
 *                         metrics by [Name]; evaluated cell-by-cell.
 *
 * Cell key: members of the metric's dimensions joined in dimension order with
 * the SEP character. Example dims ["Month Year","Product"] → "Jan 2026§Laptop".
 *
 * The engine performs dependency resolution (topological order), cell-wise
 * formula evaluation, and circular-reference detection.
 */

export const SEP = "§";

// ── Member enumeration ────────────────────────────────────────────────────────

/** Unique, sorted, non-empty member values for a column from rows. */
export function getMembers(rows, column, cap = 500) {
  const set = new Set();
  for (const r of rows || []) {
    const v = r[column];
    if (v !== null && v !== undefined && v !== "") set.add(String(v));
    if (set.size >= cap) break;
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Build the ordered cell tuples for a metric's dimensions.
 * dimensions: [colName...] in order (col dim first, then row dims).
 * membersByDim: { [dim]: [member...] }
 * Returns array of { key, members: {dim: member} }.
 */
export function buildCells(dimensions, membersByDim) {
  if (!dimensions?.length) return [];
  let tuples = [{}];
  for (const dim of dimensions) {
    const members = membersByDim[dim] || [];
    const next = [];
    for (const t of tuples) {
      for (const m of members) next.push({ ...t, [dim]: m });
    }
    tuples = next;
    if (tuples.length > 20000) break; // safety cap
  }
  return tuples.map((members) => ({
    key: dimensions.map((d) => members[d]).join(SEP),
    members,
  }));
}

// ── Grid shape for the editable table ─────────────────────────────────────────

/**
 * Produce a 2D grid description for rendering/editing:
 *   columnDim   = dimensions[0]
 *   rowDims     = dimensions.slice(1)
 *   columns     = members of columnDim
 *   rows        = cartesian product of rowDims (each: {members, label, key-part})
 *   cellKey(rowMembers, colMember) → full key
 */
export function buildGrid(dimensions, membersByDim) {
  if (!dimensions?.length) {
    return { columnDim: null, rowDims: [], columns: [], rows: [], cellKey: () => "" };
  }
  const columnDim = dimensions[0];
  const rowDims   = dimensions.slice(1);
  const columns   = membersByDim[columnDim] || [];

  // Row tuples = cartesian product of rowDims
  let rowTuples = [{}];
  for (const dim of rowDims) {
    const members = membersByDim[dim] || [];
    const next = [];
    for (const t of rowTuples) for (const m of members) next.push({ ...t, [dim]: m });
    rowTuples = next;
  }
  if (rowDims.length === 0) rowTuples = [{}]; // single implicit row

  const rows = rowTuples.map((members) => ({
    members,
    label: rowDims.map((d) => members[d]).join(" / ") || "Value",
  }));

  const cellKey = (rowMembers, colMember) => {
    const full = { ...rowMembers, [columnDim]: colMember };
    return dimensions.map((d) => full[d]).join(SEP);
  };

  return { columnDim, rowDims, columns, rows, cellKey };
}

// ── Formula parsing ────────────────────────────────────────────────────────────

/** Extract [Metric Name] references from a formula string. */
export function parseMetricRefs(formula) {
  if (!formula) return [];
  const refs = [];
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(formula)) !== null) refs.push(m[1].trim());
  return [...new Set(refs)];
}

/**
 * Validate a calculated metric formula against the set of known metric names.
 * Returns { valid, error }.
 */
export function validateMetricFormula(formula, knownNames, selfName) {
  if (!formula || !formula.trim()) return { valid: false, error: "Formula is empty." };
  const refs = parseMetricRefs(formula);
  for (const r of refs) {
    if (r === selfName) return { valid: false, error: "A metric cannot reference itself." };
    if (!knownNames.includes(r)) return { valid: false, error: `Unknown metric: [${r}]` };
  }
  // Replace refs with 1 and check the arithmetic shell is safe
  const shell = formula.replace(/\[([^\]]+)\]/g, "1");
  if (/[^0-9+\-*/().%\s]/.test(shell)) {
    return { valid: false, error: "Only + - * / % ( ) and metric references are allowed." };
  }
  try {
    // eslint-disable-next-line no-new-func
    new Function(`return (${shell.replace(/%/g, "/100")})`)();
  } catch {
    return { valid: false, error: "Invalid formula syntax." };
  }
  return { valid: true, error: null };
}

// ── Dependency graph + cycle detection ────────────────────────────────────────

/**
 * Build name→id and id→[depId] maps, then detect cycles.
 * Returns { order: [id...], cycle: [name...]|null }.
 */
export function resolveDependencies(metrics) {
  const byName = {};
  metrics.forEach((m) => { byName[m.name] = m.id; });

  const deps = {}; // id → Set(depId)
  metrics.forEach((m) => {
    deps[m.id] = new Set();
    if (m.isCalculated && m.formula) {
      parseMetricRefs(m.formula).forEach((name) => {
        const depId = byName[name];
        if (depId && depId !== m.id) deps[m.id].add(depId);
      });
    }
  });

  // Kahn's topological sort; if leftover nodes → cycle
  const indeg = {};
  metrics.forEach((m) => { indeg[m.id] = 0; });
  Object.entries(deps).forEach(([, set]) => {
    // edge dep → m means m depends on dep; we want deps computed first
  });
  // Build reverse adjacency: depId → [dependents]
  const dependents = {};
  metrics.forEach((m) => { dependents[m.id] = []; });
  Object.entries(deps).forEach(([id, set]) => {
    set.forEach((depId) => { dependents[depId].push(id); indeg[id]++; });
  });

  const queue = metrics.filter((m) => indeg[m.id] === 0).map((m) => m.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (dependents[id] || []).forEach((dep) => {
      indeg[dep]--;
      if (indeg[dep] === 0) queue.push(dep);
    });
  }

  if (order.length < metrics.length) {
    const inCycle = metrics.filter((m) => !order.includes(m.id)).map((m) => m.name);
    return { order, cycle: inCycle };
  }
  return { order, cycle: null };
}

// ── Cell lookup with aggregation across un-constrained dimensions ─────────────

/**
 * Value of `metric` at the cell described by memberMap ({dim: member}).
 * Sums all of the metric's stored cells that match on the dimensions both
 * share; dimensions present in the metric but not in memberMap are aggregated.
 */
function metricValueAt(metric, valuesById, memberMap) {
  const vals = valuesById[metric.id] || {};
  let sum = 0;
  let matched = false;
  for (const [key, v] of Object.entries(vals)) {
    const parts = key.split(SEP); // in metric.dimensions order
    let ok = true;
    for (let i = 0; i < metric.dimensions.length; i++) {
      const dim = metric.dimensions[i];
      if (memberMap[dim] !== undefined && memberMap[dim] !== parts[i]) { ok = false; break; }
    }
    if (ok) { sum += Number(v) || 0; matched = true; }
  }
  return matched ? sum : 0;
}

/** Evaluate a calculated metric's formula at one cell. */
function evalCell(formula, metricsByName, valuesById, memberMap) {
  const substituted = formula.replace(/\[([^\]]+)\]/g, (_, name) => {
    const ref = metricsByName[name.trim()];
    if (!ref) return "0";
    const v = metricValueAt(ref, valuesById, memberMap);
    return `(${Number(v) || 0})`;
  });
  const safe = substituted.replace(/%/g, "/100");
  if (/[^0-9+\-*/().\s]/.test(safe)) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const out = new Function(`return (${safe})`)();
    return Number.isFinite(out) ? out : 0;
  } catch {
    return 0;
  }
}

// ── Full compute ───────────────────────────────────────────────────────────────

/**
 * Compute final values for every metric.
 * @param metrics      full metric list (each has dimensions, membersByDim, values, formula, isCalculated)
 * @returns { valuesById: { [id]: {cellKey: number} }, cycle: [names]|null }
 */
export function computeAllMetrics(metrics) {
  const { order, cycle } = resolveDependencies(metrics);
  const metricsByName = {};
  metrics.forEach((m) => { metricsByName[m.name] = m; });
  const byId = {};
  metrics.forEach((m) => { byId[m.id] = m; });

  const valuesById = {};

  // Seed input metrics with their stored values
  metrics.forEach((m) => {
    if (!m.isCalculated) valuesById[m.id] = { ...(m.values || {}) };
  });

  // If there is a cycle, calculated metrics in the cycle resolve to {} (engine
  // reports the cycle so the UI can block the save).
  const computeOrder = cycle ? order : order;

  for (const id of computeOrder) {
    const m = byId[id];
    if (!m || !m.isCalculated) continue;
    const cells = buildCells(m.dimensions, m.membersByDim || {});
    const out = {};
    for (const { key, members } of cells) {
      out[key] = evalCell(m.formula || "0", metricsByName, valuesById, members);
    }
    valuesById[id] = out;
  }

  // Any calculated metric not computed (in cycle) gets empty values
  metrics.forEach((m) => { if (!valuesById[m.id]) valuesById[m.id] = {}; });

  return { valuesById, cycle };
}

/** Total of a metric's values (for KPI/summary display). */
export function metricTotal(values) {
  return Object.values(values || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

/**
 * Build chart-ready data for a metric: one point per column-dim member,
 * summing across all rows. [{ x: colMember, value: number }]
 */
export function metricChartData(metric, values) {
  const dims = metric.dimensions || [];
  if (!dims.length) return [];
  const colDim = dims[0];
  const byCol = {};
  for (const [key, v] of Object.entries(values || {})) {
    const parts = key.split(SEP);
    const colMember = parts[0]; // colDim is dimensions[0]
    byCol[colMember] = (byCol[colMember] || 0) + (Number(v) || 0);
  }
  void colDim;
  return Object.entries(byCol).map(([x, value]) => ({ x, value }));
}
