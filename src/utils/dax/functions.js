/**
 * functions.js — DAX function library (JS evaluator implementation).
 *
 * Each function exposes:
 *   {
 *     args:     number | [min, max] | '+'        // expected arg count
 *     category: string                            // for autocomplete grouping
 *     describe: string                            // one-line description
 *     example:  string                            // example usage
 *     kind:     'agg' | 'iterator' | 'context' | 'scalar'
 *     evaluate: (argNodes, ctx, ev) => any        // ev = recursive evaluator
 *   }
 *
 * ctx shape:
 *   {
 *     rows:       Array         // current row set (filter context applied)
 *     fullRows:   Array         // unfiltered baseline rows (for ALL())
 *     measures:   Array         // all measure definitions, for resolving [Name]
 *     dataTypes:  Object        // column type map (string|number|date|boolean)
 *     _row:       Object|null   // current row (when inside aggregator/iterator)
 *     _chain:     Set<string>   // ids of measures currently being evaluated (loop guard)
 *   }
 */

// ── Helpers ────────────────────────────────────────────────────────────────

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const truthy = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "number")  return v !== 0;
  if (typeof v === "string")  return v.length > 0;
  if (typeof v === "boolean") return v;
  return Boolean(v);
};

const eq = (a, b) => {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  // Loose comparison on values that look numeric
  const an = num(a), bn = num(b);
  if (an !== null && bn !== null) return an === bn;
  return String(a) === String(b);
};

const cmp = (a, b) => {
  const an = num(a), bn = num(b);
  if (an !== null && bn !== null) return an < bn ? -1 : an > bn ? 1 : 0;
  // Date strings compare correctly with string ordering for ISO dates
  const sa = String(a ?? ""), sb = String(b ?? "");
  return sa < sb ? -1 : sa > sb ? 1 : 0;
};

const iterNumeric = (rows, argNode, ev, ctx, mapper = (v) => v) => {
  const out = [];
  for (const row of rows) {
    const v = ev(argNode, { ...ctx, _row: row });
    const n = num(v);
    if (n !== null) out.push(mapper(n));
  }
  return out;
};

const iterAll = (rows, argNode, ev, ctx) => {
  const out = [];
  for (const row of rows) out.push(ev(argNode, { ...ctx, _row: row }));
  return out;
};

const validateArgs = (name, spec, count) => {
  if (typeof spec === "number" && count !== spec) {
    throw new Error(`${name} expects ${spec} argument(s), got ${count}`);
  }
  if (Array.isArray(spec)) {
    const [min, max] = spec;
    if (count < min || count > max) {
      throw new Error(`${name} expects ${min}–${max} arguments, got ${count}`);
    }
  }
  if (spec === "+" && count < 1) throw new Error(`${name} expects at least 1 argument`);
  if (typeof spec === "string" && /^\d\+$/.test(spec)) {
    const min = parseInt(spec, 10);
    if (count < min) throw new Error(`${name} expects at least ${min} arguments`);
  }
};

// ── Date helpers ──────────────────────────────────────────────────────────

const toDate = (v) => {
  if (v instanceof Date) return v;
  if (v == null || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDate = (d) => {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shiftDate = (d, interval, n) => {
  if (!d) return null;
  const r = new Date(d);
  const k = String(interval).toUpperCase();
  if (k === "YEAR")    r.setFullYear(r.getFullYear() + n);
  if (k === "QUARTER") r.setMonth(r.getMonth() + n * 3);
  if (k === "MONTH")   r.setMonth(r.getMonth() + n);
  if (k === "DAY")     r.setDate(r.getDate() + n);
  return r;
};

// ── Function library ─────────────────────────────────────────────────────

export const FUNCTIONS = {

  // ── Aggregations ─────────────────────────────────────────────────────
  SUM: {
    args: 1, category: "Aggregation", kind: "agg",
    describe: "Sum of a column across the current filter context.",
    example: "SUM ( Sales[Revenue] )",
    evaluate: (args, ctx, ev) => {
      const vals = iterNumeric(ctx.rows, args[0], ev, ctx);
      return vals.reduce((a, b) => a + b, 0);
    },
  },
  AVERAGE: {
    args: 1, category: "Aggregation", kind: "agg",
    describe: "Average (mean) of a column.",
    example: "AVERAGE ( Sales[Profit] )",
    evaluate: (args, ctx, ev) => {
      const vals = iterNumeric(ctx.rows, args[0], ev, ctx);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    },
  },
  AVG: { aliasOf: "AVERAGE" },
  MIN: {
    args: 1, category: "Aggregation", kind: "agg",
    describe: "Minimum value of a column.",
    example: "MIN ( Sales[Revenue] )",
    evaluate: (args, ctx, ev) => {
      const vals = iterNumeric(ctx.rows, args[0], ev, ctx);
      return vals.length ? Math.min(...vals) : null;
    },
  },
  MAX: {
    args: 1, category: "Aggregation", kind: "agg",
    describe: "Maximum value of a column.",
    example: "MAX ( Sales[Revenue] )",
    evaluate: (args, ctx, ev) => {
      const vals = iterNumeric(ctx.rows, args[0], ev, ctx);
      return vals.length ? Math.max(...vals) : null;
    },
  },
  COUNT: {
    args: 1, category: "Aggregation", kind: "agg",
    describe: "Count of non-blank numeric values in a column.",
    example: "COUNT ( Sales[OrderID] )",
    evaluate: (args, ctx, ev) => {
      let c = 0;
      for (const row of ctx.rows) {
        const v = ev(args[0], { ...ctx, _row: row });
        if (v !== null && v !== undefined && v !== "") c++;
      }
      return c;
    },
  },
  COUNTA: { aliasOf: "COUNT" },
  COUNTROWS: {
    args: [0, 1], category: "Aggregation", kind: "agg",
    describe: "Number of rows in the current filter context.",
    example: "COUNTROWS ( Sales )",
    evaluate: (args, ctx, ev) => ctx.rows.length,
  },
  DISTINCTCOUNT: {
    args: 1, category: "Aggregation", kind: "agg",
    describe: "Count of distinct values in a column.",
    example: "DISTINCTCOUNT ( Sales[Customer] )",
    evaluate: (args, ctx, ev) => {
      const set = new Set();
      for (const row of ctx.rows) {
        const v = ev(args[0], { ...ctx, _row: row });
        if (v !== null && v !== undefined && v !== "") set.add(String(v));
      }
      return set.size;
    },
  },
  MEDIAN: {
    args: 1, category: "Statistical", kind: "agg",
    describe: "Median of a column.",
    example: "MEDIAN ( Sales[Revenue] )",
    evaluate: (args, ctx, ev) => {
      const vals = iterNumeric(ctx.rows, args[0], ev, ctx).sort((a, b) => a - b);
      if (!vals.length) return 0;
      const mid = Math.floor(vals.length / 2);
      return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    },
  },
  STDEV: {
    args: 1, category: "Statistical", kind: "agg",
    describe: "Standard deviation of a column (sample).",
    example: "STDEV ( Sales[Revenue] )",
    evaluate: (args, ctx, ev) => {
      const vals = iterNumeric(ctx.rows, args[0], ev, ctx);
      if (vals.length < 2) return 0;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / (vals.length - 1);
      return Math.sqrt(variance);
    },
  },
  VAR: {
    args: 1, category: "Statistical", kind: "agg",
    describe: "Variance of a column (sample).",
    example: "VAR ( Sales[Revenue] )",
    evaluate: (args, ctx, ev) => {
      const vals = iterNumeric(ctx.rows, args[0], ev, ctx);
      if (vals.length < 2) return 0;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return vals.reduce((s, x) => s + (x - mean) ** 2, 0) / (vals.length - 1);
    },
  },
  PERCENTILE: {
    args: 2, category: "Statistical", kind: "agg",
    describe: "Percentile (0 to 1) of a column.",
    example: "PERCENTILE ( Sales[Revenue], 0.9 )",
    evaluate: (args, ctx, ev) => {
      const vals = iterNumeric(ctx.rows, args[0], ev, ctx).sort((a, b) => a - b);
      const p = num(ev(args[1], ctx)) ?? 0;
      if (!vals.length) return 0;
      const idx = Math.min(vals.length - 1, Math.max(0, p * (vals.length - 1)));
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (idx - lo);
    },
  },

  // ── Iterators ─────────────────────────────────────────────────────────
  SUMX: {
    args: 2, category: "Iterator", kind: "iterator",
    describe: "Iterate a table and sum the expression evaluated per row.",
    example: "SUMX ( Sales, Sales[Quantity] * Sales[Price] )",
    evaluate: (args, ctx, ev) => {
      const rows = resolveTableArg(args[0], ctx, ev);
      let total = 0;
      for (const row of rows) {
        const v = num(ev(args[1], { ...ctx, _row: row }));
        if (v !== null) total += v;
      }
      return total;
    },
  },
  AVERAGEX: {
    args: 2, category: "Iterator", kind: "iterator",
    describe: "Iterate and average the expression evaluated per row.",
    example: "AVERAGEX ( Sales, Sales[Profit] / Sales[Revenue] )",
    evaluate: (args, ctx, ev) => {
      const rows = resolveTableArg(args[0], ctx, ev);
      let sum = 0, count = 0;
      for (const row of rows) {
        const v = num(ev(args[1], { ...ctx, _row: row }));
        if (v !== null) { sum += v; count++; }
      }
      return count ? sum / count : 0;
    },
  },
  MAXX: {
    args: 2, category: "Iterator", kind: "iterator",
    describe: "Iterate and return the max of the expression.",
    example: "MAXX ( Sales, Sales[Quantity] * Sales[Price] )",
    evaluate: (args, ctx, ev) => {
      const rows = resolveTableArg(args[0], ctx, ev);
      let best = null;
      for (const row of rows) {
        const v = num(ev(args[1], { ...ctx, _row: row }));
        if (v !== null && (best === null || v > best)) best = v;
      }
      return best ?? 0;
    },
  },
  MINX: {
    args: 2, category: "Iterator", kind: "iterator",
    describe: "Iterate and return the min of the expression.",
    example: "MINX ( Sales, Sales[Cost] )",
    evaluate: (args, ctx, ev) => {
      const rows = resolveTableArg(args[0], ctx, ev);
      let best = null;
      for (const row of rows) {
        const v = num(ev(args[1], { ...ctx, _row: row }));
        if (v !== null && (best === null || v < best)) best = v;
      }
      return best ?? 0;
    },
  },
  COUNTX: {
    args: 2, category: "Iterator", kind: "iterator",
    describe: "Iterate and count non-blank evaluation results.",
    example: "COUNTX ( Sales, Sales[OrderID] )",
    evaluate: (args, ctx, ev) => {
      const rows = resolveTableArg(args[0], ctx, ev);
      let c = 0;
      for (const row of rows) {
        const v = ev(args[1], { ...ctx, _row: row });
        if (v !== null && v !== undefined && v !== "") c++;
      }
      return c;
    },
  },

  // ── Math ──────────────────────────────────────────────────────────────
  DIVIDE: {
    args: [2, 3], category: "Math",
    describe: "Safe division — returns BLANK / alternate when denominator is zero.",
    example: "DIVIDE ( [Total Profit], [Total Revenue], 0 )",
    evaluate: (args, ctx, ev) => {
      const a = num(ev(args[0], ctx));
      const b = num(ev(args[1], ctx));
      const alt = args[2] !== undefined ? ev(args[2], ctx) : null;
      if (b === 0 || b === null) return alt;
      return (a ?? 0) / b;
    },
  },
  ROUND: {
    args: [1, 2], category: "Math",
    describe: "Round to N decimal places (default 0).",
    example: "ROUND ( [Margin], 2 )",
    evaluate: (args, ctx, ev) => {
      const v = num(ev(args[0], ctx)) ?? 0;
      const d = args[1] !== undefined ? (num(ev(args[1], ctx)) ?? 0) : 0;
      const p = Math.pow(10, d);
      return Math.round(v * p) / p;
    },
  },
  ROUNDUP: {
    args: [1, 2], category: "Math",
    describe: "Round up to N decimal places.",
    example: "ROUNDUP ( 4.2, 0 )",
    evaluate: (args, ctx, ev) => {
      const v = num(ev(args[0], ctx)) ?? 0;
      const d = args[1] !== undefined ? (num(ev(args[1], ctx)) ?? 0) : 0;
      const p = Math.pow(10, d);
      return Math.ceil(v * p) / p;
    },
  },
  ROUNDDOWN: {
    args: [1, 2], category: "Math",
    describe: "Round down to N decimal places.",
    example: "ROUNDDOWN ( 4.9, 0 )",
    evaluate: (args, ctx, ev) => {
      const v = num(ev(args[0], ctx)) ?? 0;
      const d = args[1] !== undefined ? (num(ev(args[1], ctx)) ?? 0) : 0;
      const p = Math.pow(10, d);
      return Math.floor(v * p) / p;
    },
  },
  ABS: {
    args: 1, category: "Math",
    describe: "Absolute value.", example: "ABS ( [Variance] )",
    evaluate: (args, ctx, ev) => Math.abs(num(ev(args[0], ctx)) ?? 0),
  },
  POWER: {
    args: 2, category: "Math",
    describe: "Base raised to exponent.", example: "POWER ( 2, 10 )",
    evaluate: (args, ctx, ev) => Math.pow(num(ev(args[0], ctx)) ?? 0, num(ev(args[1], ctx)) ?? 0),
  },
  SQRT: {
    args: 1, category: "Math",
    describe: "Square root.", example: "SQRT ( 144 )",
    evaluate: (args, ctx, ev) => Math.sqrt(Math.max(0, num(ev(args[0], ctx)) ?? 0)),
  },
  MOD: {
    args: 2, category: "Math",
    describe: "Modulo (remainder).", example: "MOD ( 10, 3 )",
    evaluate: (args, ctx, ev) => {
      const a = num(ev(args[0], ctx)) ?? 0;
      const b = num(ev(args[1], ctx)) ?? 1;
      return b === 0 ? null : a % b;
    },
  },
  CEILING: {
    args: [1, 2], category: "Math",
    describe: "Round up to nearest multiple.",
    example: "CEILING ( [Price], 10 )",
    evaluate: (args, ctx, ev) => {
      const v = num(ev(args[0], ctx)) ?? 0;
      const sig = args[1] !== undefined ? num(ev(args[1], ctx)) : 1;
      return sig ? Math.ceil(v / sig) * sig : Math.ceil(v);
    },
  },
  FLOOR: {
    args: [1, 2], category: "Math",
    describe: "Round down to nearest multiple.",
    example: "FLOOR ( [Price], 10 )",
    evaluate: (args, ctx, ev) => {
      const v = num(ev(args[0], ctx)) ?? 0;
      const sig = args[1] !== undefined ? num(ev(args[1], ctx)) : 1;
      return sig ? Math.floor(v / sig) * sig : Math.floor(v);
    },
  },
  INT: {
    args: 1, category: "Math",
    describe: "Truncate to integer.", example: "INT ( 4.7 )",
    evaluate: (args, ctx, ev) => Math.trunc(num(ev(args[0], ctx)) ?? 0),
  },
  EXP: {
    args: 1, category: "Math",
    describe: "e raised to the given power.", example: "EXP ( 1 )",
    evaluate: (args, ctx, ev) => Math.exp(num(ev(args[0], ctx)) ?? 0),
  },
  LN: {
    args: 1, category: "Math",
    describe: "Natural logarithm.", example: "LN ( [x] )",
    evaluate: (args, ctx, ev) => Math.log(num(ev(args[0], ctx)) ?? 0),
  },
  LOG: {
    args: [1, 2], category: "Math",
    describe: "Logarithm (base 10 by default).", example: "LOG ( 100, 10 )",
    evaluate: (args, ctx, ev) => {
      const v = num(ev(args[0], ctx)) ?? 0;
      const b = args[1] !== undefined ? num(ev(args[1], ctx)) : 10;
      return Math.log(v) / Math.log(b);
    },
  },
  SIGN: {
    args: 1, category: "Math",
    describe: "Sign of a number (-1, 0, or 1).", example: "SIGN ( -5 )",
    evaluate: (args, ctx, ev) => Math.sign(num(ev(args[0], ctx)) ?? 0),
  },

  // ── Conditional / Logical ─────────────────────────────────────────────
  IF: {
    args: [2, 3], category: "Logical",
    describe: "IF ( condition, then, else? )",
    example: 'IF ( [Profit] > 0, "Pos", "Neg" )',
    evaluate: (args, ctx, ev) => {
      const cond = truthy(ev(args[0], ctx));
      if (cond) return ev(args[1], ctx);
      return args[2] !== undefined ? ev(args[2], ctx) : null;
    },
  },
  SWITCH: {
    args: "3+", category: "Logical",
    describe: "SWITCH ( expr, v1, r1, v2, r2, ..., default? )",
    example: 'SWITCH ( [Tier], "A", 10, "B", 5, 0 )',
    evaluate: (args, ctx, ev) => {
      const expr = ev(args[0], ctx);
      let i = 1;
      while (i + 1 < args.length) {
        const val = ev(args[i], ctx);
        if (eq(expr, val)) return ev(args[i + 1], ctx);
        i += 2;
      }
      return i < args.length ? ev(args[i], ctx) : null;
    },
  },
  AND: {
    args: 2, category: "Logical",
    describe: "Logical AND.", example: "AND ( [A] > 0, [B] > 0 )",
    evaluate: (args, ctx, ev) => truthy(ev(args[0], ctx)) && truthy(ev(args[1], ctx)),
  },
  OR: {
    args: 2, category: "Logical",
    describe: "Logical OR.", example: "OR ( [A] > 0, [B] > 0 )",
    evaluate: (args, ctx, ev) => truthy(ev(args[0], ctx)) || truthy(ev(args[1], ctx)),
  },
  NOT: {
    args: 1, category: "Logical",
    describe: "Logical NOT.", example: "NOT ( [Active] )",
    evaluate: (args, ctx, ev) => !truthy(ev(args[0], ctx)),
  },
  ISBLANK: {
    args: 1, category: "Logical",
    describe: "True when the value is BLANK (null or empty string).",
    example: "ISBLANK ( [Customer] )",
    evaluate: (args, ctx, ev) => {
      const v = ev(args[0], ctx);
      return v === null || v === undefined || v === "";
    },
  },
  IFERROR: {
    args: 2, category: "Logical",
    describe: "Return alternative when expression errors.",
    example: "IFERROR ( DIVIDE([a],[b]), 0 )",
    evaluate: (args, ctx, ev) => {
      try {
        const v = ev(args[0], ctx);
        return v === null || (typeof v === "number" && !Number.isFinite(v))
          ? ev(args[1], ctx)
          : v;
      } catch {
        return ev(args[1], ctx);
      }
    },
  },
  BLANK: {
    args: 0, category: "Logical",
    describe: "Returns BLANK (null).", example: "BLANK ()",
    evaluate: () => null,
  },
  COALESCE: {
    args: "+", category: "Logical",
    describe: "Returns first non-blank value.",
    example: "COALESCE ( [Discount], 0 )",
    evaluate: (args, ctx, ev) => {
      for (const a of args) {
        const v = ev(a, ctx);
        if (v !== null && v !== undefined && v !== "") return v;
      }
      return null;
    },
  },

  // ── Filter context ────────────────────────────────────────────────────
  CALCULATE: {
    args: "+", category: "Filter", kind: "context",
    describe: "Evaluate expression with modified filter context.",
    example: 'CALCULATE ( SUM(Sales[Revenue]), Sales[Region] = "North" )',
    evaluate: (args, ctx, ev) => {
      let rows = ctx.rows;
      let workingCtx = { ...ctx };

      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        // ALL(...) — wipe filters for the targeted entities
        if (arg.type === "call" && (arg.name === "ALL" || arg.name === "ALLEXCEPT")) {
          rows = ctx.fullRows ?? ctx.rows;
          workingCtx = { ...workingCtx, rows };
          continue;
        }
        // FILTER(table, condition) — explicit row-set filter
        if (arg.type === "call" && arg.name === "FILTER") {
          rows = rows.filter((row) =>
            truthy(ev(arg.args[1], { ...workingCtx, _row: row, rows }))
          );
          workingCtx = { ...workingCtx, rows };
          continue;
        }
        // Boolean-style filter: Sales[Region] = "North"
        rows = rows.filter((row) =>
          truthy(ev(arg, { ...workingCtx, _row: row, rows }))
        );
        workingCtx = { ...workingCtx, rows };
      }

      return ev(args[0], { ...workingCtx, rows });
    },
  },
  FILTER: {
    args: 2, category: "Filter",
    describe: "Filter a table to rows matching a condition. Use inside CALCULATE/iterators.",
    example: "FILTER ( Sales, Sales[Revenue] > 1000 )",
    evaluate: (args, ctx, ev) => {
      // When evaluated bare, return the filtered row array
      return ctx.rows.filter((row) =>
        truthy(ev(args[1], { ...ctx, _row: row }))
      );
    },
  },
  ALL: {
    args: "+", category: "Filter",
    describe: "Ignore filters on the specified table/columns. Use inside CALCULATE.",
    example: "CALCULATE ( SUM(Sales[Revenue]), ALL(Sales[Region]) )",
    evaluate: (args, ctx, ev) => ctx.fullRows ?? ctx.rows,
  },
  ALLEXCEPT: { aliasOf: "ALL" },

  // ── Text ──────────────────────────────────────────────────────────────
  CONCATENATE: {
    args: 2, category: "Text",
    describe: "Join two text values.", example: 'CONCATENATE ( [First], [Last] )',
    evaluate: (args, ctx, ev) => String(ev(args[0], ctx) ?? "") + String(ev(args[1], ctx) ?? ""),
  },
  CONCAT: {
    args: "+", category: "Text",
    describe: "Join multiple text values.",
    example: 'CONCAT ( [First], " ", [Last] )',
    evaluate: (args, ctx, ev) => args.map((a) => String(ev(a, ctx) ?? "")).join(""),
  },
  LEFT: {
    args: [1, 2], category: "Text",
    describe: "Leftmost N characters of a string.",
    example: 'LEFT ( [Code], 3 )',
    evaluate: (args, ctx, ev) => {
      const s = String(ev(args[0], ctx) ?? "");
      const n = args[1] !== undefined ? (num(ev(args[1], ctx)) ?? 1) : 1;
      return s.slice(0, Math.max(0, n));
    },
  },
  RIGHT: {
    args: [1, 2], category: "Text",
    describe: "Rightmost N characters of a string.",
    example: 'RIGHT ( [Code], 3 )',
    evaluate: (args, ctx, ev) => {
      const s = String(ev(args[0], ctx) ?? "");
      const n = args[1] !== undefined ? (num(ev(args[1], ctx)) ?? 1) : 1;
      return s.slice(-Math.max(0, n));
    },
  },
  MID: {
    args: 3, category: "Text",
    describe: "Substring from position with given length (1-indexed).",
    example: 'MID ( "Hello", 2, 3 )',
    evaluate: (args, ctx, ev) => {
      const s = String(ev(args[0], ctx) ?? "");
      const st = (num(ev(args[1], ctx)) ?? 1) - 1;
      const n = num(ev(args[2], ctx)) ?? 0;
      return s.slice(Math.max(0, st), Math.max(0, st) + n);
    },
  },
  LEN: {
    args: 1, category: "Text",
    describe: "Length of a string.", example: 'LEN ( [Name] )',
    evaluate: (args, ctx, ev) => String(ev(args[0], ctx) ?? "").length,
  },
  UPPER: {
    args: 1, category: "Text",
    describe: "Uppercase a string.", example: 'UPPER ( [Name] )',
    evaluate: (args, ctx, ev) => String(ev(args[0], ctx) ?? "").toUpperCase(),
  },
  LOWER: {
    args: 1, category: "Text",
    describe: "Lowercase a string.", example: 'LOWER ( [Name] )',
    evaluate: (args, ctx, ev) => String(ev(args[0], ctx) ?? "").toLowerCase(),
  },
  TRIM: {
    args: 1, category: "Text",
    describe: "Trim leading/trailing whitespace.",
    example: 'TRIM ( [Code] )',
    evaluate: (args, ctx, ev) => String(ev(args[0], ctx) ?? "").trim(),
  },
  SUBSTITUTE: {
    args: [3, 4], category: "Text",
    describe: "Replace occurrences of a substring with another.",
    example: 'SUBSTITUTE ( [Code], "-", " " )',
    evaluate: (args, ctx, ev) => {
      const s   = String(ev(args[0], ctx) ?? "");
      const old = String(ev(args[1], ctx) ?? "");
      const nw  = String(ev(args[2], ctx) ?? "");
      return old ? s.split(old).join(nw) : s;
    },
  },
  FORMAT: {
    args: 2, category: "Text",
    describe: "Format a value as text. (Simplified: numbers → number, dates → ISO)",
    example: 'FORMAT ( [Sales], "0.00" )',
    evaluate: (args, ctx, ev) => {
      const v = ev(args[0], ctx);
      const fmt = String(ev(args[1], ctx) ?? "");
      const n = num(v);
      if (n !== null) {
        // Count decimals from format string like "0.00" or "#,##0.00"
        const dot = fmt.indexOf(".");
        const dec = dot >= 0 ? Math.min(20, fmt.length - dot - 1) : 0;
        const opts = { minimumFractionDigits: dec, maximumFractionDigits: dec };
        if (fmt.includes(",")) opts.useGrouping = true;
        return n.toLocaleString("en-US", opts);
      }
      const d = toDate(v);
      if (d) return fmtDate(d);
      return String(v ?? "");
    },
  },
  VALUE: {
    args: 1, category: "Text",
    describe: "Convert text to number.", example: 'VALUE ( [Code] )',
    evaluate: (args, ctx, ev) => num(ev(args[0], ctx)) ?? 0,
  },

  // ── Date / Time intelligence ──────────────────────────────────────────
  YEAR: {
    args: 1, category: "Date",
    describe: "Year part of a date.", example: 'YEAR ( [Date] )',
    evaluate: (args, ctx, ev) => { const d = toDate(ev(args[0], ctx)); return d ? d.getFullYear() : null; },
  },
  MONTH: {
    args: 1, category: "Date",
    describe: "Month part of a date (1–12).", example: 'MONTH ( [Date] )',
    evaluate: (args, ctx, ev) => { const d = toDate(ev(args[0], ctx)); return d ? d.getMonth() + 1 : null; },
  },
  DAY: {
    args: 1, category: "Date",
    describe: "Day of month (1–31).", example: 'DAY ( [Date] )',
    evaluate: (args, ctx, ev) => { const d = toDate(ev(args[0], ctx)); return d ? d.getDate() : null; },
  },
  WEEKDAY: {
    args: [1, 2], category: "Date",
    describe: "Day of week (1 = Sunday).", example: 'WEEKDAY ( [Date] )',
    evaluate: (args, ctx, ev) => { const d = toDate(ev(args[0], ctx)); return d ? d.getDay() + 1 : null; },
  },
  HOUR: {
    args: 1, category: "Date",
    describe: "Hour part of a datetime.", example: 'HOUR ( [Created] )',
    evaluate: (args, ctx, ev) => { const d = toDate(ev(args[0], ctx)); return d ? d.getHours() : null; },
  },
  MINUTE: {
    args: 1, category: "Date",
    describe: "Minute part of a datetime.", example: 'MINUTE ( [Created] )',
    evaluate: (args, ctx, ev) => { const d = toDate(ev(args[0], ctx)); return d ? d.getMinutes() : null; },
  },
  SECOND: {
    args: 1, category: "Date",
    describe: "Second part of a datetime.", example: 'SECOND ( [Created] )',
    evaluate: (args, ctx, ev) => { const d = toDate(ev(args[0], ctx)); return d ? d.getSeconds() : null; },
  },
  NOW: {
    args: 0, category: "Date",
    describe: "Current date-time.", example: 'NOW ()',
    evaluate: () => new Date(),
  },
  TODAY: {
    args: 0, category: "Date",
    describe: "Today's date (no time).", example: 'TODAY ()',
    evaluate: () => { const d = new Date(); d.setHours(0,0,0,0); return d; },
  },
  DATE: {
    args: 3, category: "Date",
    describe: "Construct a date from year, month, day.",
    example: 'DATE ( 2026, 1, 1 )',
    evaluate: (args, ctx, ev) => new Date(num(ev(args[0], ctx)) ?? 1970, (num(ev(args[1], ctx)) ?? 1) - 1, num(ev(args[2], ctx)) ?? 1),
  },
  DATEDIFF: {
    args: 3, category: "Date",
    describe: 'Difference between two dates in a given interval ("DAY"|"MONTH"|"YEAR").',
    example: 'DATEDIFF ( [Start], [End], "DAY" )',
    evaluate: (args, ctx, ev) => {
      const a = toDate(ev(args[0], ctx));
      const b = toDate(ev(args[1], ctx));
      const u = String(ev(args[2], ctx) ?? "DAY").toUpperCase();
      if (!a || !b) return null;
      const ms = b - a;
      if (u === "DAY")   return Math.round(ms / 86400000);
      if (u === "HOUR")  return Math.round(ms / 3600000);
      if (u === "MONTH") return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
      if (u === "YEAR")  return b.getFullYear() - a.getFullYear();
      return Math.round(ms / 86400000);
    },
  },
  DATEADD: {
    args: 3, category: "Date",
    describe: 'Shift each date by N intervals ("DAY"|"MONTH"|"QUARTER"|"YEAR").',
    example: 'DATEADD ( [Date], -1, "YEAR" )',
    evaluate: (args, ctx, ev) => {
      const d = toDate(ev(args[0], ctx));
      const n = num(ev(args[1], ctx)) ?? 0;
      const u = String(ev(args[2], ctx) ?? "DAY");
      return shiftDate(d, u, n);
    },
  },

  // Time intelligence (simplified — based on max date in row context)
  TOTALYTD: {
    args: [2, 3], category: "Time Intelligence", kind: "context",
    describe: "Year-to-date total of an expression up to the max date in context.",
    example: 'TOTALYTD ( SUM ( Sales[Revenue] ), Sales[Date] )',
    evaluate: (args, ctx, ev) => {
      const dateCol = extractColumnName(args[1]);
      if (!dateCol) return null;
      // Find max date in current row set
      let maxD = null;
      for (const row of ctx.rows) {
        const d = toDate(row[dateCol]);
        if (d && (!maxD || d > maxD)) maxD = d;
      }
      if (!maxD) return null;
      const y = maxD.getFullYear();
      const ytdRows = (ctx.fullRows ?? ctx.rows).filter((r) => {
        const d = toDate(r[dateCol]);
        return d && d.getFullYear() === y && d <= maxD;
      });
      return ev(args[0], { ...ctx, rows: ytdRows });
    },
  },
  SAMEPERIODLASTYEAR: {
    args: 1, category: "Time Intelligence",
    describe: "Same calendar period one year earlier (returns filtered rows for use with CALCULATE).",
    example: "CALCULATE ( SUM ( Sales[Revenue] ), SAMEPERIODLASTYEAR ( Sales[Date] ) )",
    evaluate: (args, ctx, ev) => {
      const dateCol = extractColumnName(args[0]);
      if (!dateCol) return ctx.rows;
      // Find date range in current context
      const dates = ctx.rows
        .map((r) => toDate(r[dateCol]))
        .filter(Boolean);
      if (!dates.length) return [];
      const min = new Date(Math.min(...dates));
      const max = new Date(Math.max(...dates));
      const minLY = shiftDate(min, "YEAR", -1);
      const maxLY = shiftDate(max, "YEAR", -1);
      return (ctx.fullRows ?? ctx.rows).filter((r) => {
        const d = toDate(r[dateCol]);
        return d && d >= minLY && d <= maxLY;
      });
    },
  },

  // ── Constants ─────────────────────────────────────────────────────────
  PI: { args: 0, category: "Math", describe: "π constant.", example: "PI ()", evaluate: () => Math.PI },
  TRUE: { args: 0, category: "Logical", describe: "Boolean true.", example: "TRUE ()", evaluate: () => true },
  FALSE: { args: 0, category: "Logical", describe: "Boolean false.", example: "FALSE ()", evaluate: () => false },
};

// Resolve aliases so callers can look up either name
for (const [name, def] of Object.entries(FUNCTIONS)) {
  if (def.aliasOf) {
    FUNCTIONS[name] = { ...FUNCTIONS[def.aliasOf], aliasOf: def.aliasOf };
  }
}

/**
 * Given an arg node that should resolve to a table (an iterator's first arg),
 * return the row set. We accept:
 *   - A bare identifier (e.g., Sales) — treat as ctx.rows
 *   - A FILTER(...) call — evaluate to get filtered rows
 *   - ALL(...) call — full rows
 *   - Anything else — fallback to ctx.rows
 */
function resolveTableArg(node, ctx, ev) {
  if (!node) return ctx.rows;
  if (node.type === "call") {
    if (node.name === "FILTER" || node.name === "ALL" || node.name === "ALLEXCEPT") {
      const res = ev(node, ctx);
      return Array.isArray(res) ? res : ctx.rows;
    }
  }
  return ctx.rows;
}

/**
 * Extract a column name from a column-reference AST node (or null if not a colref).
 */
export function extractColumnName(node) {
  if (!node) return null;
  if (node.type === "colref") return node.column;
  if (node.type === "ref")    return node.name;
  return null;
}

/**
 * Return autocomplete-friendly metadata for the editor.
 */
export function listFunctions() {
  return Object.entries(FUNCTIONS)
    .filter(([_, def]) => !def.aliasOf || def.aliasOf === _)
    .map(([name, def]) => ({
      name,
      category: def.category ?? "Other",
      describe: def.describe ?? "",
      example:  def.example  ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
