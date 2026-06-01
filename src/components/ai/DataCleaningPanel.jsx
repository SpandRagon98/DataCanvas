import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { callAI, AI_ENABLED, safeParseJSON } from "../../services/aiClient";
import { useTheme } from "../../styles/theme";

const SEVERITY_STYLES = {
  high: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)", icon: AlertCircle },
  medium: { bg: "rgba(20,184,166,0.10)", border: "rgba(20,184,166,0.25)", icon: AlertTriangle },
  low: { bg: "rgba(96,165,250,0.10)", border: "rgba(96,165,250,0.25)", icon: Info },
};

/**
 * DataCleaningPanel — shown after data import.
 * Scans first 50 rows with AI to detect data quality issues.
 */
export default function DataCleaningPanel({ columns, dataTypes, rows, onClose }) {
  const T = useTheme();
  const [issues, setIssues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (AI_ENABLED && columns?.length && rows?.length) {
      scan();
    }
  }, []);

  const scan = async () => {
    setLoading(true);
    setError("");
    setIssues(null);

    try {
      const sampleRows = rows.slice(0, 50);
      const result = await callAI({
        task: "data_cleaning",
        payload: {
          columns,
          dataTypes,
          sampleRows,
        },
      });

      const parsed = safeParseJSON(result);
      if (!parsed.ok || !Array.isArray(parsed.data)) {
        setError("Could not parse data quality report.");
        return;
      }
      setIssues(parsed.data);
    } catch (err) {
      setError(err.message || "Failed to scan data.");
    } finally {
      setLoading(false);
    }
  };

  if (!AI_ENABLED) return null;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: T.accent }} />
          <span className="text-sm font-semibold" style={{ color: T.text }}>
            AI Data Quality Report
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <button
              onClick={scan}
              className="text-xs font-medium"
              style={{ color: T.accent }}
            >
              Re-scan
            </button>
          )}
          {onClose && (
            <button onClick={onClose} style={{ color: T.muted }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-xs" style={{ color: T.muted }}>
          <Loader2 size={14} className="animate-spin" />
          Scanning data for quality issues...
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

      {issues && !loading && (
        <div className="space-y-2">
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border px-3 py-3 text-sm"
              style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)", color: T.success }}>
              <CheckCircle2 size={14} />
              No data quality issues found. Your data looks clean!
            </div>
          ) : (
            issues.map((issue, i) => {
              const sev = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.low;
              const SevIcon = sev.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl border px-3 py-2.5"
                  style={{ background: sev.bg, borderColor: sev.border }}
                >
                  <div className="flex items-start gap-2">
                    <SevIcon size={13} className="mt-0.5 shrink-0"
                      style={{
                        color: issue.severity === "high" ? T.error
                          : issue.severity === "medium" ? T.accent
                          : T.blue
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: T.text }}>
                          {issue.issue}
                        </span>
                        {issue.field && (
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10px] mono"
                            style={{ background: T.s3, color: T.muted }}
                          >
                            {issue.field}
                          </span>
                        )}
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            background: T.s3,
                            color: issue.severity === "high" ? T.error
                              : issue.severity === "medium" ? T.accent
                              : T.blue
                          }}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      {issue.suggestedFix && (
                        <p className="text-xs" style={{ color: T.dim }}>
                          Fix: {issue.suggestedFix}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
