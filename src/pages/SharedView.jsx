import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { getSharedLink } from "../lib/supabase";
import { applyGlobalFilters } from "../utils/filterEngine";
import VisualRenderer from "../components/builder/VisualRenderer";
import Logo from "../components/Logo";
import { useTheme } from "../styles/theme";

export default function SharedView() {
  const { token } = useParams();
  const T = useTheme();
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [link,    setLink]    = useState(null);

  useEffect(() => {
    if (!token) { setError("Invalid link."); setLoading(false); return; }
    getSharedLink(token).then((data) => {
      if (!data) setError("This link is expired or doesn't exist.");
      else setLink(data);
      setLoading(false);
    });
  }, [token]);

  const dashboard = useMemo(() => {
    if (!link?.workbooks?.data) return null;
    const wb = link.workbooks.data;
    return (wb.dashboards ?? []).find((d) => d.id === link.dashboard_id) ?? null;
  }, [link]);

  const rows = useMemo(() => {
    if (!link?.workbooks?.data) return [];
    return link.workbooks.data.rawData ?? [];
  }, [link]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: T.bg }}>
      <div className="text-sm" style={{ color: T.dim }}>Loading shared dashboard…</div>
    </div>
  );

  if (error || !dashboard) return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 p-8" style={{ background: T.bg }}>
      <AlertTriangle size={36} style={{ color: T.accent }} />
      <div className="text-base font-semibold" style={{ color: T.text }}>{error || "Dashboard not found"}</div>
      <a href="/" className="text-sm underline" style={{ color: T.accent }}>Go to Vizora</a>
    </div>
  );

  const canvasMinHeight = dashboard.items?.length
    ? Math.max(560, ...dashboard.items.map((i) => (i.layout?.y || 0) + (i.layout?.h || 300) + 24))
    : 560;

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden"
            style={{ background: "rgba(20,184,166,0.10)" }}
          >
            <Logo size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: T.text }}>{dashboard.name}</div>
            <div className="text-[11px]" style={{ color: T.muted }}>Read-only shared view</div>
          </div>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium"
          style={{ background: T.s2, borderColor: T.border, color: T.dim }}
        >
          <ExternalLink size={11} /> Open Vizora
        </a>
      </div>

      {/* Canvas */}
      <div className="relative mx-auto max-w-7xl p-6" style={{ minHeight: canvasMinHeight }}>
        {dashboard.items.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm" style={{ color: T.dim }}>
            No visuals on this dashboard
          </div>
        ) : (
          dashboard.items.map((item) => (
            <div
              key={item.id}
              className="absolute rounded-xl border shadow-sm"
              style={{
                left: item.layout.x, top: item.layout.y,
                width: item.layout.w, height: item.layout.h,
                background: T.s2, borderColor: T.border,
              }}
            >
              <div className="border-b px-4 py-2" style={{ borderColor: T.border }}>
                <div className="truncate text-xs font-semibold" style={{ color: T.text }}>
                  {item.visualConfig.title}
                </div>
              </div>
              <div style={{ height: "calc(100% - 36px)", padding: 12 }}>
                <VisualRenderer
                  visual={item.visualConfig}
                  rawData={rows}
                  filters={{}}
                  compact
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
