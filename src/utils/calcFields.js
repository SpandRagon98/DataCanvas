// Safe-ish formula evaluator for row-level calculated fields.
// Supports bracketed field references: [Field Name] and simple arithmetic.
// Returns 0 on any error or non-finite result.

const numericCoerce = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

const compileCache = new Map();

function compile(formula) {
  if (compileCache.has(formula)) return compileCache.get(formula);

  // Replace [Identifier] with __n(ctx["Identifier"])
  let expr = String(formula || "").trim();
  if (!expr) return null;

  expr = expr.replace(/\[([^\]]+)\]/g, (_, name) => {
    return `__n(ctx[${JSON.stringify(name)}])`;
  });

  // Basic guardrails: reject obvious dangerous tokens
  if (/\b(?:window|document|globalThis|Function|eval|process|require|import|fetch)\b/i.test(expr)) {
    compileCache.set(formula, null);
    return null;
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("ctx", "__n", `"use strict"; return (${expr});`);
    compileCache.set(formula, fn);
    return fn;
  } catch {
    compileCache.set(formula, null);
    return null;
  }
}

export function evaluateFormula(formula, row) {
  const fn = compile(formula);
  if (!fn) return 0;
  try {
    const result = fn(row, numericCoerce);
    if (typeof result === "number" && isFinite(result)) return result;
    if (typeof result === "boolean") return result ? 1 : 0;
    return 0;
  } catch {
    return 0;
  }
}

export function validateFormula(formula) {
  const expr = String(formula || "").trim();
  if (!expr) return { valid: false, message: "Formula is empty." };
  const fn = compile(formula);
  if (!fn) return { valid: false, message: "Formula is invalid or uses restricted tokens." };
  try {
    const test = fn({}, numericCoerce);
    if (typeof test !== "number" && typeof test !== "boolean") {
      return { valid: false, message: "Formula must return a number." };
    }
  } catch {
    return { valid: false, message: "Formula failed to evaluate." };
  }
  return { valid: true, message: "" };
}

export function extractReferencedFields(formula) {
  const out = new Set();
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(String(formula || ""))) !== null) {
    out.add(m[1]);
  }
  return [...out];
}
