import { useState, useRef, useEffect } from "react";
import { Hash, AlignLeft, Calendar, ToggleLeft, Database, Grip } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_W     = 240;
const HEADER_H   = 44;
const ROW_H      = 28;
const PORT_R     = 5;
const GUTTER     = 12;
const WORLD_W    = 6000;
const WORLD_H    = 4000;

// ── Helpers ───────────────────────────────────────────────────────────────────

const typeIcon = (type) => {
  const icons = { number: Hash, date: Calendar, boolean: ToggleLeft };
  return icons[type] ?? AlignLeft;
};

const typeColor = (type, T) => {
  if (type === "number")  return "#60a5fa";
  if (type === "date")    return "#a78bfa";
  if (type === "boolean") return "#34d399";
  return T.muted;
};

function portPos(cardX, cardY, colIdx, side) {
  return {
    x: side === "right" ? cardX + CARD_W : cardX,
    y: cardY + HEADER_H + colIdx * ROW_H + ROW_H / 2,
  };
}

const CARDINALITY_SYM = {
  "one-to-one":   { from: "1", to: "1" },
  "one-to-many":  { from: "1", to: "∞" },
  "many-to-one":  { from: "∞", to: "1" },
  "many-to-many": { from: "∞", to: "∞" },
};

// ── BezierLine ────────────────────────────────────────────────────────────────
function BezierLine({ x1, y1, x2, y2, active, selected, cardinality, onClick }) {
  const dx  = Math.max(Math.abs(x2 - x1) * 0.5, 60);
  const d   = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  const col = selected ? "#f59e0b" : active ? "#60a5fa" : "#4b5563";
  const sym = CARDINALITY_SYM[cardinality] ?? { from: "∞", to: "1" };

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* Wide hit-area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      {/* Glow on selected */}
      {selected && (
        <path d={d} fill="none" stroke="#f59e0b" strokeWidth={6} opacity={0.18} />
      )}
      {/* Main line */}
      <path
        d={d}
        fill="none"
        stroke={col}
        strokeWidth={selected ? 2.5 : 1.8}
        strokeDasharray={active ? undefined : "6,4"}
        opacity={active ? 0.9 : 0.45}
      />
      {/* Cardinality labels */}
      <text x={x1 + 10} y={y1 - 4} fontSize={9} fill={col} fontFamily="monospace" opacity={0.8}>
        {sym.from}
      </text>
      <text x={x2 - 16} y={y2 - 4} fontSize={9} fill={col} fontFamily="monospace" opacity={0.8}>
        {sym.to}
      </text>
      {/* Arrow head at target end */}
      <polygon
        points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`}
        fill={col}
        opacity={active ? 0.8 : 0.4}
      />
    </g>
  );
}

// ── DatasetCard ───────────────────────────────────────────────────────────────
function DatasetCard({
  dataset: ds, pos, T,
  onHeaderDown,
  onPortDown,
  onPortUp,
  drawingMode,
  drawingFromDs,
  highlightCols,   // Set<colName> — ports lit up as drop targets
}) {
  const cardH = HEADER_H + ds.columns.length * ROW_H + GUTTER;
  const isDrawTarget = drawingMode && drawingFromDs !== ds.id;

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: CARD_W,
        borderRadius: 14,
        border: `1px solid ${isDrawTarget ? "#60a5fa55" : T.border}`,
        background: T.surface,
        boxShadow: `0 4px 24px rgba(0,0,0,0.28)`,
        overflow: "hidden",
        userSelect: "none",
        transition: "border-color 120ms",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {/* Header — drag handle */}
      <div
        onPointerDown={onHeaderDown}
        style={{
          height: HEADER_H,
          background: T.sidebarBg,
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          cursor: "grab",
          touchAction: "none",   // prevent scroll competing with drag
        }}
      >
        <Grip size={12} style={{ color: T.dim, flexShrink: 0 }} />
        <Database size={13} style={{ color: T.accent, flexShrink: 0 }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {ds.name}
        </span>
        <span style={{ fontSize: 10, color: T.muted, flexShrink: 0 }}>
          {ds.columns.length}
        </span>
      </div>

      {/* Column rows */}
      {ds.columns.map((col, idx) => {
        const type   = ds.dataTypes?.[col] ?? "string";
        const Icon   = typeIcon(type);
        const tColor = typeColor(type, T);
        const isTarget = highlightCols?.has(col);

        return (
          <div
            key={col}
            style={{
              height: ROW_H,
              display: "flex",
              alignItems: "center",
              padding: "0 10px 0 12px",
              background: isTarget ? "#60a5fa11" : "transparent",
              borderBottom: idx < ds.columns.length - 1 ? `1px solid ${T.border}22` : "none",
              position: "relative",
            }}
          >
            <Icon size={11} style={{ color: tColor, flexShrink: 0, marginRight: 6 }} />
            <span
              style={{
                fontSize: 11,
                color: T.text,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {col}
            </span>
            <span style={{ fontSize: 9, color: T.dim, marginLeft: 4, flexShrink: 0 }}>
              {type === "number" ? "#" : type === "date" ? "D" : type === "boolean" ? "B" : "A"}
            </span>

            {/* Port dot — drag target / source */}
            <div
              onPointerDown={(e) => onPortDown(e, ds.id, col, idx)}
              onPointerUp={(e) => onPortUp(e, ds.id, col)}
              style={{
                width: PORT_R * 2,
                height: PORT_R * 2,
                borderRadius: "50%",
                background: isTarget ? "#60a5fa" : T.border,
                marginLeft: 8,
                flexShrink: 0,
                cursor: "crosshair",
                touchAction: "none",
                transition: "background 120ms, transform 120ms",
                transform: isTarget ? "scale(1.4)" : "scale(1)",
              }}
              onPointerEnter={(e) => { e.currentTarget.style.background = "#60a5fa"; e.currentTarget.style.transform = "scale(1.3)"; }}
              onPointerLeave={(e) => { e.currentTarget.style.background = isTarget ? "#60a5fa" : T.border; e.currentTarget.style.transform = "scale(1)"; }}
            />
          </div>
        );
      })}

      {/* Bottom padding */}
      <div style={{ height: GUTTER }} />
    </div>
  );
}

// ── ModelCanvas ───────────────────────────────────────────────────────────────
export default function ModelCanvas({ selectedRelId, onSelectRel }) {
  const T               = useTheme();
  const datasets        = useStore((s) => s.datasets);
  const relationships   = useStore((s) => s.relationships);
  const modelLayout     = useStore((s) => s.modelLayout);
  const setModelLayout  = useStore((s) => s.setModelLayout);
  const addRelationship = useStore((s) => s.addRelationship);

  const containerRef = useRef(null);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  // Separate state for cursor / drawing preview (triggers re-render)
  const [canvasMode, setCanvasMode] = useState("idle"); // idle | panning | dragging | drawing
  const [drawLine, setDrawLine]     = useState(null);   // { x1,y1,x2,y2 } in world coords

  // Mutable refs for drag data (no re-render needed during move)
  const dragRef = useRef({ mode: "idle" });
  const panRef  = useRef(pan);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const layoutRef = useRef(modelLayout);
  useEffect(() => { layoutRef.current = modelLayout; }, [modelLayout]);

  // Auto-layout datasets that don't yet have a position
  const dsIds = datasets.map((d) => d.id).join(",");
  useEffect(() => {
    datasets.forEach((ds, i) => {
      if (!layoutRef.current[ds.id]) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        setModelLayout(ds.id, { x: 40 + col * 300, y: 40 + row * 360 });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsIds]);

  // Container-relative coords from a mouse event
  const containerCoords = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Screen → world
  const toWorld = (sx, sy) => ({
    x: sx - panRef.current.x,
    y: sy - panRef.current.y,
  });

  // ── Global window event listeners (attached once) ─────────────────────────
  useEffect(() => {
    const DRAG_THRESHOLD = 4; // px — must move this far before drag activates

    const onMove = (e) => {
      const d = dragRef.current;

      // Activate drag only after passing the threshold (prevents click = drag)
      if (d._pending) {
        const dx = Math.abs(e.clientX - d._startClientX);
        const dy = Math.abs(e.clientY - d._startClientY);
        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return; // not yet
        // Passed threshold — promote to real drag
        delete d._pending;
        delete d._startClientX;
        delete d._startClientY;
        setCanvasMode(
          d.mode === "pan" ? "panning" : d.mode === "card" ? "dragging" : "drawing"
        );
      }

      if (d.mode === "pan") {
        setPan({
          x: d.origPan.x + (e.clientX - d.startX),
          y: d.origPan.y + (e.clientY - d.startY),
        });
      } else if (d.mode === "card") {
        const { x: sx, y: sy } = containerCoords(e);
        const w = toWorld(sx, sy);
        setModelLayout(d.dsId, { x: w.x - d.offX, y: w.y - d.offY });
      } else if (d.mode === "draw") {
        const { x: sx, y: sy } = containerCoords(e);
        const w = toWorld(sx, sy);
        setDrawLine({ x1: d.fromX, y1: d.fromY, x2: w.x, y2: w.y });
      }
    };

    const onUp = () => {
      dragRef.current = { mode: "idle" };
      setCanvasMode("idle");
      setDrawLine(null);
    };

    // Also reset on blur/visibility-change (covers tab switch, alt-tab, etc.)
    const onBlur = () => {
      dragRef.current = { mode: "idle" };
      setCanvasMode("idle");
      setDrawLine(null);
    };

    // Use pointer events for reliable drag termination across all input devices.
    // pointercancel fires when the browser interrupts the pointer (e.g. mouse
    // released outside the window, touch cancelled by scroll, etc.) — this is
    // the primary fix for the "card stays attached after mouse release" bug.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onBlur);
    return () => {
      dragRef.current = { mode: "idle" };
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onBlur);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally stable — reads via refs

  // ── Event handlers passed to children ────────────────────────────────────

  const onBgDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = {
      mode: "pan",
      startX: e.clientX,
      startY: e.clientY,
      origPan: { ...panRef.current },
      _pending: true,
      _startClientX: e.clientX,
      _startClientY: e.clientY,
    };
    // Don't set canvasMode yet — wait for threshold
  };

  const onCardHeaderDown = (e, dsId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { x: sx, y: sy } = containerCoords(e);
    const w = toWorld(sx, sy);
    const pos = layoutRef.current[dsId] || { x: 40, y: 40 };
    dragRef.current = {
      mode: "card",
      dsId,
      offX: w.x - pos.x,
      offY: w.y - pos.y,
      _pending: true,
      _startClientX: e.clientX,
      _startClientY: e.clientY,
    };
    // Don't set canvasMode yet — wait for threshold
  };

  const onPortDown = (e, dsId, colName, colIdx) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const pos = layoutRef.current[dsId] || { x: 40, y: 40 };
    const from = portPos(pos.x, pos.y, colIdx, "right");
    dragRef.current = {
      mode: "draw",
      fromDataset: dsId,
      fromColumn: colName,
      fromX: from.x,
      fromY: from.y,
      _pending: true,
      _startClientX: e.clientX,
      _startClientY: e.clientY,
    };
    // Don't set canvasMode yet — wait for threshold
  };

  const onPortUp = (e, dsId, colName) => {
    const d = dragRef.current;
    if (d.mode !== "draw") return;
    e.stopPropagation();
    if (d.fromDataset === dsId) return; // Same table — ignore

    const duplicate = relationships.some((r) =>
      (r.fromDataset === d.fromDataset && r.fromColumn === d.fromColumn &&
       r.toDataset === dsId && r.toColumn === colName) ||
      (r.fromDataset === dsId && r.fromColumn === colName &&
       r.toDataset === d.fromDataset && r.toColumn === d.fromColumn)
    );

    if (!duplicate) {
      addRelationship({
        id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fromDataset: d.fromDataset,
        fromColumn:  d.fromColumn,
        toDataset:   dsId,
        toColumn:    colName,
        cardinality: "many-to-one",
        direction:   "single",
        active:      true,
      });
    }

    dragRef.current = { mode: "idle" };
    setCanvasMode("idle");
    setDrawLine(null);
  };

  // ── Render relationship lines ─────────────────────────────────────────────
  const lines = relationships.map((rel) => {
    const fromDs = datasets.find((d) => d.id === rel.fromDataset);
    const toDs   = datasets.find((d) => d.id === rel.toDataset);
    if (!fromDs || !toDs) return null;

    const fromPos = layoutRef.current[rel.fromDataset] || { x: 40, y: 40 };
    const toPos   = layoutRef.current[rel.toDataset]   || { x: 40, y: 40 };

    const fromIdx = fromDs.columns.indexOf(rel.fromColumn);
    const toIdx   = toDs.columns.indexOf(rel.toColumn);
    if (fromIdx < 0 || toIdx < 0) return null;

    // Exit port from the side that faces the target card
    const fromSide = fromPos.x + CARD_W / 2 <= toPos.x + CARD_W / 2 ? "right" : "left";
    const toSide   = fromSide === "right" ? "left" : "right";

    const from = portPos(fromPos.x, fromPos.y, fromIdx, fromSide);
    const to   = portPos(toPos.x,   toPos.y,   toIdx,   toSide);

    return (
      <BezierLine
        key={rel.id}
        x1={from.x} y1={from.y}
        x2={to.x}   y2={to.y}
        active={rel.active !== false}
        selected={rel.id === selectedRelId}
        cardinality={rel.cardinality}
        onClick={(e) => {
          e.stopPropagation();
          onSelectRel(rel.id === selectedRelId ? null : rel.id);
        }}
      />
    );
  });

  const cursorMap = {
    idle:     "default",
    panning:  "grabbing",
    dragging: "grabbing",
    drawing:  "crosshair",
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      style={{ background: T.bg, cursor: cursorMap[canvasMode], touchAction: "none" }}
      onPointerDown={onBgDown}
    >
      {/* Panned world ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: "0 0",
          width: WORLD_W,
          height: WORLD_H,
          pointerEvents: "none", // children opt-in
        }}
      >
        {/* Grid dots background */}
        <svg
          style={{
            position: "absolute", top: 0, left: 0,
            width: WORLD_W, height: WORLD_H,
            pointerEvents: "none",
          }}
        >
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill={T.border} opacity="0.5" />
            </pattern>
          </defs>
          <rect width={WORLD_W} height={WORLD_H} fill="url(#dot-grid)" />
        </svg>

        {/* SVG layer for relationship lines + drawing preview */}
        <svg
          style={{
            position: "absolute", top: 0, left: 0,
            width: WORLD_W, height: WORLD_H,
            overflow: "visible",
          }}
        >
          <g style={{ pointerEvents: "all" }}>
            {lines}
          </g>
          {/* Drawing preview bezier */}
          {drawLine && (() => {
            const dx = Math.max(Math.abs(drawLine.x2 - drawLine.x1) * 0.5, 60);
            const d = `M ${drawLine.x1} ${drawLine.y1} C ${drawLine.x1 + dx} ${drawLine.y1}, ${drawLine.x2 - dx} ${drawLine.y2}, ${drawLine.x2} ${drawLine.y2}`;
            return (
              <path
                d={d}
                fill="none"
                stroke={T.accent}
                strokeWidth={1.8}
                strokeDasharray="6,4"
                opacity={0.75}
              />
            );
          })()}
        </svg>

        {/* Dataset cards */}
        {datasets.map((ds) => {
          const pos = modelLayout[ds.id] || { x: 40, y: 40 };
          return (
            <div key={ds.id} style={{ pointerEvents: "all" }}>
              <DatasetCard
                dataset={ds}
                pos={pos}
                T={T}
                onHeaderDown={(e) => onCardHeaderDown(e, ds.id)}
                onPortDown={onPortDown}
                onPortUp={onPortUp}
                drawingMode={canvasMode === "drawing" && !dragRef.current._pending}
                drawingFromDs={dragRef.current.fromDataset}
                highlightCols={
                  canvasMode === "drawing" && !dragRef.current._pending && dragRef.current.fromDataset !== ds.id
                    ? new Set(ds.columns)
                    : null
                }
              />
            </div>
          );
        })}
      </div>

      {/* Empty state ─────────────────────────────────────────────────────── */}
      {datasets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Database size={36} style={{ color: T.border }} className="mx-auto mb-3" />
            <div className="text-sm font-medium" style={{ color: T.muted }}>No datasets loaded</div>
            <div className="text-xs mt-1" style={{ color: T.dim }}>
              Import data from the Data Source tab first
            </div>
          </div>
        </div>
      )}

      {/* Pan/zoom hint ───────────────────────────────────────────────────── */}
      {datasets.length > 0 && (
        <div
          className="absolute bottom-3 left-3 flex items-center gap-3 rounded-xl border px-3 py-1.5 text-[10px] pointer-events-none"
          style={{ background: T.surface + "cc", borderColor: T.border, color: T.muted }}
        >
          <span>Drag background to pan</span>
          <span style={{ color: T.border }}>|</span>
          <span>Drag port dot → to create relationship</span>
          <span style={{ color: T.border }}>|</span>
          <span>Click line to edit</span>
        </div>
      )}
    </div>
  );
}
