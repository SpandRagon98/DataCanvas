import { useEffect, useRef, useState } from "react";
import {
  HashRouter, NavLink, Navigate, Route, Routes, useLocation,
} from "react-router-dom";
import {
  Database, BarChart3, Table2, Layers3, LayoutDashboard,
  Sun, Moon, Sparkles, Save, FolderOpen,
  Share2, History, MessageSquare, Building2, CalendarClock,
  Cloud, ClipboardList, Settings, GitBranch, Sigma,
} from "lucide-react";
import DataSource    from "./pages/DataSource";
import DataTable     from "./pages/DataTable";
import ReportBuilder from "./pages/ReportBuilder";
import Hierarchies   from "./pages/Hierarchies";
import Dashboard     from "./pages/Dashboard";
import DataModelling from "./pages/DataModelling";
import Measures      from "./pages/Measures";
import Auth          from "./pages/Auth";
import SharedView    from "./pages/SharedView";
import ScenarioPanel     from "./components/scenario/ScenarioPanel";
import ShareModal        from "./components/cloud/ShareModal";
import PresenceBar       from "./components/cloud/PresenceBar";
import CommentsPanel     from "./components/cloud/CommentsPanel";
import WorkbookHistory   from "./components/cloud/WorkbookHistory";
import WorkspaceManager  from "./components/cloud/WorkspaceManager";
import ScheduledReports  from "./components/cloud/ScheduledReports";
import AuthGate          from "./components/cloud/AuthGate";
import AuditLog          from "./components/cloud/AuditLog";
import SettingsModal     from "./components/cloud/SettingsModal";
import CommandBar        from "./components/ai/CommandBar";
import { useStore }      from "./store/useStore";
import { useLocalAuth }  from "./store/useLocalAuth";
import { useTheme, applyThemeToDocument } from "./styles/theme";
import { useAuth }       from "./hooks/useAuth";
import { useCloudSync }  from "./hooks/useCloudSync";
import { usePresence }   from "./hooks/usePresence";
import { CLOUD_ENABLED } from "./lib/supabase";
import { ROLES, OWNER_EMAIL } from "./hooks/useRBAC";

// ── Nav items ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: "/source",      icon: Database,        label: "Data Source"    },
  { to: "/table",       icon: Table2,          label: "Data Table"     },
  { to: "/report",      icon: BarChart3,       label: "Report Builder" },
  { to: "/model",       icon: GitBranch,       label: "Data Model"     },
  { to: "/measures",    icon: Sigma,           label: "Measures"       },
  { to: "/dashboard",   icon: LayoutDashboard, label: "Dashboard"      },
  { to: "/hierarchies", icon: Layers3,         label: "Hierarchies"    },
];

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({
  onOpenScenario,
  onOpenShare,
  onOpenHistory,
  onOpenComments,
  onOpenWorkspace,
  onOpenScheduled,
  onOpenAuditLog,
  onOpenSettings,
  onSignIn,
  user,
  localUser,
  isSaving,
  lastSaved,
  online,
}) {
  const T              = useTheme();
  const themeMode      = useStore((s) => s.themeMode);
  const toggleTheme    = useStore((s) => s.toggleThemeMode);
  const scenarios      = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const loadWorkbook   = useStore((s) => s.loadWorkbook);
  const datasets       = useStore((s) => s.datasets);
  const activeDatasetId = useStore((s) => s.activeDatasetId);
  const cloudWorkbookId = useStore((s) => s.cloudWorkbookId);
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
              <span className="mono shrink-0 text-[10px]" style={{ color: T.muted }}>
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
            <Icon size={15} strokeWidth={1.8} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Divider ── */}
      <div className="mx-3 my-2 border-t" style={{ borderColor: T.border }} />

      {/* ── Bottom actions ── */}
      <div className="px-2 pb-2 space-y-0.5">
        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
          Workspace
        </div>

        <button onClick={handleSave} className="nav-link w-full text-left">
          <Save size={14} strokeWidth={1.8} />
          <span>Save Workbook</span>
        </button>

        <button onClick={() => fileInputRef.current?.click()} className="nav-link w-full text-left">
          <FolderOpen size={14} strokeWidth={1.8} />
          <span>Open Workbook</span>
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleOpenFile} />

        <button
          onClick={onOpenScenario}
          className={`nav-link w-full text-left ${activeScenario ? "active" : ""}`}
        >
          <Sparkles size={14} strokeWidth={1.8} />
          <span className="flex-1 truncate">
            {activeScenario ? activeScenario.name : "Scenarios"}
          </span>
          {activeScenario && (
            <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: T.accent }} />
          )}
        </button>

        {/* ── Cloud section ── */}
        {CLOUD_ENABLED && (
          <>
            <div className="mx-2 my-2 border-t" style={{ borderColor: T.border }} />
            <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
              Cloud
            </div>

            {/* Cloud sync status */}
            {user && (
              <div
                className="mx-2 mb-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                style={{ background: T.s2, borderColor: T.border }}
              >
                {isSaving ? (
                  <>
                    <span className="h-1.5 w-1.5 shrink-0 animate-spin rounded-full border border-current border-t-transparent" style={{ color: T.accent }} />
                    <span className="text-[10px]" style={{ color: T.accent }}>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#22c55e" }} />
                    <span className="text-[10px]" style={{ color: T.dim }}>
                      Saved {new Date(lastSaved).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </>
                ) : (
                  <>
                    <Cloud size={10} style={{ color: T.muted }} />
                    <span className="text-[10px]" style={{ color: T.muted }}>Not saved to cloud</span>
                  </>
                )}
              </div>
            )}

            {/* Presence bar */}
            {online?.length > 0 && (
              <div className="mx-2 mb-1.5">
                <PresenceBar online={online} />
              </div>
            )}

            <button onClick={onOpenShare} className="nav-link w-full text-left">
              <Share2 size={14} strokeWidth={1.8} />
              <span>Share Dashboard</span>
            </button>

            <button onClick={onOpenHistory} className="nav-link w-full text-left">
              <History size={14} strokeWidth={1.8} />
              <span>Version History</span>
            </button>

            <button onClick={onOpenComments} className="nav-link w-full text-left">
              <MessageSquare size={14} strokeWidth={1.8} />
              <span>Comments</span>
            </button>

            <button onClick={onOpenWorkspace} className="nav-link w-full text-left">
              <Building2 size={14} strokeWidth={1.8} />
              <span>Workspaces</span>
            </button>

            <button onClick={onOpenScheduled} className="nav-link w-full text-left">
              <CalendarClock size={14} strokeWidth={1.8} />
              <span>Scheduled Reports</span>
            </button>

            <button onClick={onOpenAuditLog} className="nav-link w-full text-left">
              <ClipboardList size={14} strokeWidth={1.8} />
              <span>Audit Log</span>
            </button>
          </>
        )}

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

        {/* ── Auth Gate (cloud mode) ── */}
        {CLOUD_ENABLED && (
          <div className="mt-2">
            <AuthGate user={user} onSignIn={onSignIn} />
          </div>
        )}

        {/* ── Settings button ── */}
        <button
          onClick={onOpenSettings}
          className="nav-link w-full text-left mt-1"
        >
          <Settings size={14} strokeWidth={1.8} />
          <span>Settings</span>
        </button>

        {/* Version */}
        <div className="px-2 pb-1 pt-2 text-[10px] font-medium" style={{ color: T.muted }}>
          DataCanvas · v7.0
        </div>
      </div>
    </aside>
  );
}

// ── Animated route wrapper ─────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter flex-1 flex flex-col min-h-0">
      <Routes location={location}>
        <Route path="/"            element={<Navigate to="/source" replace />} />
        <Route path="/source"      element={<DataSource />} />
        <Route path="/table"       element={<DataTable />} />
        <Route path="/report"      element={<ReportBuilder />} />
        <Route path="/model"       element={<DataModelling />} />
        <Route path="/measures"    element={<Measures />} />
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/hierarchies" element={<Hierarchies />} />
      </Routes>
    </div>
  );
}

// ── App root ───────────────────────────────────────────────────────────────
export default function App() {
  const T         = useTheme();
  const themeMode = useStore((s) => s.themeMode);
  const setCloudMeta = useStore((s) => s.setCloudMeta);

  // Phase 5 — cloud hooks
  const { user, loading: authLoading } = useAuth();
  const { isSaving, lastSaved, workbookId } = useCloudSync(user);
  const cloudWorkbookId = useStore((s) => s.cloudWorkbookId);
  const online = usePresence(cloudWorkbookId, user);

  // Local auth (for when CLOUD_ENABLED is false)
  const localUser = useLocalAuth((s) => s.currentUser);
  const localLogout = useLocalAuth((s) => s.logout);

  // Force re-render when local login happens
  const [, forceUpdate] = useState(0);

  // Modal states
  const [scenarioOpen,   setScenarioOpen]   = useState(false);
  const [shareOpen,      setShareOpen]      = useState(false);
  const [historyOpen,    setHistoryOpen]    = useState(false);
  const [commentsOpen,   setCommentsOpen]   = useState(false);
  const [workspaceOpen,  setWorkspaceOpen]  = useState(false);
  const [scheduledOpen,  setScheduledOpen]  = useState(false);
  const [auditOpen,      setAuditOpen]      = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);

  useEffect(() => {
    applyThemeToDocument(themeMode);
  }, [themeMode]);

  // Sync workbook id from cloud sync hook -> store
  useEffect(() => {
    if (workbookId) setCloudMeta({ cloudWorkbookId: workbookId });
  }, [workbookId]);

  // ── Login gate ────────────────────────────────────────────────────────────
  // When cloud is configured, block behind Supabase auth.
  // When cloud is NOT configured, block behind local auth.
  // The /share/:token route is always public.

  if (CLOUD_ENABLED && authLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: T.bg }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: T.accent, boxShadow: "0 4px 20px rgba(245,158,11,0.4)" }}
          >
            <Database size={22} color="#000" strokeWidth={2.2} />
          </div>
          <div className="text-[13px] font-medium" style={{ color: T.muted }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Cloud mode — no user
  if (CLOUD_ENABLED && !user) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/share/:token" element={<SharedView />} />
          <Route path="*" element={<Auth hideLocalMode />} />
        </Routes>
      </HashRouter>
    );
  }

  // Local mode — no user
  if (!CLOUD_ENABLED && !localUser) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/share/:token" element={<SharedView />} />
          <Route
            path="*"
            element={
              <Auth
                hideLocalMode
                onLocalLogin={() => forceUpdate((n) => n + 1)}
              />
            }
          />
        </Routes>
      </HashRouter>
    );
  }

  // Determine the effective user object for settings/display
  const effectiveUser = CLOUD_ENABLED
    ? user
    : localUser
      ? {
          email: localUser.email,
          user_metadata: { name: localUser.name },
          app_metadata: { provider: "local" },
          id: localUser.email,
        }
      : null;

  return (
    <HashRouter>
      <Routes>
        {/* Public shared-view route — no sidebar */}
        <Route path="/share/:token" element={<SharedView />} />

        {/* Main app */}
        <Route
          path="/*"
          element={
            <div
              className="flex overflow-hidden"
              style={{ height: "100vh", background: T.bg }}
            >
              <Sidebar
                onOpenScenario={() => setScenarioOpen(true)}
                onOpenShare={() => setShareOpen(true)}
                onOpenHistory={() => setHistoryOpen(true)}
                onOpenComments={() => setCommentsOpen(true)}
                onOpenWorkspace={() => setWorkspaceOpen(true)}
                onOpenScheduled={() => setScheduledOpen(true)}
                onOpenAuditLog={() => setAuditOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onSignIn={() => setSettingsOpen(true)}
                user={user}
                localUser={localUser}
                isSaving={isSaving}
                lastSaved={lastSaved}
                online={online}
              />

              <main
                className="flex-1 min-w-0 flex flex-col overflow-hidden"
                style={{ background: T.bg }}
              >
                <AnimatedRoutes />
              </main>

              {/* Modals & panels */}
              <ScenarioPanel
                open={scenarioOpen}
                onClose={() => setScenarioOpen(false)}
              />
              <ShareModal
                open={shareOpen}
                onClose={() => setShareOpen(false)}
              />
              <WorkbookHistory
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
              />
              <CommentsPanel
                open={commentsOpen}
                onClose={() => setCommentsOpen(false)}
                workbookId={cloudWorkbookId}
                user={effectiveUser}
              />
              <WorkspaceManager
                open={workspaceOpen}
                onClose={() => setWorkspaceOpen(false)}
                user={effectiveUser}
              />
              <ScheduledReports
                open={scheduledOpen}
                onClose={() => setScheduledOpen(false)}
                user={effectiveUser}
              />
              <AuditLog
                open={auditOpen}
                onClose={() => setAuditOpen(false)}
              />
              <SettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                user={effectiveUser}
              />

              {/* AI Command Bar (Cmd+K) */}
              <CommandBar />
            </div>
          }
        />
      </Routes>
    </HashRouter>
  );
}
