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

export const applyGlobalFilters = (rows, filters) => {
  if (!rows?.length) return [];
  if (!filters || Object.keys(filters).length === 0) return rows;

  return rows.filter((row) =>
    Object.entries(filters).every(([field, filterValue]) => {
      if (
        filterValue === undefined ||
        filterValue === null ||
        filterValue === "" ||
        (Array.isArray(filterValue) && filterValue.length === 0)
      ) {
        return true;
      }
      const cell = row[field];
      if (isRelativeDateFilter(filterValue)) return matchesRelativeDate(cell, filterValue);
      if (Array.isArray(filterValue)) return filterValue.includes(cell);
      return String(cell) === String(filterValue);
    })
  );
};

export const getUniqueValues = (rows, field) =>
  [...new Set(rows.map((r) => r[field]))]
    .filter((v) => v !== undefined && v !== null && v !== "")
    .sort((a, b) => String(a).localeCompare(String(b)));
