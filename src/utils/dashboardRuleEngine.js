/**
 * dashboardRuleEngine.js — Zero-LLM dashboard layout generator.
 *
 * Takes a SchemaResult from schemaAnalyzer and produces:
 *   { visuals: VisualConfig[], slicers: SlicerConfig[], layout: LayoutMap }
 *
 * All rules are deterministic and run entirely in the browser.
 * The output uses the same data shapes as the existing dashboard store.
 */

// ── Chart type selector ───────────────────────────────────────────────────────

/**
 * Recommend the best chart type for a given x/y column pair.
 */
export function suggestChartType(xMeta, yMeta) {
  if (!xMeta || !yMeta) return "bar";
  if (xMeta.category === "date")                                 return "line";
  if (xMeta.category === "dimension" && xMeta.cardinality <= 6) return "pie";
  if (xMeta.category === "dimension" && xMeta.cardinality <= 20) return "bar";
  return "bar";
}

/**
 * Recommend aggregation for a measure column name.
 */
function suggestAgg(name) {
  const lower = name.toLowerCase();
  if (/\b(count|orders|transactions|units|qty|quantity)\b/.test(lower)) return "sum";
  if (/\b(rate|ratio|margin|pct|percent|%)\b/.test(lower))              return "avg";
  if (/\b(score|rank|level)\b/.test(lower))                             return "avg";
  return "sum";
}

// ── Layout constants ──────────────────────────────────────────────────────────

const KPI_W = 180, KPI_H = 110;
const KPI_GAP = 16;
const CHART_W = 520, CHART_H = 300;
const CHART_GAP = 16;
const TOP_PAD  = 20;

function kpiLayout(index, total) {
  const totalW = total * KPI_W + (total - 1) * KPI_GAP;
  const startX = 16;
  return { x: startX + index * (KPI_W + KPI_GAP), y: TOP_PAD, w: KPI_W, h: KPI_H, minW: 120, minH: 80 };
}

function chartLayout(index, row) {
  const x   = 16 + (index % 2) * (CHART_W + CHART_GAP);
  const y   = TOP_PAD + (KPI_H + CHART_GAP) + row * (CHART_H + CHART_GAP);
  return { x, y, w: CHART_W, h: CHART_H, minW: 200, minH: 160 };
}

// ── ID generator ──────────────────────────────────────────────────────────────

const uid = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// ── Main rule engine ──────────────────────────────────────────────────────────

/**
 * Generate a full dashboard spec from schema analysis.
 *
 * @param   {SchemaResult} schema
 * @returns {{ visuals, slicers, dashboardName }}
 */
export function generateDashboard(schema) {
  const { measures, dimensions, dates } = schema;

  const visuals  = [];   // VisualConfig items (type: "visual")
  const slicers  = [];   // Slicer config items
  let chartRow   = 0;
  let chartInRow = 0;

  // ── STEP 3: KPI cards (max 5) ──────────────────────────────────────────────
  const kpiMeasures = measures.slice(0, 5);
  kpiMeasures.forEach((m, i) => {
    visuals.push({
      id:         uid("v"),
      type:       "visual",
      visualConfig: {
        id:          uid("vc"),
        title:       `Total ${capitalize(m.name)}`,
        chartType:   "kpi",
        xFields:     [],
        yFields:     [m.name],
        legendField: "",
        tooltipFields: [],
        aggregation: suggestAgg(m.name),
        sortDirection: "desc",
        filters: {},
        referenceLines: [],
        conditionalRules: [],
        colorPalette: "default",
        showGridlines: true,
        showLegend:    true,
        showAxisLabels: true,
      },
      layout: kpiLayout(i, kpiMeasures.length),
    });
  });

  // ── STEP 4: Trend charts (date × measure, max 2) ──────────────────────────
  const bestDate    = dates[0];
  const topMeasures = measures.slice(0, 3);

  if (bestDate) {
    topMeasures.forEach((m) => {
      visuals.push({
        id:   uid("v"),
        type: "visual",
        visualConfig: {
          id:          uid("vc"),
          title:       `${capitalize(m.name)} Over Time`,
          chartType:   "line",
          xFields:     [bestDate.name],
          yFields:     [m.name],
          legendField: "",
          tooltipFields: [],
          aggregation:   suggestAgg(m.name),
          sortDirection: "asc",
          filters: {},
          referenceLines: [],
          conditionalRules: [],
          colorPalette:  "default",
          showGridlines: true,
          showLegend:    true,
          showAxisLabels: true,
          chartStyle: { lineSmooth: true, showMarkers: false, lineWidth: 2, showGridlines: true, showLegend: true },
        },
        layout: chartLayout(chartInRow, chartRow),
      });
      chartInRow++;
      if (chartInRow >= 2) { chartInRow = 0; chartRow++; }
    });
  }

  // ── STEP 4b: Dimension × Measure charts (max 4) ───────────────────────────
  const bestMeasure  = measures[0];
  const topDims      = dimensions.filter((d) => d.cardinality >= 2 && d.cardinality <= 50).slice(0, 4);

  if (bestMeasure) {
    topDims.forEach((dim) => {
      const chartType = suggestChartType(dim, bestMeasure);
      visuals.push({
        id:   uid("v"),
        type: "visual",
        visualConfig: {
          id:          uid("vc"),
          title:       `${capitalize(bestMeasure.name)} by ${capitalize(dim.name)}`,
          chartType,
          xFields:     [dim.name],
          yFields:     [bestMeasure.name],
          legendField: "",
          tooltipFields: [],
          aggregation:   suggestAgg(bestMeasure.name),
          sortDirection: "desc",
          filters: {},
          referenceLines: [],
          conditionalRules: [],
          colorPalette: "default",
          showGridlines: true,
          showLegend:    chartType !== "pie",
          showAxisLabels: true,
        },
        layout: chartLayout(chartInRow, chartRow),
      });
      chartInRow++;
      if (chartInRow >= 2) { chartInRow = 0; chartRow++; }
    });
  }

  // ── STEP 5: Slicers for low-cardinality dimensions ────────────────────────
  const slicerCols = dimensions
    .filter((d) => d.cardinality >= 2 && d.cardinality <= 30)
    .slice(0, 5);

  const slicerStartY = TOP_PAD + KPI_H + KPI_GAP + (chartRow + 1) * (CHART_H + CHART_GAP) + 20;

  slicerCols.forEach((dim, i) => {
    slicers.push({
      id:   uid("slicer"),
      type: "slicer",
      layout: {
        x: 16 + i * (200 + 12),
        y: slicerStartY,
        w: 196, h: 46, minW: 100, minH: 36,
      },
      slicerConfig: {
        column:      dim.name,
        label:       capitalize(dim.name),
        mode:        "dropdown",
        multiSelect: false,
      },
      selectedValues: [],
    });
  });

  // ── Dashboard name ────────────────────────────────────────────────────────
  const dsName = schema.primaryDataset?.name || "Dataset";
  const dashboardName = `AI Dashboard — ${dsName}`;

  return { visuals, slicers, dashboardName };
}

// ── Per-pair chart suggestion (used by Customize mode) ───────────────────────

/**
 * Suggest chart type + aggregation for an explicit x/y field pair from schema metadata.
 */
export function suggestForPair(xMeta, yMeta) {
  if (!xMeta || !yMeta) return { chartType: "bar", aggregation: "sum" };

  let chartType = "bar";
  if (xMeta.category === "date")                                  chartType = "line";
  else if (xMeta.category === "dimension" && xMeta.cardinality <= 5) chartType = "pie";
  else if (xMeta.category === "dimension")                         chartType = "bar";

  return { chartType, aggregation: suggestAgg(yMeta.name) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(str) {
  if (!str) return str;
  return str
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
