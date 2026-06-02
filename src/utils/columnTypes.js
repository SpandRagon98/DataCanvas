/**
 * columnTypes.js — rich (user-facing) column types and their mapping to the
 * engine base types (string | number | date | boolean) used everywhere else.
 *
 * The base type keeps all existing logic (charts, profiler, DAX, metrics)
 * working unchanged; the rich type drives display/formatting (e.g. Dimension
 * pills, currency/percent) and is stored per column in columnFormats.
 */

export const RICH_TYPES = [
  { id: "dimension",  label: "Dimension",       base: "string"  },
  { id: "text",       label: "Text",            base: "string"  },
  { id: "number",     label: "Number",          base: "number"  },
  { id: "decimal",    label: "Decimal Number",  base: "number"  },
  { id: "whole",      label: "Whole Number",    base: "number"  },
  { id: "percent",    label: "Percentage",      base: "number"  },
  { id: "currency",   label: "Currency",        base: "number"  },
  { id: "date",       label: "Date",            base: "date"    },
  { id: "datetime",   label: "DateTime",        base: "date"    },
  { id: "boolean",    label: "Boolean",         base: "boolean" },
];

const BY_ID = Object.fromEntries(RICH_TYPES.map((t) => [t.id, t]));

/** Map a rich type id → engine base type. */
export function richToBase(richId) {
  return BY_ID[richId]?.base ?? "string";
}

/**
 * Default rich type when a column has no explicit type set.
 * Numeric → Number (measure-friendly); everything else (text / date /
 * datetime / boolean / categorical) → Dimension.
 */
export function baseToRich(base) {
  if (base === "number") return "number";
  return "dimension";
}

/**
 * The effective rich type for a column:
 *   1. explicit user choice (columnFormats), else
 *   2. for system datasets (native Calendar) → always Dimension, else
 *   3. the default derived from the engine base type.
 */
export function effectiveRichType(col, baseType, columnFormats, isSystem = false) {
  const explicit = columnFormats?.[col];
  if (explicit) return explicit;
  if (isSystem) return "dimension";
  return baseToRich(baseType);
}

export const isDimension     = (richId) => richId === "dimension";
export const isDimensionType = (richId) => richId === "dimension";
