import { useState, useRef, useCallback } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { callAI, AI_ENABLED } from "../../services/aiClient";
import { useTheme } from "../../styles/theme";

/**
 * AI Insights Panel — collapsible panel at the bottom of VisualCard.
 * Sends aggregated chart data to AI, returns 2-3 bullet-point observations.
 * Caches insights per visual config hash to avoid redundant calls.
 */
export default function AIInsightsPanel({ visual, chartData }) {
  const T = useTheme();
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cacheKeyRef = useRef("");

  const cacheKey = JSON.stringify({
    chartType: visual.chartType,
    xFields: visual.xFields,
    yFields: visual.yFields,
    aggregation: visual.aggregation,
    dataLen: chartData?.length,
  });

  const fetchInsights = useCallback(async (force = false) => {
    if (!force && cacheKeyRef.current === cacheKey && insights) return;
    setLoading(true);
    setError("");

    try {
      // Send at most 30 data points to keep payload small
      const trimmedData = (chartData || []).slice(0, 30);

      const result = await callAI({
        task: "insights",
        payload: {
          chartType: visual.chartType,
          xAxis: visual.xFields?.join(", ") || "",
          yAxis: visual.yFields?.join(", ") || "",
          aggregation: visual.aggregation || "sum",
          data: trimmedData,
        },
      });

      setInsights(result);
      cacheKeyRef.current = cacheKey;
    } catch (err) {
      setError(err.message || "Failed to generate insights.");
    } finally {
      setLoading(false);
    }
  }, [cacheKey, chartData, visual, insights]);

  if (!AI_ENABLED) return null;
  if (!chartData?.length) return null;

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && !insights && !loading) {
      fetchInsights();
    }
  };

  return (
    <div
      className="mt-3 rounded-xl border"
      style={{ background: T.s2, borderColor: T.border }}
    >
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-semibold"
        style={{ color: T.text }}
      >
        <span className="flex items-center gap-2">
          <Sparkles size={12} style={{ color: T.accent }} />
          AI Insights
        </span>
        {open ? (
          <ChevronUp size={12} style={{ color: T.dim }} />
        ) : (
          <ChevronDown size={12} style={{ color: T.dim }} />
        )}
      </button>

      {open && (
        <div className="border-t px-4 pb-3 pt-3" style={{ borderColor: T.border }}>
          {loading && (
            <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
              <Loader2 size={12} className="animate-spin" />
              Generating insights...
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
              style={{
                background: "rgba(239,68,68,0.08)",
                borderColor: "rgba(239,68,68,0.25)",
                color: T.error,
              }}
            >
              <AlertCircle size={11} />
              {error}
            </div>
          )}

          {insights && !loading && (
            <div className="space-y-1">
              {insights.split("\n").filter(Boolean).map((line, i) => (
                <p key={i} className="text-xs leading-relaxed" style={{ color: T.dim }}>
                  {line}
                </p>
              ))}
              <button
                onClick={() => fetchInsights(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: T.accent }}
              >
                <RefreshCw size={10} />
                Refresh
              </button>
            </div>
          )}

          {!insights && !loading && !error && (
            <button
              onClick={() => fetchInsights()}
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: T.accent }}
            >
              <Sparkles size={10} />
              Generate insights
            </button>
          )}
        </div>
      )}
    </div>
  );
}
