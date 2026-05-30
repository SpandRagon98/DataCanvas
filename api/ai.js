/**
 * Serverless AI endpoint — Vercel / Netlify compatible.
 *
 * Routes all AI tasks through a single POST endpoint.
 * Reads OPENAI_API_KEY from server-side environment variables.
 *
 * POST /api/ai
 * Body: { task: string, payload: object }
 *
 * task types:
 *   "formula"              – generate calc field formula
 *   "chart_recommendation" – suggest chart config
 *   "insights"             – generate chart insights
 *   "nl_query"             – natural language → visual config
 *   "data_cleaning"        – detect data quality issues
 *   "forecast_explanation" – explain a forecast trend
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || "gpt-4o-mini";
const OPENAI_URL     = "https://api.openai.com/v1/chat/completions";

// ── System prompts per task ──────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  formula: `You are a formula generator for a BI tool. Given column names, data types, and a natural language request, return ONLY a valid arithmetic formula string using [ColumnName] bracket syntax. Use only the provided column names. Return ONLY the formula string, no explanation, no markdown.`,

  chart_recommendation: `You are a chart recommendation engine. Given field names, data types, sample values, and available chart types, return a JSON object with: chartType, xAxis, yAxis, series (or null), aggregation, rationale. Return ONLY valid JSON, no markdown fences.`,

  insights: `You are a data analyst. Given aggregated chart data, return 2-3 short bullet-point observations in plain English. Each bullet starts with *. Be concise and specific with numbers. Return ONLY the bullet points, no other text.`,

  nl_query: `You are a visual configuration generator. Given a natural language question, dataset schema, and supported chart types, return a JSON object with: chartType, xAxis, yAxis, series (or null), filters (array of {field, operator, value}), aggregation, title. Return ONLY valid JSON, no markdown fences.`,

  data_cleaning: `You are a data quality inspector. Given column names, data types, and sample rows, detect data quality issues. Return a JSON array of objects with: issue, severity (low/medium/high), suggestedFix, field, autoFixAvailable (boolean). Return ONLY valid JSON array, no markdown fences.`,

  forecast_explanation: `You are a data analyst. Given a time series trend summary, provide a 1-2 sentence plain English explanation of the forecast. Be specific and concise. Return ONLY the explanation text.`,

  dashboard_generation: `You are an expert BI consultant with deep knowledge of business analytics.
You will receive dataset metadata (column names, data types, cardinality, sample values, row count).
Analyze the business context and generate the most useful executive dashboard possible.

Supported chart types: "line", "bar", "stackedBar", "area", "pie", "donut", "kpi", "scatter", "table", "treemap", "waterfall", "funnel", "gauge".
Supported aggregations: "sum", "avg", "count", "distinctCount", "min", "max".

Rules:
- Revenue/Sales/Amount/Profit/Cost/Margin → measures → KPI cards + trend lines
- Date/Month/Year/Quarter → time dimensions → use for X axis in trend charts
- Region/Country/Category/Brand/Product/Segment → dimensions → use for bar/pie breakdowns
- Generate KPI card for each important measure (max 5)
- Generate a trend chart (line) for each measure × best date column (max 3)
- Generate a bar or pie chart for each key dimension × primary measure (max 4)
- Generate slicers for low-cardinality categorical columns (max 5)
- Choose chart types intelligently: date→line, ≤6 categories→pie, many categories→bar
- Create meaningful, business-friendly titles

Return ONLY a single valid JSON object with this exact structure (no markdown fences, no explanation):
{
  "dashboardTitle": "string",
  "kpis": [
    { "field": "string", "title": "string", "aggregation": "string" }
  ],
  "visuals": [
    { "title": "string", "chartType": "string", "xField": "string", "yField": "string", "aggregation": "string" }
  ],
  "filters": [
    { "column": "string", "label": "string" }
  ]
}`,
};

// ── Build user message per task ──────────────────────────────────────────

function buildUserMessage(task, payload) {
  switch (task) {
    case "formula":
      return `Columns: ${JSON.stringify(payload.columns)}\nData types: ${JSON.stringify(payload.dataTypes)}\nRequest: "${payload.request}"`;

    case "chart_recommendation":
      return `Fields selected: ${JSON.stringify(payload.fields)}\nData types: ${JSON.stringify(payload.dataTypes)}\nSample values: ${JSON.stringify(payload.sampleValues)}\nAvailable chart types: ${JSON.stringify(payload.chartTypes)}`;

    case "insights":
      return `Chart type: ${payload.chartType}\nX axis: ${payload.xAxis}\nY axis: ${payload.yAxis}\nAggregation: ${payload.aggregation}\nData:\n${JSON.stringify(payload.data, null, 1)}`;

    case "nl_query":
      return `Question: "${payload.question}"\nDataset schema: ${JSON.stringify(payload.schema)}\nAvailable chart types: ${JSON.stringify(payload.chartTypes)}`;

    case "data_cleaning":
      return `Columns: ${JSON.stringify(payload.columns)}\nData types: ${JSON.stringify(payload.dataTypes)}\nSample rows (first 50):\n${JSON.stringify(payload.sampleRows, null, 1)}`;

    case "forecast_explanation":
      return `Metric: ${payload.metric}\nTrend: ${payload.trend}\nForecast periods: ${payload.periods}\nLast actual value: ${payload.lastValue}\nForecasted end value: ${payload.forecastedEndValue}`;

    case "dashboard_generation":
      return `Dataset: "${payload.datasetName}" · ${payload.rowCount.toLocaleString()} rows\n\nColumns:\n${payload.columns.map(
        (c) => `  ${c.name} (${c.dataType}, ${c.cardinality} unique) — samples: ${c.sampleValues.slice(0,4).join(", ")}`
      ).join("\n")}\n\nGenerate the best possible executive dashboard for this data.`;

    default:
      return JSON.stringify(payload);
  }
}

// ── Handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not configured on server." });
  }

  const { task, payload } = req.body || {};
  if (!task || !payload) {
    return res.status(400).json({ error: "Missing task or payload." });
  }

  const systemPrompt = SYSTEM_PROMPTS[task];
  if (!systemPrompt) {
    return res.status(400).json({ error: `Unknown task: ${task}` });
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(task, payload) },
        ],
        temperature: 0.3,
        max_tokens: task === "dashboard_generation" ? 2048 : 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI API error:", response.status, err);
      if (response.status === 429) {
        return res.status(429).json({ error: "Rate limit exceeded. Please wait a moment and try again." });
      }
      return res.status(502).json({ error: "AI service temporarily unavailable." });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";

    return res.status(200).json({ result: content });
  } catch (err) {
    console.error("AI endpoint error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
