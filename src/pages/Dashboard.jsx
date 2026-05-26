import { Plus, Pencil, Trash2, LayoutDashboard, Grid3x3, Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useEffectiveData } from "../hooks/useEffectiveData";
import VisualRenderer from "../components/builder/VisualRenderer";
import { useTheme } from "../styles/theme";

const GRID_SIZE = 40;
const snap = (v) => Math.round(v / GRID_SIZE) * GRID_SIZE;

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

  const activeDashboard = useMemo(() => {
    if (!dashboards?.length) return null;
    return dashboards.find((d) => d.id === activeDashboardId) || dashboards[0];
  }, [dashboards, activeDashboardId]);

  const canvasRef = useRef(null);
  const [editingTabId, setEditingTabId] = useState(null);
  const [draftTabName, setDraftTabName] = useState("");
  const [snapEnabled, setSnapEnabled] = useState(false);

  // Presentation mode state
  const [presentMode, setPresentMode] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);

  useEffect(() => {
    if (!presentMode) return;
    const onKey = (e) => {
      if (e.key === "Escape") { setPresentMode(false); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setPresentIndex((i) => (i + 1) % dashboards.length);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setPresentIndex((i) => (i - 1 + dashboards.length) % dashboards.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [presentMode, dashboards.length]);

  const handleStartRename = (dashboard) => {
    setEditingTabId(dashboard.id);
    setDraftTabName(dashboard.name);
  };

  const handleCommitRename = () => {
    if (editingTabId) {
      renameDashboard(editingTabId, draftTabName.trim() || "Untitled Dashboard");
    }
    setEditingTabId(null);
    setDraftTabName("");
  };

  const beginMove = (e, item) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startLayout = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();

    const onMove = (moveEvent) => {
      if (!bounds || !activeDashboard) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newX = Math.max(0, Math.min(startLayout.x + dx, bounds.width - startLayout.w));
      let newY = Math.max(0, startLayout.y + dy);

      if (snapEnabled) {
        newX = snap(newX);
        newY = snap(newY);
      }

      updateDashboardItemLayout({
        dashboardId: activeDashboard.id,
        itemId: item.id,
        patch: { x: newX, y: newY },
      });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const beginResize = (e, item) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startLayout = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();

    const onMove = (moveEvent) => {
      if (!bounds || !activeDashboard) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newW = Math.max(item.layout.minW || 300, startLayout.w + dx);
      let newH = Math.max(item.layout.minH || 240, startLayout.h + dy);
      const allowedW = Math.min(newW, bounds.width - startLayout.x);

      if (snapEnabled) {
        newW = snap(allowedW);
        newH = snap(newH);
      } else {
        newW = allowedW;
      }

      updateDashboardItemLayout({
        dashboardId: activeDashboard.id,
        itemId: item.id,
        patch: { w: newW, h: newH },
      });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Presentation Mode Overlay ──
  if (presentMode) {
    const currentDash = dashboards[presentIndex] || dashboards[0];
    if (!currentDash) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: T.bg }}
      >
        {/* Presentation toolbar */}
        <div
          className="flex items-center justify-between gap-4 border-b px-6 py-3"
          style={{ background: T.surface, borderColor: T.border }}
        >
          <div className="text-base font-bold" style={{ color: T.text }}>
            {currentDash.name}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: T.dim }}>
              {presentIndex + 1} / {dashboards.length}
            </span>
            <button
              onClick={() => setPresentIndex((i) => (i - 1 + dashboards.length) % dashboards.length)}
              disabled={dashboards.length <= 1}
              className="rounded-xl border px-3 py-2"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}
              title="Previous (←)"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPresentIndex((i) => (i + 1) % dashboards.length)}
              disabled={dashboards.length <= 1}
              className="rounded-xl border px-3 py-2"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}
              title="Next (→)"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setPresentMode(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}
              title="Exit presentation (Esc)"
            >
              <X size={14} /> Exit
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative flex-1 overflow-auto p-4">
          {!currentDash.items.length ? (
            <div
              className="flex h-full items-center justify-center rounded-[24px] border border-dashed text-sm"
              style={{ borderColor: T.border, color: T.dim }}
            >
              No visuals on this dashboard
            </div>
          ) : (
            <div
              className="relative"
              style={{
                minHeight: Math.max(
                  560,
                  ...currentDash.items.map(
                    (item) => (item.layout?.y || 0) + (item.layout?.h || 300) + 24
                  )
                ),
              }}
            >
              {currentDash.items.map((item) => (
                <div
                  key={item.id}
                  className="absolute rounded-[22px] border shadow-sm"
                  style={{
                    left: item.layout.x,
                    top: item.layout.y,
                    width: item.layout.w,
                    height: item.layout.h,
                    background: T.s2,
                    borderColor: T.border,
                  }}
                >
                  <div className="border-b px-4 py-2" style={{ borderColor: T.border }}>
                    <div className="truncate text-sm font-semibold" style={{ color: T.text }}>
                      {item.visualConfig.title}
                    </div>
                  </div>
                  <div className="h-[calc(100%-40px)] p-3">
                    <VisualRenderer
                      visual={item.visualConfig}
                      rawData={effectiveRows}
                      filters={filters}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dot navigation */}
        {dashboards.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-3">
            {dashboards.map((_, i) => (
              <button
                key={i}
                onClick={() => setPresentIndex(i)}
                className="rounded-full transition"
                style={{
                  width: i === presentIndex ? 22 : 8,
                  height: 8,
                  background: i === presentIndex ? T.accent : T.border,
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Normal Dashboard View ──
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
        {!activeDashboard || activeDashboard.items.length === 0 ? (
          <div
            className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed"
            style={{
              borderColor: T.border,
              background: T.s2,
              color: T.dim,
            }}
          >
            <LayoutDashboard size={38} color={T.muted} />
            <div className="text-base font-semibold" style={{ color: T.text }}>
              {activeDashboard?.name || "Dashboard"}
            </div>
            <div className="text-sm" style={{ color: T.dim }}>
              No visuals added yet.
            </div>
            <div className="text-sm" style={{ color: T.dim }}>
              Go to <span style={{ color: T.accent, fontWeight: 600 }}>Report Builder</span> and click
              <span style={{ color: T.accent, fontWeight: 600 }}> Add to Dashboard</span>.
            </div>
          </div>
        ) : (
          <div
            className="relative"
            style={{
              minHeight: Math.max(
                560,
                ...activeDashboard.items.map(
                  (item) => (item.layout?.y || 0) + (item.layout?.h || 300) + 24
                )
              ),
            }}
          >
            {activeDashboard.items.map((item) => (
              <div
                key={item.id}
                className="absolute rounded-[22px] border shadow-sm"
                style={{
                  left: item.layout.x,
                  top: item.layout.y,
                  width: item.layout.w,
                  height: item.layout.h,
                  background: T.s2,
                  borderColor: T.border,
                }}
              >
                <div
                  className="flex cursor-move items-center justify-between gap-3 border-b px-4 py-3"
                  style={{ borderColor: T.border }}
                  onMouseDown={(e) => beginMove(e, item)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: T.text }}>
                      {item.visualConfig.title}
                    </div>
                    <div className="text-xs" style={{ color: T.dim }}>
                      Drag this header to move
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      removeDashboardItem({
                        dashboardId: activeDashboard.id,
                        itemId: item.id,
                      })
                    }
                    className="rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{
                      background: T.surface,
                      borderColor: T.border,
                      color: T.dim,
                    }}
                  >
                    Remove
                  </button>
                </div>

                <div className="h-[calc(100%-57px)] p-3">
                  <VisualRenderer
                    visual={item.visualConfig}
                    rawData={effectiveRows}
                    filters={filters}
                    compact
                  />
                </div>

                <button
                  className="absolute bottom-2 right-2 h-5 w-5 cursor-se-resize rounded-sm"
                  style={{
                    borderRight: `2px solid ${T.accent}`,
                    borderBottom: `2px solid ${T.accent}`,
                  }}
                  onMouseDown={(e) => beginResize(e, item)}
                  title="Resize visual"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-[20px] border p-3"
        style={{
          background: T.surface,
          borderColor: T.border,
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {dashboards.map((dashboard) => {
            const isActive = dashboard.id === activeDashboard?.id;

            return (
              <div
                key={dashboard.id}
                className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2"
                style={{
                  background: isActive ? T.accentDim : T.s2,
                  borderColor: isActive ? "rgba(245,158,11,0.25)" : T.border,
                }}
              >
                {editingTabId === dashboard.id ? (
                  <input
                    autoFocus
                    value={draftTabName}
                    onChange={(e) => setDraftTabName(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitRename();
                      if (e.key === "Escape") {
                        setEditingTabId(null);
                        setDraftTabName("");
                      }
                    }}
                    className="rounded-lg border px-2 py-1 text-sm outline-none"
                    style={{
                      background: T.surface,
                      borderColor: T.border,
                      color: T.text,
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setActiveDashboard(dashboard.id)}
                    className="text-sm font-semibold"
                    style={{ color: isActive ? T.accent : T.text }}
                  >
                    {dashboard.name}
                  </button>
                )}

                <button
                  onClick={() => handleStartRename(dashboard)}
                  className="rounded-lg p-1"
                  style={{ color: T.dim }}
                  title="Rename dashboard"
                >
                  <Pencil size={14} />
                </button>

                {dashboards.length > 1 && (
                  <button
                    onClick={() => removeDashboard(dashboard.id)}
                    className="rounded-lg p-1"
                    style={{ color: T.dim }}
                    title="Delete dashboard"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={createDashboard}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold"
            style={{
              background: T.accent,
              color: "#000",
            }}
          >
            <Plus size={14} />
            New Dashboard
          </button>

          {/* Divider */}
          <div className="mx-1 h-6 w-px" style={{ background: T.border }} />

          {/* Snap-to-grid toggle */}
          <button
            onClick={() => setSnapEnabled((s) => !s)}
            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium"
            style={{
              background: snapEnabled ? T.accentDim : T.s2,
              borderColor: snapEnabled ? "rgba(245,158,11,0.25)" : T.border,
              color: snapEnabled ? T.accent : T.dim,
            }}
            title="Toggle snap-to-grid"
          >
            <Grid3x3 size={14} />
            Snap
          </button>

          {/* Presentation mode button */}
          <button
            onClick={() => { setPresentIndex(dashboards.findIndex(d => d.id === activeDashboard?.id) || 0); setPresentMode(true); }}
            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.dim }}
            title="Present dashboards (fullscreen slideshow)"
          >
            <Maximize2 size={14} />
            Present
          </button>
        </div>
      </div>
    </div>
  );
}
