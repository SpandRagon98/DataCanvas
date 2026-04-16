import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";
import { useMemo } from "react";
import { useStore } from "../../store/useStore";
import { applyGlobalFilters } from "../../utils/filterEngine";
import { buildVisualData, getLegendKeys } from "../../utils/chartEngine";
import DropZone from "./DropZone";
import VisualToolbar from "./VisualToolbar";

export default function VisualCard({ visual }) {
  const rawData = useStore((s) => s.rawData);
  const filters = useStore((s) => s.filters);
  const assignFieldToVisual = useStore((s) => s.assignFieldToVisual);
  const removeFieldFromVisual = useStore((s) => s.removeFieldFromVisual);
  const updateVisual = useStore((s) => s.updateVisual);
  const removeVisual = useStore((s) => s.removeVisual);
  const setActiveVisual = useStore((s) => s.setActiveVisual);
  const activeVisualId = useStore((s) => s.activeVisualId);

  const filteredRows = useMemo(
    () => applyGlobalFilters(rawData, filters),
    [rawData, filters]
  );

  const chartData = useMemo(
    () =>
      buildVisualData({
        rows: filteredRows,
        xFields: visual.xFields,
        yFields: visual.yFields,
        legendField: visual.legendField,
        aggregation: visual.aggregation,
        sortDirection: visual.sortDirection,
      }),
    [filteredRows, visual]
  );

  const legendKeys = getLegendKeys(chartData);
  const isActive = activeVisualId === visual.id;

  const renderChart = () => {
    if (!visual.xFields?.length || !visual.yFields?.length) {
      return (
        <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
          Assign X and Y fields to render the visual
        </div>
      );
    }

    if (visual.chartType === "table") {
      return (
        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {chartData[0] &&
                  Object.keys(chartData[0]).map((key) => (
                    <th
                      key={key}
                      className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700"
                    >
                      {key}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  {Object.values(row).map((val, i) => (
                    <td key={i} className="px-4 py-3 text-slate-700">
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (visual.chartType === "kpi") {
      const total = chartData.reduce((sum, item) => {
        return (
          sum +
          Object.keys(item)
            .filter((k) => k !== "x")
            .reduce((s, k) => s + Number(item[k] || 0), 0)
        );
      }, 0);

      return (
        <div className="flex h-[260px] flex-col justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8">
          <div className="text-sm text-slate-500">
            {visual.yFields?.join(", ")}
          </div>
          <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
            {total.toLocaleString()}
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Aggregation: {visual.aggregation}
          </div>
        </div>
      );
    }

    if (visual.chartType === "pie" || visual.chartType === "donut") {
      const pieKey = legendKeys[0] || visual.yFields?.[0];
      const pieData = chartData.map((d) => ({
        name: d.x,
        value: Number(d[pieKey] || 0),
      }));

      return (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                innerRadius={visual.chartType === "donut" ? 60 : 0}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (visual.chartType === "line") {
      return (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              {legendKeys.map((k) => (
                <Line key={k} type="monotone" dataKey={k} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (visual.chartType === "area") {
      return (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              {legendKeys.map((k) => (
                <Area key={k} type="monotone" dataKey={k} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" />
            <YAxis />
            <Tooltip />
            <Legend />
            {legendKeys.map((k) => (
              <Bar
                key={k}
                dataKey={k}
                stackId={visual.chartType === "stackedBar" ? "a" : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div
      onClick={() => setActiveVisual(visual.id)}
      className={`rounded-3xl border bg-white p-5 shadow-sm transition ${
        isActive
          ? "border-slate-400 ring-2 ring-slate-200"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <input
            value={visual.title}
            onChange={(e) => updateVisual(visual.id, { title: e.target.value })}
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-slate-800 outline-none focus:border-slate-200 focus:bg-slate-50"
          />
          <p className="text-sm text-slate-500">Interactive report visual</p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            removeVisual(visual.id);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Remove
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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

        <DropZone
          label="Tooltip"
          value={visual.tooltipFields}
          onDropField={(field) =>
            assignFieldToVisual({
              visualId: visual.id,
              zone: "tooltipFields",
              field,
            })
          }
          onRemoveField={(field) =>
            removeFieldFromVisual({
              visualId: visual.id,
              zone: "tooltipFields",
              field,
            })
          }
        />
      </div>

      <div className="mb-5">
        <VisualToolbar
          chartType={visual.chartType}
          aggregation={visual.aggregation}
          sortDirection={visual.sortDirection}
          onChange={(patch) => updateVisual(visual.id, patch)}
        />
      </div>

      {renderChart()}
    </div>
  );
}
