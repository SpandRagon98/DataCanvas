/**
 * WorkspaceManager — workspaces, cloud files, and access control.
 *
 * Backed by the local-first `useWorkspaces` store (persisted to localStorage,
 * key: vizora.workspaces) so it works whether or not a cloud backend is
 * configured. Everything is scoped to the signed-in user's email.
 *
 * Roles (owner > editor > viewer):
 *   owner  — full control: manage members, rename/delete workspace + files
 *   editor — open files, save/update/rename/delete files
 *   viewer — open/view files only (cannot save)
 *
 * Files store a full Vizora workbook snapshot (datasets, data model, reports,
 * dashboards, measures, metrics, filters, theme, etc.) via useStore.exportWorkbook().
 */

import { useEffect, useState, useCallback } from "react";
import {
  Building2, X, Plus, Mail, Crown, PenLine, Eye, Trash2, Users,
  AlertCircle, Check, FileText, FolderOpen, Save, Pencil, Files as FilesIcon,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";
import { useWorkspaces, isValidEmail } from "../../store/useWorkspaces";

// ── Role display helpers ──────────────────────────────────────────────────────

const ROLE_META = {
  owner:  { label: "Owner",  color: "#f59e0b", icon: <Crown   size={11} />, desc: "Full control of the workspace" },
  editor: { label: "Editor", color: "#10b981", icon: <PenLine size={11} />, desc: "Open, save, and edit files" },
  viewer: { label: "Viewer", color: "#60a5fa", icon: <Eye     size={11} />, desc: "View files only (read-only)" },
};
const ASSIGNABLE_ROLES = ["editor", "viewer"];

function RoleBadge({ role }) {
  const info = ROLE_META[role] ?? ROLE_META.viewer;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase"
      style={{ background: info.color + "22", color: info.color }}
    >
      {info.icon}{info.label}
    </span>
  );
}

function Avatar({ name, size = 26 }) {
  const COLORS = ["var(--dc-accent)", "#60a5fa", "#34d399", "#f472b6", "#a78bfa"];
  const color  = COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length];
  return (
    <div
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ width: size, height: size, background: color, color: "#000" }}
    >
      {(name ?? "?")[0]?.toUpperCase()}
    </div>
  );
}

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkspaceManager({ open, onClose, user }) {
  const T = useTheme();
  const currentUserEmail = (user?.email ?? "").trim();

  // Store: workbook snapshot + restore + active-file meta
  const exportWorkbook = useStore((s) => s.exportWorkbook);
  const loadWorkbook   = useStore((s) => s.loadWorkbook);
  const setCloudMeta   = useStore((s) => s.setCloudMeta);
  const cloudWorkbookId = useStore((s) => s.cloudWorkbookId);

  // Workspaces store — subscribe to arrays so the UI re-renders on changes
  const allWorkspaces = useWorkspaces((s) => s.workspaces);
  const allFiles      = useWorkspaces((s) => s.files);
  const roleOf        = useWorkspaces((s) => s.roleOf);

  const [activeWsId,  setActiveWsId]  = useState(null);
  const [tab,         setTab]         = useState("files");
  const [newWsName,   setNewWsName]   = useState("");
  const [fileName,    setFileName]    = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("viewer");
  const [statusMsg,   setStatusMsg]   = useState({ text: "", ok: true });

  const flash = useCallback((text, ok = true) => {
    setStatusMsg({ text, ok });
    setTimeout(() => setStatusMsg((m) => (m.text === text ? { text: "", ok: true } : m)), 3200);
  }, []);

  // Only workspaces the current user owns or is a member of
  const e = currentUserEmail.toLowerCase();
  const myWorkspaces = allWorkspaces.filter(
    (w) => w.ownerEmail?.toLowerCase() === e || (w.members || []).some((m) => m.email?.toLowerCase() === e)
  );

  // Keep a valid active workspace selected
  useEffect(() => {
    if (!open) return;
    if (myWorkspaces.length === 0) { setActiveWsId(null); return; }
    if (!myWorkspaces.some((w) => w.id === activeWsId)) setActiveWsId(myWorkspaces[0].id);
  }, [open, myWorkspaces, activeWsId]);

  if (!open) return null;

  const activeWs   = myWorkspaces.find((w) => w.id === activeWsId) || null;
  const myRole     = activeWs ? roleOf(activeWs.id, currentUserEmail) : null;
  const canEditWs  = myRole === "owner" || myRole === "editor";
  const canManage  = myRole === "owner";
  const wsFiles    = activeWs
    ? allFiles.filter((f) => f.workspaceId === activeWs.id)
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    : [];

  // ── Workspace actions ──
  const handleCreateWs = () => {
    const res = useWorkspaces.getState().createWorkspace(newWsName, currentUserEmail);
    if (res.ok) {
      setActiveWsId(res.workspace.id);
      setNewWsName("");
      setTab("files");
      flash(`Workspace “${res.workspace.name}” created.`);
    } else {
      flash(res.error, false);
    }
  };

  const handleRenameWs = (ws) => {
    const name = window.prompt("Rename workspace", ws.name);
    if (name == null) return;
    const res = useWorkspaces.getState().renameWorkspace(ws.id, name, currentUserEmail);
    flash(res.ok ? "Workspace renamed." : res.error, res.ok);
  };

  const handleDeleteWs = (ws) => {
    if (!window.confirm(`Delete workspace “${ws.name}” and all its files? This cannot be undone.`)) return;
    const res = useWorkspaces.getState().deleteWorkspace(ws.id, currentUserEmail);
    if (res.ok) { setActiveWsId(null); flash("Workspace deleted."); }
    else flash(res.error, false);
  };

  // ── File actions ──
  const handleSaveCurrent = () => {
    if (!activeWs) return;
    const data = exportWorkbook();
    const res = useWorkspaces.getState().saveFile({
      workspaceId: activeWs.id,
      name: fileName.trim() || `Workbook ${new Date().toLocaleDateString()}`,
      data,
      byEmail: currentUserEmail,
    });
    if (res.ok) {
      setCloudMeta({ cloudWorkspaceId: activeWs.id, cloudWorkbookId: res.file.id, cloudWorkbookName: res.file.name });
      setFileName("");
      flash(`Saved “${res.file.name}” to ${activeWs.name}.`);
    } else {
      flash(res.error, false);
    }
  };

  const handleUpdateFile = (file) => {
    const res = useWorkspaces.getState().updateFile(file.id, { data: exportWorkbook() }, currentUserEmail);
    if (res.ok) {
      setCloudMeta({ cloudWorkspaceId: file.workspaceId, cloudWorkbookId: file.id, cloudWorkbookName: file.name });
      flash(`Updated “${file.name}”.`);
    } else flash(res.error, false);
  };

  const handleOpenFile = (file) => {
    try {
      loadWorkbook(file.data);
      setCloudMeta({ cloudWorkspaceId: file.workspaceId, cloudWorkbookId: file.id, cloudWorkbookName: file.name });
      flash(`Opened “${file.name}”.`);
      setTimeout(onClose, 400);
    } catch {
      flash("Could not open this file.", false);
    }
  };

  const handleRenameFile = (file) => {
    const name = window.prompt("Rename file", file.name);
    if (name == null) return;
    const res = useWorkspaces.getState().renameFile(file.id, name, currentUserEmail);
    flash(res.ok ? "File renamed." : res.error, res.ok);
  };

  const handleDeleteFile = (file) => {
    if (!window.confirm(`Delete “${file.name}”? This cannot be undone.`)) return;
    const res = useWorkspaces.getState().deleteFile(file.id, currentUserEmail);
    flash(res.ok ? "File deleted." : res.error, res.ok);
  };

  // ── Member actions ──
  const handleInvite = () => {
    if (!activeWs) return;
    if (!isValidEmail(inviteEmail)) { flash("Enter a valid email address.", false); return; }
    const res = useWorkspaces.getState().addMember(activeWs.id, inviteEmail, inviteRole, currentUserEmail);
    if (res.ok) { flash(`${inviteEmail.trim().toLowerCase()} added as ${inviteRole}.`); setInviteEmail(""); }
    else flash(res.error, false);
  };

  const handleChangeRole = (memberEmail, role) => {
    const res = useWorkspaces.getState().updateMemberRole(activeWs.id, memberEmail, role, currentUserEmail);
    if (!res.ok) flash(res.error, false);
  };

  const handleRemoveMember = (memberEmail) => {
    const res = useWorkspaces.getState().removeMember(activeWs.id, memberEmail, currentUserEmail);
    flash(res.ok ? "Member removed." : res.error, res.ok);
  };

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };

  // Owner is implicit member; build a full display list (owner first)
  const memberRows = activeWs
    ? [
        { email: activeWs.ownerEmail, role: "owner" },
        ...(activeWs.members || []).filter((m) => m.email?.toLowerCase() !== activeWs.ownerEmail?.toLowerCase()),
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in w-full max-w-3xl rounded-xl border flex flex-col"
        style={{ background: T.surface, borderColor: T.border, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", maxHeight: "88vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <Building2 size={14} color={T.accent} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: T.text }}>Workspaces</div>
              <div className="text-[11px]" style={{ color: T.dim }}>Save, organize, and share your workbooks</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
            <X size={13} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left — workspace list */}
          <div className="w-56 shrink-0 flex flex-col border-r overflow-hidden" style={{ borderColor: T.border }}>
            <div className="px-3 py-2.5 border-b shrink-0" style={{ borderColor: T.border }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                Your Workspaces
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {myWorkspaces.length === 0 ? (
                <div className="px-3 py-6 text-xs text-center" style={{ color: T.muted }}>
                  No workspaces yet.<br />Create one below.
                </div>
              ) : (
                myWorkspaces.map((ws) => {
                  const isActive = activeWs?.id === ws.id;
                  const r = roleOf(ws.id, currentUserEmail);
                  return (
                    <button
                      key={ws.id}
                      onClick={() => setActiveWsId(ws.id)}
                      className="w-full rounded-lg px-2.5 py-2 text-left"
                      style={{
                        background: isActive ? T.accentDim : "transparent",
                        border: `1px solid ${isActive ? "rgba(var(--dc-accent-rgb),0.3)" : "transparent"}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md shrink-0 text-[10px] font-bold"
                          style={{ background: isActive ? T.accent : T.s3, color: isActive ? "#000" : T.dim }}>
                          {ws.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium" style={{ color: isActive ? T.accent : T.text }}>
                            {ws.name}
                          </div>
                          <div className="mt-0.5"><RoleBadge role={r} /></div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Create workspace */}
            <div className="border-t p-3 space-y-2 shrink-0" style={{ borderColor: T.border }}>
              <input
                value={newWsName}
                onChange={(ev) => setNewWsName(ev.target.value)}
                placeholder="New workspace name"
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                style={inputStyle}
                onKeyDown={(ev) => ev.key === "Enter" && handleCreateWs()}
              />
              <button
                onClick={handleCreateWs}
                disabled={!newWsName.trim()}
                className="w-full inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold"
                style={{ background: T.accent, color: "#000", opacity: newWsName.trim() ? 1 : 0.5 }}
              >
                <Plus size={11} /> Create Workspace
              </button>
            </div>
          </div>

          {/* Right — detail */}
          <div className="flex-1 flex flex-col min-w-0">
            {!activeWs ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Building2 size={28} style={{ color: T.border, margin: "0 auto 8px" }} />
                  <div className="text-xs" style={{ color: T.muted }}>Select or create a workspace</div>
                </div>
              </div>
            ) : (
              <>
                {/* Workspace header */}
                <div className="px-4 py-3 border-b flex items-center justify-between gap-2" style={{ borderColor: T.border }}>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: T.text }}>{activeWs.name}</div>
                    <div className="text-[10.5px]" style={{ color: T.muted }}>
                      {wsFiles.length} file{wsFiles.length !== 1 ? "s" : ""}
                      {" · "}Your role: <span style={{ color: ROLE_META[myRole]?.color }}>{ROLE_META[myRole]?.label}</span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleRenameWs(activeWs)} title="Rename workspace"
                        className="rounded-lg border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDeleteWs(activeWs)} title="Delete workspace"
                        className="rounded-lg border p-1.5" style={{ background: T.s2, borderColor: T.border, color: "#ef4444" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b px-4 pt-2 pb-0 shrink-0" style={{ borderColor: T.border }}>
                  {[["files", "Files", FilesIcon], ["members", "Members", Users]].map(([v, l, Icon]) => (
                    <button
                      key={v}
                      onClick={() => setTab(v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2"
                      style={{ borderColor: tab === v ? T.accent : "transparent", color: tab === v ? T.accent : T.muted }}
                    >
                      <Icon size={12} />{l}
                    </button>
                  ))}
                </div>

                {/* Status message */}
                {statusMsg.text && (
                  <div className="mx-4 mt-2 rounded-lg border px-3 py-1.5 text-xs flex items-center gap-1.5"
                    style={{
                      background: statusMsg.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                      borderColor: statusMsg.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
                      color: statusMsg.ok ? "#10b981" : "#ef4444",
                    }}>
                    {statusMsg.ok ? <Check size={11} /> : <AlertCircle size={11} />}{statusMsg.text}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4">
                  {/* ── Files tab ── */}
                  {tab === "files" && (
                    <div className="space-y-3">
                      {/* Save current workbook */}
                      {canEditWs ? (
                        <div className="rounded-lg border p-3" style={{ background: T.s2, borderColor: T.border }}>
                          <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: T.muted }}>
                            Save current workbook here
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              value={fileName}
                              onChange={(ev) => setFileName(ev.target.value)}
                              placeholder="File name (optional)"
                              className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                              style={{ background: T.surface, borderColor: T.border, color: T.text }}
                              onKeyDown={(ev) => ev.key === "Enter" && handleSaveCurrent()}
                            />
                            <button
                              onClick={handleSaveCurrent}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0"
                              style={{ background: T.accent, color: "#000" }}
                            >
                              <Save size={12} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border px-3 py-2 text-[11px]" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
                          <Eye size={11} className="inline mr-1" />
                          You have view-only access. You can open files but not save.
                        </div>
                      )}

                      {/* File list */}
                      {wsFiles.length === 0 ? (
                        <div className="text-xs text-center py-8" style={{ color: T.muted }}>
                          <FileText size={24} style={{ margin: "0 auto 8px", color: T.border }} />
                          No saved files yet.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {wsFiles.map((file) => {
                            const isOpen = cloudWorkbookId === file.id;
                            return (
                              <div key={file.id}
                                className="flex items-center gap-3 rounded-lg border px-3 py-2"
                                style={{
                                  background: T.s2,
                                  borderColor: isOpen ? "rgba(var(--dc-accent-rgb),0.4)" : T.border,
                                }}>
                                <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                                  style={{ background: T.s3 }}>
                                  <FileText size={13} style={{ color: T.accent }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-medium" style={{ color: T.text }}>
                                    {file.name}
                                    {isOpen && <span className="ml-1.5 text-[9px] font-semibold uppercase" style={{ color: T.accent }}>· Open</span>}
                                  </div>
                                  <div className="truncate text-[10px]" style={{ color: T.muted }}>
                                    Updated {fmtDate(file.updatedAt)}
                                  </div>
                                </div>
                                <button onClick={() => handleOpenFile(file)} title="Open"
                                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium shrink-0"
                                  style={{ background: T.surface, borderColor: T.border, color: T.text }}>
                                  <FolderOpen size={11} /> Open
                                </button>
                                {canEditWs && (
                                  <>
                                    <button onClick={() => handleUpdateFile(file)} title="Save current workbook into this file"
                                      className="rounded-md p-1.5 opacity-60 hover:opacity-100" style={{ color: T.accent }}>
                                      <Save size={13} />
                                    </button>
                                    <button onClick={() => handleRenameFile(file)} title="Rename"
                                      className="rounded-md p-1.5 opacity-60 hover:opacity-100" style={{ color: T.muted }}>
                                      <Pencil size={12} />
                                    </button>
                                    <button onClick={() => handleDeleteFile(file)} title="Delete"
                                      className="rounded-md p-1.5 opacity-50 hover:opacity-100" style={{ color: "#ef4444" }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Members tab ── */}
                  {tab === "members" && (
                    <div className="space-y-4">
                      {/* Invite (owner only) */}
                      {canManage && (
                        <div className="rounded-lg border p-3 space-y-2.5" style={{ background: T.s2, borderColor: T.border }}>
                          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                            Invite a member
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Mail size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
                              <input
                                type="email"
                                value={inviteEmail}
                                onChange={(ev) => setInviteEmail(ev.target.value)}
                                placeholder="colleague@example.com"
                                className="w-full rounded-lg border pl-7 pr-2.5 py-1.5 text-xs outline-none"
                                style={{ background: T.surface, borderColor: T.border, color: T.text }}
                                onKeyDown={(ev) => ev.key === "Enter" && handleInvite()}
                              />
                            </div>
                            <select
                              value={inviteRole}
                              onChange={(ev) => setInviteRole(ev.target.value)}
                              className="rounded-lg border px-2 py-1.5 text-xs outline-none shrink-0"
                              style={{ background: T.surface, borderColor: T.border, color: T.text }}
                            >
                              {ASSIGNABLE_ROLES.map((r) => (
                                <option key={r} value={r}>{ROLE_META[r].label}</option>
                              ))}
                            </select>
                            <button onClick={handleInvite}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0"
                              style={{ background: T.accent, color: "#000" }}>
                              <Plus size={12} /> Add
                            </button>
                          </div>
                          <div className="text-[10px]" style={{ color: T.muted }}>
                            {ROLE_META.editor.label}: {ROLE_META.editor.desc}. {ROLE_META.viewer.label}: {ROLE_META.viewer.desc}.
                          </div>
                        </div>
                      )}

                      {/* Member list */}
                      <div className="space-y-1.5">
                        {memberRows.map((m) => {
                          const isOwnerRow = m.role === "owner";
                          const isSelf = m.email?.toLowerCase() === currentUserEmail.toLowerCase();
                          return (
                            <div key={m.email}
                              className="flex items-center gap-3 rounded-lg border px-3 py-2"
                              style={{ background: T.s2, borderColor: T.border }}>
                              <Avatar name={m.email} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-medium" style={{ color: T.text }}>
                                  {m.email}
                                  {isSelf && <span className="ml-1 text-[10px]" style={{ color: T.muted }}>(you)</span>}
                                </div>
                              </div>
                              {canManage && !isOwnerRow ? (
                                <>
                                  <select
                                    value={m.role}
                                    onChange={(ev) => handleChangeRole(m.email, ev.target.value)}
                                    className="rounded-md border px-1.5 py-1 text-[11px] outline-none"
                                    style={{ background: T.surface, borderColor: T.border, color: T.text }}
                                  >
                                    {ASSIGNABLE_ROLES.map((r) => (
                                      <option key={r} value={r}>{ROLE_META[r].label}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => handleRemoveMember(m.email)} title="Remove"
                                    className="rounded-md p-1 opacity-50 hover:opacity-100" style={{ color: "#ef4444" }}>
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              ) : (
                                <RoleBadge role={m.role} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
