import {
  Plus, Pencil, Trash2, LayoutDashboard, Grid3x3, Maximize2, X,
  ChevronLeft, ChevronRight, StickyNote, Download, Type as TypeIcon,
  Palette, Hash, AlignLeft, Settings2,
} from "lucide-react";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import html2canvas      from "html2canvas";
import { useStore }     from "../store/useStore";
import { DEFAULT_TILE_STYLE } from "../store/useStore";
import { useEffectiveData } from "../hooks/useEffectiveData";
import VisualRenderer   from "../components/builder/VisualRenderer";
import VirtualDashboardItem from "../components/dashboard/VirtualDashboardItem";
import ColorPickerInput from "../components/builder/ColorPickerInput";
import { useTheme }     from "../styles/theme";

const GRID_SIZE = 40;
const snap = (v) => Math.round(v / GRID_SIZE) * GRID_SIZE;

const ANNOTATION_COLORS = [
  "rgba(245,158,11,0.18)", "rgba(96,165,250,0.18)",
  "rgba(16,185,129,0.18)", "rgba(239,68,68,0.18)",
  "rgba(167,139,250,0.18)",
];

// ── Annotation sticky note (unchanged) ───────────────────────────────────
function Annotation({ ann, dashboardId, snapEnabled, T }) {
  const updateDashboardAnnotation = useStore((s) => s.updateDashboardAnnotation);
  const removeDashboardAnnotation = useStore((s) => s.removeDashboardAnnotation);
  const [editing,  setEditing]  = useState(false);
  const [colorIdx, setColorIdx] = useState(
    Math.max(0, ANNOTATION_COLORS.indexOf(ann.color))
  );

  const beginDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sp = { x: ann.x, y: ann.y };
    const onMove = (mv) => {
      let nx = Math.max(0, sp.x + mv.clientX - sx);
      let ny = Math.max(0, sp.y + mv.clientY - sy);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const cycleColor = (e) => {
    e.stopPropagation();
    const next = (colorIdx + 1) % ANNOTATION_COLORS.length;
    setColorIdx(next);
    updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { color: ANNOTATION_COLORS[next] } });
  };

  return (
    <div className="absolute rounded-lg border shadow-md"
      style={{ left: ann.x, top: ann.y, width: ann.w || 220, background: ann.color || ANNOTATION_COLORS[0], borderColor: T.border, zIndex: 10 }}>
      <div className="flex cursor-move items-center justify-between gap-2 rounded-t-[14px] px-3 py-2"
        style={{ background: "rgba(0,0,0,0.08)" }} onMouseDown={beginDrag}>
        <button onClick={cycleColor} className="h-4 w-4 rounded-full border-2 border-white" style={{ background: ann.color }} title="Change color" />
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing((o) => !o)}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(0,0,0,0.15)", color: T.text }}>{editing ? "Done" : "Edit"}</button>
          <button onClick={() => removeDashboardAnnotation({ dashboardId, annotationId: ann.id })}
            className="rounded-md p-0.5" style={{ color: T.muted }}><X size={12} /></button>
        </div>
      </div>
      {editing ? (
        <textarea autoFocus value={ann.text}
          onChange={(e) => updateDashboardAnnotation({ dashboardId, annotationId: ann.id, patch: { text: e.target.value } })}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full resize-none rounded-b-[14px] bg-transparent px-3 py-2 text-sm outline-none"
          style={{ color: T.text, minHeight: 72 }} />
      ) : (
        <div className="cursor-text whitespace-pre-wrap break-words px-3 py-2 text-sm"
          style={{ color: T.text, minHeight: 56 }} onDoubleClick={() => setEditing(true)}>
          {ann.text || "Double-click to edit"}
        </div>
      )}
    </div>
  );
}

// ── Textbox item ──────────────────────────────────────────────────────────
function TextboxItem({ item, dashboardId, snapEnabled, isSelected, onSelect, canvasRef, T }) {
  const updateDashboardItem  = useStore((s) => s.updateDashboardItem);
  const updateDashboardItemLayout = useStore((s) => s.updateDashboardItemLayout);
  const removeDashboardItem  = useStore((s) => s.removeDashboardItem);
  const [editing, setEditing] = useState(false);

  const ts    = item.textStyle || {};
  const tile  = item.tileStyle || {};

  const bgColor      = tile.bgColor || "transparent";
  const borderColor  = tile.borderEnabled !== false ? (tile.borderColor || T.border) : "transparent";
  const borderRadius = tile.borderRadius ?? 12;
  const shadow       = tile.shadow !== false ? "0 2px 8px rgba(0,0,0,0.12)" : "none";
  const padding      = tile.padding ?? 12;
  const opacity      = tile.transparency ?? 1;

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
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const beginResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds) return;
      const nw = Math.max(sl.minW || 80,  Math.min(sl.w + mv.clientX - sx, bounds.width - sl.x));
      const nh = Math.max(sl.minH || 40,  sl.h + mv.clientY - sy);
      updateDashboardItemLayout({ dashboardId, itemId: item.id, patch: { w: nw, h: nh } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      onClick={onSelect}
      className="absolute"
      style={{
        left: item.layout.x, top: item.layout.y,
        width: item.layout.w, height: item.layout.h,
        background: bgColor, borderRadius,
        border: `${tile.borderEnabled !== false ? 1 : 0}px solid ${borderColor}`,
        boxShadow: isSelected ? `0 0 0 2px ${T.accent}, ${shadow}` : shadow,
        opacity, overflow: "hidden",
        zIndex: isSelected ? 5 : 2,
      }}
    >
      {/* Drag handle — top strip */}
      <div
        className="flex cursor-move items-center justify-between gap-2 px-2 py-1"
        style={{ background: "rgba(0,0,0,0.06)", minHeight: 28 }}
        onMouseDown={beginMove}
      >
        <TypeIcon size={10} style={{ color: T.muted, flexShrink: 0 }} />
        <button
          onClick={(e) => { e.stopPropagation(); removeDashboardItem({ dashboardId, itemId: item.id }); }}
          className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: T.dim }}><X size={11} /></button>
      </div>

      {/* Content */}
      {editing ? (
        <textarea
          autoFocus
          value={item.text}
          onChange={(e) => updateDashboardItem({ dashboardId, itemId: item.id, patch: { text: e.target.value } })}
          onBlur={() => setEditing(false)}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full h-full resize-none bg-transparent outline-none"
          style={{
            padding,
            color: ts.color || T.text,
            fontFamily: ts.fontFamily || "inherit",
            fontSize:   ts.fontSize   || 15,
            fontWeight: ts.fontWeight || 400,
            fontStyle:  ts.italic     ? "italic" : "normal",
            textAlign:  ts.align      || "left",
          }}
        />
      ) : (
        <div
          className="w-full h-full cursor-text whitespace-pre-wrap break-words"
          style={{
            padding,
            color:      ts.color      || T.text,
            fontFamily: ts.fontFamily || "inherit",
            fontSize:   ts.fontSize   || 15,
            fontWeight: ts.fontWeight || 400,
            fontStyle:  ts.italic     ? "italic" : "normal",
            textAlign:  ts.align      || "left",
            overflow:   "auto",
          }}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
        >
          {item.text || <span style={{ opacity: 0.35 }}>Double-click to edit text…</span>}
        </div>
      )}

      {/* Resize handle */}
      <button
        className="absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm"
        style={{ borderRight: `2px solid ${T.accent}`, borderBottom: `2px solid ${T.accent}`, opacity: 0.7 }}
        onMouseDown={beginResize} title="Resize" />
    </div>
  );
}

// ── Tile Format Panel ─────────────────────────────────────────────────────
function TileFormatPanel({ item, dashboardId, T }) {
  const updateDashboardItem = useStore((s) => s.updateDashboardItem);

  if (!item) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 py-8 text-center">
      <Settings2 size={28} style={{ color: T.muted }} />
      <p className="text-xs" style={{ color: T.muted }}>Select a tile on the canvas to format it</p>
    </div>
  );

  const tile = item.tileStyle || {};
  const ts   = item.textStyle || {};
  const vc   = item.visualConfig || {};
  const nf   = vc.numFormat || {};

  const patchTile = (patch) => updateDashboardItem({ dashboardId, itemId: item.id, patch: { tileStyle: { ...DEFAULT_TILE_STYLE, ...tile, ...patch } } });
  const patchText = (patch) => updateDashboardItem({ dashboardId, itemId: item.id, patch: { textStyle: { ...ts, ...patch } } });
  const patchNumFmt = (patch) => {
    if (item.type !== "visual") return;
    updateDashboardItem({ dashboardId, itemId: item.id, patch: { visualConfig: { ...vc, numFormat: { ...nf, ...patch } } } });
  };

  const iLabel = { display: "block", fontSize: 11, color: T.muted, marginBottom: 3 };
  const iSelect = { background: T.s2, borderColor: T.border, color: T.text, width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 8, border: `1px solid ${T.border}`, outline: "none" };

  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{ fontSize: 12, color: T.text }}>
      <div className="sticky top-0 px-4 py-2.5 border-b shrink-0"
        style={{ background: T.surface, borderColor: T.border }}>
        <div className="font-semibold" style={{ color: T.text }}>Format Tile</div>
        <div className="text-[11px]" style={{ color: T.muted }}>
          {item.type === "textbox" ? "Text Box" : (vc.title || "Visual")}
        </div>
      </div>

      <div className="px-4 py-3 space-y-5">

        {/* ── Tile Styling ── */}
        <section>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
            style={{ color: T.muted }}><Palette size={10} /> Tile Style</div>
          <div className="space-y-2.5">
            <div>
              <label style={iLabel}>Background Color</label>
              <ColorPickerInput value={tile.bgColor || "#1a1a2e"} onChange={(c) => patchTile({ bgColor: c })} />
            </div>
            <div className="flex items-center gap-2">
              <label style={{ ...iLabel, marginBottom: 0 }}>Border</label>
              <button onClick={() => patchTile({ borderEnabled: !tile.borderEnabled })}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0"
                style={{ background: tile.borderEnabled !== false ? T.accent : T.border }}>
                <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                  style={{ transform: tile.borderEnabled !== false ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
              </button>
              {tile.borderEnabled !== false && (
                <ColorPickerInput value={tile.borderColor || T.border} onChange={(c) => patchTile({ borderColor: c })} />
              )}
            </div>
            <div>
              <label style={iLabel}>Border Radius: {tile.borderRadius ?? 16}px</label>
              <input type="range" min={0} max={32} value={tile.borderRadius ?? 16}
                onChange={(e) => patchTile({ borderRadius: +e.target.value })}
                style={{ width: "100%", accentColor: T.accent }} />
            </div>
            <div className="flex items-center gap-2">
              <label style={{ ...iLabel, marginBottom: 0 }}>Shadow</label>
              <button onClick={() => patchTile({ shadow: !tile.shadow })}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                style={{ background: tile.shadow !== false ? T.accent : T.border }}>
                <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                  style={{ transform: tile.shadow !== false ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
              </button>
            </div>
            <div>
              <label style={iLabel}>Opacity: {Math.round((tile.transparency ?? 1) * 100)}%</label>
              <input type="range" min={10} max={100} value={Math.round((tile.transparency ?? 1) * 100)}
                onChange={(e) => patchTile({ transparency: +e.target.value / 100 })}
                style={{ width: "100%", accentColor: T.accent }} />
            </div>
            <div>
              <label style={iLabel}>Padding: {tile.padding ?? 12}px</label>
              <input type="range" min={0} max={32} value={tile.padding ?? 12}
                onChange={(e) => patchTile({ padding: +e.target.value })}
                style={{ width: "100%", accentColor: T.accent }} />
            </div>
          </div>
        </section>

        {/* ── Font / Text Style ── */}
        <section>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
            style={{ color: T.muted }}><TypeIcon size={10} /> Text / Font</div>
          <div className="space-y-2.5">
            <div>
              <label style={iLabel}>Font Family</label>
              <select value={tile.fontFamily || "inherit"} onChange={(e) => patchTile({ fontFamily: e.target.value })} style={iSelect}>
                <option value="inherit">Default</option>
                <option value="'Inter', sans-serif">Inter</option>
                <option value="'Roboto', sans-serif">Roboto</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Arial', sans-serif">Arial</option>
              </select>
            </div>
            <div>
              <label style={iLabel}>Font Size: {tile.fontSize ?? "auto"}px</label>
              <input type="range" min={10} max={48} step={1}
                value={tile.fontSize ?? 14}
                onChange={(e) => patchTile({ fontSize: +e.target.value })}
                style={{ width: "100%", accentColor: T.accent }} />
            </div>
            <div>
              <label style={iLabel}>Font Weight</label>
              <select value={tile.fontWeight ?? 400} onChange={(e) => patchTile({ fontWeight: +e.target.value })} style={iSelect}>
                <option value={300}>Light (300)</option>
                <option value={400}>Regular (400)</option>
                <option value={500}>Medium (500)</option>
                <option value={600}>Semi-Bold (600)</option>
                <option value={700}>Bold (700)</option>
              </select>
            </div>
            <div>
              <label style={iLabel}>Text Color</label>
              <ColorPickerInput value={tile.textColor || T.text} onChange={(c) => patchTile({ textColor: c })} />
            </div>
          </div>
        </section>

        {/* ── Textbox-specific text style ── */}
        {item.type === "textbox" && (
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: T.muted }}><AlignLeft size={10} /> Text Options</div>
            <div className="space-y-2.5">
              <div>
                <label style={iLabel}>Align</label>
                <div className="flex gap-1.5">
                  {["left","center","right"].map((a) => (
                    <button key={a} onClick={() => patchText({ align: a })}
                      className="flex-1 rounded-lg border py-1.5 text-xs capitalize transition"
                      style={{ background: ts.align === a ? T.accent : T.s2, color: ts.align === a ? "#000" : T.text, borderColor: T.border }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={iLabel}>Font Size: {ts.fontSize ?? 15}px</label>
                <input type="range" min={10} max={64} value={ts.fontSize ?? 15}
                  onChange={(e) => patchText({ fontSize: +e.target.value })}
                  style={{ width: "100%", accentColor: T.accent }} />
              </div>
              <div className="flex items-center gap-2">
                <label style={{ ...iLabel, marginBottom: 0 }}>Italic</label>
                <button onClick={() => patchText({ italic: !ts.italic })}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition"
                  style={{ background: ts.italic ? T.accent : T.border }}>
                  <span className="inline-block h-3 w-3 rounded-full bg-white transition"
                    style={{ transform: ts.italic ? "translateX(1.25rem)" : "translateX(0.25rem)" }} />
                </button>
              </div>
              <div>
                <label style={iLabel}>Text Color</label>
                <ColorPickerInput value={ts.color || T.text} onChange={(c) => patchText({ color: c })} />
              </div>
            </div>
          </section>
        )}

        {/* ── Number Formatting (visual tiles only) ── */}
        {item.type !== "textbox" && (
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: T.muted }}><Hash size={10} /> Number Format</div>
            <div className="space-y-2">
              <div>
                <label style={iLabel}>Type</label>
                <select value={nf.type || "number"} onChange={(e) => patchNumFmt({ type: e.target.value })} style={iSelect}>
                  <option value="number">Default</option>
                  <option value="whole">Whole Number</option>
                  <option value="decimal">Decimal</option>
                  <option value="percent">Percentage</option>
                  <option value="currency">Currency</option>
                  <option value="compact">Compact (K/M/B)</option>
                </select>
              </div>
              <div>
                <label style={iLabel}>Decimal Places</label>
                <input type="number" min={0} max={10} value={nf.decimals ?? 2}
                  onChange={(e) => patchNumFmt({ decimals: Math.max(0, +e.target.value) })}
                  style={{ ...iSelect, width: 80 }} />
              </div>
              {nf.type === "currency" && (
                <div>
                  <label style={iLabel}>Currency Symbol</label>
                  <input value={nf.currencySymbol || "₹"} onChange={(e) => patchNumFmt({ currencySymbol: e.target.value })}
                    style={{ ...iSelect, width: 60 }} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label style={iLabel}>Prefix</label>
                  <input value={nf.prefix || ""} onChange={(e) => patchNumFmt({ prefix: e.target.value })}
                    placeholder="e.g. $" style={iSelect} />
                </div>
                <div>
                  <label style={iLabel}>Suffix</label>
                  <input value={nf.suffix || ""} onChange={(e) => patchNumFmt({ suffix: e.target.value })}
                    placeholder="e.g. %" style={iSelect} />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard component ──────────────────────────────────────────────
export default function Dashboard() {
  const T                    = useTheme();
  const { rows: effectiveRows } = useEffectiveData();
  const filters              = useStore((s) => s.filters);
  const dashboards           = useStore((s) => s.dashboards);
  const activeDashboardId    = useStore((s) => s.activeDashboardId);
  const createDashboard      = useStore((s) => s.createDashboard);
  const renameDashboard      = useStore((s) => s.renameDashboard);
  const removeDashboard      = useStore((s) => s.removeDashboard);
  const setActiveDashboard   = useStore((s) => s.setActiveDashboard);
  const updateDashboardItemLayout = useStore((s) => s.updateDashboardItemLayout);
  const removeDashboardItem  = useStore((s) => s.removeDashboardItem);
  const addDashboardAnnotation    = useStore((s) => s.addDashboardAnnotation);
  const addTextboxToDashboard     = useStore((s) => s.addTextboxToDashboard);

  const activeDashboard = useMemo(() => {
    if (!dashboards?.length) return null;
    return dashboards.find((d) => d.id === activeDashboardId) || dashboards[0];
  }, [dashboards, activeDashboardId]);

  const canvasRef       = useRef(null);
  const canvasContentRef= useRef(null);
  const [editingTabId,  setEditingTabId]  = useState(null);
  const [draftTabName,  setDraftTabName]  = useState("");
  const [snapEnabled,   setSnapEnabled]   = useState(false);
  const [presentMode,   setPresentMode]   = useState(false);
  const [presentIndex,  setPresentIndex]  = useState(0);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);

  const selectedItem = useMemo(() =>
    activeDashboard?.items?.find((item) => item.id === selectedItemId) || null,
    [activeDashboard, selectedItemId]
  );

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
    setEditingTabId(null); setDraftTabName("");
  };

  const handleExportPNG = useCallback(async () => {
    const target = canvasContentRef.current;
    if (!target) return;
    try {
      const canvas = await html2canvas(target, { backgroundColor: T.surface, scale: 1.5, logging: false, useCORS: true });
      const url    = canvas.toDataURL("image/png");
      Object.assign(document.createElement("a"), { href: url, download: `${activeDashboard?.name || "dashboard"}.png` }).click();
    } catch { /* fail silently */ }
  }, [T.surface, activeDashboard?.name]);

  const beginMove = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedItemId(item.id);
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds || !activeDashboard) return;
      let nx = Math.max(0, Math.min(sl.x + mv.clientX - sx, bounds.width - sl.w));
      let ny = Math.max(0, sl.y + mv.clientY - sy);
      if (snapEnabled) { nx = snap(nx); ny = snap(ny); }
      updateDashboardItemLayout({ dashboardId: activeDashboard.id, itemId: item.id, patch: { x: nx, y: ny } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const beginResize = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sl = { ...item.layout };
    const bounds = canvasRef.current?.getBoundingClientRect();
    const onMove = (mv) => {
      if (!bounds || !activeDashboard) return;
      let nw = Math.max(sl.minW || 160, sl.w + mv.clientX - sx);
      let nh = Math.max(sl.minH || 120, sl.h + mv.clientY - sy);
      const aw = Math.min(nw, bounds.width - sl.x);
      if (snapEnabled) { nw = snap(aw); nh = snap(nh); } else { nw = aw; }
      updateDashboardItemLayout({ dashboardId: activeDashboard.id, itemId: item.id, patch: { w: nw, h: nh } });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  // Build tile inline style from tileStyle settings
  const tileInlineStyle = (item) => {
    const ts = item.tileStyle || {};
    return {
      background:    ts.bgColor      || T.s2,
      borderColor:   ts.borderEnabled !== false ? (ts.borderColor || T.border) : "transparent",
      borderRadius:  ts.borderRadius  ?? 16,
      boxShadow:     ts.shadow !== false ? "0 2px 16px rgba(0,0,0,0.14)" : "none",
      opacity:       ts.transparency  ?? 1,
      fontFamily:    ts.fontFamily    || "inherit",
      fontSize:      ts.fontSize      ? ts.fontSize + "px" : undefined,
      fontWeight:    ts.fontWeight    || undefined,
      color:         ts.textColor     || T.text,
      border:        `${ts.borderEnabled !== false ? 1 : 0}px solid ${ts.borderEnabled !== false ? (ts.borderColor || T.border) : "transparent"}`,
    };
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
            <button onClick={() => setPresentIndex((i) => (i - 1 + dashboards.length) % dashboards.length)} disabled={dashboards.length <= 1}
              className="rounded-xl border px-3 py-2" style={{ background: T.s2, borderColor: T.border, color: T.text }}><ChevronLeft size={16} /></button>
            <button onClick={() => setPresentIndex((i) => (i + 1) % dashboards.length)} disabled={dashboards.length <= 1}
              className="rounded-xl border px-3 py-2" style={{ background: T.s2, borderColor: T.border, color: T.text }}><ChevronRight size={16} /></button>
            <button onClick={() => setPresentMode(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}><X size={14} /> Exit</button>
          </div>
        </div>
        <div className="relative flex-1 overflow-auto p-4">
          {!currentDash.items.length ? (
            <div className="flex h-full items-center justify-center text-sm" style={{ color: T.dim }}>No visuals on this dashboard</div>
          ) : (
            <div className="relative" style={{ minHeight: Math.max(560, ...currentDash.items.map((i) => (i.layout?.y || 0) + (i.layout?.h || 300) + 24)) }}>
              {currentDash.items.map((item) => (
                item.type === "textbox" ? (
                  <div key={item.id} className="absolute" style={{ ...tileInlineStyle(item), left: item.layout.x, top: item.layout.y, width: item.layout.w, height: item.layout.h, padding: item.tileStyle?.padding ?? 12, overflow: "auto" }}>
                    <span style={{ color: (item.textStyle?.color) || T.text }}>{item.text}</span>
                  </div>
                ) : (
                  <div key={item.id} className="absolute rounded-2xl border shadow-sm"
                    style={{ left: item.layout.x, top: item.layout.y, width: item.layout.w, height: item.layout.h, background: T.s2, borderColor: T.border }}>
                    <div className="border-b px-4 py-2" style={{ borderColor: T.border }}>
                      <div className="truncate text-sm font-semibold" style={{ color: T.text }}>{item.visualConfig?.title}</div>
                    </div>
                    <div className="h-[calc(100%-40px)] p-3">
                      <VisualRenderer visual={item.visualConfig} rawData={effectiveRows} filters={filters} compact />
                    </div>
                  </div>
                )
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
    ? Math.max(560,
        ...activeDashboard.items.map((i) => (i.layout?.y || 0) + (i.layout?.h || 300) + 24),
        ...(activeDashboard.annotations || []).map((a) => a.y + 160))
    : 560;

  const isEmpty = !activeDashboard ||
    (!activeDashboard.items?.length && !(activeDashboard.annotations || []).length);

  return (
    <div className="flex flex-1 overflow-hidden p-3 gap-2.5">

      {/* ── Main canvas area ── */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-hidden min-w-0">
        <div
          ref={canvasRef}
          className="relative flex-1 overflow-auto rounded-xl border"
          onClick={() => setSelectedItemId(null)}
          style={{
            background: T.surface, borderColor: T.border, minHeight: 400,
            backgroundImage: snapEnabled ? `radial-gradient(circle, ${T.border} 1px, transparent 1px)` : "none",
            backgroundSize:  snapEnabled ? `${GRID_SIZE}px ${GRID_SIZE}px` : "auto",
          }}
        >
          {isEmpty ? (
            <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed"
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
              {activeDashboard.items.map((item) => {
                const isSelected = selectedItemId === item.id;

                // ── Textbox item ──
                if (item.type === "textbox") {
                  return (
                    <TextboxItem
                      key={item.id}
                      item={item}
                      dashboardId={activeDashboard.id}
                      snapEnabled={snapEnabled}
                      isSelected={isSelected}
                      onSelect={() => setSelectedItemId(item.id)}
                      canvasRef={canvasRef}
                      T={T}
                    />
                  );
                }

                // ── Visual item ──
                const ts = item.tileStyle || {};
                return (
                  <VirtualDashboardItem
                    key={item.id}
                    title={item.visualConfig?.title}
                    className="absolute"
                    style={{
                      left: item.layout.x, top: item.layout.y,
                      width: item.layout.w, height: item.layout.h,
                      borderRadius: ts.borderRadius ?? 16,
                      border: `${ts.borderEnabled !== false ? 1 : 0}px solid ${ts.borderEnabled !== false ? (ts.borderColor || T.border) : "transparent"}`,
                      background: ts.bgColor || T.s2,
                      boxShadow: isSelected
                        ? `0 0 0 2px ${T.accent}, ${ts.shadow !== false ? "0 4px 18px rgba(0,0,0,0.18)" : "none"}`
                        : ts.shadow !== false ? "0 4px 16px rgba(0,0,0,0.12)" : "none",
                      opacity: ts.transparency ?? 1,
                      fontFamily: ts.fontFamily || "inherit",
                      fontSize: ts.fontSize ? ts.fontSize + "px" : undefined,
                      fontWeight: ts.fontWeight || undefined,
                      color: ts.textColor || T.text,
                      zIndex: isSelected ? 5 : 2,
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); }}
                  >
                    <div className="flex h-full flex-col" style={{ padding: ts.padding ?? 0 }}>
                      <div
                        className="flex shrink-0 cursor-move items-center justify-between gap-3 border-b px-3 py-2"
                        style={{ borderColor: ts.borderColor || T.border }}
                        onMouseDown={(e) => beginMove(e, item)}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold" style={{ color: ts.textColor || T.text }}>
                            {item.visualConfig?.title}
                          </div>
                          <div className="text-[10px]" style={{ color: T.muted }}>Drag to move</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeDashboardItem({ dashboardId: activeDashboard.id, itemId: item.id }); }}
                          className="rounded-lg border px-2.5 py-1 text-xs shrink-0"
                          style={{ background: T.surface, borderColor: T.border, color: T.dim }}>
                          Remove
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 p-2">
                        <VisualRenderer
                          visual={item.visualConfig}
                          rawData={effectiveRows}
                          filters={filters}
                          compact
                        />
                      </div>
                      <button
                        className="absolute bottom-1.5 right-1.5 h-4 w-4 cursor-se-resize rounded-sm"
                        style={{ borderRight: `2px solid ${T.accent}`, borderBottom: `2px solid ${T.accent}`, opacity: 0.6 }}
                        onMouseDown={(e) => beginResize(e, item)}
                        title="Resize" />
                    </div>
                  </VirtualDashboardItem>
                );
              })}

              {/* Annotations */}
              {(activeDashboard.annotations || []).map((ann) => (
                <Annotation key={ann.id} ann={ann} dashboardId={activeDashboard.id} snapEnabled={snapEnabled} T={T} />
              ))}
            </div>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className="shrink-0 rounded-xl border px-3 py-2" style={{ background: T.surface, borderColor: T.border }}>
          <div className="flex flex-wrap items-center gap-2">
            {dashboards.map((dashboard) => {
              const isActive = dashboard.id === activeDashboard?.id;
              return (
                <div key={dashboard.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
                  style={{ background: isActive ? T.accentDim : T.s2, borderColor: isActive ? "rgba(245,158,11,0.28)" : T.border, transition: "all 150ms ease" }}>
                  {editingTabId === dashboard.id ? (
                    <input autoFocus value={draftTabName} onChange={(e) => setDraftTabName(e.target.value)}
                      onBlur={handleCommitRename}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCommitRename(); if (e.key === "Escape") { setEditingTabId(null); setDraftTabName(""); } }}
                      className="rounded-lg border px-2 py-0.5 text-xs outline-none"
                      style={{ background: T.surface, borderColor: T.border, color: T.text, width: 100 }} />
                  ) : (
                    <button onClick={() => setActiveDashboard(dashboard.id)} className="text-xs font-semibold" style={{ color: isActive ? T.accent : T.text }}>
                      {dashboard.name}
                    </button>
                  )}
                  <button onClick={() => { setEditingTabId(dashboard.id); setDraftTabName(dashboard.name); }}
                    className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity" style={{ color: T.dim }}><Pencil size={11} /></button>
                  {dashboards.length > 1 && (
                    <button onClick={() => removeDashboard(dashboard.id)}
                      className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity" style={{ color: T.dim }}><Trash2 size={11} /></button>
                  )}
                </div>
              );
            })}

            <button onClick={createDashboard}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold btn-primary"
              style={{ background: T.accent, color: "#000" }}>
              <Plus size={12} /> New
            </button>

            <div className="mx-0.5 h-5 w-px" style={{ background: T.border }} />

            <button onClick={() => activeDashboard && addDashboardAnnotation({ dashboardId: activeDashboard.id })}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }} title="Add sticky note">
              <StickyNote size={12} /> Note
            </button>

            <button onClick={() => activeDashboard && addTextboxToDashboard(activeDashboard.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }} title="Add text box">
              <TypeIcon size={12} /> Text Box
            </button>

            <button onClick={() => setSnapEnabled((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: snapEnabled ? T.accentDim : T.s2, borderColor: snapEnabled ? "rgba(245,158,11,0.28)" : T.border, color: snapEnabled ? T.accent : T.dim }}>
              <Grid3x3 size={12} /> Snap
            </button>

            <button onClick={() => { setFormatPanelOpen((o) => !o); }}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: formatPanelOpen ? T.accentDim : T.s2, borderColor: formatPanelOpen ? "rgba(245,158,11,0.28)" : T.border, color: formatPanelOpen ? T.accent : T.dim }}
              title="Format panel">
              <Palette size={12} /> Format
            </button>

            <button onClick={handleExportPNG}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
              <Download size={12} /> Export
            </button>

            <button
              onClick={() => { setPresentIndex(dashboards.findIndex((d) => d.id === activeDashboard?.id) || 0); setPresentMode(true); }}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium"
              style={{ background: T.s2, borderColor: T.border, color: T.dim }}>
              <Maximize2 size={12} /> Present
            </button>
          </div>
        </div>
      </div>

      {/* ── Format Panel (right sidebar) ── */}
      {formatPanelOpen && (
        <div
          className="shrink-0 rounded-xl border shadow-sm overflow-hidden flex flex-col"
          style={{ width: 240, background: T.surface, borderColor: T.border }}
        >
          <TileFormatPanel
            item={selectedItem}
            dashboardId={activeDashboard?.id}
            T={T}
          />
        </div>
      )}
    </div>
  );
}
