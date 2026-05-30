/**
 * schemaAnalyzer.js — Lightweight metadata-driven schema intelligence.
 *
 * Zero LLM calls. Pure keyword + statistical analysis of column names
 * and sample values to classify columns and extract schema metadata.
 *
 * Exports:
 *   analyzeSchema(datasets)   → SchemaResult
 *   getColumnMeta(ds, col)    → ColumnMeta
 *   buildSchemaPayload(result) → minimal JSON for optional LLM calls
 */

// ── Keyword tables ────────────────────────────────────────────────────────────

const MEASURE_KW = new Set([
  "revenue","sales","amount","profit","cost","margin","price","value",
  "count","qty","quantity","total","sum","income","expense","spend",
  "budget","forecast","target","actual","balance","payment","fee",
  "tax","discount","gross","net","units","orders","transaction",
  "clicks","impressions","views","rate","score","points","weight",
  "volume","capacity","size","duration","hours","minutes","km","miles",
]);

const DATE_KW = new Set([
  "date","time","month","year","quarter","week","day","timestamp",
  "created","updated","period","fiscal","datetime","dt","at","on",
]);

const ID_KW = new Set([
  "id","key","code","uuid","guid","_id","num","no","ref","pk","fk","hash",
]);

const DIMENSION_KW = new Set([
  "product","sku","region","country","state","city","category","brand",
  "channel","segment","market","dept","department","customer","user",
  "store","location","area","team","group","type","class","status",
  "source","medium","campaign","label","name","description","title",
  "gender","age","tier","level","plan","model","version","platform",
  "device","browser","os","format","color","size","shape","style",
]);

function matchesAny(colName, kwSet) {
  const lower = colName.toLowerCase().replace(/[_\s-]/g, "");
  for (const kw of kwSet) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

// ── Column metadata ───────────────────────────────────────────────────────────

/**
 * Compute per-column metadata for one dataset.
 * @returns { name, dataType, category, cardinality, sampleValues, uniqueRatio }
 */
export function getColumnMeta(ds, colName) {
  const dataType = ds.dataTypes?.[colName] ?? "string";
  const rows     = ds.rows ?? [];
  const values   = rows.map((r) => r[colName]).filter((v) => v !== null && v !== undefined && v !== "");
  const unique   = new Set(values.map(String));
  const cardinality = unique.size;
  const uniqueRatio = values.length > 0 ? cardinality / values.length : 0;
  const sampleValues = [...unique].slice(0, 6).map(String);

  let category = "unknown";
  const lower  = colName.toLowerCase();

  // Priority order: ID → Date → Measure → Dimension → Boolean → Generic
  if (matchesAny(colName, ID_KW) && dataType !== "date") {
    category = "id";
  } else if (dataType === "date" || matchesAny(colName, DATE_KW)) {
    category = "date";
  } else if (dataType === "boolean") {
    category = "boolean";
  } else if (dataType === "number" && matchesAny(colName, MEASURE_KW)) {
    category = "measure";
  } else if (dataType === "number" && !matchesAny(colName, ID_KW) && uniqueRatio > 0.05) {
    category = "measure";
  } else if (dataType === "string" || dataType === "boolean") {
    category = matchesAny(colName, DIMENSION_KW) ? "dimension" : (cardinality < 50 ? "dimension" : "text");
  } else if (dataType === "number") {
    // Low-cardinality numbers → dimension (year, quarter, etc.)
    category = cardinality < 20 ? "dimension" : "measure";
  }

  return { name: colName, dataType, category, cardinality, sampleValues, uniqueRatio };
}

// ── Full schema analysis ──────────────────────────────────────────────────────

/**
 * Analyze all non-system datasets and return a rich schema description.
 *
 * @param {Array} datasets   — from useStore(s => s.datasets)
 * @returns SchemaResult
 */
export function analyzeSchema(datasets) {
  const nonSystem = (datasets || []).filter((d) => !d.isSystemTable);

  if (!nonSystem.length) {
    return { datasets: [], measures: [], dimensions: [], dates: [], ids: [], booleans: [], rowCount: 0 };
  }

  // Combine metadata across all non-system datasets
  const allMeta = [];
  let totalRows  = 0;

  for (const ds of nonSystem) {
    totalRows += (ds.rows || []).length;
    for (const col of (ds.columns || [])) {
      const meta = getColumnMeta(ds, col);
      allMeta.push({ ...meta, datasetId: ds.id, datasetName: ds.name });
    }
  }

  const measures   = allMeta.filter((m) => m.category === "measure");
  const dimensions = allMeta.filter((m) => m.category === "dimension");
  const dates      = allMeta.filter((m) => m.category === "date");
  const ids        = allMeta.filter((m) => m.category === "id");
  const booleans   = allMeta.filter((m) => m.category === "boolean");

  // Per-dataset summary for node canvas
  const datasetMeta = nonSystem.map((ds) => ({
    id:   ds.id,
    name: ds.name,
    rows: (ds.rows || []).length,
    columns: (ds.columns || []).map((c) => getColumnMeta(ds, c)),
  }));

  return {
    datasets: datasetMeta,
    measures,
    dimensions,
    dates,
    ids,
    booleans,
    rowCount: totalRows,
    primaryDataset: nonSystem[0] || null,
  };
}

// ── Minimal payload for LLM (naming only) ────────────────────────────────────

/**
 * Build a compact schema payload safe to send to the AI for naming/titles only.
 * Never contains actual data rows.
 */
export function buildSchemaPayload(schemaResult) {
  return {
    rowCount:   schemaResult.rowCount,
    measures:   schemaResult.measures.map((m) => ({ name: m.name, type: m.dataType })),
    dimensions: schemaResult.dimensions.map((d) => ({ name: d.name, cardinality: d.cardinality, samples: d.sampleValues.slice(0, 3) })),
    dates:      schemaResult.dates.map((d) => ({ name: d.name })),
  };
}
