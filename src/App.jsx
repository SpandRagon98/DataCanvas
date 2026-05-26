import { useEffect, useRef, useState } from "react";
import { HashRouter, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  Database, BarChart3, Table2, Layers3, ArrowRight, LayoutDashboard,
  Sun, Moon, Sparkles, Save, FolderOpen,
} from "lucide-react";
import DataSource from "./pages/DataSource";
import DataTable from "./pages/DataTable";
import ReportBuilder from "./pages/ReportBuilder";
import Hierarchies from "./pages/Hierarchies";
import Dashboard from "./pages/Dashboard";
import ScenarioPanel from "./components/scenario/ScenarioPanel";
import { useStore } from "./store/useStore";
import { useTheme, applyThemeToDocument } from "./styles/theme";

function TopNav({ onOpenScenario }) {
  const T = useTheme();
  const themeMode = useStore((s) => s.themeMode);
  const toggleThemeMode = useStore((s) => s.toggleThemeMode);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const loadWorkbook = useStore((s) => s.loadWorkbook);
  const fileInputRef = useRef(null);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) || null;

  const handleSave = () => {
    const state = useStore.getState();
    const snapshot = {
      version: "1.0",
      savedAt: new Date().toISOString(),
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
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `datacanvas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = JSON.parse(ev.target.result);
        loadWorkbook(wb);
      } catch {
        alert("Could not read workbook file. Make sure it is a valid DataCanvas JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const linkClass = ({ isActive }) =>
    `inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
      isActive ? "text-black" : "hover:opacity-90"
    }`;

  const activeStyle = ({ isActive }) =>
    isActive
      ? { background: T.accent, color: "#000", boxShadow: "0 0 0 1px rgba(245,158,11,0.18) inset" }
      : { color: T.dim };

  return (
    <div
      className="sticky top-0 z-20 border-b"
      style={{ background: T.navBg, backdropFilter: "blur(10px)", borderColor: T.border }}
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: T.accent }}
          >
            <Database size={18} color="#000" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight" style={{ color: T.text }}>DataCanvas</div>
            <div className="text-xs" style={{ color: T.dim }}>Lightweight BI + planning workspace</div>
          </div>
        </div>

        {/* Nav links */}
        <div
          className="flex items-center gap-2 rounded-2xl border p-1"
          style={{ background: T.s2, borderColor: T.border }}
        >
          <NavLink to="/source" className={linkClass} style={activeStyle}>
            <Database size={14} /> Data Source
          </NavLink>
          <NavLink to="/table" className={linkClass} style={activeStyle}>
            <Table2 size={14} /> Data Table
          </NavLink>
          <NavLink to="/report" className={linkClass} style={activeStyle}>
            <BarChart3 size={14} /> Report Builder
          </NavLink>
          <NavLink to="/dashboard" className={linkClass} style={activeStyle}>
            <LayoutDashboard size={14} /> Dashboard
          </NavLink>
          <NavLink to="/hierarchies" className={linkClass} style={activeStyle}>
            <Layers3 size={14} /> Hierarchies
          </NavLink>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Save workbook */}
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}
            title="Save workbook as JSON"
          >
            <Save size={14} />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Open workbook */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}
            title="Open workbook from JSON"
          >
            <FolderOpen size={14} />
            <span className="hidden sm:inline">Open</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleOpenFile}
          />

          {/* Scenarios */}
          <button
            onClick={onOpenScenario}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
            style={{
              background: activeScenario ? T.accentDim : T.s2,
              borderColor: activeScenario ? T.accent : T.border,
              color: activeScenario ? T.accent : T.text,
            }}
            title="What-If scenarios"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">
              {activeScenario ? activeScenario.name : "Scenarios"}
            </span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleThemeMode}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}
            title={themeMode === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {themeMode === "light" ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const T = useTheme();
  const navigate = useNavigate();
  const themeMode = useStore((s) => s.themeMode);

  const heroGradient =
    themeMode === "light"
      ? "radial-gradient(circle at top, rgba(245,158,11,0.18), rgba(255,255,255,0) 45%), #ffffff"
      : "radial-gradient(circle at top, rgba(245,158,11,0.12), rgba(9,9,11,0) 38%), #111113";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-112px)] max-w-6xl items-center justify-center px-4 py-10">
      <div
        className="w-full rounded-[32px] border px-8 py-14 text-center shadow-sm md:px-14"
        style={{ background: heroGradient, borderColor: T.border }}
      >
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: T.accent }}
        >
          <Database size={28} color="#000" />
        </div>

        <div
          className="mx-auto inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ background: T.accentDim, borderColor: "rgba(245,158,11,0.18)", color: T.accent }}
        >
          Welcome to DataCanvas
        </div>

        <h1
          className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl"
          style={{ color: T.text }}
        >
          Your personal planning and reporting workspace
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base md:text-lg" style={{ color: T.dim }}>
          Import your data, edit it live, build interactive visuals, organize dashboards, and define hierarchies in one clean workspace.
        </p>

        <div className="mt-10 flex items-center justify-center">
          <button
            onClick={() => navigate("/source")}
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition hover:translate-y-[-1px]"
            style={{ background: T.accent, color: "#000" }}
          >
            Explore Now
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const T = useTheme();
  const themeMode = useStore((s) => s.themeMode);
  const [scenarioOpen, setScenarioOpen] = useState(false);

  useEffect(() => {
    applyThemeToDocument(themeMode);
  }, [themeMode]);

  return (
    <HashRouter>
      <div className="min-h-screen" style={{ background: T.bg }}>
        <TopNav onOpenScenario={() => setScenarioOpen(true)} />
        <div className="mx-auto max-w-[1600px] p-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/source" element={<DataSource />} />
            <Route path="/table" element={<DataTable />} />
            <Route path="/report" element={<ReportBuilder />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/hierarchies" element={<Hierarchies />} />
          </Routes>
        </div>

        <ScenarioPanel open={scenarioOpen} onClose={() => setScenarioOpen(false)} />
      </div>
    </HashRouter>
  );
}
