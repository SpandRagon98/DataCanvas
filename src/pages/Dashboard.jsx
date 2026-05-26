import {
  Plus, Pencil, Trash2, LayoutDashboard, Grid3x3, Maximize2, X,
  ChevronLeft, ChevronRight, StickyNote, Download,
} from "lucide-react";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import html2canvas from "html2canvas";
import { useStore } from "../store/useStore";
import { useEffectiveData } from "../hooks/useEffectiveData";
import VisualRenderer from "../components/builder/VisualRenderer";
import { useTheme } from "../styles/theme";

const GRID_SIZE = 40;
const snap = (v) => Math.round(v / GRID_SIZE) * GRID_SIZE;

const ANNOTATION_COLORS = [
  "rgba(245,158,11,0.18)",
  "rgba(96,165,250,0.18)",
  "rgba(16,185,129,0.18)",
  "rgba(239,68,68,0.18)",
  "rgba(167,139,250,0.18)",
];

// ── Annotation sticky note ──
function Annotation({ ann, dashboardId, snapEnabled, canvasBounds, T }) {
  const updateDashboardAnnotation = useStore((s) => s.updateDashboardAnnotation);
  const removeDashboardAnnotation = useStore((s) => s.removeDashboardAnnotation);
  const [editing, setEditing] = useState(false);
  const [colorIdx, setColorIdx] = useState(
    ANNOTATION_COLORS.indexOf(ann.color) >= 0 ? ANNOTATION_COLORS.indexOf(ann.color) : 0
  );

  const beginDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { x: ann.x, y: ann.y };

    const onMove = (mv) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      let nx = Math.max(0, startPos.x + dx);
      let ny = Math.max(0, startPos.y + dy);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const cycleColor = (e) => {
    e.stopPropagation();
    const next = (colorIdx + 1) % ANNOTATION_COLORS.length;
    setColorIdx(next);
    updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { color: ANNOTATION_COLORS[next] } });
  };

  return (
    <div
      className="absolute rounded-[14px] border shadow-md"
      style={{
        left: ann.x,
        top: ann.y,
        width: ann.w || 220,
        background: ann.color || ANNOTATION_COLORS[0],
        borderColor: T.border,
        zIndex: 10,
      }}
    >
      {/* Drag header */}
      <div
        className="flex cursor-move items-center justify-between gap-2 rounded-t-[14px] px-3 py-2"
        style={{ background: "rgba(0,0,0,0.08)" }}
        onMouseDown={beginDrag}
      >
        <button onClick={cycleColor} className="h-4 w-4 rounded-full border-2 border-white" style={{ background: ann.color }} title="Change color" />
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing((o) => !o)}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(0,0,0,0.15)", color: T.text }}
            title="Edit text">
            {editing ? "Done" : "Edit"}
          </button>
          <button onClick={() => removeDashboardAnnotation({ dashboardId, annotationId: ann.id })}
            className="rounded-md p-0.5" style={{ color: T.muted }} title="Delete note">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <textarea
          autoFocus
          value={ann.text}
          onChange={(e) =>
            updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { text: e.target.value } })
          }
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full resize-none rounded-b-[14px] bg-transparent px-3 py-2 text-sm outline-none"
          style={{ color: T.text, minHeight: 72 }}
        />
      ) : (
        <div
          className="cursor-text whitespace-pre-wrap break-words px-3 py-2 text-sm"
          style={{ color: T.text, minHeight: 56 }}
          onDoubleClick={() => setEditing(true)}
        >
          {ann.text || "Double-click to edit"}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const T = useTheme();
  const { rows: effectiveRows } = useEffectiveData();
  const filters = useStore((s) => s.filters);
  const dashboards = useStore((s) => s.dashboards);
  const activeDashboardId = useStore((s) => s.activeDashboardId);
  const createDashboard = useStore((s) => s.createDashboard);
  const renameDashboard = useStore((s) => s.renameDashboard);
  const removeDashboard = useStore((s) => s.removeDashboard);
  const setActiveDashboard = useStore((s) => s.setActiveDashboard);
  const updateDashboardItemLayout = useStore((s) => s.updateDashboardItemLayout);
  const removeDashboardItem = useStore((s) => s.removeDashboardItem);
  const addDashboardAnnotation = useStore((s) => s.addDashboardAnnotation);

  const activeDashboard = useMemo(() => {
    if (!dashboards?.length) return null;
    return dashboards.find((d) => d.id === activeDashboardId) || dashboards[0];
  }, [dashboards, activeDashboardId]);

  const canvasRef = useRef(null);
  const canvasContentRef = useRef(null);
  const [editingTabId, setEditingTabId] = useState(null);
  const [draftTabName, setDraftTabName] = useState("");
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);

  useEffect(() => {
    if (!presentMode) return;
    const onKey = (e) => {
      if (e.key === "Escape") { setPresentMode(false); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setPresentIndex((i) => (i + 1) % dashboards.length);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setPresentIndex((i) => (i - 1 + dashboards.length) % dashboards.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [presentMode, dashboards.length]);

  const handleCommitRename = () => {
    if (editingTabId) renameDashboard(editingTabId, draftTabName.trim() || "Untitled Dashboard");
    setEditingTabId(null);
    setDraftTabName("");
  };

  const handleExportPNG = useCallback(async () => {
    const target = canvasContentRef.current;
    if (!target) return;
    try {
      const canvas = await html2canvas(target, {
        backgroundColor: T.surface,
        scale: 1.5,
        logging: false,
        useCORS: true,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeDashboard?.name || "dashboard"}.png`;
      a.click();
    } catch {
      // fail silently — html2canvas may fail on complex SVG charts
    }
  }, [T.surface, activeDashboard?.name]);

  const beginMove = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startLayout = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds || !activeDashboard) return;
      let nx = Math.max(0, Math.min(startLayout.x + mv.clientX - startX, bounds.width - startLayout.w));
      let ny = Math.max(0, startLayout.y + mv.clientY - startY);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardItemLayout({ dashboardId: activeDashboard.id, itemId: item.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const beginResize = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startLayout = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds || !activeDashboard) return;
      let nw = Math.max(item.layout.minW || 300, startLayout.w + mv.clientX - startX);
      let nh = Math.max(item.layout.minH || 240, startLayout.h + mv.clientY - startY);
      const aw = Math.min(nw, bounds.width - startLayout.x);
      if (snapEnabled) { nw = snap(aw); nh = snap(nh); } else { nw = aw; }
      updateDashboardItemLayout({ dashboardId: activeDashboard.id, itemId: item.id, patch: { w: nw, h: nh } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Presentation Mode ──
  if (presentMode) {
    const currentDash = dashboards[presentIndex] || dashboards[0];
    if (!currentDash) return null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: T.bg }}>
        <div className="flex items-center justify-between gap-4 border-b px-6 py-3" style={{ background: T.surface, borderColor: T.border }}>
          <div className="text-base font-bold" style={{ color: T.text }}>{currentDash.name}</div>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: T.dim }}>{presentIndex + 1} / {dashboards.length}</span>
            <button onClick={() => setPresentIndex((i) => (i - 1 + dashboards.length) % dashboards.length)}
              disabled={dashboards.length <= 1}
              className="rounded-xl border px-3 py-2" style={{ background: T.s2, borderColor: T.border, color: T.text }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPresentIndex((i) => (i + 1) % dashboards.length)}
              disabled={dashboards.length <= 1}
              className="rounded-xl border px-3 py-2" style={{ background: T.s2, borderColor: T.border, color: T.text }}>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setPresentMode(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}>
              <X size={14} /> Exit
            </button>
          </div>
        </div>
        <div className="relative flex-1 overflow-auto p-4">
          {!currentDash.items.length ? (
            <div className="flex h-full items-center justify-center text-sm" style={{ color: T.dim }}>
              No visuals on this dashboard
            </div>
          ) : (
            <div className="relative" style={{
              minHeight: Math.max(560, ...currentDash.items.map((item) => (item.layout?.y || 0) + (item.layout?.h || 300) + 24)),
            }}>
              {currentDash.items.map((item) => (
                <div key={item.id} className="absolute rounded-[22px] border shadow-sm"
                  style={{ left: item.layout.x, top: item.layout.y, width: item.layout.w, height: item.layout.h, background: T.s2, borderColor: T.border }}>
                  <div className="border-b px-4 py-2" style={{ borderColor: T.border }}>
                    <div className="truncate text-sm font-semibold" style={{ color: T.text }}>{item.visualConfig.title}</div>
                  </div>
                  <div className="h-[calc(100%-40px)] p-3">
                    <VisualRenderer visual={item.visualConfig} rawData={effectiveRows} filters={filters} compact />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {dashboards.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-3">
            {dashboards.map((_, i) => (
              <button key={i} onClick={() => setPresentIndex(i)} className="rounded-full transition"
                style={{ width: i === presentIndex ? 22 : 8, height: 8, background: i === presentIndex ? T.accent : T.border }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Normal Dashboard View ──
  const canvasMinHeight = activeDashboard?.items?.length
    ? Math.max(560, ...activeDashboard.items.map((item) => (item.layout?.y || 0) + (item.layout?.h || 300) + 24),
        ...(activeDashboard.annotations || []).map((a) => a.y + 160))
    : 560;

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-4">
      <div
        ref={canvasRef}
        className="relative flex-1 overflow-auto rounded-[24px] border"
        style={{
          background: T.surface,
          borderColor: T.border,
          minHeight: 520,
          backgroundImage: snapEnabled
            ? `radial-gradient(circle, ${T.border} 1px, transparent 1px)`
            : "none",
          backgroundSize: snapEnabled ? `${GRID_SIZE}px ${GRID_SIZE}px` : "auto",
        }}
      >
        {!activeDashboard || (activeDashboard.items.length === 0 && !(activeDashboard.annotations || []).length) ? (
          <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed"
            style={{ borderColor: T.border, background: T.s2, color: T.dim }}>
            <LayoutDashboard size={38} color={T.muted} />
            <div className="text-base font-semibold" style={{ color: T.text }}>{activeDashboard?.name || "Dashboard"}</div>
            <div className="text-sm" style={{ color: T.dim }}>No visuals added yet.</div>
            <div className="text-sm" style={{ color: T.dim }}>
              Go to <span style={{ color: T.accent, fontWeight: 600 }}>Report Builder</span> and click
              <span style={{ color: T.accent, fontWeight: 600 }}> Add to Dashboard</span>.
            </div>
          </div>
        ) : (
          <div ref={canvasContentRef} className="relative" style={{ minHeight: canvasMinHeight }}>
            {/* Dashboard visuals */}
            {activeDashboard.items.map((item) => (
              <div key={item.id} className="absolute rounded-[22px] border shadow-sm"
                style={{ left: item.layout.x, top: item.layout.y, width: item.layout.w, height: item.layout.h, background: T.s2, borderColor: T.border }}>
                <div className="flex cursor-move items-center justify-between gap-3 border-b px-4 py-3"
                  style={{ borderColor: T.border }} onMouseDown={(e) => beginMove(e, item)}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: T.text }}>{item.visualConfig.title}</div>
                    <div className="text-xs" style={{ color: T.dim }}>Drag this header to move</div>
                  </div>
                  <button onClick={() => removeDashboardItem({ dashboardId: activeDashboard.id, itemId: item.id })}
                    className="rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{ background: T.surface, borderColor: T.border, color: T.dim }}>
                    Remove
                  </button>
                </div>
                <div className="h-[calc(100%-57px)] p-3">
                  <VisualRenderer visual={item.visualConfig} rawData={effectiveRows} filters={filters} compact />
                </div>
                <button className="absolute bottom-2 right-2 h-5 w-5 cursor-se-resize rounded-sm"
                  style={{ borderRight: `2px solid ${T.accent}`, borderBottom: `2px solid ${T.accent}` }}
                  onMouseDown={(e) => beginResize(e, item)} title="Resize visual" />
              </div>
            ))}

            {/* Annotations */}
            {(activeDashboard.annotations || []).map((ann) => (
              <Annotation
                key={ann.id}
                ann={ann}
                dashboardId={activeDashboard.id}
                snapEnabled={snapEnabled}
                T={T}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="rounded-[20px] border p-3" style={{ background: T.surface, borderColor: T.border }}>
        <div className="flex flex-wrap items-center gap-3">
          {dashboards.map((dashboard) => {
            const isActive = dashboard.id === activeDashboard?.id;
            return (
              <div key={dashboard.id}
                className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2"
                style={{ background: isActive ? T.accentDim : T.s2, borderColor: isActive ? "rgba(245,158,11,0.25)" : T.border }}>
                {editingTabId === dashboard.id ? (
                  <input autoFocus value={draftTabName}
                    onChange={(e) => setDraftTabName(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCommitRename(); if (e.key === "Escape") { setEditingTabId(null); setDraftTabName(""); } }}
                    className="rounded-lg border px-2 py-1 text-sm outline-none"
                    style={{ background: T.surface, borderColor: T.border, color: T.text }} />
                ) : (
                  <button onClick={() => setActiveDashboard(dashboard.id)}
                    className="text-sm font-semibold" style={{ color: isActive ? T.accent : T.text }}>
                    {dashboard.name}
                  </button>
                )}
                <button onClick={() => { setEditingTabId(dashboard.id); setDraftTabName(dashboard.name); }}
                  className="rounded-lg p-1" style={{ color: T.dim }} title="Rename">
                  <Pencil size={14} />
                </button>
                {dashboards.length > 1 && (
                  <button onClick={() => removeDashboard(dashboard.id)}
                    className="rounded-lg p-1" style={{ color: T.dim }} title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}

          <button onClick={createDashboard}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold"
            style={{ background: T.accent, color: "#000" }}>
            <Plus size={14} /> New Dashboard
          </button>

          <div className="mx-1 h-6 w-px" style={{ background: T.border }} />

          {/* Add sticky note */}
          <button
            onClick={() => activeDashboard && addDashboardAnnotation({ dashboardId: activeDashboard.id })}
            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.dim }}
            title="Add sticky note annotation"
          >
            <StickyNote size={14} /> Note
          </button>

          {/* Snap-to-grid toggle */}
          <button onClick={() => setSnapEnabled((s) => !s)}
            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium"
            style={{ background: snapEnabled ? T.accentDim : T.s2, borderColor: snapEnabled ? "rgba(245,158,11,0.25)" : T.border, color: snapEnabled ? T.accent : T.dim }}
            title="Toggle snap-to-grid">
            <Grid3x3 size={14} /> Snap
          </button>

          {/* Export as PNG */}
          <button onClick={handleExportPNG}
            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.dim }}
            title="Export dashboard as PNG">
            <Download size={14} /> Export
          </button>

          {/* Presentation mode */}
          <button
            onClick={() => { setPresentIndex(dashboards.findIndex((d) => d.id === activeDashboard?.id) || 0); setPresentMode(true); }}
            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.dim }}
            title="Present dashboards (fullscreen slideshow)">
            <Maximize2 size={14} /> Present
          </button>
        </div>
      </div>
    </div>
  );
}
