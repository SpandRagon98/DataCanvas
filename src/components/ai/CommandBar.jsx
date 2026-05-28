import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Sparkles, Loader2, X, AlertCircle } from "lucide-react";
import { callAI, AI_ENABLED, safeParseJSON } from "../../services/aiClient";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

const CHART_TYPES = [
  "bar", "hbar", "line", "area", "scatter", "pie", "donut",
  "radar", "treemap", "waterfall", "funnel", "gauge", "kpi",
  "stackedBar", "table", "correlation",
];

/**
 * CommandBar — global Cmd+K natural language query bar.
 * User types a question, AI returns chart configuration JSON,
 * and we create a new visual with that configuration.
 */
export default function CommandBar() {
  const T = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const columns = useStore((s) => s.columns);
  const dataTypes = useStore((s) => s.dataTypes);
  const addVisual = useStore((s) => s.addVisual);
  const updateVisual = useStore((s) => s.updateVisual);
  const visuals = useStore((s) => s.visuals);
  const assignFieldToVisual = useStore((s) => s.assignFieldToVisual);

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setError("");
      setResult(null);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const schema = columns.map((col) => ({
        name: col,
        type: dataTypes[col] || "string",
      }));

      const response = await callAI({
        task: "nl_query",
        payload: {
          question: query.trim(),
          schema,
          chartTypes: CHART_TYPES,
        },
      });

      const parsed = safeParseJSON(response);
      if (!parsed.ok) {
        setError("Could not parse AI response.");
        return;
      }

      setResult(parsed.data);
    } catch (err) {
      setError(err.message || "Failed to process query.");
    } finally {
      setLoading(false);
    }
  }, [query, loading, columns, dataTypes]);

  const applyResult = useCallback(() => {
    if (!result) return;

    // Create new visual
    addVisual();
    // Get the newly added visual (last one)
    const newVisuals = useStore.getState().visuals;
    const newVisual = newVisuals[newVisuals.length - 1];
    if (!newVisual) return;

    const patch = {};
    if (result.chartType && CHART_TYPES.includes(result.chartType)) {
      patch.chartType = result.chartType;
    }
    if (result.aggregation) patch.aggregation = result.aggregation;
    if (result.title) patch.title = result.title;

    updateVisual(newVisual.id, patch);

    // Assign fields
    if (result.xAxis) {
      const xField = columns.find((c) => c === result.xAxis);
      if (xField) assignFieldToVisual({ visualId: newVisual.id, zone: "xFields", field: xField });
    }
    if (result.yAxis) {
      const yField = columns.find((c) => c === result.yAxis);
      if (yField) assignFieldToVisual({ visualId: newVisual.id, zone: "yFields", field: yField });
    }
    if (result.series) {
      const sField = columns.find((c) => c === result.series);
      if (sField) assignFieldToVisual({ visualId: newVisual.id, zone: "legendField", field: sField });
    }

    setOpen(false);
  }, [result, addVisual, updateVisual, columns, assignFieldToVisual]);

  if (!AI_ENABLED) return null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl"
        style={{
          background: T.surface,
          borderColor: T.border,
          boxShadow: T.shadowXl,
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: T.border }}>
          {loading ? (
            <Loader2 size={16} className="animate-spin shrink-0" style={{ color: T.accent }} />
          ) : (
            <Search size={16} className="shrink-0" style={{ color: T.muted }} />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Ask a question about your data..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: T.text }}
            disabled={loading}
          />
          <div className="flex items-center gap-2">
            <kbd
              className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.muted }}
            >
              ESC
            </kbd>
            <button onClick={() => setOpen(false)} style={{ color: T.muted }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Results area */}
        <div className="px-4 py-3" style={{ minHeight: 60 }}>
          {!result && !error && !loading && (
            <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
              <Sparkles size={11} style={{ color: T.accent }} />
              <span>
                Try: "Show revenue by month as a line chart" or "Compare sales across regions"
              </span>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}>
              <Loader2 size={12} className="animate-spin" />
              Analyzing your question...
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"
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

          {result && (
            <div className="space-y-3">
              <div className="rounded-xl border p-3" style={{ background: T.s2, borderColor: T.border }}>
                <div className="text-xs font-semibold mb-2" style={{ color: T.text }}>
                  {result.title || "AI Suggestion"}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: T.dim }}>
                  <div>Chart: <strong style={{ color: T.text }}>{result.chartType}</strong></div>
                  {result.xAxis && <div>X: <strong style={{ color: T.text }}>{result.xAxis}</strong></div>}
                  {result.yAxis && <div>Y: <strong style={{ color: T.text }}>{result.yAxis}</strong></div>}
                  {result.aggregation && <div>Agg: <strong style={{ color: T.text }}>{result.aggregation}</strong></div>}
                  {result.series && <div>Series: <strong style={{ color: T.text }}>{result.series}</strong></div>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={applyResult}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                  style={{ background: T.accent, color: "#000" }}
                >
                  <Sparkles size={11} />
                  Create Visual
                </button>
                <button
                  onClick={() => { setResult(null); setQuery(""); inputRef.current?.focus(); }}
                  className="text-xs"
                  style={{ color: T.muted }}
                >
                  Try another
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t px-4 py-2 text-[10px]"
          style={{ borderColor: T.border, color: T.muted }}
        >
          <span>Powered by AI</span>
          <span>
            <kbd className="rounded border px-1 py-0.5" style={{ background: T.s2, borderColor: T.border }}>
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+K
            </kbd>
            {" "}to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
