import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEmptyScenario } from "../utils/scenarioEngine";

const DEMO_DATA = [
  { Date: "2026-01-01", Region: "North", Product: "Laptop", Category: "Electronics", Revenue: 120000, Cost: 90000, Profit: 30000, Units: 12, Salesperson: "Aman" },
  { Date: "2026-01-02", Region: "South", Product: "Phone", Category: "Electronics", Revenue: 80000, Cost: 50000, Profit: 30000, Units: 20, Salesperson: "Riya" },
  { Date: "2026-01-03", Region: "East", Product: "Chair", Category: "Furniture", Revenue: 40000, Cost: 25000, Profit: 15000, Units: 15, Salesperson: "Neeraj" },
  { Date: "2026-01-04", Region: "West", Product: "Desk", Category: "Furniture", Revenue: 70000, Cost: 45000, Profit: 25000, Units: 10, Salesperson: "Sara" },
  { Date: "2026-01-05", Region: "North", Product: "Phone", Category: "Electronics", Revenue: 100000, Cost: 70000, Profit: 30000, Units: 22, Salesperson: "Aman" },
];

const detectType = (values) => {
  let numberCount = 0, dateCount = 0, boolCount = 0, nonEmpty = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    nonEmpty++;
    if (!isNaN(Number(v))) numberCount++;
    if (!isNaN(Date.parse(v))) dateCount++;
    if (String(v).toLowerCase() === "true" || String(v).toLowerCase() === "false") boolCount++;
  }
  if (nonEmpty === 0) return "string";
  if (boolCount === nonEmpty) return "boolean";
  if (numberCount === nonEmpty) return "number";
  if (dateCount === nonEmpty) return "date";
  return "string";
};

const buildColumns = (rows) => {
  if (!rows?.length) return { columns: [], dataTypes: {} };
  const cols = Object.keys(rows[0]);
  const dataTypes = {};
  cols.forEach((c) => { dataTypes[c] = detectType(rows.map((r) => r[c])); });
  return { columns: cols, dataTypes };
};

const createId = (prefix) =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createDefaultDashboard = () => ({
  id: createId("dashboard"),
  name: "Dashboard 1",
  items: [],
});

const createDashboardItem = (visual, existingItems = []) => {
  const nextY = existingItems.reduce(
    (max, item) => Math.max(max, (item.layout?.y || 0) + (item.layout?.h || 340) + 16),
    0
  );
  return {
    id: createId("dash_item"),
    visualConfig: JSON.parse(JSON.stringify(visual)),
    layout: { x: 16, y: nextY + 16, w: 520, h: 340, minW: 300, minH: 240 },
  };
};

const { columns: demoColumns, dataTypes: demoTypes } = buildColumns(DEMO_DATA);
const initialDashboard = createDefaultDashboard();

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Core data ──
      rawData: DEMO_DATA,
      columns: demoColumns,
      dataTypes: demoTypes,

      // ── Visuals ──
      filters: {},
      visuals: [],
      activeVisualId: null,

      // ── Hierarchies ──
      hierarchies: [],

      // ── Dashboards ──
      dashboards: [initialDashboard],
      activeDashboardId: initialDashboard.id,

      // ── Theme (persist middleware handles localStorage) ──
      themeMode: "dark",

      // ── Calc fields ──
      calculatedFields: [],

      // ── Scenarios ──
      scenarios: [],
      activeScenarioId: null,

      // ── Filter bookmarks (Phase 1) ──
      filterBookmarks: [],

      // ── Undo / Redo — intentionally excluded from persist (see partialize) ──
      undoStack: [],
      redoStack: [],

      // ── Actions ──

      setData: (data, columns, types) => {
        const resetDashboard = createDefaultDashboard();
        set({
          rawData: data,
          columns,
          dataTypes: types,
          filters: {},
          visuals: [],
          activeVisualId: null,
          hierarchies: [],
          dashboards: [resetDashboard],
          activeDashboardId: resetDashboard.id,
          calculatedFields: [],
          scenarios: [],
          activeScenarioId: null,
          filterBookmarks: [],
          undoStack: [],
          redoStack: [],
        });
      },

      loadWorkbook: (wb) => {
        const fallback = createDefaultDashboard();
        set({
          rawData: wb.rawData ?? DEMO_DATA,
          columns: wb.columns ?? demoColumns,
          dataTypes: wb.dataTypes ?? demoTypes,
          filters: wb.filters ?? {},
          visuals: wb.visuals ?? [],
          activeVisualId: wb.activeVisualId ?? null,
          hierarchies: wb.hierarchies ?? [],
          dashboards: wb.dashboards ?? [fallback],
          activeDashboardId: wb.activeDashboardId ?? fallback.id,
          themeMode: wb.themeMode ?? "dark",
          calculatedFields: wb.calculatedFields ?? [],
          scenarios: wb.scenarios ?? [],
          activeScenarioId: wb.activeScenarioId ?? null,
          filterBookmarks: wb.filterBookmarks ?? [],
          undoStack: [],
          redoStack: [],
        });
      },

      updateCell: ({ rowIndex, field, value }) =>
        set((state) => {
          if (state.calculatedFields.some((cf) => cf.name === field)) return state;

          const fieldType = state.dataTypes[field];
          let parsedValue = value;
          if (fieldType === "number") {
            parsedValue = value === "" || value === null || value === undefined ? "" : Number(value);
          } else if (fieldType === "boolean") {
            if (String(value).toLowerCase() === "true") parsedValue = true;
            else if (String(value).toLowerCase() === "false") parsedValue = false;
          }

          const oldValue = state.rawData[rowIndex]?.[field];
          const nextRawData = [...state.rawData];
          nextRawData[rowIndex] = { ...nextRawData[rowIndex], [field]: parsedValue };

          return {
            rawData: nextRawData,
            visuals: [...state.visuals],
            dashboards: [...state.dashboards],
            undoStack: [...state.undoStack, { rowIndex, field, oldValue, newValue: parsedValue }].slice(-50),
            redoStack: [],
          };
        }),

      undoEdit: () =>
        set((state) => {
          if (!state.undoStack.length) return state;
          const entry = state.undoStack[state.undoStack.length - 1];
          const nextRawData = [...state.rawData];
          nextRawData[entry.rowIndex] = { ...nextRawData[entry.rowIndex], [entry.field]: entry.oldValue };
          return {
            rawData: nextRawData,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, entry],
          };
        }),

      redoEdit: () =>
        set((state) => {
          if (!state.redoStack.length) return state;
          const entry = state.redoStack[state.redoStack.length - 1];
          const nextRawData = [...state.rawData];
          nextRawData[entry.rowIndex] = { ...nextRawData[entry.rowIndex], [entry.field]: entry.newValue };
          return {
            rawData: nextRawData,
            undoStack: [...state.undoStack, entry],
            redoStack: state.redoStack.slice(0, -1),
          };
        }),

      addVisual: () =>
        set((state) => {
          const id = createId("visual");
          const newVisual = {
            id,
            title: `Visual ${state.visuals.length + 1}`,
            chartType: "bar",
            xFields: [],
            yFields: [],
            legendField: "",
            tooltipFields: [],
            sortField: "",
            sortDirection: "asc",
            aggregation: "sum",
            filters: {},
            width: 1,
            height: 320,
          };
          return { visuals: [...state.visuals, newVisual], activeVisualId: id };
        }),

      duplicateVisual: (id) =>
        set((state) => {
          const source = state.visuals.find((v) => v.id === id);
          if (!source) return state;
          const newId = createId("visual");
          const copy = { ...JSON.parse(JSON.stringify(source)), id: newId, title: `${source.title} (copy)` };
          const idx = state.visuals.findIndex((v) => v.id === id);
          const next = [...state.visuals];
          next.splice(idx + 1, 0, copy);
          return { visuals: next, activeVisualId: newId };
        }),

      removeVisual: (id) =>
        set((state) => {
          const next = state.visuals.filter((v) => v.id !== id);
          return {
            visuals: next,
            activeVisualId: state.activeVisualId === id ? next[0]?.id ?? null : state.activeVisualId,
          };
        }),

      setActiveVisual: (id) => set({ activeVisualId: id }),

      updateVisual: (id, patch) =>
        set((state) => ({
          visuals: state.visuals.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),

      assignFieldToVisual: ({ visualId, zone, field }) =>
        set((state) => ({
          visuals: state.visuals.map((v) => {
            if (v.id !== visualId) return v;
            if (zone === "xFields") return v.xFields.includes(field) ? v : { ...v, xFields: [...v.xFields, field] };
            if (zone === "yFields") return v.yFields.includes(field) ? v : { ...v, yFields: [...v.yFields, field] };
            if (zone === "legendField") return { ...v, legendField: field };
            if (zone === "tooltipFields") return v.tooltipFields.includes(field) ? v : { ...v, tooltipFields: [...v.tooltipFields, field] };
            return v;
          }),
        })),

      removeFieldFromVisual: ({ visualId, zone, field }) =>
        set((state) => ({
          visuals: state.visuals.map((v) => {
            if (v.id !== visualId) return v;
            if (zone === "xFields") return { ...v, xFields: v.xFields.filter((f) => f !== field) };
            if (zone === "yFields") return { ...v, yFields: v.yFields.filter((f) => f !== field) };
            if (zone === "tooltipFields") return { ...v, tooltipFields: v.tooltipFields.filter((f) => f !== field) };
            if (zone === "legendField") return { ...v, legendField: "" };
            return v;
          }),
        })),

      setGlobalFilter: (field, value) =>
        set((state) => ({ filters: { ...state.filters, [field]: value } })),

      clearGlobalFilters: () => set({ filters: {} }),

      addHierarchy: (hierarchy) =>
        set((state) => ({ hierarchies: [...state.hierarchies, hierarchy] })),

      removeHierarchy: (hierarchyName) =>
        set((state) => ({ hierarchies: state.hierarchies.filter((h) => h.name !== hierarchyName) })),

      createDashboard: () =>
        set((state) => {
          const dashboard = { id: createId("dashboard"), name: `Dashboard ${state.dashboards.length + 1}`, items: [] };
          return { dashboards: [...state.dashboards, dashboard], activeDashboardId: dashboard.id };
        }),

      renameDashboard: (dashboardId, name) =>
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === dashboardId ? { ...d, name: name || d.name } : d
          ),
        })),

      removeDashboard: (dashboardId) =>
        set((state) => {
          if (state.dashboards.length <= 1) return state;
          const dashboards = state.dashboards.filter((d) => d.id !== dashboardId);
          return {
            dashboards,
            activeDashboardId:
              state.activeDashboardId === dashboardId ? dashboards[0]?.id ?? null : state.activeDashboardId,
          };
        }),

      setActiveDashboard: (dashboardId) => set({ activeDashboardId: dashboardId }),

      addVisualToDashboard: ({ visualId, dashboardId }) =>
        set((state) => {
          const visual = state.visuals.find((v) => v.id === visualId);
          const targetId = dashboardId || state.activeDashboardId;
          if (!visual || !targetId) return state;
          return {
            dashboards: state.dashboards.map((d) =>
              d.id !== targetId ? d : { ...d, items: [...d.items, createDashboardItem(visual, d.items)] }
            ),
            activeDashboardId: targetId,
          };
        }),

      updateDashboardItemLayout: ({ dashboardId, itemId, patch }) =>
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === dashboardId
              ? { ...d, items: d.items.map((item) => item.id === itemId ? { ...item, layout: { ...item.layout, ...patch } } : item) }
              : d
          ),
        })),

      removeDashboardItem: ({ dashboardId, itemId }) =>
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === dashboardId ? { ...d, items: d.items.filter((item) => item.id !== itemId) } : d
          ),
        })),

      getActiveVisual: () => {
        const state = get();
        return state.visuals.find((v) => v.id === state.activeVisualId) || null;
      },

      // ── Theme ──
      setThemeMode: (mode) => set({ themeMode: mode === "light" ? "light" : "dark" }),
      toggleThemeMode: () => set((state) => ({ themeMode: state.themeMode === "light" ? "dark" : "light" })),

      // ── Calculated Fields ──
      addCalculatedField: ({ name, formula, type = "number" }) =>
        set((state) => {
          if (!name || !formula) return state;
          if (state.calculatedFields.some((cf) => cf.name === name)) return state;
          if (state.columns.includes(name)) return state;
          return { calculatedFields: [...state.calculatedFields, { id: createId("calc"), name, formula, type }] };
        }),

      removeCalculatedField: (id) =>
        set((state) => ({
          calculatedFields: state.calculatedFields.filter((cf) => cf.id !== id),
        })),

      updateCalculatedField: (id, patch) =>
        set((state) => ({
          calculatedFields: state.calculatedFields.map((cf) => (cf.id === id ? { ...cf, ...patch } : cf)),
        })),

      // ── Scenarios ──
      addScenario: (name) =>
        set((state) => {
          const scenario = createEmptyScenario(name || `Scenario ${state.scenarios.length + 1}`);
          return { scenarios: [...state.scenarios, scenario], activeScenarioId: state.activeScenarioId || scenario.id };
        }),

      removeScenario: (id) =>
        set((state) => ({
          scenarios: state.scenarios.filter((s) => s.id !== id),
          activeScenarioId: state.activeScenarioId === id ? null : state.activeScenarioId,
        })),

      renameScenario: (id, name) =>
        set((state) => ({
          scenarios: state.scenarios.map((s) => (s.id === id ? { ...s, name: name || s.name } : s)),
        })),

      setActiveScenario: (id) => set({ activeScenarioId: id }),

      addScenarioAdjustment: (scenarioId, adjustment) =>
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId
              ? {
                  ...s,
                  adjustments: [
                    ...s.adjustments,
                    {
                      id: createId("adj"),
                      field: adjustment?.field || "",
                      operation: adjustment?.operation || "multiply",
                      value: adjustment?.value ?? 1,
                    },
                  ],
                }
              : s
          ),
        })),

      updateScenarioAdjustment: (scenarioId, adjustmentId, patch) =>
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId
              ? { ...s, adjustments: s.adjustments.map((a) => (a.id === adjustmentId ? { ...a, ...patch } : a)) }
              : s
          ),
        })),

      removeScenarioAdjustment: (scenarioId, adjustmentId) =>
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId
              ? { ...s, adjustments: s.adjustments.filter((a) => a.id !== adjustmentId) }
              : s
          ),
        })),

      // ── Filter Bookmarks ──
      saveFilterBookmark: (name) =>
        set((state) => {
          if (!name?.trim()) return state;
          const bookmark = { id: createId("bm"), name: name.trim(), filters: { ...state.filters } };
          return { filterBookmarks: [...state.filterBookmarks, bookmark] };
        }),

      applyFilterBookmark: (id) =>
        set((state) => {
          const bm = state.filterBookmarks.find((b) => b.id === id);
          return bm ? { filters: { ...bm.filters } } : state;
        }),

      deleteFilterBookmark: (id) =>
        set((state) => ({
          filterBookmarks: state.filterBookmarks.filter((b) => b.id !== id),
        })),
    }),
    {
      name: "datacanvas.workbook",
      partialize: (state) => ({
        rawData: state.rawData,
        columns: state.columns,
        dataTypes: state.dataTypes,
        filters: state.filters,
        visuals: state.visuals,
        activeVisualId: state.activeVisualId,
        hierarchies: state.hierarchies,
        dashboards: state.dashboards,
        activeDashboardId: state.activeDashboardId,
        themeMode: state.themeMode,
        calculatedFields: state.calculatedFields,
        scenarios: state.scenarios,
        activeScenarioId: state.activeScenarioId,
        filterBookmarks: state.filterBookmarks,
        // undoStack and redoStack are intentionally excluded
      }),
    }
  )
);
