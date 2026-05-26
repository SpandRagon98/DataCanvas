// Join engine for two row-based datasets.
// Supports inner, left, outer (full outer), and cross joins.
// Prefixes right-side conflicting columns with the right dataset name.

const normalizeKey = (v) => String(v ?? "");

function buildRenameMap(cols, leftColSet, rightName, skipKey) {
  const map = {};
  for (const c of cols) {
    if (c === skipKey) continue;
    if (leftColSet.has(c)) {
      let candidate = `${rightName}_${c}`;
      let i = 2;
      while (leftColSet.has(candidate) || Object.values(map).includes(candidate)) {
        candidate = `${rightName}_${c}_${i++}`;
      }
      map[c] = candidate;
    } else {
      map[c] = c;
    }
  }
  return map;
}

export function joinDatasets({
  leftRows,
  rightRows,
  leftKey,
  rightKey,
  leftName = "Left",
  rightName = "Right",
  how = "inner", // 'inner' | 'left' | 'outer' | 'cross'
}) {
  // ── Cross join (Cartesian product — no keys required) ──────────────────────
  if (how === "cross") {
    if (!leftRows?.length || !rightRows?.length) return { rows: [], columns: [] };

    const leftCols = Object.keys(leftRows[0]);
    const rightCols = Object.keys(rightRows[0]);
    const map = buildRenameMap(rightCols, new Set(leftCols), rightName, null);
    const mergedCols = [...leftCols, ...rightCols.map((c) => map[c])];

    const out = [];
    for (const l of leftRows) {
      for (const r of rightRows) {
        const merged = { ...l };
        for (const c of rightCols) merged[map[c]] = r[c];
        out.push(merged);
      }
    }
    return { rows: out, columns: mergedCols };
  }

  // ── Key-based joins ────────────────────────────────────────────────────────
  if (!leftRows?.length || !rightRows?.length) return { rows: [], columns: [] };
  if (!leftKey || !rightKey) return { rows: [], columns: [] };

  const leftCols = Object.keys(leftRows[0]);
  const rightCols = Object.keys(rightRows[0]);
  const leftColSet = new Set(leftCols);
  const map = buildRenameMap(rightCols, leftColSet, rightName, rightKey);

  const mergedCols = [
    ...leftCols,
    ...rightCols.filter((c) => c !== rightKey).map((c) => map[c]),
  ];

  // Build right-side index
  const rightIndex = new Map();
  for (const r of rightRows) {
    const k = normalizeKey(r[rightKey]);
    if (!rightIndex.has(k)) rightIndex.set(k, []);
    rightIndex.get(k).push(r);
  }

  const out = [];

  // Process all left rows
  for (const l of leftRows) {
    const k = normalizeKey(l[leftKey]);
    const matches = rightIndex.get(k);

    if (matches?.length) {
      for (const r of matches) {
        const merged = { ...l };
        for (const c of rightCols) {
          if (c !== rightKey) merged[map[c]] = r[c];
        }
        out.push(merged);
      }
    } else if (how === "left" || how === "outer") {
      const merged = { ...l };
      for (const c of rightCols) {
        if (c !== rightKey) merged[map[c]] = "";
      }
      out.push(merged);
    }
  }

  // For outer join: append unmatched right rows
  if (how === "outer") {
    const leftKeySet = new Set(leftRows.map((l) => normalizeKey(l[leftKey])));
    for (const r of rightRows) {
      if (!leftKeySet.has(normalizeKey(r[rightKey]))) {
        const merged = {};
        for (const c of leftCols) {
          merged[c] = c === leftKey ? r[rightKey] : "";
        }
        for (const c of rightCols) {
          if (c !== rightKey) merged[map[c]] = r[c];
        }
        out.push(merged);
      }
    }
  }

  return { rows: out, columns: mergedCols };
}
