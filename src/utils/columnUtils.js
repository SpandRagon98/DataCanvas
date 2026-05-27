/**
 * Column display-name helpers.
 * The internal row key never changes — aliases are display-only.
 */

/** Returns the display label for a column key. */
export function displayName(col, aliases = {}) {
  return aliases[col] ?? col;
}

/** Returns { key, label } pairs for an array of column keys. */
export function displayCols(columns, aliases = {}) {
  return columns.map((key) => ({ key, label: aliases[key] ?? key }));
}
