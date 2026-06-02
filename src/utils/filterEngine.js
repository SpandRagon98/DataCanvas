const RELATIVE_DATE_FNS = {
  last7days:  (d, now) => { const c = new Date(now); c.setDate(now.getDate() - 7);  return d >= c; },
  last30days: (d, now) => { const c = new Date(now); c.setDate(now.getDate() - 30); return d >= c; },
  last90days: (d, now) => { const c = new Date(now); c.setDate(now.getDate() - 90); return d >= c; },
  thismonth:  (d, now) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(),
  lastmonth:  (d, now) => {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    return d.getMonth() === m && d.getFullYear() === y;
  },
  thisyear: (d, now) => d.getFullYear() === now.getFullYear(),
};

export const RELATIVE_DATE_LABELS = [
  { value: "last7days",  label: "Last 7 days" },
  { value: "last30days", label: "Last 30 days" },
  { value: "last90days", label: "Last 90 days" },
  { value: "thismonth",  label: "This month" },
  { value: "lastmonth",  label: "Last month" },
  { value: "thisyear",   label: "This year" },
];

export const isRelativeDateFilter = (value) =>
  Object.prototype.hasOwnProperty.call(RELATIVE_DATE_FNS, value);

const matchesRelativeDate = (cellValue, filterValue) => {
  const fn = RELATIVE_DATE_FNS[filterValue];
  if (!fn) return false;
  const d = new Date(cellValue);
  return !isNaN(d.getTime()) && fn(d, new Date());
};

/** Check a date range filter: { from?: string, to?: string } */
const matchesDateRange = (cellValue, range) => {
  if (!range.from && !range.to) return true; // empty range = all
  const d = new Date(cellValue);
  if (isNaN(d.getTime())) return false;
  if (range.from) {
    const fromDate = new Date(range.from);
    if (!isNaN(fromDate.getTime()) && d < fromDate) return false;
  }
  if (range.to) {
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999); // inclusive end of day
    if (!isNaN(toDate.getTime()) && d > toDate) return false;
  }
  return true;
};

export const applyGlobalFilters = (rows, filters) => {
  if (!rows?.length) return [];
  if (!filters || Object.keys(filters).length === 0) return rows;

  // Ignore filters whose field isn't present in the data (e.g. a dimension from
  // an unrelated dataset with no relationship) so the report never breaks.
  const sample = rows[0];
  const activeEntries = Object.entries(filters).filter(([field]) => field in sample);
  if (!activeEntries.length) return rows;

  return rows.filter((row) =>
    activeEntries.every(([field, filterValue]) => {
      // Empty / no filter
      if (
        filterValue === undefined ||
        filterValue === null ||
        filterValue === "" ||
        (Array.isArray(filterValue) && filterValue.length === 0)
      ) {
        return true;
      }

      const cell = row[field];

      // Date range object { from?, to? }
      if (typeof filterValue === "object" && !Array.isArray(filterValue)) {
        return matchesDateRange(cell, filterValue);
      }

      // Relative date string
      if (isRelativeDateFilter(filterValue)) {
        return matchesRelativeDate(cell, filterValue);
      }

      // Multi-select array
      if (Array.isArray(filterValue)) {
        return filterValue.map(String).includes(String(cell));
      }

      // Single exact match
      return String(cell) === String(filterValue);
    })
  );
};

export const getUniqueValues = (rows, field) =>
  [...new Set(rows.map((r) => r[field]))]
    .filter((v) => v !== undefined && v !== null && v !== "")
    .sort((a, b) => String(a).localeCompare(String(b)));
