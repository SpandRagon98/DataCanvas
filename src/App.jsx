import { useEffect, useRef, useState, useCallback } from "react";
import {
  HashRouter, NavLink, Navigate, Route, Routes, useLocation,
} from "react-router-dom";
import {
  Database, BarChart3, Table2, Layers3, LayoutDashboard,
  Sun, Moon, Sparkles, Save, FolderOpen, FilePlus, Wand2,
  Share2, History, MessageSquare, Building2, CalendarClock,
  Cloud, ClipboardList, Settings, GitBranch, Sigma,
  PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight,
} from "lucide-react";
import DataSource    from "./pages/DataSource";
import DataTable     from "./pages/DataTable";
import AIDashboard  from "./pages/AIDashboard";
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
import Logo              from "./components/Logo";
import SplashScreen      from "./components/SplashScreen";
import { APP_NAME, APP_TAGLINE, APP_VERSION } from "./branding";
import { useStore }      from "./store/useStore";
import { useLocalAuth }  from "./store/useLocalAuth";
import { useTheme, applyThemeToDocument } from "./styles/theme";
import { useAuth }       from "./hooks/useAuth";
import { useCloudSync }  from "./hooks/useCloudSync";
import { usePresence }   from "./hooks/usePresence";
import { CLOUD_ENABLED } from "./lib/supabase";
import { ROLES, OWNER_EMAIL } from "./hooks/useRBAC";

// ── Constants ──────────────────────────────────────────────────────────────
const SIDEBAR_MIN      = 64;
const SIDEBAR_DEFAULT  = 220;
const SIDEBAR_MAX      = 320;
const SIDEBAR_COLLAPSE_THRESHOLD = 88; // auto-collapse below this

const STORAGE_W = "dc.sidebarWidth";
const STORAGE_C = "dc.sidebarCollapsed";

// ── Nav items ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: "/source",       icon: Database,        label: "Data Source"    },
  { to: "/table",        icon: Table2,          label: "Data Table"     },
  { to: "/ai-dashboard", icon: Wand2,           label: "AI Dashboard",  accent: true },
  { to: "/report",       icon: BarChart3,       label: "Report Builder" },
  { to: "/model",        icon: GitBranch,       label: "Data Model"     },
  { to: "/measures",     icon: Sigma,           label: "Measures"       },
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard"      },
  { to: "/hierarchies",  icon: Layers3,         label: "Hierarchies"    },
];

// ── Top Workbook Action Bar ────────────────────────────────────────────────
function TopBar({ T }) {
  const loadWorkbook = useStore((s) => s.loadWorkbook);
  const fileInputRef = useRef(null);

  const handleNew = () => {
    if (window.confirm("Start a new workbook? Unsaved changes will be lost.")) {
      loadWorkbook({});
    }
  };

  const handleSave = () => {
    const s = useStore.getState();
    const blob = new Blob([JSON.stringify({
      version: "1.0",
      savedAt: new Date().toISOString(),
      rawData: s.rawData, columns: s.columns, dataTypes: s.dataTypes,
      datasets: s.datasets, activeDatasetId: s.activeDatasetId,
      apiConnectors: s.apiConnectors,
      filters: s.filters, visuals: s.visuals, activeVisualId: s.activeVisualId,
      hierarchies: s.hierarchies, dashboards: s.dashboards,
      activeDashboardId: s.activeDashboardId,
      themeMode: s.themeMode, calculatedFields: s.calculatedFields,
      scenarios: s.scenarios, activeScenarioId: s.activeScenarioId,
      filterBookmarks: s.filterBookmarks, relationships: s.relationships,
      modelLayout: s.modelLayout, measures: s.measures,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url,
      download: `vizora-${Date.now()}.json`,
    }).click();
    URL.revokeObjectURL(url);
  };

  const handleOpenFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { loadWorkbook(JSON.parse(ev.target.result)); }
      catch { alert("Invalid Vizora workbook file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="topbar">
      {/* Brand micro-text */}
      <span className="text-[11px] font-bold mr-2 select-none" style={{ color: T.muted, letterSpacing: "0.04em" }}>
        Vizora
      </span>
      <div className="topbar-divider" />

      <button className="topbar-btn" onClick={handleNew} title="New Workbook">
        <FilePlus size={13} />
        <span>New</span>
      </button>

      <button className="topbar-btn" onClick={() => fileInputRef.current?.click()} title="Open Workbook">
        <FolderOpen size={13} />
        <span>Open</span>
      </button>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleOpenFile} />

      <button className="topbar-btn topbar-btn-primary" onClick={handleSave} title="Save Workbook">
        <Save size={13} />
        <span>Save</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Cloud workbook name (if any) */}
      {/* Reserved for cloud state indicator */}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({
  width,
  collapsed,
  onResizeStart,
  onToggleCollapse,
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
  const T               = useTheme();
  const themeMode       = useStore((s) => s.themeMode);
  const toggleTheme     = useStore((s) => s.toggleThemeMode);
  const scenarios       = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const datasets        = useStore((s) => s.datasets);
  const activeDatasetId = useStore((s) => s.activeDatasetId);
  const cloudWorkbookId = useStore((s) => s.cloudWorkbookId);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) || null;
  const activeDataset  = datasets.find((d) => d.id === activeDatasetId && !d.isSystemTable) || null;

  const isDark  = themeMode === "dark";
  const isLight = themeMode === "light";

  return (
    <aside
      className={`sidebar flex flex-col shrink-0 relative ${collapsed ? "sidebar-collapsed" : ""}`}
      style={{
        width,
        height: "100vh",
        background: T.sidebarBg,
        borderRight: `1px solid ${T.border}`,
        overflowY: "auto",
        overflowX: "hidden",
        // Glassmorphism for light mode
        backdropFilter: isLight ? "blur(20px)" : undefined,
        WebkitBackdropFilter: isLight ? "blur(20px)" : undefined,
      }}
    >
      {/* ── Resize handle ── */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={onResizeStart}
        title="Drag to resize sidebar"
      />

      {/* ── Logo row ── */}
      <div className="px-3 pt-3 pb-2 flex items-center" style={{ minHeight: 52 }}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden"
          style={{ background: "rgba(20,184,166,0.10)", boxShadow: "0 2px 12px rgba(20,184,166,0.20)" }}
        >
          <Logo size={26} />
        </div>

        {!collapsed && (
          <div className="sidebar-logo-text ml-2.5 min-w-0 flex-1">
            <div className="text-[13px] font-bold tracking-tight leading-none truncate" style={{ color: T.text }}>
              {APP_NAME}
            </div>
            <div className="mt-0.5 text-[10px] leading-none truncate" style={{ color: T.muted }}>
              {APP_TAGLINE}
            </div>
          </div>
        )}

        {/* Collapse / expand toggle */}
        <button
          onClick={onToggleCollapse}
          className="sidebar-toggle-btn ml-auto"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{ marginLeft: collapsed ? "auto" : 6 }}
        >
          {collapsed ? <ChevronRight size={13} /> : <PanelLeftClose size={13} />}
        </button>
      </div>

      {/* ── Active dataset pill ── */}
      {activeDataset && !collapsed && (
        <div className="sidebar-dataset-pill mx-2.5 mb-2">
          <div className="rounded-xl border px-2.5 py-1.5" style={{ background: T.s2, borderColor: T.border }}>
            <div className="text-[9.5px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
              Active Dataset
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <span className="truncate text-[11.5px] font-medium" style={{ color: T.text }}>
                {activeDataset.name}
              </span>
              <span className="mono shrink-0 text-[9.5px]" style={{ color: T.muted }}>
                {activeDataset.rows.length.toLocaleString()}r
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Nav section label ── */}
      {!collapsed && (
        <div className="sidebar-label mx-3.5 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
            Navigation
          </span>
        </div>
      )}

      {/* ── Nav items ── */}
      <nav className={`flex-1 px-1.5 space-y-0.5 ${collapsed ? "" : "anim-slide-left stagger"}`}>
        {NAV_ITEMS.map(({ to, icon: Icon, label, accent }) => (
          <NavLink
            key={to}
            to={to}
            data-label={label}
            className={({ isActive }) =>
              `nav-link anim-fade-in ${isActive ? "active" : ""}`
            }
            style={accent ? ({ isActive }) => ({
              ...(isActive ? {
                background: "rgba(20,184,166,0.12)",
                borderColor: "rgba(20,184,166,0.22)",
                color: "#14b8a6",
              } : {
                borderColor: "transparent",
                color: "rgba(20,184,166,0.85)",
              })
            }) : undefined}
          >
            <Icon size={15} strokeWidth={1.8} style={accent ? { color: "#14b8a6", flexShrink: 0 } : { flexShrink: 0 }} />
            {!collapsed && (
              <>
                <span className="nav-label truncate flex-1">{label}</span>
                {accent && (
                  <span className="nav-ai-badge ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-bold shrink-0"
                    style={{ background: "#14b8a6", color: "#000" }}>AI</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Divider ── */}
      <div className="mx-2.5 my-1.5 border-t" style={{ borderColor: T.border }} />

      {/* ── Bottom section ── */}
      <div className="px-1.5 pb-2 space-y-0.5">
        {!collapsed && (
          <div className="sidebar-label mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
            Tools
          </div>
        )}

        <button
          onClick={onOpenScenario}
          data-label={activeScenario ? activeScenario.name : "Scenarios"}
          className={`nav-link w-full text-left ${activeScenario ? "active" : ""}`}
        >
          <Sparkles size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          {!collapsed && (
            <>
              <span className="nav-label flex-1 truncate">
                {activeScenario ? activeScenario.name : "Scenarios"}
              </span>
              {activeScenario && (
                <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: T.accent }} />
              )}
            </>
          )}
        </button>

        {/* ── Cloud section ── */}
        {CLOUD_ENABLED && (
          <>
            <div className="mx-1 my-1.5 border-t" style={{ borderColor: T.border }} />
            {!collapsed && (
              <div className="sidebar-label mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                Cloud
              </div>
            )}

            {/* Cloud sync status — hidden when collapsed */}
            {user && !collapsed && (
              <div className="sidebar-label mx-1 mb-1 flex items-center gap-2 rounded-lg border px-2 py-1.5"
                style={{ background: T.s2, borderColor: T.border }}>
                {isSaving ? (
                  <><span className="h-1.5 w-1.5 shrink-0 animate-spin rounded-full border border-current border-t-transparent" style={{ color: T.accent }} />
                  <span className="text-[10px]" style={{ color: T.accent }}>Saving...</span></>
                ) : lastSaved ? (
                  <><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#22c55e" }} />
                  <span className="text-[10px]" style={{ color: T.dim }}>
                    Saved {new Date(lastSaved).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span></>
                ) : (
                  <><Cloud size={10} style={{ color: T.muted }} />
                  <span className="text-[10px]" style={{ color: T.muted }}>Not saved to cloud</span></>
                )}
              </div>
            )}

            {/* Presence bar */}
            {online?.length > 0 && !collapsed && (
              <div className="sidebar-label mx-1 mb-1">
                <PresenceBar online={online} />
              </div>
            )}

            {[
              { icon: Share2,       label: "Share Dashboard",  onClick: onOpenShare },
              { icon: History,      label: "Version History",  onClick: onOpenHistory },
              { icon: MessageSquare,label: "Comments",         onClick: onOpenComments },
              { icon: Building2,    label: "Workspaces",       onClick: onOpenWorkspace },
              { icon: CalendarClock,label: "Scheduled Reports",onClick: onOpenScheduled },
              { icon: ClipboardList,label: "Audit Log",        onClick: onOpenAuditLog },
            ].map(({ icon: Icon, label, onClick }) => (
              <button key={label} onClick={onClick} data-label={label}
                className="nav-link w-full text-left">
                <Icon size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                {!collapsed && <span className="nav-label truncate">{label}</span>}
              </button>
            ))}
          </>
        )}

        {/* ── Theme toggle ── */}
        {collapsed ? (
          <button
            onClick={toggleTheme}
            data-label={isDark ? "Light theme" : "Dark theme"}
            className="nav-link w-full text-left justify-center"
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>
        ) : (
          <div className="mt-2 flex items-center rounded-xl border p-1 mx-0.5"
            style={{ background: T.s2, borderColor: T.border }}>
            {[
              { mode: "dark",  Icon: Moon, label: "Dark"  },
              { mode: "light", Icon: Sun,  label: "Light" },
            ].map(({ mode, Icon, label }) => (
              <button key={mode} onClick={() => themeMode !== mode && toggleTheme()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-1.5 text-xs font-medium"
                style={{
                  background: themeMode === mode ? T.s3    : "transparent",
                  color:      themeMode === mode ? T.text  : T.muted,
                  boxShadow:  themeMode === mode ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                  transition: "all 150ms ease",
                }}>
                <Icon size={11} strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Auth Gate ── */}
        {CLOUD_ENABLED && (
          <div className={`mt-1 ${collapsed ? "flex justify-center" : ""}`}>
            <AuthGate user={user} onSignIn={onSignIn} compact={collapsed} />
          </div>
        )}

        {/* ── Settings ── */}
        <button onClick={onOpenSettings} data-label="Settings"
          className="nav-link w-full text-left">
          <Settings size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          {!collapsed && <span className="nav-label truncate">Settings</span>}
        </button>

        {/* Version */}
        {!collapsed && (
          <div className="sidebar-version px-2 pb-1 pt-1 text-[10px] font-medium" style={{ color: T.muted }}>
            Vizora · v7.0
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Animated route wrapper ─────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter flex-1 flex flex-col min-h-0 overflow-hidden">
      <Routes location={location}>
        <Route path="/"             element={<Navigate to="/source" replace />} />
        <Route path="/source"      element={<DataSource />} />
        <Route path="/table"       element={<DataTable />} />
        <Route path="/ai-dashboard" element={<AIDashboard />} />
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

  // Cloud hooks
  const { user, loading: authLoading } = useAuth();
  const { isSaving, lastSaved, workbookId } = useCloudSync(user);
  const cloudWorkbookId = useStore((s) => s.cloudWorkbookId);
  const online = usePresence(cloudWorkbookId, user);

  // Local auth
  const localUser   = useLocalAuth((s) => s.currentUser);
  const [, forceUpdate] = useState(0);

  // Modal states
  const [scenarioOpen,  setScenarioOpen]  = useState(false);
  const [shareOpen,     setShareOpen]     = useState(false);
  const [historyOpen,   setHistoryOpen]   = useState(false);
  const [commentsOpen,  setCommentsOpen]  = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [auditOpen,     setAuditOpen]     = useState(false);
  const [settingsOpen,  setSettingsOpen]  = useState(false);

  // ── First-load splash (once per browser session) ─────────────────────────
  const [showSplash, setShowSplash] = useState(() => {
    try { return !sessionStorage.getItem("vizora.splashed"); } catch { return true; }
  });
  const dismissSplash = () => {
    try { sessionStorage.setItem("vizora.splashed", "1"); } catch { /* ignore */ }
    setShowSplash(false);
  };

  // ── Sidebar resize & collapse state ──────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(STORAGE_W) || "", 10);
    return isNaN(saved) ? SIDEBAR_DEFAULT : Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, saved));
  });
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_C) === "true";
  });
  const [isDragging, setIsDragging] = useState(false);

  // Effective display width
  const effectiveWidth = collapsed ? SIDEBAR_MIN : sidebarWidth;

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(STORAGE_W, String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(() => {
    localStorage.setItem(STORAGE_C, String(collapsed));
  }, [collapsed]);

  // Resize handle drag
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX  = e.clientX;
    const startW  = sidebarWidth;
    setIsDragging(true);
    document.body.style.cursor    = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (mv) => {
      const newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + mv.clientX - startX));
      setSidebarWidth(newW);
      // Auto-collapse when dragged to minimum
      if (newW <= SIDEBAR_COLLAPSE_THRESHOLD) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };

    const onUp = () => {
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }, [sidebarWidth]);

  const handleToggleCollapse = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
      // If previously was at minimum, restore to default
      if (sidebarWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
        setSidebarWidth(SIDEBAR_DEFAULT);
      }
    } else {
      setCollapsed(true);
    }
  }, [collapsed, sidebarWidth]);

  useEffect(() => {
    applyThemeToDocument(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (workbookId) setCloudMeta({ cloudWorkbookId: workbookId });
  }, [workbookId]);

  // ── Login gate ────────────────────────────────────────────────────────────
  if (CLOUD_ENABLED && authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: T.bg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden"
            style={{ background: "rgba(20,184,166,0.10)", boxShadow: "0 4px 24px rgba(20,184,166,0.28)" }}>
            <Logo size={40} />
          </div>
          <div className="text-[13px] font-medium" style={{ color: T.muted }}>Loading {APP_NAME}…</div>
        </div>
      </div>
    );
  }

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

  if (!CLOUD_ENABLED && !localUser) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/share/:token" element={<SharedView />} />
          <Route path="*" element={
            <Auth hideLocalMode onLocalLogin={() => forceUpdate((n) => n + 1)} />
          } />
        </Routes>
      </HashRouter>
    );
  }

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
              {/* ── Sidebar ── */}
              <Sidebar
                width={effectiveWidth}
                collapsed={collapsed}
                onResizeStart={handleResizeStart}
                onToggleCollapse={handleToggleCollapse}
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

              {/* ── Main area: TopBar + Content ── */}
              <main
                className="flex-1 min-w-0 flex flex-col overflow-hidden"
                style={{ background: T.bg }}
              >
                {/* Top workbook action bar */}
                <TopBar T={T} />

                {/* Page content */}
                <AnimatedRoutes />
              </main>

              {/* Modals & panels */}
              <ScenarioPanel     open={scenarioOpen}  onClose={() => setScenarioOpen(false)} />
              <ShareModal        open={shareOpen}     onClose={() => setShareOpen(false)} />
              <WorkbookHistory   open={historyOpen}   onClose={() => setHistoryOpen(false)} />
              <CommentsPanel     open={commentsOpen}  onClose={() => setCommentsOpen(false)}
                workbookId={cloudWorkbookId} user={effectiveUser} />
              <WorkspaceManager  open={workspaceOpen} onClose={() => setWorkspaceOpen(false)}
                user={effectiveUser} />
              <ScheduledReports  open={scheduledOpen} onClose={() => setScheduledOpen(false)}
                user={effectiveUser} />
              <AuditLog          open={auditOpen}     onClose={() => setAuditOpen(false)} />
              <SettingsModal     open={settingsOpen}  onClose={() => setSettingsOpen(false)}
                user={effectiveUser} />
              <CommandBar />

              {/* First-load welcome splash (once per session) */}
              {showSplash && (
                <SplashScreen user={effectiveUser} onDone={dismissSplash} />
              )}
            </div>
          }
        />
      </Routes>
    </HashRouter>
  );
}
