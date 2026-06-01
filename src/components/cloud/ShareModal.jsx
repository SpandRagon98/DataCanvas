import { useState } from "react";
import { Link2, Copy, Check, X, Clock, Globe } from "lucide-react";
import { createShareLink, CLOUD_ENABLED } from "../../lib/supabase";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

export default function ShareModal({ open, onClose }) {
  const T = useTheme();
  const workbookId = useStore((s) => s.cloudWorkbookId);
  const dashboards = useStore((s) => s.dashboards);
  const activeDashboardId = useStore((s) => s.activeDashboardId);

  const [dashId,   setDashId]   = useState(activeDashboardId ?? dashboards[0]?.id ?? "");
  const [expiry,   setExpiry]   = useState("never");
  const [link,     setLink]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!CLOUD_ENABLED) return;
    setLoading(true);
    const expiresInDays = expiry === "7" ? 7 : expiry === "30" ? 30 : null;
    const sl = await createShareLink({ workbookId, dashboardId: dashId, expiresInDays });
    if (sl) {
      const url = `${window.location.origin}${window.location.pathname}#/share/${sl.token}`;
      setLink(url);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in w-full max-w-md rounded-xl border p-5"
        style={{ background: T.surface, borderColor: T.border, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <Globe size={14} color={T.accent} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: T.text }}>Share Dashboard</div>
              <div className="text-[11px]" style={{ color: T.dim }}>Generate a read-only public link</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
            <X size={13} />
          </button>
        </div>

        {!CLOUD_ENABLED && (
          <div className="rounded-xl border px-3 py-3 text-xs" style={{ background: "rgba(var(--dc-accent-rgb),0.08)", borderColor: "rgba(var(--dc-accent-rgb),0.22)", color: T.accent }}>
            Cloud not configured. Add <span className="mono">VITE_SUPABASE_URL</span> and <span className="mono">VITE_SUPABASE_ANON_KEY</span> to your <span className="mono">.env</span> to enable sharing.
          </div>
        )}

        {CLOUD_ENABLED && (
          <div className="space-y-3">
            {/* Dashboard selector */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>Dashboard</label>
              <select
                value={dashId}
                onChange={(e) => setDashId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Expiry */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>
                <Clock size={10} className="inline mr-1" />Link expiry
              </label>
              <div className="flex gap-2">
                {[["never","Never"],["7","7 days"],["30","30 days"]].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setExpiry(v)}
                    className="flex-1 rounded-xl border py-1.5 text-xs font-medium"
                    style={{
                      background: expiry === v ? T.accentDim : T.s2,
                      borderColor: expiry === v ? "rgba(var(--dc-accent-rgb),0.28)" : T.border,
                      color: expiry === v ? T.accent : T.dim,
                    }}
                  >{l}</button>
                ))}
              </div>
            </div>

            {!workbookId && (
              <div className="rounded-xl border px-3 py-2 text-xs" style={{ background: "rgba(var(--dc-accent-rgb),0.08)", borderColor: "rgba(var(--dc-accent-rgb),0.22)", color: T.accent }}>
                Save your workbook to the cloud first before sharing.
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !workbookId}
              className="w-full rounded-xl py-2 text-sm font-semibold"
              style={{ background: T.accent, color: "#000", opacity: (!workbookId || loading) ? 0.6 : 1 }}
            >
              {loading ? "Generating…" : "Generate Link"}
            </button>

            {link && (
              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-2"
                  style={{ background: T.s2, borderColor: T.border }}
                >
                  <Link2 size={12} style={{ color: T.muted, flexShrink: 0 }} />
                  <span className="flex-1 truncate text-xs mono" style={{ color: T.text }}>{link}</span>
                  <button
                    onClick={handleCopy}
                    className="rounded-lg border px-2 py-1 text-[11px] font-medium"
                    style={{ background: copied ? T.accentDim : T.surface, borderColor: T.border, color: copied ? T.accent : T.dim }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: T.muted }}>
                  Anyone with this link can view the dashboard (read-only).
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
