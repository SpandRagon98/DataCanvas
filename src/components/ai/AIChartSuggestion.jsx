import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { callAI, AI_ENABLED, safeParseJSON } from "../../services/aiClient";
import { useTheme } from "../../styles/theme";

const CHART_TYPES = [
  "bar", "hbar", "line", "area", "scatter", "pie", "donut",
  "radar", "treemap", "waterfall", "funnel", "gauge", "kpi",
  "stackedBar", "table", "correlation",
];

/**
 * AI Chart Suggestion — appears in VisualCard after fields are assigned.
 * Sends field info + sample data to AI, gets recommended chart config.
 */
export default function AIChartSuggestion({
  fields,
  dataTypes,
  sampleValues,
  onApply,
}) {
  const T = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState(null);

  if (!AI_ENABLED) return null;

  const suggest = async () => {
    setLoading(true);
    setError("");
    setSuggestion(null);

    try {
      const result = await callAI({
        task: "chart_recommendation",
        payload: {
          fields,
          dataTypes,
          sampleValues,
          chartTypes: CHART_TYPES,
        },
      });

      const parsed = safeParseJSON(result);
      if (!parsed.ok) {
        setError("Could not parse AI response.");
        return;
      }
      setSuggestion(parsed.data);
    } catch (err) {
      setError(err.message || "Failed to get suggestion.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!suggestion || !onApply) return;
    const patch = {};
    if (suggestion.chartType && CHART_TYPES.includes(suggestion.chartType)) {
      patch.chartType = suggestion.chartType;
    }
    if (suggestion.aggregation) patch.aggregation = suggestion.aggregation;
    onApply(patch, suggestion);
    setSuggestion(null);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={suggest}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition"
        style={{
          background: T.accentDim,
          borderColor: "rgba(20,184,166,0.20)",
          color: T.accent,
          opacity: loading ? 0.6 : 1,
        }}
        title="AI suggests the best chart type for your data"
      >
        {loading ? (
          <>
            <Loader2 size={11} className="animate-spin" />
            Thinking...
          </>
        ) : (
          <>
            <Sparkles size={11} />
            Suggest Chart
          </>
        )}
      </button>

      {error && (
        <span className="flex items-center gap-1 text-xs" style={{ color: T.error }}>
          <AlertCircle size={10} />
          {error}
        </span>
      )}

      {suggestion && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: T.dim }}>
            Suggested: <strong style={{ color: T.text }}>{suggestion.chartType}</strong>
            {suggestion.rationale && (
              <span style={{ color: T.muted }}> — {suggestion.rationale}</span>
            )}
          </span>
          <button
            onClick={handleApply}
            className="rounded-lg border px-2 py-1 text-xs font-semibold"
            style={{
              background: T.accent,
              color: "#000",
              border: "none",
            }}
          >
            Apply
          </button>
          <button
            onClick={() => setSuggestion(null)}
            className="text-xs"
            style={{ color: T.muted }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
