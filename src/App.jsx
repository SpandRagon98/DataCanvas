import { HashRouter, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { Database, BarChart3, Table2, Layers3, ArrowRight, LayoutDashboard } from "lucide-react";
import DataSource from "./pages/DataSource";
import DataTable from "./pages/DataTable";
import ReportBuilder from "./pages/ReportBuilder";
import Hierarchies from "./pages/Hierarchies";
import Dashboard from "./pages/Dashboard";
import { T } from "./styles/theme";

function TopNav() {
  const linkClass = ({ isActive }) =>
    `inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
      isActive ? "text-black" : "text-zinc-400 hover:text-zinc-100"
    }`;

  const activeStyle = ({ isActive }) =>
    isActive
      ? {
          background: T.accent,
          boxShadow: "0 0 0 1px rgba(245,158,11,0.18) inset",
        }
      : {};

  return (
    <div
      className="sticky top-0 z-20 border-b"
      style={{
        background: "rgba(17,17,19,0.92)",
        backdropFilter: "blur(10px)",
        borderColor: T.border,
      }}
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: T.accent }}
          >
            <Database size={18} color="#000" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight" style={{ color: T.text }}>
              DataCanvas
            </div>
            <div className="text-xs" style={{ color: T.dim }}>
              Lightweight BI + planning workspace
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-2 rounded-2xl border p-1"
          style={{ background: T.s2, borderColor: T.border }}
        >
          <NavLink to="/source" className={linkClass} style={activeStyle}>
            <Database size={14} />
            Data Source
          </NavLink>

          <NavLink to="/table" className={linkClass} style={activeStyle}>
            <Table2 size={14} />
            Data Table
          </NavLink>

          <NavLink to="/report" className={linkClass} style={activeStyle}>
            <BarChart3 size={14} />
            Report Builder
          </NavLink>

          <NavLink to="/dashboard" className={linkClass} style={activeStyle}>
            <LayoutDashboard size={14} />
            Dashboard
          </NavLink>

          <NavLink to="/hierarchies" className={linkClass} style={activeStyle}>
            <Layers3 size={14} />
            Hierarchies
          </NavLink>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-112px)] max-w-6xl items-center justify-center px-4 py-10">
      <div
        className="w-full rounded-[32px] border px-8 py-14 text-center shadow-sm md:px-14"
        style={{
          background:
            "radial-gradient(circle at top, rgba(245,158,11,0.12), rgba(9,9,11,0) 38%), #111113",
          borderColor: T.border,
        }}
      >
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: T.accent }}
        >
          <Database size={28} color="#000" />
        </div>

        <div
          className="mx-auto inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
          style={{
            background: T.accentDim,
            borderColor: "rgba(245,158,11,0.18)",
            color: T.accent,
          }}
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
  return (
    <HashRouter>
      <div className="min-h-screen" style={{ background: T.bg }}>
        <TopNav />
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
      </div>
    </HashRouter>
  );
}
