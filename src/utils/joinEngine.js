// Minimal join engine for two row-based datasets.
// Supports inner and left joins on a single key pair.
// Prefixes right-side conflicting columns with the right dataset name.

const normalizeKey = (v) => {
  if (v === null || v === undefined) return "";
  return String(v);
};

export function joinDatasets({
  leftRows,
  rightRows,
  leftKey,
  rightKey,
  leftName = "Left",
  rightName = "Right",
  how = "inner", // 'inner' | 'left'
}) {
  if (!leftRows?.length || !rightRows?.length) return { rows: [], columns: [] };
  if (!leftKey || !rightKey) return { rows: [], columns: [] };

  const rightIndex = new Map();
  for (const r of rightRows) {
    const k = normalizeKey(r[rightKey]);
    if (!rightIndex.has(k)) rightIndex.set(k, []);
    rightIndex.get(k).push(r);
  }

  const leftCols = Object.keys(leftRows[0] || {});
  const rightCols = Object.keys(rightRows[0] || {});

  // Rename right-side columns that collide with left-side ones (except the join key).
  const leftColSet = new Set(leftCols);
  const rightRenameMap = {};
  for (const c of rightCols) {
    if (c === rightKey) continue;
    if (leftColSet.has(c)) {
      let candidate = `${rightName}_${c}`;
      let i = 2;
      while (leftColSet.has(candidate) || Object.values(rightRenameMap).includes(candidate)) {
        candidate = `${rightName}_${c}_${i++}`;
      }
      rightRenameMap[c] = candidate;
    } else {
      rightRenameMap[c] = c;
    }
  }

  const mergedCols = [...leftCols];
  for (const c of rightCols) {
    if (c === rightKey) continue;
    mergedCols.push(rightRenameMap[c]);
  }

  const out = [];
  for (const l of leftRows) {
    const k = normalizeKey(l[leftKey]);
    const matches = rightIndex.get(k);

    if (matches && matches.length) {
      for (const r of matches) {
        const merged = { ...l };
        for (const c of rightCols) {
          if (c === rightKey) continue;
          merged[rightRenameMap[c]] = r[c];
        }
        out.push(merged);
      }
    } else if (how === "left") {
      const merged = { ...l };
      for (const c of rightCols) {
        if (c === rightKey) continue;
        merged[rightRenameMap[c]] = "";
      }
      out.push(merged);
    }
  }

  return { rows: out, columns: mergedCols };
}
