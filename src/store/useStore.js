import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEmptyScenario } from "../utils/scenarioEngine";
import { log, A } from "../lib/auditLog";
import { ensureCalendarTable, CALENDAR_DATASET_ID } from "../utils/calendarTable";

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

const DEMO_DATASET_ID = "demo-dataset-v1";

export const DEFAULT_TILE_STYLE = {
  bgColor:       null,   // null → theme default
  borderColor:   null,   // null → theme default
  borderEnabled: true,
  borderRadius:  16,
  shadow:        true,
  transparency:  1,
  padding:       12,
  fontFamily:    "inherit",
  fontSize:      null,   // null → inherit
  fontWeight:    null,   // null → inherit
  textColor:     null,   // null → theme default
};

const createDefaultDashboard = () => ({
  id: createId("dashboard"),
  name: "Dashboard 1",
  items: [],
  annotations: [],
});

const createDashboardItem = (visual, existingItems = []) => {
  const nextY = existingItems.reduce(
    (max, item) => Math.max(max, (item.layout?.y || 0) + (item.layout?.h || 340) + 16),
    0
  );
  return {
    id:           createId("dash_item"),
    type:         "visual",
    visualConfig: JSON.parse(JSON.stringify(visual)),
    layout:       { x: 16, y: nextY + 16, w: 520, h: 340, minW: 160, minH: 120 },
    tileStyle:    { ...DEFAULT_TILE_STYLE },
  };
};

const createTextboxItem = (existingItems = []) => {
  const nextY = existingItems.reduce(
    (max, item) => Math.max(max, (item.layout?.y || 0) + (item.layout?.h || 120) + 16),
    0
  );
  return {
    id:        createId("textbox"),
    type:      "textbox",
    text:      "Double-click to edit text",
    textStyle: {
      fontFamily: "inherit",
      fontSize:   16,
      fontWeight: 400,
      color:      null,
      italic:     false,
      align:      "left",
      bgColor:    null,
    },
    layout:    { x: 100, y: nextY + 16, w: 320, h: 120, minW: 80, minH: 40 },
    tileStyle: { ...DEFAULT_TILE_STYLE },
  };
};

const { columns: demoColumns, dataTypes: demoTypes } = buildColumns(DEMO_DATA);
const initialDashboard = createDefaultDashboard();

const _baseDemoDatasets = [{
  id: DEMO_DATASET_ID,
  name: "Demo Sales",
  rows: DEMO_DATA,
  columns: demoColumns,
  dataTypes: demoTypes,
  sourceType: "demo",
  sourceConfig: {},
}];

// Generate Calendar table from demo data at startup
const {
  datasets:      initialDatasets,
  relationships: initialRelationships,
} = ensureCalendarTable(_baseDemoDatasets, []);

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Core data (mirrors the active dataset) ──
      rawData: DEMO_DATA,
      columns: demoColumns,
      dataTypes: demoTypes,

      // ── Multi-dataset slots ──
      datasets: initialDatasets,
      activeDatasetId: DEMO_DATASET_ID,

      // ── REST API Connectors ──
      apiConnectors: [],

      // ── Visuals ──
      filters: {},
      visuals: [],
      activeVisualId: null,

      // ── Hierarchies ──
      hierarchies: [],

      // ── Dashboards ──
      dashboards: [initialDashboard],
      activeDashboardId: initialDashboard.id,

      // ── Theme ──
      themeMode: "dark",

      // ── Calc fields ──
      calculatedFields: [],

      // ── Scenarios ──
      scenarios: [],
      activeScenarioId: null,

      // ── Filter bookmarks (Phase 1) ──
      filterBookmarks: [],

      // ── Cross-filter — transient, not persisted ──
      crossFilter: {},

      // ── Column aliases (display names) — persisted ──
      // Maps originalKey → display label. Internal keys never change.
      columnAliases: {},

      // ── Data Modelling — relationships & canvas layout ──
      relationships: initialRelationships,
      modelLayout: {},   // { [datasetId]: { x, y } }

      // ── Measures (DAX) ──
      // Each: { id, name, formula, description, format }
      measures: [],

      // ── Cloud meta — transient, not persisted to localStorage ──
      cloudWorkbookId:   null,
      cloudWorkbookName: null,
      cloudWorkspaceId:  null,

      // ── Incremental calc field tracking — transient ──
      // Set to the edited row index by updateCell; reset to -1 on any bulk change.
      lastEditRowIndex: -1,

      // ── Undo / Redo — intentionally excluded from persist (see partialize) ──
      undoStack: [],
      redoStack: [],

      // ── Actions ──

      // ── Column rename ──
      renameColumn: (originalKey, alias) =>
        set((state) => ({
          columnAliases: {
            ...state.columnAliases,
            [originalKey]: alias?.trim() || originalKey,
          },
        })),

      resetColumnAlias: (originalKey) =>
        set((state) => {
          const next = { ...state.columnAliases };
          delete next[originalKey];
          return { columnAliases: next };
        }),

      setData: (data, columns, types, name) => {
        const resetDashboard = createDefaultDashboard();
        const id = createId("dataset");
        const newDataset = {
          id,
          name: name || "Imported Dataset",
          rows: data,
          columns,
          dataTypes: types,
          sourceType: "file",
          sourceConfig: {},
        };
        log({ action: A.DATA_IMPORTED, target: name || "Imported Dataset",
              detail: `${data.length.toLocaleString()} rows, ${columns.length} columns`,
              workbook_id: useStore.getState().cloudWorkbookId });

        // Generate / refresh the Calendar dimension table
        const { datasets: withCal, relationships: autoRels } =
          ensureCalendarTable([newDataset], []);

        set({
          rawData: data,
          columns,
          dataTypes: types,
          datasets: withCal,
          activeDatasetId: id,
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
          relationships: autoRels,
          modelLayout: {},
          measures: [],
          crossFilter: {},
          lastEditRowIndex: -1,
          undoStack: [],
          redoStack: [],
        });
      },

      loadWorkbook: (wb) => {
        const fallback = createDefaultDashboard();
        const fallbackId = `migrated-${Date.now()}`;
        const fallbackDatasets = [{
          id: fallbackId,
          name: "My Dataset",
          rows: wb.rawData ?? DEMO_DATA,
          columns: wb.columns ?? demoColumns,
          dataTypes: wb.dataTypes ?? demoTypes,
          sourceType: "file",
          sourceConfig: {},
        }];

        const loadedDatasets = wb.datasets ?? fallbackDatasets;
        const loadedRels     = wb.relationships ?? [];

        // Ensure Calendar is present and up-to-date
        const hasCalendar = loadedDatasets.some((d) => d.id === CALENDAR_DATASET_ID);
        const { datasets: datasetsWithCal, relationships: relsWithCal } =
          hasCalendar
            ? { datasets: loadedDatasets, relationships: loadedRels }
            : ensureCalendarTable(loadedDatasets, loadedRels);

        set({
          rawData: wb.rawData ?? DEMO_DATA,
          columns: wb.columns ?? demoColumns,
          dataTypes: wb.dataTypes ?? demoTypes,
          datasets: datasetsWithCal,
          activeDatasetId: wb.activeDatasetId ?? fallbackId,
          apiConnectors: wb.apiConnectors ?? [],
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
          relationships: relsWithCal,
          modelLayout: wb.modelLayout ?? {},
          measures: wb.measures ?? [],
          crossFilter: {},
          undoStack: [],
          redoStack: [],
        });
      },

      // ── Dataset slot actions ──

      addDataset: ({ name, rows, columns, dataTypes, sourceType = "file", sourceConfig = {} }) =>
        set((state) => {
          const id = createId("dataset");
          const newDataset = {
            id,
            name: name || `Dataset ${state.datasets.length + 1}`,
            rows,
            columns,
            dataTypes,
            sourceType,
            sourceConfig,
          };
          // Rebuild Calendar using all non-system datasets + the new one
          const nonCalendar = state.datasets.filter((d) => d.id !== CALENDAR_DATASET_ID);
          const { datasets: withCal, relationships: autoRels } =
            ensureCalendarTable([...nonCalendar, newDataset], state.relationships);
          return {
            datasets: withCal,
            activeDatasetId: id,
            rawData: rows,
            columns,
            dataTypes,
            relationships: autoRels,
            filters: {},
            crossFilter: {},
          };
        }),

      activateDataset: (id) =>
        set((state) => {
          const ds = state.datasets.find((d) => d.id === id);
          if (!ds) return state;
          return {
            activeDatasetId: id,
            rawData: ds.rows,
            columns: ds.columns,
            dataTypes: ds.dataTypes,
            filters: {},
            crossFilter: {},
          };
        }),

      removeDataset: (id) =>
        set((state) => {
          if (state.datasets.length <= 1) return state;
          const datasets = state.datasets.filter((d) => d.id !== id);
          const isActive = state.activeDatasetId === id;
          const newActive = isActive ? datasets[0] : null;
          return {
            datasets,
            ...(isActive
              ? {
                  activeDatasetId: newActive.id,
                  rawData: newActive.rows,
                  columns: newActive.columns,
                  dataTypes: newActive.dataTypes,
                  filters: {},
                  crossFilter: {},
                }
              : {}),
          };
        }),

      renameDataset: (id, name) =>
        set((state) => ({
          datasets: state.datasets.map((d) => (d.id === id ? { ...d, name: name || d.name } : d)),
        })),

      updateDatasetRows: (id, rows, columns, dataTypes) =>
        set((state) => {
          const datasets = state.datasets.map((d) =>
            d.id === id ? { ...d, rows, columns, dataTypes } : d
          );
          const isActive = state.activeDatasetId === id;
          return {
            datasets,
            ...(isActive ? { rawData: rows, columns, dataTypes, filters: {}, crossFilter: {} } : {}),
          };
        }),

      // ── API Connector actions ──

      addApiConnector: (config) =>
        set((state) => ({
          apiConnectors: [
            ...state.apiConnectors,
            {
              id: createId("api"),
              name: config.name || "API Connector",
              url: config.url || "",
              method: config.method || "GET",
              headers: config.headers || [],
              jsonPath: config.jsonPath || "",
              autoRefresh: config.autoRefresh || false,
              refreshInterval: config.refreshInterval || 60,
              datasetId: null,
              lastFetched: null,
              lastError: null,
              rowCount: 0,
            },
          ],
        })),

      updateApiConnector: (id, patch) =>
        set((state) => ({
          apiConnectors: state.apiConnectors.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeApiConnector: (id) =>
        set((state) => ({
          apiConnectors: state.apiConnectors.filter((c) => c.id !== id),
        })),

      // ── Data editing ──

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

          // Keep active dataset in sync
          const datasets = state.datasets.map((d) =>
            d.id === state.activeDatasetId ? { ...d, rows: nextRawData } : d
          );

          // Audit — non-blocking
          log({
            action:      A.CELL_EDIT,
            target:      field,
            detail:      `Row ${rowIndex}: ${oldValue} → ${parsedValue}`,
            workbook_id: state.cloudWorkbookId,
          });

          return {
            rawData: nextRawData,
            datasets,
            visuals:          [...state.visuals],
            dashboards:       [...state.dashboards],
            lastEditRowIndex: rowIndex, // Phase 6.4 incremental calc
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
          const datasets = state.datasets.map((d) =>
            d.id === state.activeDatasetId ? { ...d, rows: nextRawData } : d
          );
          return {
            rawData: nextRawData,
            datasets,
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
          const datasets = state.datasets.map((d) =>
            d.id === state.activeDatasetId ? { ...d, rows: nextRawData } : d
          );
          return {
            rawData: nextRawData,
            datasets,
            undoStack: [...state.undoStack, entry],
            redoStack: state.redoStack.slice(0, -1),
          };
        }),

      addVisual: () =>
        set((state) => {
          const id = createId("visual");
          log({ action: A.VISUAL_ADDED, target: `Visual ${state.visuals.length + 1}`,
                workbook_id: state.cloudWorkbookId });
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
            referenceLines: [],
            conditionalRules: [],
            showRunningTotal: false,
            showTrendline: false,
            colorPalette: "default",
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
          const v = state.visuals.find((v) => v.id === id);
          log({ action: A.VISUAL_REMOVED, target: v?.title ?? id,
                workbook_id: state.cloudWorkbookId });
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
          // Keep every dashboard copy in sync — dashboard items deep-copy the visual
          // at pin time, so we must re-apply the same patch whenever the source visual
          // changes (chart type, fields, title, colors, numFormat, etc.).
          dashboards: state.dashboards.map((d) => ({
            ...d,
            items: d.items.map((item) =>
              item.type === "visual" && item.visualConfig?.id === id
                ? { ...item, visualConfig: { ...item.visualConfig, ...patch } }
                : item
            ),
          })),
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
        set((state) => {
          log({ action: A.FILTER_CHANGED, target: field,
                detail: Array.isArray(value) ? value.join(", ") : String(value ?? ""),
                workbook_id: state.cloudWorkbookId });
          return { filters: { ...state.filters, [field]: value } };
        }),

      clearGlobalFilters: () => {
        log({ action: A.FILTER_CLEARED,
              workbook_id: useStore.getState().cloudWorkbookId });
        set({ filters: {} });
      },

      addHierarchy: (hierarchy) =>
        set((state) => ({ hierarchies: [...state.hierarchies, hierarchy] })),

      removeHierarchy: (hierarchyName) =>
        set((state) => ({ hierarchies: state.hierarchies.filter((h) => h.name !== hierarchyName) })),

      createDashboard: () =>
        set((state) => {
          const name = `Dashboard ${state.dashboards.length + 1}`;
          const dashboard = { id: createId("dashboard"), name, items: [], annotations: [] };
          log({ action: A.DASHBOARD_CREATED, target: name,
                workbook_id: state.cloudWorkbookId });
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
          const visual   = state.visuals.find((v) => v.id === visualId);
          const targetId = dashboardId || state.activeDashboardId;
          if (!visual || !targetId) return state;
          const dash = state.dashboards.find((d) => d.id === targetId);
          log({ action: A.DASH_ITEM_ADDED, target: visual.title,
                detail: `Added to ${dash?.name ?? "dashboard"}`,
                workbook_id: state.cloudWorkbookId });
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

      // General-purpose item patch (covers tileStyle, textStyle, text, etc.)
      updateDashboardItem: ({ dashboardId, itemId, patch }) =>
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id !== dashboardId ? d : {
              ...d,
              items: d.items.map((item) =>
                item.id !== itemId ? item : { ...item, ...patch }
              ),
            }
          ),
        })),

      addTextboxToDashboard: (dashboardId) =>
        set((state) => {
          const targetId = dashboardId || state.activeDashboardId;
          const dash = state.dashboards.find((d) => d.id === targetId);
          if (!dash) return state;
          return {
            dashboards: state.dashboards.map((d) =>
              d.id !== targetId ? d : {
                ...d,
                items: [...d.items, createTextboxItem(d.items)],
              }
            ),
          };
        }),

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

      // ── Dashboard Annotations ──
      addDashboardAnnotation: ({ dashboardId }) =>
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === dashboardId
              ? {
                  ...d,
                  annotations: [
                    ...(d.annotations || []),
                    {
                      id: createId("anno"),
                      x: 20,
                      y: 20,
                      w: 220,
                      text: "📝 Add your note here…",
                      color: "rgba(245,158,11,0.15)",
                    },
                  ],
                }
              : d
          ),
        })),

      updateDashboardAnnotation: ({ dashboardId, annotationId, patch }) =>
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === dashboardId
              ? {
                  ...d,
                  annotations: (d.annotations || []).map((a) =>
                    a.id === annotationId ? { ...a, ...patch } : a
                  ),
                }
              : d
          ),
        })),

      removeDashboardAnnotation: ({ dashboardId, annotationId }) =>
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === dashboardId
              ? { ...d, annotations: (d.annotations || []).filter((a) => a.id !== annotationId) }
              : d
          ),
        })),

      // ── Cross-filter ──
      setCrossFilter: (field, value) =>
        set((state) => {
          if (state.crossFilter[field] === String(value)) {
            const next = { ...state.crossFilter };
            delete next[field];
            return { crossFilter: next };
          }
          return { crossFilter: { ...state.crossFilter, [field]: String(value) } };
        }),

      clearCrossFilter: () => set({ crossFilter: {} }),

      // ── Cloud meta ──
      setCloudMeta: (patch) =>
        set((state) => ({
          cloudWorkbookId:   patch.cloudWorkbookId   ?? state.cloudWorkbookId,
          cloudWorkbookName: patch.cloudWorkbookName ?? state.cloudWorkbookName,
          cloudWorkspaceId:  patch.cloudWorkspaceId  ?? state.cloudWorkspaceId,
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

      // ── Data Model — Relationships ──
      addRelationship: (rel) =>
        set((state) => ({ relationships: [...state.relationships, rel] })),

      updateRelationship: (id, patch) =>
        set((state) => ({
          relationships: state.relationships.map((r) =>
            r.id === id ? { ...r, ...patch } : r
          ),
        })),

      deleteRelationship: (id) =>
        set((state) => ({
          relationships: state.relationships.filter((r) => r.id !== id),
        })),

      setModelLayout: (datasetId, pos) =>
        set((state) => ({
          modelLayout: { ...state.modelLayout, [datasetId]: pos },
        })),

      // ── Measures (DAX) ──
      addMeasure: (measure) =>
        set((state) => ({
          measures: [...state.measures, {
            id: measure.id ?? createId("measure"),
            name: measure.name ?? "New Measure",
            formula: measure.formula ?? "",
            description: measure.description ?? "",
            format: measure.format ?? "number",
            createdAt: new Date().toISOString(),
          }],
        })),

      updateMeasure: (id, patch) =>
        set((state) => ({
          measures: state.measures.map((m) =>
            m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
          ),
        })),

      deleteMeasure: (id) =>
        set((state) => ({
          measures: state.measures.filter((m) => m.id !== id),
        })),

      duplicateMeasure: (id) =>
        set((state) => {
          const src = state.measures.find((m) => m.id === id);
          if (!src) return state;
          let name = `${src.name} (copy)`;
          // Avoid name collision
          let n = 2;
          while (state.measures.some((m) => m.name === name)) {
            name = `${src.name} (copy ${n++})`;
          }
          return {
            measures: [...state.measures, {
              ...src,
              id: createId("measure"),
              name,
              createdAt: new Date().toISOString(),
            }],
          };
        }),
    }),
    {
      name: "datacanvas.workbook",
      version: 1,
      migrate: (persistedState, version) => {
        if (version < 1) {
          // Upgrade: wrap existing rawData into a dataset slot
          const id = `migrated-${Date.now()}`;
          return {
            ...persistedState,
            datasets: [{
              id,
              name: "My Dataset",
              rows: persistedState.rawData ?? DEMO_DATA,
              columns: persistedState.columns ?? demoColumns,
              dataTypes: persistedState.dataTypes ?? demoTypes,
              sourceType: "file",
              sourceConfig: {},
            }],
            activeDatasetId: id,
            apiConnectors: [],
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        rawData: state.rawData,
        columns: state.columns,
        dataTypes: state.dataTypes,
        datasets: state.datasets,
        activeDatasetId: state.activeDatasetId,
        apiConnectors: state.apiConnectors,
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
        columnAliases: state.columnAliases,
        relationships: state.relationships,
        modelLayout: state.modelLayout,
        measures: state.measures,
        // undoStack, redoStack, crossFilter intentionally excluded
      }),
    }
  )
);
