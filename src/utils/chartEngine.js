import { evaluateMeasure } from "./dax";

/**
 * Find a measure by name in a measures array.
 * Returns null if none matches.
 */
export const findMeasure = (measures, name) => {
  if (!measures?.length) return null;
  return measures.find((m) => m.name === name) ?? null;
};

export const aggregateValue = (rows, field, aggregation) => {
  const numeric = rows
    .map((r) => Number(r[field]))
    .filter((v) => !isNaN(v));

  switch (aggregation) {
    case "sum":
      return numeric.reduce((a, b) => a + b, 0);
    case "avg":
      return numeric.length
        ? numeric.reduce((a, b) => a + b, 0) / numeric.length
        : 0;
    case "count":
      return rows.length;
    case "distinctCount":
      return new Set(rows.map((r) => r[field])).size;
    case "min":
      return numeric.length ? Math.min(...numeric) : 0;
    case "max":
      return numeric.length ? Math.max(...numeric) : 0;
    case "median": {
      if (!numeric.length) return 0;
      const sorted = [...numeric].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case "stddev": {
      if (!numeric.length) return 0;
      const mean = numeric.reduce((a, b) => a + b, 0) / numeric.length;
      const variance =
        numeric.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
        numeric.length;
      return Math.sqrt(variance);
    }
    default:
      return numeric.reduce((a, b) => a + b, 0);
  }
};

const makeCompositeX = (row, xFields) => {
  return xFields.map((field) => row[field] ?? "(Blank)").join(" / ");
};

export const buildVisualData = ({
  rows,
  xFields,
  yFields,
  legendField,
  aggregation = "sum",
  sortDirection = "asc",
  measures = [],
  fullRows = null,
}) => {
  if (!rows?.length) return [];
  if (!xFields?.length || !yFields?.length) return [];

  const grouped = {};

  for (const row of rows) {
    const xKey = makeCompositeX(row, xFields);
    const legendKey = legendField ? row[legendField] ?? "(Blank)" : null;

    if (!grouped[xKey]) grouped[xKey] = { x: xKey };

    if (legendField) {
      if (!grouped[xKey][legendKey]) grouped[xKey][legendKey] = {};
      yFields.forEach((yField) => {
        if (!grouped[xKey][legendKey][yField]) {
          grouped[xKey][legendKey][yField] = [];
        }
        grouped[xKey][legendKey][yField].push(row);
      });
    } else {
      yFields.forEach((yField) => {
        if (!grouped[xKey][yField]) grouped[xKey][yField] = [];
        grouped[xKey][yField].push(row);
      });
    }
  }

  let output = Object.values(grouped).map((groupRow) => {
    const result = { x: groupRow.x };

    if (legendField) {
      Object.keys(groupRow).forEach((key) => {
        if (key === "x") return;

        const legendBucket = groupRow[key];
        yFields.forEach((yField) => {
          const measureKey = `${key} | ${yField}`;
          const measure = findMeasure(measures, yField);
          if (measure) {
            const { value } = evaluateMeasure(measure, {
              rows: legendBucket[yField] || [],
              fullRows: fullRows ?? rows,
              measures,
            });
            result[measureKey] = typeof value === "number" ? value : 0;
          } else {
            result[measureKey] = aggregateValue(
              legendBucket[yField] || [],
              yField,
              aggregation
            );
          }
        });
      });
    } else {
      yFields.forEach((yField) => {
        const measure = findMeasure(measures, yField);
        if (measure) {
          const { value } = evaluateMeasure(measure, {
            rows: groupRow[yField] || [],
            fullRows: fullRows ?? rows,
            measures,
          });
          result[yField] = typeof value === "number" ? value : 0;
        } else {
          result[yField] = aggregateValue(
            groupRow[yField] || [],
            yField,
            aggregation
          );
        }
      });
    }

    return result;
  });

  output.sort((a, b) =>
    sortDirection === "asc"
      ? String(a.x).localeCompare(String(b.x))
      : String(b.x).localeCompare(String(a.x))
  );

  return output;
};

export const getLegendKeys = (data) => {
  if (!data?.length) return [];
  return Object.keys(data[0]).filter((k) => k !== "x");
};

/** Apply running total across all measure keys (mutates values cumulatively) */
export const applyRunningTotal = (data, keys) => {
  const running = {};
  return data.map((row) => {
    const newRow = { ...row };
    keys.forEach((k) => {
      running[k] = (running[k] || 0) + Number(row[k] || 0);
      newRow[k] = running[k];
    });
    return newRow;
  });
};

/** Build stacked-bar data for a waterfall chart from chartData and one yField */
export const buildWaterfallData = (data, yKey) => {
  let running = 0;
  return data.map((row) => {
    const val = Number(row[yKey] || 0);
    const base = val >= 0 ? running : running + val;
    running += val;
    return {
      x: row.x,
      _phantom: base,
      _value: Math.abs(val),
      _positive: val >= 0,
      _total: running,
      _origVal: val,
    };
  });
};

/** Compute Pearson correlation coefficient between two numeric arrays */
export const pearsonCorr = (xs, ys) => {
  const n = xs.length;
  if (!n) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const sx = Math.sqrt(xs.reduce((s, x) => s + Math.pow(x - mx, 2), 0));
  const sy = Math.sqrt(ys.reduce((s, y) => s + Math.pow(y - my, 2), 0));
  return sx * sy === 0 ? 0 : cov / (sx * sy);
};
