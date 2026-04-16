import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { Database, BarChart3, Table2, Layers3 } from "lucide-react";
import DataSource from "./pages/DataSource";
import DataTable from "./pages/DataTable";
import ReportBuilder from "./pages/ReportBuilder";
import Hierarchies from "./pages/Hierarchies";
import { T } from "./styles/theme";

function TopNav() {
  const linkClass = ({ isActive }) =>
    `inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
      isActive
        ? "text-black"
        : "text-zinc-400 hover:text-zinc-100"
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
          <NavLink to="/" className={linkClass} style={activeStyle}>
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

          <NavLink to="/hierarchies" className={linkClass} style={activeStyle}>
            <Layers3 size={14} />
            Hierarchies
          </NavLink>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen" style={{ background: T.bg }}>
        <TopNav />
        <div className="mx-auto max-w-[1600px] p-4">
          <Routes>
            <Route path="/" element={<DataSource />} />
            <Route path="/table" element={<DataTable />} />
            <Route path="/report" element={<ReportBuilder />} />
            <Route path="/hierarchies" element={<Hierarchies />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
