/**
 * forecasting.js — client-side time-series forecasting.
 *
 * Two methods:
 *   1. Linear regression (default)
 *   2. Simple exponential smoothing (SES)
 *
 * No LLM involved. Purely deterministic.
 */

/**
 * Linear regression forecast.
 *
 * @param {number[]} values — ordered numeric values
 * @param {number}   periods — number of future periods
 * @returns {{ forecast: number[], slope: number, intercept: number, r2: number,
 *             upper: number[], lower: number[] }}
 */
export function linearForecast(values, periods = 6) {
  const n = values.length;
  if (n < 2) return { forecast: Array(periods).fill(values[0] ?? 0), slope: 0, intercept: values[0] ?? 0, r2: 0, upper: [], lower: [] };

  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  const num = xs.reduce((s, x, i) => s + (x - xMean) * (values[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + Math.pow(x - xMean, 2), 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  // R-squared
  const ssTot = values.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
  const ssRes = values.reduce((s, y, i) => s + Math.pow(y - (slope * i + intercept), 2), 0);
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  // Residual standard error for confidence band
  const residuals = values.map((y, i) => y - (slope * i + intercept));
  const rse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2));
  const margin = 1.96 * rse; // ~95% confidence

  const forecast = [];
  const upper = [];
  const lower = [];
  for (let i = 0; i < periods; i++) {
    const x = n + i;
    const y = slope * x + intercept;
    forecast.push(Math.round(y * 100) / 100);
    upper.push(Math.round((y + margin) * 100) / 100);
    lower.push(Math.round((y - margin) * 100) / 100);
  }

  return { forecast, slope: Math.round(slope * 100) / 100, intercept: Math.round(intercept * 100) / 100, r2: Math.round(r2 * 1000) / 1000, upper, lower };
}

/**
 * Simple Exponential Smoothing (SES) forecast.
 *
 * @param {number[]} values — ordered numeric values
 * @param {number}   periods — future periods
 * @param {number}   alpha — smoothing factor (0-1, default 0.3)
 * @returns {{ forecast: number[] }}
 */
export function sesForecast(values, periods = 6, alpha = 0.3) {
  const n = values.length;
  if (n === 0) return { forecast: Array(periods).fill(0) };

  let level = values[0];
  for (let i = 1; i < n; i++) {
    level = alpha * values[i] + (1 - alpha) * level;
  }

  // SES forecasts are flat (last smoothed level)
  return { forecast: Array(periods).fill(Math.round(level * 100) / 100) };
}

/**
 * Generate forecast labels for the x-axis.
 * If the last data label looks like a date, increment; otherwise use "F+1", "F+2", etc.
 */
export function generateForecastLabels(lastLabel, periods) {
  // Try date parsing
  const d = new Date(lastLabel);
  if (!isNaN(d.getTime()) && typeof lastLabel === "string" && lastLabel.length >= 8) {
    const labels = [];
    for (let i = 1; i <= periods; i++) {
      const next = new Date(d);
      next.setMonth(next.getMonth() + i); // assume monthly
      labels.push(next.toISOString().slice(0, 10));
    }
    return labels;
  }
  // Fallback: generic labels
  return Array.from({ length: periods }, (_, i) => `F+${i + 1}`);
}

/**
 * Summarize trend direction for AI explanation.
 */
export function summarizeTrend(values) {
  if (values.length < 2) return "insufficient data";
  const first = values[0];
  const last  = values[values.length - 1];
  const diff  = last - first;
  const pct   = first !== 0 ? ((diff / Math.abs(first)) * 100).toFixed(1) : "N/A";
  if (diff > 0) return `upward (+${pct}%)`;
  if (diff < 0) return `downward (${pct}%)`;
  return "flat";
}
