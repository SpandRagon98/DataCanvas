import { create } from "zustand";

const DEMO_DATA = [
  {
    Date: "2026-01-01",
    Region: "North",
    Product: "Laptop",
    Category: "Electronics",
    Revenue: 120000,
    Cost: 90000,
    Profit: 30000,
    Units: 12,
    Salesperson: "Aman",
  },
  {
    Date: "2026-01-02",
    Region: "South",
    Product: "Phone",
    Category: "Electronics",
    Revenue: 80000,
    Cost: 50000,
    Profit: 30000,
    Units: 20,
    Salesperson: "Riya",
  },
  {
    Date: "2026-01-03",
    Region: "East",
    Product: "Chair",
    Category: "Furniture",
    Revenue: 40000,
    Cost: 25000,
    Profit: 15000,
    Units: 15,
    Salesperson: "Neeraj",
  },
  {
    Date: "2026-01-04",
    Region: "West",
    Product: "Desk",
    Category: "Furniture",
    Revenue: 70000,
    Cost: 45000,
    Profit: 25000,
    Units: 10,
    Salesperson: "Sara",
  },
  {
    Date: "2026-01-05",
    Region: "North",
    Product: "Phone",
    Category: "Electronics",
    Revenue: 100000,
    Cost: 70000,
    Profit: 30000,
    Units: 22,
    Salesperson: "Aman",
  },
];

const detectType = (values) => {
  let numberCount = 0;
  let dateCount = 0;
  let boolCount = 0;
  let nonEmpty = 0;

  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    nonEmpty++;

    if (!isNaN(Number(v))) numberCount++;
    if (!isNaN(Date.parse(v))) dateCount++;
    if (
      String(v).toLowerCase() === "true" ||
      String(v).toLowerCase() === "false"
    ) {
      boolCount++;
    }
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

  cols.forEach((c) => {
    dataTypes[c] = detectType(rows.map((r) => r[c]));
  });

  return { columns: cols, dataTypes };
};

const { columns: demoColumns, dataTypes: demoTypes } = buildColumns(DEMO_DATA);

export const useStore = create((set, get) => ({
  rawData: DEMO_DATA,
  columns: demoColumns,
  dataTypes: demoTypes,

  filters: {},
  visuals: [],
  activeVisualId: null,

  hierarchies: [],

  setData: (data, columns, types) =>
    set({
      rawData: data,
      columns,
      dataTypes: types,
      filters: {},
      visuals: [],
      activeVisualId: null,
      hierarchies: [],
    }),

  updateCell: ({ rowIndex, field, value }) =>
    set((state) => {
      const next = [...state.rawData];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return { rawData: next };
    }),

  addVisual: () =>
    set((state) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `visual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

      return {
        visuals: [...state.visuals, newVisual],
        activeVisualId: id,
      };
    }),

  removeVisual: (id) =>
    set((state) => {
      const next = state.visuals.filter((v) => v.id !== id);
      return {
        visuals: next,
        activeVisualId:
          state.activeVisualId === id ? next[0]?.id ?? null : state.activeVisualId,
      };
    }),

  setActiveVisual: (id) => set({ activeVisualId: id }),

  updateVisual: (id, patch) =>
    set((state) => ({
      visuals: state.visuals.map((v) =>
        v.id === id ? { ...v, ...patch } : v
      ),
    })),

  assignFieldToVisual: ({ visualId, zone, field }) =>
    set((state) => ({
      visuals: state.visuals.map((v) => {
        if (v.id !== visualId) return v;

        if (zone === "xFields") {
          const exists = v.xFields.includes(field);
          return {
            ...v,
            xFields: exists ? v.xFields : [...v.xFields, field],
          };
        }

        if (zone === "yFields") {
          const exists = v.yFields.includes(field);
          return {
            ...v,
            yFields: exists ? v.yFields : [...v.yFields, field],
          };
        }

        if (zone === "legendField") {
          return { ...v, legendField: field };
        }

        if (zone === "tooltipFields") {
          const exists = v.tooltipFields.includes(field);
          return {
            ...v,
            tooltipFields: exists
              ? v.tooltipFields
              : [...v.tooltipFields, field],
          };
        }

        return v;
      }),
    })),

  removeFieldFromVisual: ({ visualId, zone, field }) =>
    set((state) => ({
      visuals: state.visuals.map((v) => {
        if (v.id !== visualId) return v;

        if (zone === "xFields") {
          return { ...v, xFields: v.xFields.filter((f) => f !== field) };
        }

        if (zone === "yFields") {
          return { ...v, yFields: v.yFields.filter((f) => f !== field) };
        }

        if (zone === "tooltipFields") {
          return {
            ...v,
            tooltipFields: v.tooltipFields.filter((f) => f !== field),
          };
        }

        if (zone === "legendField") {
          return { ...v, legendField: "" };
        }

        return v;
      }),
    })),

  setGlobalFilter: (field, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [field]: value,
      },
    })),

  clearGlobalFilters: () => set({ filters: {} }),

  addHierarchy: (hierarchy) =>
    set((state) => ({
      hierarchies: [...state.hierarchies, hierarchy],
    })),

  removeHierarchy: (hierarchyName) =>
    set((state) => ({
      hierarchies: state.hierarchies.filter((h) => h.name !== hierarchyName),
    })),

  getActiveVisual: () => {
    const state = get();
    return state.visuals.find((v) => v.id === state.activeVisualId) || null;
  },
}));
