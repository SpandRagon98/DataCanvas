import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import DataSource from './pages/DataSource'
import DataTable from './pages/DataTable'
import ReportBuilder from './pages/ReportBuilder'

function TopNav() {
  const linkClass = ({ isActive }) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-slate-900 text-white shadow-soft'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between px-6 py-4">
        <div>
          <div className="text-xl font-bold tracking-tight text-slate-900">DataCanvas</div>
          <div className="text-sm text-slate-500">Lightweight BI + planning workspace</div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-soft">
          <NavLink to="/" className={linkClass}>
            Data Source
          </NavLink>
          <NavLink to="/table" className={linkClass}>
            Data Table
          </NavLink>
          <NavLink to="/report" className={linkClass}>
            Report Builder
          </NavLink>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen">
        <TopNav />
        <div className="mx-auto max-w-[1680px] p-4">
          <Routes>
            <Route path="/" element={<DataSource />} />
            <Route path="/table" element={<DataTable />} />
            <Route path="/report" element={<ReportBuilder />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  )
}
