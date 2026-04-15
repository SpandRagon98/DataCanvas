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
          result[measureKey] = aggregateValue(
            legendBucket[yField] || [],
            yField,
            aggregation
          );
        });
      });
    } else {
      yFields.forEach((yField) => {
        result[yField] = aggregateValue(
          groupRow[yField] || [],
          yField,
          aggregation
        );
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
