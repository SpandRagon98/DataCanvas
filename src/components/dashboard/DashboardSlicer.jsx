/**
 * DashboardSlicer — moveable/resizable filter widget for the dashboard canvas.
 *
 * Modes:
 *   dropdown   — native <select> (single or multi via shift-click on options)
 *   list       — scrollable chip list (single or multi-select)
 *
 * The slicer item in the store has:
 *   { id, type:"slicer", layout, slicerConfig: { column, label, mode, multiSelect }, selectedValues:[] }
 */

import { useMemo, useState } from "react";
import { X, Filter, ChevronDown } from "lucide-react";
import { useStore }       from "../../store/useStore";
import { useEffectiveData } from "../../hooks/useEffectiveData";
import { getUniqueValues }  from "../../utils/filterEngine";
import { useTheme }         from "../../styles/theme";

export default function DashboardSlicer({
  item,
  dashboardId,
  isSelected,
  onSelect,
  snapEnabled,
  canvasRef,
  T: passedT,
}) {
  const themeT = useTheme();
  const T = passedT || themeT;
  const updateDashboardItemLayout = useStore((s) => s.updateDashboardItemLayout);
  const updateSlicerValues        = useStore((s) => s.updateSlicerValues);
  const removeDashboardItem       = useStore((s) => s.removeDashboardItem);
  const { rows }            = useEffectiveData();
  const [open, setOpen]     = useState(false);

  const cfg     = item.slicerConfig  || {};
  const sel     = item.selectedValues || [];
  const column  = cfg.column  || "";
  const label   = cfg.label   || column || "Filter";
  const mode    = cfg.mode    || "dropdown";
  const multi   = cfg.multiSelect === true;

  const uniqueVals = useMemo(
    () => column ? getUniqueValues(rows, column) : [],
    [rows, column]
  );

  // ── Drag to move ──────────────────────────────────────────────────────────
  const snap  = (v) => Math.round(v / 40) * 40;
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
      const nw = Math.max(sl.minW || 120, Math.min(sl.w + mv.clientX - sx, bounds.width - sl.x));
      const nh = Math.max(sl.minH || 40,  sl.h + mv.clientY - sy);
      updateDashboardItemLayout({ dashboardId, itemId: item.id, patch: { w: nw, h: nh } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",  onUp);
  };

  // ── Selection handlers ────────────────────────────────────────────────────
  const toggleValue = (v) => {
    const sv = String(v);
    if (!multi) {
      updateSlicerValues(dashboardId, item.id, sel.includes(sv) ? [] : [sv]);
      setOpen(false);
    } else {
      const next = sel.includes(sv) ? sel.filter((x) => x !== sv) : [...sel, sv];
      updateSlicerValues(dashboardId, item.id, next);
    }
  };

  const clearAll = (e) => {
    e.stopPropagation();
    updateSlicerValues(dashboardId, item.id, []);
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const tile = item.tileStyle || {};
  const containerStyle = {
    left: item.layout.x, top: item.layout.y,
    width: item.layout.w, height: item.layout.h,
    background:   tile.bgColor || T.surface,
    borderRadius: tile.borderRadius ?? 8,
    border: `${tile.borderEnabled !== false ? 1 : 0}px solid ${isSelected ? T.accent : (tile.borderColor || T.border)}`,
    boxShadow: isSelected ? `0 0 0 2px ${T.accent}44` : (tile.shadow !== false ? "0 2px 8px rgba(0,0,0,0.10)" : "none"),
    zIndex: isSelected ? 5 : 3,
    overflow: "visible",
  };

  const displayText = sel.length === 0
    ? `All ${label}`
    : sel.length === 1
      ? sel[0]
      : `${sel.length} selected`;

  return (
    <div className="absolute" style={containerStyle} onClick={(e) => { e.stopPropagation(); onSelect(); }}>

      {/* Header / drag handle */}
      <div
        className="flex h-full cursor-move items-center gap-2 px-2.5"
        onMouseDown={beginMove}
        style={{ userSelect: "none" }}
      >
        <Filter size={11} style={{ color: T.accent, flexShrink: 0 }} />
        <span className="text-[10px] font-semibold truncate shrink-0" style={{ color: T.muted, maxWidth: 60 }}>
          {label}
        </span>

        {/* Dropdown trigger */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (column) setOpen((o) => !o); }}
          className="flex flex-1 min-w-0 items-center justify-between rounded-lg border px-2 py-1 text-xs"
          style={{ background: T.s2, borderColor: T.border, color: T.text, height: 30 }}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown size={10} style={{ color: T.dim, flexShrink: 0, marginLeft: 4 }} />
        </button>

        {sel.length > 0 && (
          <button onMouseDown={(e) => e.stopPropagation()} onClick={clearAll}
            className="shrink-0 rounded p-0.5" style={{ color: T.dim }}>
            <X size={11} />
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      {open && column && (
        <div
          className="absolute z-[9999] rounded-lg border shadow-xl overflow-hidden"
          style={{
            top: item.layout.h + 4, left: 0,
            minWidth: Math.max(item.layout.w, 180),
            maxHeight: 260, overflowY: "auto",
            background: T.surface, borderColor: T.border,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* All / Clear */}
          <div className="sticky top-0 flex items-center justify-between border-b px-3 py-1.5"
            style={{ background: T.surface, borderColor: T.border }}>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
              {multi ? "Multi-select" : "Single-select"}
            </span>
            {sel.length > 0 && (
              <button onClick={clearAll} className="text-[10px]" style={{ color: T.accent }}>
                Clear
              </button>
            )}
          </div>

          {uniqueVals.length === 0 ? (
            <div className="px-3 py-2 text-xs" style={{ color: T.muted }}>No values</div>
          ) : (
            uniqueVals.map((v) => {
              const sv = String(v);
              const active = sel.includes(sv);
              return (
                <button
                  key={sv}
                  onClick={() => toggleValue(sv)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-white/5"
                  style={{ color: active ? T.accent : T.text, background: active ? T.accentDim : "transparent" }}
                >
                  {multi && (
                    <span className="h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center"
                      style={{ borderColor: active ? T.accent : T.border, background: active ? T.accent : "transparent" }}>
                      {active && <span style={{ width: 6, height: 6, background: "#000", borderRadius: 1 }} />}
                    </span>
                  )}
                  {sv}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Resize handle */}
      <button
        className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-se-resize rounded-sm"
        style={{ borderRight: `2px solid ${T.accent}`, borderBottom: `2px solid ${T.accent}`, opacity: 0.5 }}
        onMouseDown={beginResize}
      />
    </div>
  );
}
