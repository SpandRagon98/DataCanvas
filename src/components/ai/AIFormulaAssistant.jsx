import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { callAI, AI_ENABLED, safeParseJSON } from "../../services/aiClient";
import { useTheme } from "../../styles/theme";

/**
 * AI Formula Assistant — appears inside CalcFieldManager.
 * Takes a natural-language prompt and columns list, calls the backend,
 * and returns a formula string which the parent can insert.
 */
export default function AIFormulaAssistant({ columns, dataTypes, onInsert }) {
  const T = useTheme();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");

  if (!AI_ENABLED) return null;

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setSuggestion("");

    try {
      const result = await callAI({
        task: "formula",
        payload: {
          columns,
          dataTypes,
          request: prompt.trim(),
        },
      });

      const cleaned = result.trim().replace(/^=\s*/, "");
      setSuggestion(cleaned);
    } catch (err) {
      setError(err.message || "Failed to generate formula.");
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (suggestion && onInsert) {
      onInsert(suggestion);
      setSuggestion("");
      setPrompt("");
    }
  };

  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: T.s2, borderColor: T.border }}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
        <Sparkles size={11} style={{ color: T.accent }} />
        AI Formula Assistant
      </div>

      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="e.g. profit margin as percentage"
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: T.surface, borderColor: T.border, color: T.text }}
          disabled={loading}
        />
        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
          style={{
            background: T.accent,
            color: "#000",
            opacity: loading || !prompt.trim() ? 0.6 : 1,
          }}
        >
          {loading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Thinking...
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Generate
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          className="mt-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
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

      {suggestion && (
        <div className="mt-2 space-y-2">
          <div
            className="rounded-lg border px-3 py-2 text-sm mono"
            style={{ background: T.surface, borderColor: T.accent, color: T.text }}
          >
            {suggestion}
          </div>
          <button
            onClick={handleInsert}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{
              background: T.accentDim,
              borderColor: "rgba(245,158,11,0.25)",
              color: T.accent,
              border: "1px solid",
            }}
          >
            Use this formula
          </button>
        </div>
      )}
    </div>
  );
}
