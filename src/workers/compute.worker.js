/**
 * Compute Web Worker — handles CPU-heavy post-processing off the main thread.
 *
 * Offloads:
 *  - Waterfall data building
 *  - Running totals
 *  - Trendline regression
 *  - Pearson correlation matrix
 *
 * Message protocol:
 *  IN:  { id: number, type: string, payload: object }
 *  OUT: { id: number, ok: true,  result: any }
 *       { id: number, ok: false, error: string }
 */

import { pearsonCorr } from "../utils/chartEngine";
import { applyRunningTotal, buildWaterfallData, getLegendKeys } from "../utils/chartEngine";

// ── Trendline (linear regression) ─────────────────────────────────────────

function computeTrendline(data, yKey) {
  const n = data.length;
  if (n < 2) return data;
  const ys = data.map((d) => Number(d[yKey] || 0));
  const xs = data.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num   = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den   = xs.reduce((s, x)    => s + Math.pow(x - xMean, 2), 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return data.map((d, i) => ({ ...d, _trend: slope * i + intercept }));
}

// ── Message handler ────────────────────────────────────────────────────────

self.onmessage = (e) => {
  const { id, type, payload } = e.data;
  try {
    let result;

    switch (type) {
      // Apply running total to pre-built chart data
      case "RUNNING_TOTAL": {
        const { chartData } = payload;
        const keys = getLegendKeys(chartData);
        result = { chartData: applyRunningTotal(chartData, keys), legendKeys: keys };
        break;
      }

      // Build waterfall data from pre-built chart data
      case "WATERFALL": {
        const { chartData, yKey } = payload;
        result = { waterfallData: buildWaterfallData(chartData, yKey) };
        break;
      }

      // Compute linear trendline overlay
      case "TRENDLINE": {
        const { chartData, yKey } = payload;
        result = { chartData: computeTrendline(chartData, yKey) };
        break;
      }

      // Compute Pearson correlation matrix
      case "CORRELATION": {
        const { rows, yFields } = payload;
        const matrix = yFields.map((fA) => {
          const xsA = rows.map((r) => Number(r[fA])).filter((v) => !isNaN(v));
          return yFields.map((fB) => {
            const xsB = rows.map((r) => Number(r[fB])).filter((v) => !isNaN(v));
            const len = Math.min(xsA.length, xsB.length);
            return pearsonCorr(xsA.slice(0, len), xsB.slice(0, len));
          });
        });
        result = { matrix };
        break;
      }

      default:
        throw new Error(`Unknown compute type: ${type}`);
    }

    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message });
  }
};
