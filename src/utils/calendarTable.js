/**
 * calendarTable.js — Power BI-style auto Calendar (date dimension) generator.
 *
 * Exports:
 *   generateCalendarTable(startDate, endDate) → row[]
 *   detectDateColumns(datasets)               → [{datasetId, columnName}]
 *   getCalendarRangeFromDatasets(datasets)    → {start: Date, end: Date}
 *   ensureCalendarTable(datasets, rels)       → {datasets, relationships}
 *   CALENDAR_DATASET_ID                       string constant
 */

export const CALENDAR_DATASET_ID = "system-calendar-v1";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const DAY_NAMES  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/** Normalise any date-like value to "YYYY-MM-DD". */
function toDateOnly(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

/**
 * Generate one row per calendar day between startDate and endDate (inclusive).
 *
 * Each row contains:
 *   Date, Year, Month Number, Month Name, Month Short, Month Year,
 *   Month Year Sort, Quarter, Quarter Name, Year Quarter,
 *   Week Number, Day, Day Name, Day Short, Day of Week,
 *   Start of Month, End of Month, Is Weekend
 */
export function generateCalendarTable(startDate, endDate) {
  const rows  = [];
  const start = new Date(startDate);
  const end   = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const cur = new Date(start);
  while (cur <= end) {
    const y   = cur.getFullYear();
    const m   = cur.getMonth();    // 0-based
    const d   = cur.getDate();
    const dow = cur.getDay();      // 0 = Sunday

    // ISO-like week number (1-based)
    const jan1   = new Date(y, 0, 1);
    const weekNo = Math.ceil(((cur - jan1) / 86400000 + jan1.getDay() + 1) / 7);

    const q             = Math.floor(m / 3) + 1;
    const monthYearSort = y * 100 + (m + 1);          // e.g. 202601

    const som = new Date(y, m, 1);
    const eom = new Date(y, m + 1, 0);

    rows.push({
      "Date":             toDateOnly(cur),
      "Year":             y,
      "Month Number":     m + 1,
      "Month Name":       MONTH_NAMES[m],
      "Month Short":      MONTH_SHORT[m],
      "Month Year":       `${MONTH_SHORT[m]} ${y}`,
      "Month Year Sort":  monthYearSort,
      "Quarter":          q,
      "Quarter Name":     `Q${q}`,
      "Year Quarter":     `${y} Q${q}`,
      "Week Number":      weekNo,
      "Day":              d,
      "Day Name":         DAY_NAMES[dow],
      "Day Short":        DAY_SHORT[dow],
      "Day of Week":      dow,
      "Start of Month":   toDateOnly(som),
      "End of Month":     toDateOnly(eom),
      "Is Weekend":       dow === 0 || dow === 6,
    });

    cur.setDate(cur.getDate() + 1);
  }
  return rows;
}

/** Return [{datasetId, columnName}] for every date column in non-system datasets. */
export function detectDateColumns(datasets) {
  const result = [];
  for (const ds of datasets) {
    if (ds.isSystemTable) continue;
    for (const col of ds.columns ?? []) {
      if ((ds.dataTypes?.[col] ?? "string") === "date") {
        result.push({ datasetId: ds.id, columnName: col });
      }
    }
  }
  return result;
}

/**
 * Scan all date columns across non-system datasets and compute:
 *   start = Jan 1 of min-date year
 *   end   = Dec 31 of max-date year
 *
 * Falls back to (currentYear - 5) … (currentYear + 2) when no dates are found.
 */
export function getCalendarRangeFromDatasets(datasets) {
  const now = new Date();
  const fallbackStart = new Date(now.getFullYear() - 5, 0, 1);
  const fallbackEnd   = new Date(now.getFullYear() + 2, 11, 31);

  const dateCols = detectDateColumns(datasets);
  if (!dateCols.length) return { start: fallbackStart, end: fallbackEnd };

  let minDate = null;
  let maxDate = null;

  for (const { datasetId, columnName } of dateCols) {
    const ds = datasets.find((d) => d.id === datasetId);
    if (!ds) continue;
    for (const row of ds.rows ?? []) {
      const raw = row[columnName];
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
  }

  if (!minDate) return { start: fallbackStart, end: fallbackEnd };

  return {
    start: new Date(minDate.getFullYear(), 0, 1),
    end:   new Date(maxDate.getFullYear(), 11, 31),
  };
}

/** Column data-types for the Calendar table. */
const CALENDAR_TYPES = {
  "Date":             "date",
  "Year":             "number",
  "Month Number":     "number",
  "Month Name":       "string",
  "Month Short":      "string",
  "Month Year":       "string",
  "Month Year Sort":  "number",
  "Quarter":          "number",
  "Quarter Name":     "string",
  "Year Quarter":     "string",
  "Week Number":      "number",
  "Day":              "number",
  "Day Name":         "string",
  "Day Short":        "string",
  "Day of Week":      "number",
  "Start of Month":   "date",
  "End of Month":     "date",
  "Is Weekend":       "boolean",
};

/**
 * Ensure a Calendar system table exists in `datasets` and that
 * date-column → Calendar[Date] relationships exist in `relationships`.
 *
 * - Rebuilds the Calendar date range from the current non-system datasets.
 * - Removes the old Calendar dataset (if present) and adds the new one.
 * - Adds auto-relationships for every detected date column; preserves all
 *   user-defined (non-system) relationships.
 *
 * Returns { datasets, relationships }.
 */
export function ensureCalendarTable(datasets = [], relationships = []) {
  // Work with non-Calendar datasets only when computing the range
  const nonCalendar = datasets.filter((d) => d.id !== CALENDAR_DATASET_ID);

  const { start, end } = getCalendarRangeFromDatasets(nonCalendar);
  const rows           = generateCalendarTable(start, end);
  const columns        = Object.keys(CALENDAR_TYPES);

  const calendarDataset = {
    id:            CALENDAR_DATASET_ID,
    name:          "Calendar",
    rows,
    columns,
    dataTypes:     { ...CALENDAR_TYPES },
    sourceType:    "system",
    sourceConfig:  {},
    isSystemTable: true,
  };

  const updatedDatasets = [...nonCalendar, calendarDataset];

  // Keep only user-defined (non-system) relationships; auto ones will be rebuilt
  const userRels = relationships.filter((r) => !r.isSystemRel);

  const dateCols     = detectDateColumns(nonCalendar);
  const autoRels     = dateCols.map(({ datasetId, columnName }) => ({
    id:           `auto_cal_${datasetId}_${columnName}`,
    fromDataset:  datasetId,
    fromColumn:   columnName,
    toDataset:    CALENDAR_DATASET_ID,
    toColumn:     "Date",
    cardinality:  "many-to-one",
    direction:    "single",
    active:       true,
    isSystemRel:  true,
  }));

  return {
    datasets:      updatedDatasets,
    relationships: [...userRels, ...autoRels],
  };
}
