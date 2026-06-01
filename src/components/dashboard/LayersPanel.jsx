/**
 * LayersPanel — Power BI-style Selection / Layers panel.
 *
 * Lists every object on the active dashboard with type icon, editable name,
 * and visibility toggle. Supports reorder (z-order), bring-to-front/back,
 * move up/down, and two-way selection sync with the canvas.
 *
 * Paint order = array order (later items render on top). The panel shows the
 * list top-layer-first (reversed) to match visual stacking expectations.
 */

import { useState } from "react";
import {
  X, Eye, EyeOff, ChevronUp, ChevronDown, ArrowUpToLine, ArrowDownToLine,
  BarChart3, Type as TypeIcon, Filter, MousePointer, Grid3x3, Layers,
} from "lucide-react";
import { useStore } from "../../store/useStore";

function itemIcon(type) {
  switch (type) {
    case "textbox": return TypeIcon;
    case "slicer":  return Filter;
    case "dbutton": return MousePointer;
    case "metric":  return Grid3x3;
    default:        return BarChart3;
  }
}

function defaultLabel(item, metrics) {
  if (item.name) return item.name;
  switch (item.type) {
    case "textbox": return "Text Box";
    case "slicer":  return `Slicer: ${item.slicerConfig?.label || item.slicerConfig?.column || "filter"}`;
    case "dbutton": return `Button: ${item.buttonConfig?.label || "Button"}`;
    case "metric":  return metrics.find((m) => m.id === item.metricId)?.name || "Metric";
    default:        return item.visualConfig?.title || "Visual";
  }
}

export default function LayersPanel({ dashboard, selectedItemId, onSelect, onClose, T }) {
  const metrics       = useStore((s) => s.metrics);
  const reorder       = useStore((s) => s.reorderDashboardItem);
  const toggleVis     = useStore((s) => s.toggleDashboardItemVisibility);
  const updateItem    = useStore((s) => s.updateDashboardItem);
  const removeItem    = useStore((s) => s.removeDashboardItem);

  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState("");

  // Top layer first
  const ordered = [...(dashboard.items || [])].reverse();

  const commitRename = (id) => {
    updateItem({ dashboardId: dashboard.id, itemId: id, patch: { name: draftName.trim() || undefined } });
    setEditingId(null);
    setDraftName("");
  };

  const ctrlBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 22, height: 22, borderRadius: 6, color: T.muted,
  };

  return (
    <div className="flex h-full flex-col" style={{ fontSize: 12 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2">
          <Layers size={13} style={{ color: T.accent }} />
          <span className="font-semibold" style={{ color: T.text }}>Layers</span>
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ background: T.accent + "22", color: T.accent }}>{ordered.length}</span>
        </div>
        <button onClick={onClose} className="rounded p-0.5" style={{ color: T.muted }}><X size={13} /></button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {ordered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px]" style={{ color: T.muted }}>
            No objects on this dashboard
          </div>
        ) : ordered.map((item) => {
          const Icon = itemIcon(item.type);
          const isSel = item.id === selectedItemId;
          const hidden = !!item.hidden;
          return (
            <div key={item.id}
              onClick={() => onSelect(item.id)}
              className="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 cursor-pointer transition"
              style={{
                background: isSel ? T.accentDim : "transparent",
                borderColor: isSel ? "rgba(245,158,11,0.3)" : "transparent",
                opacity: hidden ? 0.5 : 1,
              }}>
              {/* Visibility */}
              <button onClick={(e) => { e.stopPropagation(); toggleVis({ dashboardId: dashboard.id, itemId: item.id }); }}
                style={ctrlBtn} title={hidden ? "Show" : "Hide"}>
                {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>

              <Icon size={12} style={{ color: isSel ? T.accent : T.dim, flexShrink: 0 }} />

              {/* Name */}
              {editingId === item.id ? (
                <input autoFocus value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(item.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitRename(item.id); if (e.key === "Escape") { setEditingId(null); } }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 rounded border px-1 py-0.5 text-[11px] outline-none"
                  style={{ background: T.surface, borderColor: T.border, color: T.text }} />
              ) : (
                <span className="flex-1 min-w-0 truncate text-[11.5px]"
                  style={{ color: isSel ? T.accent : T.text }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingId(item.id); setDraftName(item.name || defaultLabel(item, metrics)); }}
                  title="Double-click to rename">
                  {defaultLabel(item, metrics)}
                </span>
              )}

              {/* Per-row reorder (visible on hover/selection) */}
              <div className={`flex items-center transition-opacity ${isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                <button onClick={(e) => { e.stopPropagation(); reorder({ dashboardId: dashboard.id, itemId: item.id, direction: "up" }); }}
                  style={ctrlBtn} title="Move up (forward)"><ChevronUp size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); reorder({ dashboardId: dashboard.id, itemId: item.id, direction: "down" }); }}
                  style={ctrlBtn} title="Move down (backward)"><ChevronDown size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — front/back actions for selection */}
      {selectedItemId && (
        <div className="border-t p-2 shrink-0 space-y-1.5" style={{ borderColor: T.border }}>
          <div className="text-[9.5px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
            Arrange selected
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => reorder({ dashboardId: dashboard.id, itemId: selectedItemId, direction: "front" })}
              className="inline-flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}>
              <ArrowUpToLine size={11} /> Front
            </button>
            <button onClick={() => reorder({ dashboardId: dashboard.id, itemId: selectedItemId, direction: "back" })}
              className="inline-flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}>
              <ArrowDownToLine size={11} /> Back
            </button>
          </div>
          <button onClick={() => { removeItem({ dashboardId: dashboard.id, itemId: selectedItemId }); onSelect(null); }}
            className="w-full inline-flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-medium"
            style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}>
            <X size={11} /> Delete object
          </button>
        </div>
      )}
    </div>
  );
}
