import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { useStore } from "../../store/useStore";
import DropZone from "./DropZone";
import { buildVisualData, getLegendKeys } from "../../utils/chartEngine";

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
];

export default function VisualCard({ visual }) {
  const rawData = useStore((s) => s.rawData);
  const globalFilters = useStore((s) => s.filters);

  const assignFieldToVisual = useStore((s) => s.assignFieldToVisual);
  const removeFieldFromVisual = useStore((s) => s.removeFieldFromVisual);
  const updateVisual = useStore((s) => s.updateVisual);
  const removeVisual = useStore((s) => s.removeVisual);

  // Apply global filters
  const filteredRows = useMemo(() => {
    return rawData.filter((row) => {
      return Object.entries(globalFilters).every(([field, val]) => {
        if (!val || val === "All") return true;
        return String(row[field]) === String(val);
      });
    });
  }, [rawData, globalFilters]);

  // Build chart data
  const chartData = useMemo(() => {
    return buildVisualData({
      rows: filteredRows,
      xFields: visual.xFields,
      yFields: visual.yFields,
      legendField: visual.legendField,
      aggregation: visual.aggregation,
      sortDirection: visual.sortDirection,
    });
  }, [filteredRows, visual]);

  const legendKeys = getLegendKeys(chartData);

  const totalValue = useMemo(() => {
    if (!chartData.length) return 0;
    return legendKeys.reduce((sum, key) => {
      return sum + chartData.reduce((acc, row) => acc + (row[key] || 0), 0);
    }, 0);
  }, [chartData]);

  // Empty state
  if (!visual.xFields?.length || !visual.yFields?.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">{visual.title}</h3>
          <button
            onClick={() => removeVisual(visual.id)}
            className="text-red-500 text-sm"
          >
            Delete
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <DropZone
            label="X Axis"
            value={visual.xFields}
            onDropField={(field) =>
              assignFieldToVisual({
                visualId: visual.id,
                zone: "xFields",
                field,
              })
            }
            onRemoveField={(field) =>
              removeFieldFromVisual({
                visualId: visual.id,
                zone: "xFields",
                field,
              })
            }
          />

          <DropZone
            label="Y Axis"
            value={visual.yFields}
            onDropField={(field) =>
              assignFieldToVisual({
                visualId: visual.id,
                zone: "yFields",
                field,
              })
            }
            onRemoveField={(field) =>
              removeFieldFromVisual({
                visualId: visual.id,
                zone: "yFields",
                field,
              })
            }
          />

          <DropZone
            label="Legend"
            value={visual.legendField}
            onDropField={(field) =>
              assignFieldToVisual({
                visualId: visual.id,
                zone: "legendField",
                field,
              })
            }
            onRemoveField={() =>
              removeFieldFromVisual({
                visualId: visual.id,
                zone: "legendField",
                field: visual.legendField,
              })
            }
          />
        </div>

        <div className="mt-6 text-center text-sm text-slate-400">
          Drag fields to build your visual
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{visual.title}</h3>
        <button
          onClick={() => removeVisual(visual.id)}
          className="text-red-500 text-sm"
        >
          Delete
        </button>
      </div>

      {/* Drop zones */}
      <div className="mt-4 grid gap-3">
        <DropZone
          label="X Axis"
          value={visual.xFields}
          onDropField={(field) =>
            assignFieldToVisual({
              visualId: visual.id,
              zone: "xFields",
              field,
            })
          }
          onRemoveField={(field) =>
            removeFieldFromVisual({
              visualId: visual.id,
              zone: "xFields",
              field,
            })
          }
        />

        <DropZone
          label="Y Axis"
          value={visual.yFields}
          onDropField={(field) =>
            assignFieldToVisual({
              visualId: visual.id,
              zone: "yFields",
              field,
            })
          }
          onRemoveField={(field) =>
            removeFieldFromVisual({
              visualId: visual.id,
              zone: "yFields",
              field,
            })
          }
        />

        <DropZone
          label="Legend"
          value={visual.legendField}
          onDropField={(field) =>
            assignFieldToVisual({
              visualId: visual.id,
              zone: "legendField",
              field,
            })
          }
          onRemoveField={() =>
            removeFieldFromVisual({
              visualId: visual.id,
              zone: "legendField",
              field: visual.legendField,
            })
          }
        />
      </div>

      {/* Chart */}
      <div className="mt-6 h-[300px]">
        {visual.chartType === "bar" && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              {legendKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}

        {visual.chartType === "line" && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              {legendKeys.map((key, index) => (
                <Line
                  key={key}
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {visual.chartType === "area" && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              {legendKeys.map((key, index) => (
                <Area
                  key={key}
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                  stroke={COLORS[index % COLORS.length]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}

        {visual.chartType === "pie" && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={chartData}
                dataKey={legendKeys[0]}
                nameKey="x"
                outerRadius={100}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}

        {visual.chartType === "kpi" && (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <div className="text-3xl font-bold">
                {totalValue.toLocaleString()}
              </div>
              <div className="text-sm text-slate-500">
                {visual.yFields.join(", ")}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
