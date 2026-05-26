import { useRef, useMemo, useState } from "react";
import { Check, LayoutDashboard, Trash2, Copy, Download, AlertTriangle } from "lucide-react";
import html2canvas from "html2canvas";
import { useStore } from "../../store/useStore";
import { useEffectiveData } from "../../hooks/useEffectiveData";
import { applyGlobalFilters } from "../../utils/filterEngine";
import { buildVisualData } from "../../utils/chartEngine";
import DropZone from "./DropZone";
import VisualToolbar from "./VisualToolbar";
import VisualRenderer from "./VisualRenderer";
import { useTheme } from "../../styles/theme";

export default function VisualCard({ visual }) {
  const T = useTheme();
  const { rows: effectiveRows } = useEffectiveData();

  const filters = useStore((s) => s.filters);
  const dashboards = useStore((s) => s.dashboards);
  const activeDashboardId = useStore((s) => s.activeDashboardId);
  const assignFieldToVisual = useStore((s) => s.assignFieldToVisual);
  const removeFieldFromVisual = useStore((s) => s.removeFieldFromVisual);
  const updateVisual = useStore((s) => s.updateVisual);
  const removeVisual = useStore((s) => s.removeVisual);
  const duplicateVisual = useStore((s) => s.duplicateVisual);
  const setActiveVisual = useStore((s) => s.setActiveVisual);
  const activeVisualId = useStore((s) => s.activeVisualId);
  const addVisualToDashboard = useStore((s) => s.addVisualToDashboard);

  const [targetDashboardId, setTargetDashboardId] = useState(activeDashboardId || dashboards[0]?.id || "");
  const [addedState, setAddedState] = useState(false);
  const chartRef = useRef(null);
  const isActive = activeVisualId === visual.id;

  // Compute health warnings to surface misconfiguration early
  const healthWarnings = useMemo(() => {
    const w = [];
    if (!visual.xFields?.length) w.push("No X field assigned");
    if (!visual.yFields?.length) w.push("No Y field assigned");
    if (
      visual.xFields?.length &&
      visual.yFields?.length &&
      visual.chartType !== "kpi" &&
      visual.chartType !== "scatter"
    ) {
      const filtered = applyGlobalFilters(effectiveRows, filters);
      const data = buildVisualData({
        rows: filtered,
        xFields: visual.xFields,
        yFields: visual.yFields,
        legendField: visual.legendField,
        aggregation: visual.aggregation,
        sortDirection: visual.sortDirection,
      });
      if (!data.length) w.push("No data matches current filters");
    }
    return w;
  }, [visual, effectiveRows, filters]);

  const handleAddToDashboard = (e) => {
    e.stopPropagation();
    const dashboardId = targetDashboardId || dashboards[0]?.id;
    if (!dashboardId) return;
    addVisualToDashboard({ visualId: visual.id, dashboardId });
    setAddedState(true);
    window.setTimeout(() => setAddedState(false), 1200);
  };

  const handleExportPNG = async (e) => {
    e.stopPropagation();
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: T.surface,
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${visual.title || "chart"}.png`;
      a.click();
    } catch {
      // html2canvas can fail for certain SVG content — fail silently
    }
  };

  const handleDuplicate = (e) => {
    e.stopPropagation();
    duplicateVisual(visual.id);
  };

  return (
    <div
      onClick={() => setActiveVisual(visual.id)}
      className="rounded-[20px] border p-5 shadow-sm transition"
      style={{
        background: T.surface,
        borderColor: isActive ? T.accent : T.border,
        boxShadow: isActive
          ? "0 0 0 1px rgba(245,158,11,0.12), 0 12px 30px rgba(0,0,0,0.25)"
          : "0 10px 24px rgba(0,0,0,0.18)",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={visual.title}
            onChange={(e) => updateVisual(visual.id, { title: e.target.value })}
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold outline-none"
            style={{ color: T.text }}
          />
          <p className="text-sm" style={{ color: T.dim }}>Interactive report visual</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={handleExportPNG}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: T.border, color: T.dim, background: T.s2 }}
            title="Export chart as PNG"
          >
            <Download size={13} />
          </button>

          <button
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: T.border, color: T.dim, background: T.s2 }}
            title="Duplicate visual"
          >
            <Copy size={13} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); removeVisual(visual.id); }}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: T.border, color: T.dim, background: T.s2 }}
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      </div>

      {/* Health warnings */}
      {healthWarnings.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {healthWarnings.map((w, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium"
              style={{
                background: "rgba(245,158,11,0.10)",
                borderColor: "rgba(245,158,11,0.28)",
                color: T.accent,
              }}
            >
              <AlertTriangle size={11} />
              {w}
            </span>
          ))}
        </div>
      )}

      {/* Drop zones */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DropZone
          label="X Axis"
          value={visual.xFields}
          onDropField={(field) => assignFieldToVisual({ visualId: visual.id, zone: "xFields", field })}
          onRemoveField={(field) => removeFieldFromVisual({ visualId: visual.id, zone: "xFields", field })}
        />
        <DropZone
          label="Y Axis"
          value={visual.yFields}
          onDropField={(field) => assignFieldToVisual({ visualId: visual.id, zone: "yFields", field })}
          onRemoveField={(field) => removeFieldFromVisual({ visualId: visual.id, zone: "yFields", field })}
        />
        <DropZone
          label="Legend"
          value={visual.legendField}
          onDropField={(field) => assignFieldToVisual({ visualId: visual.id, zone: "legendField", field })}
          onRemoveField={() => removeFieldFromVisual({ visualId: visual.id, zone: "legendField", field: visual.legendField })}
        />
        <DropZone
          label="Tooltip"
          value={visual.tooltipFields}
          onDropField={(field) => assignFieldToVisual({ visualId: visual.id, zone: "tooltipFields", field })}
          onRemoveField={(field) => removeFieldFromVisual({ visualId: visual.id, zone: "tooltipFields", field })}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4">
        <VisualToolbar
          chartType={visual.chartType}
          aggregation={visual.aggregation}
          sortDirection={visual.sortDirection}
          onChange={(patch) => updateVisual(visual.id, patch)}
        />
      </div>

      {/* Add to Dashboard */}
      <div
        className="mb-5 flex flex-col gap-3 rounded-2xl border p-3 lg:flex-row lg:items-center lg:justify-between"
        style={{ background: T.s2, borderColor: T.border }}
      >
        <div>
          <div className="text-sm font-semibold" style={{ color: T.text }}>Add to Dashboard</div>
          <div className="text-xs" style={{ color: T.dim }}>Choose the dashboard for this visual.</div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={targetDashboardId}
            onChange={(e) => setTargetDashboardId(e.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.surface, borderColor: T.border, color: T.text, minWidth: 180 }}
            onClick={(e) => e.stopPropagation()}
          >
            {dashboards.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <button
            onClick={handleAddToDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: addedState ? T.success : T.accent, color: addedState ? "#04120d" : "#000" }}
          >
            {addedState ? <Check size={15} /> : <LayoutDashboard size={15} />}
            {addedState ? "Added" : "Add to Dashboard"}
          </button>
        </div>
      </div>

      {/* Chart area — ref used for PNG export */}
      <div ref={chartRef}>
        <VisualRenderer visual={visual} rawData={effectiveRows} filters={filters} />
      </div>
    </div>
  );
}
