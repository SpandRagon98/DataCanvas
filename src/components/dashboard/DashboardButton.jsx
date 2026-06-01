/**
 * DashboardButton — moveable/resizable interactive button on the dashboard canvas.
 *
 * Actions supported:
 *   none          — no action (decorative)
 *   toggle-visual — show/hide a visual tile by item id
 *   navigate-page — switch active dashboard by dashboard id
 */

import { Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

const DRAG_THRESHOLD = 4; // px before a press becomes a drag (vs a click)

export default function DashboardButton({
  item,
  dashboardId,
  isSelected,
  onSelect,
  snapEnabled,
  canvasRef,
  onToggleVisual,
  T: passedT,
}) {
  const themeT = useTheme();
  const T = passedT || themeT;
  const updateDashboardItemLayout = useStore((s) => s.updateDashboardItemLayout);
  const removeDashboardItem       = useStore((s) => s.removeDashboardItem);
  const setActiveDashboard        = useStore((s) => s.setActiveDashboard);

  const snap = (v) => Math.round(v / 40) * 40;
  const cfg  = item.buttonConfig || {};

  const fireAction = () => {
    if (cfg.action === "toggle-visual" && cfg.targetId) {
      onToggleVisual?.(cfg.targetId);
    } else if (cfg.action === "navigate-page" && cfg.targetId) {
      setActiveDashboard(cfg.targetId);
    }
  };

  // Press on the button: drag to move, click (no movement) to fire the action.
  const onButtonPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    onSelect();
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    let moved = false;

    const onMove = (mv) => {
      if (!moved && (Math.abs(mv.clientX - sx) > DRAG_THRESHOLD || Math.abs(mv.clientY - sy) > DRAG_THRESHOLD)) {
        moved = true;
      }
      if (!moved || !bounds) return;
      let nx = Math.max(0, Math.min(sl.x + mv.clientX - sx, bounds.width - sl.w));
      let ny = Math.max(0, sl.y + mv.clientY - sy);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardItemLayout({ dashboardId, itemId: item.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
      if (!moved) fireAction();   // treat as a click
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
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
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
  };

  return (
    <div
      className="absolute group"
      style={{
        left: item.layout.x, top: item.layout.y,
        width: item.layout.w, height: item.layout.h,
        zIndex: isSelected ? 6 : 4,
      }}
    >
      {/* Remove button — shows when selected or on hover */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); removeDashboardItem({ dashboardId, itemId: item.id }); }}
        title="Remove button"
        className={`absolute -top-2.5 -right-2.5 z-20 flex h-5 w-5 items-center justify-center rounded-full transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        style={{ background: "#ef4444", color: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}
      >
        <Trash2 size={10} />
      </button>

      {/* The visible button — drag to move, click to fire action */}
      <button
        onPointerDown={onButtonPointerDown}
        className="w-full h-full flex items-center justify-center font-semibold transition hover:brightness-105 active:brightness-95"
        style={{
          background:   cfg.bgColor     || "#f59e0b",
          color:        cfg.textColor   || "#000",
          borderRadius: cfg.borderRadius ?? 8,
          fontSize:     cfg.fontSize     ?? 13,
          fontWeight:   cfg.fontWeight   ?? 600,
          border: cfg.borderWidth
            ? `${cfg.borderWidth}px solid ${cfg.borderColor || "transparent"}`
            : "none",
          boxShadow: isSelected ? `0 0 0 2px ${T.accent}` : "0 1px 3px rgba(0,0,0,0.12)",
          letterSpacing: "0.01em",
          cursor: "grab",
          touchAction: "none",
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
