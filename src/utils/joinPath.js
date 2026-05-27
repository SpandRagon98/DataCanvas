/**
 * joinPath.js — Data-modelling query helpers
 *
 * Given a list of active relationships, find the shortest join chain between
 * two datasets (BFS) and generate a DuckDB-compatible SQL fragment.
 */

// ── Path finding ──────────────────────────────────────────────────────────────

/**
 * Find the shortest relationship chain from `fromId` to `toId`.
 *
 * @param {Array}  relationships  - Full array of relationship objects from the store
 * @param {string} fromId         - Source dataset id
 * @param {string} toId           - Target dataset id
 * @returns {Array|null} Array of relationship steps (in traversal order), or null if unreachable
 *
 * Each step is the relationship object augmented with `traversedReversed: boolean`
 * (true when the link was traversed to→from instead of from→to).
 */
export function findJoinPath(relationships, fromId, toId) {
  if (fromId === toId) return [];

  const active = relationships.filter((r) => r.active !== false);

  // Build adjacency list — bidirectional relationships add edges in both directions
  const graph = {};
  const ensure = (id) => { if (!graph[id]) graph[id] = []; };

  for (const rel of active) {
    ensure(rel.fromDataset);
    ensure(rel.toDataset);
    graph[rel.fromDataset].push({ neighbor: rel.toDataset, rel, reversed: false });
    if (rel.direction === "bidirectional") {
      graph[rel.toDataset].push({ neighbor: rel.fromDataset, rel, reversed: true });
    }
  }

  // BFS
  const queue = [{ id: fromId, path: [] }];
  const visited = new Set([fromId]);

  while (queue.length > 0) {
    const { id: current, path } = queue.shift();
    for (const { neighbor, rel, reversed } of (graph[current] || [])) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      const step = { ...rel, traversedReversed: reversed };
      const newPath = [...path, step];
      if (neighbor === toId) return newPath;
      queue.push({ id: neighbor, path: newPath });
    }
  }

  return null; // No path
}

// ── SQL generation ────────────────────────────────────────────────────────────

const safeName = (name) => `"${String(name).replace(/"/g, '""')}"`;

/**
 * Given a set of required dataset ids, produce a DuckDB SQL string that
 * JOINs all of them using the shortest paths from the relationship graph.
 *
 * @param {Array}  datasets           - Array of { id, name } objects from the store
 * @param {Array}  relationships      - Full array of relationship objects from the store
 * @param {Array}  requiredDatasetIds - Ordered list of dataset ids needed for the query
 * @param {Array}  [selectFields]     - Optional list of "table.column" or raw column strings
 * @returns {string|null} A SELECT ... FROM ... JOIN ... SQL string, or null on failure
 */
export function generateCrossTableSQL(datasets, relationships, requiredDatasetIds, selectFields) {
  if (!requiredDatasetIds?.length) return null;

  const getDs = (id) => datasets.find((d) => d.id === id);

  // Single-table shortcut
  if (requiredDatasetIds.length === 1) {
    const ds = getDs(requiredDatasetIds[0]);
    if (!ds) return null;
    const cols = selectFields?.length ? selectFields.join(", ") : "*";
    return `SELECT ${cols} FROM ${safeName(ds.name)}`;
  }

  const baseId = requiredDatasetIds[0];
  const baseDs = getDs(baseId);
  if (!baseDs) return null;

  const joinClauses = [];
  const joined = new Set([baseId]);

  for (const targetId of requiredDatasetIds.slice(1)) {
    if (joined.has(targetId)) continue;

    const path = findJoinPath(relationships, baseId, targetId);
    if (!path) {
      console.warn(`[joinPath] No relationship path from ${baseId} to ${targetId}`);
      continue;
    }

    for (const step of path) {
      const fromId = step.traversedReversed ? step.toDataset : step.fromDataset;
      const toId   = step.traversedReversed ? step.fromDataset : step.toDataset;
      const fromCol = step.traversedReversed ? step.toColumn : step.fromColumn;
      const toCol   = step.traversedReversed ? step.fromColumn : step.toColumn;

      if (joined.has(toId)) continue;

      const fromDs = getDs(fromId);
      const toDs   = getDs(toId);
      if (!fromDs || !toDs) continue;

      joinClauses.push(
        `JOIN ${safeName(toDs.name)} ON ${safeName(fromDs.name)}.${safeName(fromCol)} = ${safeName(toDs.name)}.${safeName(toCol)}`
      );
      joined.add(toId);
    }
  }

  const cols = selectFields?.length ? selectFields.join(", ") : "*";
  const joins = joinClauses.length ? " " + joinClauses.join(" ") : "";

  return `SELECT ${cols} FROM ${safeName(baseDs.name)}${joins}`;
}

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Check whether adding a new relationship would create a cycle in the graph
 * (only relevant for single-directional relationships; bidirectional always risk cycles).
 */
export function wouldCreateCycle(relationships, newFromId, newToId) {
  // If we can already reach newFromId from newToId, adding newFromId→newToId would cycle
  const path = findJoinPath(
    [...relationships, {
      id: "__test__",
      fromDataset: newToId,
      toDataset: newFromId,
      direction: "single",
      active: true,
    }],
    newToId,
    newFromId
  );
  return path !== null && path.length > 0;
}

/**
 * Return all dataset ids reachable from `startId` via active relationships.
 */
export function reachableDatasets(relationships, startId) {
  const active = relationships.filter((r) => r.active !== false);
  const visited = new Set();
  const queue = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const rel of active) {
      const neighbors = [];
      if (rel.fromDataset === current) neighbors.push(rel.toDataset);
      if (rel.toDataset === current && rel.direction === "bidirectional") neighbors.push(rel.fromDataset);
      for (const n of neighbors) {
        if (!visited.has(n)) { visited.add(n); queue.push(n); }
      }
    }
  }

  visited.delete(startId);
  return [...visited];
}
