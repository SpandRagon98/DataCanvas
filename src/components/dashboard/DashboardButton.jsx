/**
 * DashboardButton — moveable/resizable interactive button on the dashboard canvas.
 *
 * Actions supported:
 *   none          — no action (decorative)
 *   toggle-visual — show/hide a visual tile by item id
 *   navigate-page — switch active dashboard by dashboard id
 */

import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

export default function DashboardButton({
  item,
  dashboardId,
  isSelected,
  onSelect,
  snapEnabled,
  canvasRef,
  onToggleVisual,
  T: _T,
}) {
  const T = _T || useTheme();
  const updateDashboardItemLayout = useStore((s) => s.updateDashboardItemLayout);
  const removeDashboardItem       = useStore((s) => s.removeDashboardItem);
  const setActiveDashboard        = useStore((s) => s.setActiveDashboard);

  const snap = (v) => Math.round(v / 40) * 40;
  const cfg  = item.buttonConfig || {};

  const beginMove = (e) => {
    e.preventDefault(); e.stopPropagation();
    onSelect();
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds) return;
      let nx = Math.max(0, Math.min(sl.x + mv.clientX - sx, bounds.width - sl.w));
      let ny = Math.max(0, sl.y + mv.clientY - sy);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardItemLayout({ dashboardId, itemId: item.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",  onUp);
  };

  const beginResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds) return;
      const nw = Math.max(sl.minW || 60,  Math.min(sl.w + mv.clientX - sx, bounds.width - sl.x));
      const nh = Math.max(sl.minH || 32,  sl.h + mv.clientY - sy);
      updateDashboardItemLayout({ dashboardId, itemId: item.id, patch: { w: nw, h: nh } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",  onUp);
  };

  const handleAction = (e) => {
    e.stopPropagation();
    if (cfg.action === "toggle-visual" && cfg.targetId) {
      onToggleVisual?.(cfg.targetId);
    } else if (cfg.action === "navigate-page" && cfg.targetId) {
      setActiveDashboard(cfg.targetId);
    }
  };

  return (
    <div
      className="absolute cursor-move"
      style={{
        left: item.layout.x, top: item.layout.y,
        width: item.layout.w, height: item.layout.h,
        zIndex: isSelected ? 5 : 4,
      }}
      onMouseDown={beginMove}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* The visible button */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleAction}
        className="w-full h-full flex items-center justify-center font-semibold transition hover:opacity-85 active:opacity-70"
        style={{
          background:   cfg.bgColor     || "#f59e0b",
          color:        cfg.textColor   || "#000",
          borderRadius: cfg.borderRadius ?? 8,
          fontSize:     cfg.fontSize     ?? 13,
          fontWeight:   cfg.fontWeight   ?? 600,
          border: cfg.borderWidth
            ? `${cfg.borderWidth}px solid ${cfg.borderColor || "transparent"}`
            : "none",
          boxShadow: isSelected ? `0 0 0 2px ${T.accent}` : "none",
          letterSpacing: "0.01em",
          cursor: cfg.action !== "none" ? "pointer" : "default",
        }}
      >
        {cfg.label || "Button"}
      </button>

      {/* Resize handle */}
      <button
        className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-se-resize rounded-sm"
        style={{ borderRight: `2px solid ${T.accent}`, borderBottom: `2px solid ${T.accent}`, opacity: 0.5 }}
        onMouseDown={beginResize}
      />
    </div>
  );
}
