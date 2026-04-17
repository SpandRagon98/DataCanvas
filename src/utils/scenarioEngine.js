// Applies scenario adjustments to numeric fields of every row.
// Each adjustment: { id, field, operation: 'multiply'|'add'|'set', value: number }

export function applyScenario(rows, scenario) {
  if (!scenario || !scenario.adjustments?.length || !rows?.length) return rows;

  const adjustments = scenario.adjustments.filter(
    (a) => a && a.field && a.operation && a.value !== "" && a.value !== null && a.value !== undefined
  );
  if (!adjustments.length) return rows;

  return rows.map((row) => {
    const out = { ...row };
    for (const adj of adjustments) {
      const value = Number(adj.value);
      if (!isFinite(value)) continue;

      const current = Number(out[adj.field]);
      const base = isFinite(current) ? current : 0;

      if (adj.operation === "multiply") out[adj.field] = base * value;
      else if (adj.operation === "add") out[adj.field] = base + value;
      else if (adj.operation === "set") out[adj.field] = value;
    }
    return out;
  });
}

export function createEmptyScenario(name) {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `scenario_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name || "New Scenario",
    adjustments: [],
  };
}
