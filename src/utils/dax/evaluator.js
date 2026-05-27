/**
 * evaluator.js — JS evaluator for DAX ASTs.
 *
 * The entry point is `evaluate(ast, ctx)`. The evaluator walks the AST
 * recursively, dispatching to FUNCTIONS for function calls and applying
 * binary/unary operators directly.
 *
 * Filter / row context:
 *   - At the top level there is no row context — only aggregators and
 *     iterators (SUM, AVG, SUMX, ...) can produce a scalar.
 *   - Inside an aggregator argument or iterator body, ctx._row holds
 *     the current row; column references resolve to that row's value.
 *   - Bare bracketed names ([Name]) first try the measure table, then
 *     the current row, and finally fail with a clear error.
 */

import { FUNCTIONS } from "./functions.js";
import { parse } from "./parser.js";

// Tiny per-formula AST cache (shared across calls within a session)
const astCache = new Map();
function parseCached(formula) {
  // Strip optional leading "=" so users can write "= SUM([Revenue])" Power BI-style
  const key = String(formula ?? "").trim().replace(/^=\s*/, "");
  if (astCache.has(key)) return astCache.get(key);
  const ast = parse(key);
  astCache.set(key, ast);
  return ast;
}

// ── Binary / unary operator implementations ───────────────────────────────

const numericCoerce = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const equalsOp = (a, b) => {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  const an = numericCoerce(a);
  const bn = numericCoerce(b);
  if (an !== null && bn !== null) return an === bn;
  return String(a) === String(b);
};

const compareOp = (op, a, b) => {
  if (a === null || b === null) return false;
  const an = numericCoerce(a), bn = numericCoerce(b);
  let cmp;
  if (an !== null && bn !== null) {
    cmp = an < bn ? -1 : an > bn ? 1 : 0;
  } else {
    const sa = String(a), sb = String(b);
    cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  switch (op) {
    case "LT":  return cmp <  0;
    case "GT":  return cmp >  0;
    case "LTE": return cmp <= 0;
    case "GTE": return cmp >= 0;
  }
  return false;
};

const arithOp = (op, a, b) => {
  const an = numericCoerce(a) ?? 0;
  const bn = numericCoerce(b) ?? 0;
  switch (op) {
    case "PLUS":  return an + bn;
    case "MINUS": return an - bn;
    case "STAR":  return an * bn;
    case "SLASH": return bn === 0 ? null : an / bn;
  }
  return null;
};

// ── Main evaluator ────────────────────────────────────────────────────────

export function evaluate(ast, ctx) {
  if (!ast) return null;

  switch (ast.type) {
    case "number": return ast.value;
    case "string": return ast.value;
    case "bool":   return ast.value;
    case "blank":  return null;

    case "ref":    return resolveBareRef(ast.name, ctx);
    case "colref": return resolveRowCol(ast.column, ctx);

    case "binop":  return evalBinop(ast, ctx);
    case "unaryop": return evalUnary(ast, ctx);

    case "call":   return evalCall(ast, ctx);
  }
  throw new Error(`Unknown AST node: ${ast.type}`);
}

function resolveBareRef(name, ctx) {
  // In a row context, columns take priority (calculated-column style)
  if (ctx._row && Object.prototype.hasOwnProperty.call(ctx._row, name)) {
    return ctx._row[name];
  }

  // Look up as a measure
  const measure = ctx.measures?.find((m) => m.name === name);
  if (measure) {
    return evaluateMeasureRef(measure, ctx);
  }

  // Last-resort: still in a row context but column missing
  if (ctx._row) return null;

  throw new Error(`Unknown reference [${name}] — no column or measure with this name.`);
}

function resolveRowCol(column, ctx) {
  if (ctx._row && Object.prototype.hasOwnProperty.call(ctx._row, column)) {
    return ctx._row[column];
  }
  if (ctx._row) return null; // missing column → blank
  throw new Error(`Column "${column}" referenced outside aggregator/iterator context.`);
}

function evalBinop(node, ctx) {
  const { op } = node;
  // Short-circuit for AND/OR
  if (op === "AND") {
    return Boolean(evaluate(node.left, ctx)) && Boolean(evaluate(node.right, ctx));
  }
  if (op === "OR") {
    return Boolean(evaluate(node.left, ctx)) || Boolean(evaluate(node.right, ctx));
  }
  const a = evaluate(node.left, ctx);
  const b = evaluate(node.right, ctx);
  if (op === "EQ")  return equalsOp(a, b);
  if (op === "NEQ") return !equalsOp(a, b);
  if (op === "LT" || op === "GT" || op === "LTE" || op === "GTE") {
    return compareOp(op, a, b);
  }
  if (op === "AMP") return String(a ?? "") + String(b ?? "");
  if (op === "PLUS" || op === "MINUS" || op === "STAR" || op === "SLASH") {
    return arithOp(op, a, b);
  }
  throw new Error(`Unknown binary operator: ${op}`);
}

function evalUnary(node, ctx) {
  const v = evaluate(node.operand, ctx);
  if (node.op === "NEG") {
    const n = numericCoerce(v);
    return n === null ? null : -n;
  }
  if (node.op === "NOT") return !Boolean(v);
  throw new Error(`Unknown unary operator: ${node.op}`);
}

function evalCall(node, ctx) {
  const fn = FUNCTIONS[node.name];
  if (!fn) throw new Error(`Unknown function: ${node.name}()`);
  validateArgCount(node.name, fn.args, node.args.length);
  return fn.evaluate(node.args, ctx, evaluate);
}

function validateArgCount(name, spec, count) {
  if (typeof spec === "number" && count !== spec) {
    throw new Error(`${name} expects ${spec} argument${spec === 1 ? "" : "s"}, got ${count}.`);
  }
  if (Array.isArray(spec)) {
    const [min, max] = spec;
    if (count < min || count > max) {
      throw new Error(`${name} expects ${min}–${max} arguments, got ${count}.`);
    }
  }
  if (spec === "+" && count < 1) {
    throw new Error(`${name} expects at least 1 argument.`);
  }
  if (typeof spec === "string" && /^\d\+$/.test(spec)) {
    const min = parseInt(spec, 10);
    if (count < min) throw new Error(`${name} expects at least ${min} arguments.`);
  }
}

// ── Measure references (with loop-guard) ──────────────────────────────────

function evaluateMeasureRef(measure, ctx) {
  const chain = ctx._chain ?? new Set();
  if (chain.has(measure.id)) {
    throw new Error(`Circular measure reference: ${measure.name}`);
  }
  const newChain = new Set(chain);
  newChain.add(measure.id);

  const ast = parseCached(measure.formula);
  // Reset _row when crossing into a referenced measure — measures define
  // their own scalar context, not the caller's row context.
  return evaluate(ast, { ...ctx, _row: null, _chain: newChain });
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Evaluate a measure (by its definition) against the given filtered rows.
 *
 * @param {Object} measure   { id, name, formula }
 * @param {Object} options   { rows, fullRows?, measures?, dataTypes? }
 * @returns {{ value: any, error: string|null }}
 */
export function evaluateMeasure(measure, { rows, fullRows, measures = [], dataTypes = {} } = {}) {
  try {
    const ast = parseCached(measure.formula);
    const ctx = {
      rows: rows ?? [],
      fullRows: fullRows ?? rows ?? [],
      measures,
      dataTypes,
      _row: null,
      _chain: new Set([measure.id]),
    };
    const value = evaluate(ast, ctx);
    return { value, error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
}

/**
 * Quick syntax check — parses and inspects the AST without evaluating.
 */
export function validateFormula(formula) {
  try {
    const cleaned = String(formula ?? "").trim().replace(/^=\s*/, "");
    if (!cleaned) return { valid: false, error: "Formula is empty." };
    parseCached(cleaned);
    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}
