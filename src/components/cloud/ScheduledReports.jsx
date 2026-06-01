import { useEffect, useState } from "react";
import {
  CalendarClock, X, Plus, Trash2, Mail, ToggleLeft,
  ToggleRight, ChevronDown, Clock, Repeat,
} from "lucide-react";
import {
  CLOUD_ENABLED, getScheduledReports, upsertScheduledReport, deleteScheduledReport,
} from "../../lib/supabase";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

const FREQ_OPTIONS = [
  { value: "daily",   label: "Daily",   desc: "Every day at the configured time" },
  { value: "weekly",  label: "Weekly",  desc: "Every Monday at the configured time" },
  { value: "monthly", label: "Monthly", desc: "1st of every month at the configured time" },
];

function FreqBadge({ freq }) {
  const colors = {
    daily:   { bg: "rgba(96,165,250,0.12)",  color: "#60a5fa" },
    weekly:  { bg: "rgba(167,139,250,0.12)", color: "#a78bfa" },
    monthly: { bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  };
  const c = colors[freq] ?? colors.daily;
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold capitalize"
      style={c}
    >
      {freq}
    </span>
  );
}

function ReportRow({ report, dashboards, onToggle, onDelete, T }) {
  const dash = dashboards.find((d) => d.id === report.dashboard_id);
  const enabled = report.enabled !== false;

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
      style={{ background: T.s2, borderColor: T.border }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: enabled ? T.accentDim : T.s3 }}
      >
        <CalendarClock size={13} color={enabled ? T.accent : T.muted} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold truncate" style={{ color: T.text }}>
            {dash?.name ?? "Unknown Dashboard"}
          </span>
          <FreqBadge freq={report.frequency} />
          {!enabled && (
            <span className="rounded px-1.5 py-0.5 text-[9.5px] font-medium" style={{ background: T.s3, color: T.muted }}>
              Paused
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="text-[10.5px]" style={{ color: T.muted }}>
            <Mail size={9} className="inline mr-0.5" />
            {(report.recipients ?? []).join(", ") || "No recipients"}
          </span>
          {report.last_run && (
            <>
              <span style={{ color: T.border }}>·</span>
              <span className="text-[10.5px]" style={{ color: T.muted }}>
                Last: {new Date(report.last_run).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggle(report)}
          className="rounded-lg p-1.5"
          style={{ color: enabled ? T.accent : T.muted }}
          title={enabled ? "Pause" : "Resume"}
        >
          {enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
        <button
          onClick={() => onDelete(report.id)}
          className="rounded-lg p-1.5"
          style={{ color: T.muted }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function ScheduledReports({ open, onClose, user }) {
  const T            = useTheme();
  const dashboards   = useStore((s) => s.dashboards);
  const workbookId   = useStore((s) => s.cloudWorkbookId);

  const [reports,    setReports]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [creating,   setCreating]   = useState(false);

  // Form state
  const [dashId,     setDashId]     = useState(dashboards[0]?.id ?? "");
  const [freq,       setFreq]       = useState("weekly");
  const [recipients, setRecipients] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState("");

  useEffect(() => {
    if (!open || !workbookId || !CLOUD_ENABLED) return;
    setLoading(true);
    getScheduledReports(workbookId).then((data) => {
      setReports(data ?? []);
      setLoading(false);
    });
  }, [open, workbookId]);

  if (!open) return null;

  const handleCreate = async () => {
    if (!dashId || !recipients.trim() || !CLOUD_ENABLED) return;
    const emails = recipients.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    if (!emails.length) return;
    setSaving(true);
    const report = await upsertScheduledReport(workbookId, {
      dashboard_id: dashId,
      frequency: freq,
      recipients: emails,
      enabled: true,
    });
    if (report) {
      setReports((prev) => [report, ...prev]);
      setRecipients("");
      setCreating(false);
      setMsg("Report scheduled!");
    } else {
      setMsg("Failed to schedule. Try again.");
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const handleToggle = async (report) => {
    if (!CLOUD_ENABLED) return;
    const updated = await upsertScheduledReport(workbookId, {
      ...report,
      enabled: !report.enabled,
    });
    if (updated) {
      setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    }
  };

  const handleDelete = async (id) => {
    if (!CLOUD_ENABLED) return;
    await deleteScheduledReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in w-full max-w-lg rounded-xl border flex flex-col"
        style={{
          background: T.surface,
          borderColor: T.border,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <CalendarClock size={14} color={T.accent} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: T.text }}>Scheduled Reports</div>
              <div className="text-[11px]" style={{ color: T.dim }}>
                Email dashboards automatically on a schedule
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {!CLOUD_ENABLED && (
            <div className="rounded-lg border p-3 text-xs" style={{ background: "rgba(var(--dc-accent-rgb),0.07)", borderColor: "rgba(var(--dc-accent-rgb),0.2)", color: T.accent }}>
              Cloud not configured. Scheduled reports require Supabase + Resend API.
            </div>
          )}

          {!workbookId && CLOUD_ENABLED && (
            <div className="rounded-lg border p-3 text-xs" style={{ background: "rgba(var(--dc-accent-rgb),0.07)", borderColor: "rgba(var(--dc-accent-rgb),0.2)", color: T.accent }}>
              Save your workbook to the cloud first before scheduling reports.
            </div>
          )}

          {/* Existing reports */}
          {loading ? (
            <div className="text-xs text-center py-6" style={{ color: T.muted }}>Loading…</div>
          ) : (
            <div className="space-y-2">
              {reports.length === 0 && !creating && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <CalendarClock size={28} style={{ color: T.border }} />
                  <div className="text-xs" style={{ color: T.muted }}>No scheduled reports yet</div>
                </div>
              )}
              {reports.map((r) => (
                <ReportRow
                  key={r.id}
                  report={r}
                  dashboards={dashboards}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  T={T}
                />
              ))}
            </div>
          )}

          {/* Create form */}
          {creating && CLOUD_ENABLED && workbookId && (
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{ background: T.s2, borderColor: T.border }}
            >
              <div className="text-xs font-semibold" style={{ color: T.text }}>New Scheduled Report</div>

              {/* Dashboard */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>Dashboard</label>
                <select
                  value={dashId}
                  onChange={(e) => setDashId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                >
                  {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: T.dim }}>
                  <Repeat size={10} className="inline mr-1" />Frequency
                </label>
                <div className="flex gap-2">
                  {FREQ_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setFreq(value)}
                      className="flex-1 rounded-lg border py-1.5 text-xs font-medium"
                      style={{
                        background: freq === value ? T.accentDim : T.surface,
                        borderColor: freq === value ? "rgba(var(--dc-accent-rgb),0.3)" : T.border,
                        color: freq === value ? T.accent : T.dim,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>
                  <Mail size={10} className="inline mr-1" />Recipients (comma-separated)
                </label>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="alice@example.com, bob@example.com"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              {msg && (
                <div
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{
                    background: msg.startsWith("Failed") ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                    borderColor: msg.startsWith("Failed") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                    color: msg.startsWith("Failed") ? "#ef4444" : "#10b981",
                  }}
                >
                  {msg}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setCreating(false); setRecipients(""); setMsg(""); }}
                  className="flex-1 rounded-lg border py-2 text-xs font-medium"
                  style={{ background: T.surface, borderColor: T.border, color: T.dim }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!recipients.trim() || saving}
                  className="flex-1 rounded-lg py-2 text-xs font-semibold"
                  style={{ background: T.accent, color: "#000", opacity: (!recipients.trim() || saving) ? 0.5 : 1 }}
                >
                  {saving ? "Scheduling…" : "Schedule Report"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {CLOUD_ENABLED && workbookId && !creating && (
          <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: T.border }}>
            <button
              onClick={() => setCreating(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold"
              style={{ background: T.accent, color: "#000" }}
            >
              <Plus size={14} />
              New Scheduled Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
