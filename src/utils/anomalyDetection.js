/**
 * anomalyDetection.js — client-side Z-score anomaly detection.
 *
 * No LLM involved. Purely deterministic.
 *
 * Usage:
 *   const result = detectAnomalies(data, "Revenue", 3);
 *   // result: [{ index, value, zScore, isAnomaly }]
 */

/**
 * Compute Z-scores and flag anomalies for a numeric series.
 *
 * @param {Object[]} data    — array of chart data points
 * @param {string}   yKey    — key to the numeric field
 * @param {number}   [threshold=3] — Z-score threshold for anomaly
 * @returns {{ points: Array<{index, value, zScore, isAnomaly}>, mean: number, stdDev: number }}
 */
export function detectAnomalies(data, yKey, threshold = 3) {
  if (!data?.length || !yKey) return { points: [], mean: 0, stdDev: 0 };

  const values = data.map((d, i) => ({ index: i, value: Number(d[yKey]) || 0 }));
  const n = values.length;
  if (n < 3) return { points: values.map((v) => ({ ...v, zScore: 0, isAnomaly: false })), mean: 0, stdDev: 0 };

  const mean   = values.reduce((s, v) => s + v.value, 0) / n;
  const variance = values.reduce((s, v) => s + Math.pow(v.value - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return {
      points: values.map((v) => ({ ...v, zScore: 0, isAnomaly: false })),
      mean,
      stdDev: 0,
    };
  }

  const points = values.map((v) => {
    const zScore = (v.value - mean) / stdDev;
    return {
      ...v,
      zScore: Math.round(zScore * 100) / 100,
      isAnomaly: Math.abs(zScore) >= threshold,
    };
  });

  return { points, mean: Math.round(mean * 100) / 100, stdDev: Math.round(stdDev * 100) / 100 };
}

/**
 * Format anomaly tooltip text.
 */
export function anomalyTooltip(zScore, mean) {
  const dir = zScore > 0 ? "above" : "below";
  return `This value is ${Math.abs(zScore).toFixed(1)}σ ${dir} the column mean (${mean.toLocaleString()}).`;
}
