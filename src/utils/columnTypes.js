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

/** Reasonable default rich type when only a base type is known. */
export function baseToRich(base) {
  switch (base) {
    case "number":  return "number";
    case "date":    return "date";
    case "boolean": return "boolean";
    default:        return "text";
  }
}

export const isDimension = (richId) => richId === "dimension";
