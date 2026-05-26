import { useEffect, useState } from "react";
import { History, X, RotateCcw, GitBranch, Clock, ChevronRight } from "lucide-react";
import { CLOUD_ENABLED, getWorkbookVersions } from "../../lib/supabase";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function WorkbookHistory({ open, onClose }) {
  const T           = useTheme();
  const workbookId  = useStore((s) => s.cloudWorkbookId);
  const loadWorkbook = useStore((s) => s.loadWorkbook);

  const [versions,  setVersions]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [restoring, setRestoring] = useState(null); // version id being restored
  const [expanded,  setExpanded]  = useState(null); // expanded diff preview

  useEffect(() => {
    if (!open || !workbookId || !CLOUD_ENABLED) return;
    setLoading(true);
    getWorkbookVersions(workbookId).then((data) => {
      setVersions(data ?? []);
      setLoading(false);
    });
  }, [open, workbookId]);

  if (!open) return null;

  const handleRestore = async (version) => {
    if (!version?.data) return;
    setRestoring(version.id);
    try {
      loadWorkbook(version.data);
      onClose();
    } finally {
      setRestoring(null);
    }
  };

  // Summarise what changed vs previous version
  const summarise = (v, i, all) => {
    const prev = all[i + 1];
    if (!prev?.data || !v?.data) return null;
    const parts = [];
    const vData   = v.data;
    const prevData = prev.data;
    if ((vData.visuals?.length ?? 0) !== (prevData.visuals?.length ?? 0)) {
      const diff = (vData.visuals?.length ?? 0) - (prevData.visuals?.length ?? 0);
      parts.push(`${diff > 0 ? "+" : ""}${diff} visual${Math.abs(diff) !== 1 ? "s" : ""}`);
    }
    if ((vData.dashboards?.length ?? 0) !== (prevData.dashboards?.length ?? 0)) {
      const diff = (vData.dashboards?.length ?? 0) - (prevData.dashboards?.length ?? 0);
      parts.push(`${diff > 0 ? "+" : ""}${diff} dashboard${Math.abs(diff) !== 1 ? "s" : ""}`);
    }
    if ((vData.rawData?.length ?? 0) !== (prevData.rawData?.length ?? 0)) {
      const diff = (vData.rawData?.length ?? 0) - (prevData.rawData?.length ?? 0);
      parts.push(`${diff > 0 ? "+" : ""}${diff} row${Math.abs(diff) !== 1 ? "s" : ""}`);
    }
    return parts.length ? parts.join(", ") : "Minor changes";
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in flex flex-col w-full max-w-lg rounded-xl border"
        style={{
          background: T.surface,
          borderColor: T.border,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          maxHeight: "82vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <History size={14} color={T.accent} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: T.text }}>Version History</div>
              <div className="text-[11px]" style={{ color: T.dim }}>
                {versions.length} version{versions.length !== 1 ? "s" : ""} saved
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {!CLOUD_ENABLED && (
            <div
              className="rounded-lg border p-3 text-xs"
              style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.2)", color: T.accent }}
            >
              Cloud not configured. Version history requires Supabase.
            </div>
          )}

          {!workbookId && CLOUD_ENABLED && (
            <div
              className="rounded-lg border p-3 text-xs"
              style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.2)", color: T.accent }}
            >
              Save your workbook to the cloud first to see version history.
            </div>
          )}

          {loading && (
            <div className="py-10 text-center text-xs" style={{ color: T.muted }}>
              Loading versions…
            </div>
          )}

          {!loading && versions.length === 0 && CLOUD_ENABLED && workbookId && (
            <div className="flex flex-col items-center gap-2 py-10">
              <GitBranch size={28} style={{ color: T.border }} />
              <div className="text-xs" style={{ color: T.muted }}>No versions saved yet</div>
              <div className="text-[10.5px] text-center" style={{ color: T.muted }}>
                Versions are created automatically when you save to the cloud.
              </div>
            </div>
          )}

          {versions.map((v, i) => {
            const isFirst   = i === 0;
            const change    = summarise(v, i, versions);
            const isExpanded = expanded === v.id;

            return (
              <div
                key={v.id}
                className="rounded-xl border"
                style={{
                  background: isFirst ? "rgba(245,158,11,0.05)" : T.s2,
                  borderColor: isFirst ? "rgba(245,158,11,0.22)" : T.border,
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                    style={{ background: isFirst ? T.accentDim : T.s3 }}
                  >
                    {isFirst
                      ? <Clock size={12} color={T.accent} />
                      : <span className="text-[10px] font-bold" style={{ color: T.muted }}>v{versions.length - i}</span>
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: T.text }}>
                        {isFirst ? "Current Version" : `Version ${versions.length - i}`}
                      </span>
                      {isFirst && (
                        <span
                          className="rounded px-1.5 py-px text-[9px] font-semibold uppercase"
                          style={{ background: T.accentDim, color: T.accent }}
                        >
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10.5px]" style={{ color: T.muted }}>
                        {timeAgo(v.created_at)}
                      </span>
                      {change && (
                        <>
                          <span style={{ color: T.border }}>·</span>
                          <span className="text-[10.5px]" style={{ color: T.dim }}>{change}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : v.id)}
                      className="rounded-lg border p-1.5"
                      style={{ background: T.s3, borderColor: T.border, color: T.muted }}
                      title="Preview"
                    >
                      <ChevronRight
                        size={11}
                        style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 150ms" }}
                      />
                    </button>

                    {!isFirst && (
                      <button
                        onClick={() => handleRestore(v)}
                        disabled={restoring === v.id}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-semibold"
                        style={{
                          background: T.s3,
                          borderColor: T.border,
                          color: T.dim,
                          opacity: restoring === v.id ? 0.5 : 1,
                        }}
                      >
                        <RotateCcw size={10} />
                        Restore
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded preview */}
                {isExpanded && v.data && (
                  <div className="border-t px-3 py-2" style={{ borderColor: T.border }}>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["Rows",       (v.data.rawData?.length ?? 0).toLocaleString()],
                        ["Visuals",    (v.data.visuals?.length ?? 0).toString()],
                        ["Dashboards", (v.data.dashboards?.length ?? 0).toString()],
                      ].map(([label, val]) => (
                        <div key={label} className="rounded-lg px-2 py-1.5" style={{ background: T.s3 }}>
                          <div className="text-[9.5px] uppercase font-semibold" style={{ color: T.muted }}>{label}</div>
                          <div className="text-sm font-bold" style={{ color: T.text }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: T.border }}>
          <p className="text-[10.5px] text-center" style={{ color: T.muted }}>
            Restoring a version replaces your current workbook state — previous changes are not lost if you have another version saved.
          </p>
        </div>
      </div>
    </div>
  );
}
