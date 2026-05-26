import { useEffect, useRef, useState } from "react";
import {
  HashRouter, NavLink, Navigate, Route, Routes, useLocation,
} from "react-router-dom";
import {
  Database, BarChart3, Table2, Layers3, LayoutDashboard,
  Sun, Moon, Sparkles, Save, FolderOpen, GitMerge,
} from "lucide-react";
import DataSource    from "./pages/DataSource";
import DataTable     from "./pages/DataTable";
import ReportBuilder from "./pages/ReportBuilder";
import Hierarchies   from "./pages/Hierarchies";
import Dashboard     from "./pages/Dashboard";
import ScenarioPanel from "./components/scenario/ScenarioPanel";
import { useStore }  from "./store/useStore";
import { useTheme, applyThemeToDocument } from "./styles/theme";

// ── Nav items ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: "/source",      icon: Database,        label: "Data Source"    },
  { to: "/table",       icon: Table2,          label: "Data Table"     },
  { to: "/report",      icon: BarChart3,       label: "Report Builder" },
  { to: "/dashboard",   icon: LayoutDashboard, label: "Dashboard"      },
  { to: "/hierarchies", icon: Layers3,         label: "Hierarchies"    },
];

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ onOpenScenario }) {
  const T              = useTheme();
  const themeMode      = useStore((s) => s.themeMode);
  const toggleTheme    = useStore((s) => s.toggleThemeMode);
  const scenarios      = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const loadWorkbook   = useStore((s) => s.loadWorkbook);
  const datasets       = useStore((s) => s.datasets);
  const activeDatasetId = useStore((s) => s.activeDatasetId);
  const fileInputRef   = useRef(null);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) || null;
  const activeDataset  = datasets.find((d) => d.id === activeDatasetId) || null;

  const handleSave = () => {
    const s = useStore.getState();
    const blob = new Blob([JSON.stringify({
      version: "1.0",
      savedAt: new Date().toISOString(),
      rawData: s.rawData, columns: s.columns, dataTypes: s.dataTypes,
      datasets: s.datasets, activeDatasetId: s.activeDatasetId,
      apiConnectors: s.apiConnectors,
      filters: s.filters, visuals: s.visuals, activeVisualId: s.activeVisualId,
      hierarchies: s.hierarchies, dashboards: s.dashboards, activeDashboardId: s.activeDashboardId,
      themeMode: s.themeMode, calculatedFields: s.calculatedFields,
      scenarios: s.scenarios, activeScenarioId: s.activeScenarioId,
      filterBookmarks: s.filterBookmarks,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `datacanvas-${Date.now()}.json` }).click();
    URL.revokeObjectURL(url);
  };

  const handleOpenFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { loadWorkbook(JSON.parse(ev.target.result)); }
      catch { alert("Invalid DataCanvas workbook file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const isDark = themeMode === "dark";

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 196,
        height: "100vh",
        background: T.sidebarBg,
        borderRight: `1px solid ${T.border}`,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* ── Logo ── */}
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: T.accent,
              boxShadow: "0 2px 14px rgba(245,158,11,0.38)",
            }}
          >
            <Database size={17} color="#000" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold tracking-tight leading-none" style={{ color: T.text }}>
              DataCanvas
            </div>
            <div className="mt-0.5 text-[10.5px] leading-none" style={{ color: T.muted }}>
              BI Workspace
            </div>
          </div>
        </div>
      </div>

      {/* ── Active dataset pill ── */}
      {activeDataset && (
        <div className="mx-3 mb-3">
          <div
            className="rounded-xl border px-3 py-2"
            style={{ background: T.s2, borderColor: T.border }}
          >
            <div
              className="mb-1 text-[9.5px] font-semibold uppercase tracking-widest"
              style={{ color: T.muted }}
            >
              Active Dataset
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-medium" style={{ color: T.text }}>
                {activeDataset.name}
              </span>
              <span
                className="mono shrink-0 text-[10px]"
                style={{ color: T.muted }}
              >
                {activeDataset.rows.length.toLocaleString()}r
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Section label ── */}
      <div className="mx-4 mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
          Navigation
        </span>
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 px-2 space-y-0.5 anim-slide-left stagger">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link anim-fade-in ${isActive ? "active" : ""}`}
          >
            <Icon size={15} strokeWidth={isActive => isActive ? 2.2 : 1.8} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Divider ── */}
      <div className="mx-3 my-2 border-t" style={{ borderColor: T.border }} />

      {/* ── Bottom actions ── */}
      <div className="px-2 pb-2 space-y-0.5">
        <div
          className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: T.muted }}
        >
          Workspace
        </div>

        <button
          onClick={handleSave}
          className="nav-link w-full text-left"
        >
          <Save size={14} strokeWidth={1.8} />
          <span>Save Workbook</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="nav-link w-full text-left"
        >
          <FolderOpen size={14} strokeWidth={1.8} />
          <span>Open Workbook</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleOpenFile}
        />

        <button
          onClick={onOpenScenario}
          className={`nav-link w-full text-left ${activeScenario ? "active" : ""}`}
        >
          <Sparkles size={14} strokeWidth={1.8} />
          <span className="flex-1 truncate">
            {activeScenario ? activeScenario.name : "Scenarios"}
          </span>
          {activeScenario && (
            <span
              className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: T.accent }}
            />
          )}
        </button>

        {/* ── Theme toggle ── */}
        <div
          className="mt-3 flex items-center rounded-xl border p-1"
          style={{ background: T.s2, borderColor: T.border }}
        >
          {[
            { mode: "dark",  Icon: Moon, label: "Dark"  },
            { mode: "light", Icon: Sun,  label: "Light" },
          ].map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => themeMode !== mode && toggleTheme()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-1.5 text-xs font-medium"
              style={{
                background: themeMode === mode ? T.s3 : "transparent",
                color:      themeMode === mode ? T.text : T.muted,
                boxShadow:  themeMode === mode ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                transition: "all 150ms ease",
              }}
            >
              <Icon size={11} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        {/* Version */}
        <div
          className="px-2 pb-1 pt-2 text-[10px] font-medium"
          style={{ color: T.muted }}
        >
          DataCanvas · v4.0
        </div>
      </div>
    </aside>
  );
}

// ── Animated route wrapper ─────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation();
  return (
    // flex-1 + flex-col so page roots can use flex-1 to fill this container
    <div key={location.pathname} className="page-enter flex-1 flex flex-col min-h-0">
      <Routes location={location}>
        <Route path="/"           element={<Navigate to="/source" replace />} />
        <Route path="/source"     element={<DataSource />} />
        <Route path="/table"      element={<DataTable />} />
        <Route path="/report"     element={<ReportBuilder />} />
        <Route path="/dashboard"  element={<Dashboard />} />
        <Route path="/hierarchies" element={<Hierarchies />} />
      </Routes>
    </div>
  );
}

// ── App root ───────────────────────────────────────────────────────────────
export default function App() {
  const T         = useTheme();
  const themeMode = useStore((s) => s.themeMode);
  const [scenarioOpen, setScenarioOpen] = useState(false);

  useEffect(() => {
    applyThemeToDocument(themeMode);
  }, [themeMode]);

  return (
    <HashRouter>
      <div
        className="flex overflow-hidden"
        style={{ height: "100vh", background: T.bg }}
      >
        <Sidebar onOpenScenario={() => setScenarioOpen(true)} />

        {/* flex-col so children (AnimatedRoutes) can fill with flex-1 */}
        <main
          className="flex-1 min-w-0 flex flex-col overflow-hidden"
          style={{ background: T.bg }}
        >
          <AnimatedRoutes />
        </main>

        <ScenarioPanel
          open={scenarioOpen}
          onClose={() => setScenarioOpen(false)}
        />
      </div>
    </HashRouter>
  );
}
