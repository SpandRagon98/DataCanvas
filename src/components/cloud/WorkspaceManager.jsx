/**
 * WorkspaceManager — full RBAC workspace panel.
 *
 * Roles (owner > admin > developer > contributor > viewer):
 *   owner       — created the workspace; full control, cannot be removed
 *   admin       — manage members, edit everything
 *   developer   — create/edit visuals and datasets
 *   contributor — edit dashboards, add comments
 *   viewer      — read-only
 *
 * Access control rules enforced here (Supabase RLS also enforces server-side):
 *   - Only workspace members can open / see a workspace
 *   - Only admin/owner can invite, change roles, or remove members
 *   - Owner rows cannot be removed via the UI
 *   - All email comparisons are lowercase
 */

import { useEffect, useState, useCallback } from "react";
import {
  Building2, X, Plus, Mail, UserCheck, ShieldCheck, Crown,
  Code2, PenLine, Eye, Trash2, ChevronDown, Users, AlertCircle,
  Check, Loader2,
} from "lucide-react";
import {
  CLOUD_ENABLED,
  getMyWorkspaces,
  createWorkspace,
  inviteMember,
  getWorkspaceMembers,
  updateMemberRole,
  removeMember,
} from "../../lib/supabase";
import { useStore }  from "../../store/useStore";
import { useTheme }  from "../../styles/theme";
import { ROLES, OWNER_EMAIL, useRBAC } from "../../hooks/useRBAC";

// ── Role display helpers ──────────────────────────────────────────────────────

const ROLE_OPTIONS = ["owner","admin","developer","contributor","viewer"];

const ROLE_ICON = {
  owner:       <Crown   size={11} />,
  admin:       <ShieldCheck size={11} />,
  developer:   <Code2   size={11} />,
  contributor: <PenLine size={11} />,
  viewer:      <Eye     size={11} />,
};

function RoleBadge({ role }) {
  const info = ROLES[role] ?? ROLES.viewer;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase"
      style={{ background: info.color + "22", color: info.color }}
    >
      {ROLE_ICON[role]}
      {info.label}
    </span>
  );
}

function Avatar({ name, size = 26 }) {
  const COLORS = ["#f59e0b","#60a5fa","#34d399","#f472b6","#a78bfa"];
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

// Inline role-change dropdown for a member row
function RoleSelect({ currentRole, memberEmail, currentUserEmail, rbac, onChangeRole }) {
  const [open, setOpen] = useState(false);
  const isOwnerRow = currentRole === "owner";
  // Cannot change the global owner's role, or your own role, or without permission
  const isSelf     = memberEmail?.toLowerCase() === currentUserEmail?.toLowerCase();
  const canChange  = rbac.canChangeRoles && !isOwnerRow && !isSelf;

  if (!canChange) return <RoleBadge role={currentRole} />;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase border"
        style={{
          background: (ROLES[currentRole]?.color ?? "#94a3b8") + "22",
          color: ROLES[currentRole]?.color ?? "#94a3b8",
          borderColor: (ROLES[currentRole]?.color ?? "#94a3b8") + "44",
        }}
      >
        {ROLE_ICON[currentRole]}
        {ROLES[currentRole]?.label ?? currentRole}
        <ChevronDown size={8} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1 rounded-lg border shadow-xl overflow-hidden"
          style={{ background: "#1e1e2e", borderColor: "#333", minWidth: 140 }}
          onMouseLeave={() => setOpen(false)}
        >
          {ROLE_OPTIONS.filter((r) => r !== "owner").map((r) => (
            <button
              key={r}
              onClick={(e) => { e.stopPropagation(); onChangeRole(r); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/5"
              style={{ color: ROLES[r]?.color ?? "#94a3b8" }}
            >
              {ROLE_ICON[r]} {ROLES[r]?.label ?? r}
              {currentRole === r && <Check size={10} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkspaceManager({ open, onClose, user }) {
  const T               = useTheme();
  const setCloudMeta    = useStore((s) => s.setCloudMeta);
  const cloudWorkspaceId = useStore((s) => s.cloudWorkspaceId);

  const [workspaces,  setWorkspaces]  = useState([]);
  const [members,     setMembers]     = useState([]);
  const [activeWs,    setActiveWs]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [newName,     setNewName]     = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("viewer");
  const [inviting,    setInviting]    = useState(false);
  const [statusMsg,   setStatusMsg]   = useState({ text: "", ok: true });
  const [tab,         setTab]         = useState("members");

  const currentUserEmail = user?.email ?? "";

  // RBAC for the active workspace
  const rbac = useRBAC(members, currentUserEmail);

  const flash = useCallback((text, ok = true) => {
    setStatusMsg({ text, ok });
    setTimeout(() => setStatusMsg({ text: "", ok: true }), 3000);
  }, []);

  const refreshMembers = useCallback((wsId) =>
    getWorkspaceMembers(wsId).then((data) => setMembers(data ?? [])), []);

  useEffect(() => {
    if (!open || !CLOUD_ENABLED || !user) return;
    setLoading(true);
    getMyWorkspaces(user.id).then((data) => {
      const list = data ?? [];
      setWorkspaces(list);
      // Auto-select the currently active workspace, or the first one
      const current = list.find((w) => w.id === cloudWorkspaceId) ?? list[0] ?? null;
      setActiveWs(current);
      setLoading(false);
    });
  }, [open, user?.id]);

  useEffect(() => {
    if (!activeWs) return;
    refreshMembers(activeWs.id);
  }, [activeWs?.id, refreshMembers]);

  if (!open) return null;

  // Access guard: only show member details if the current user is a member
  const isMember = members.some(
    (m) => m.profiles?.email?.toLowerCase() === currentUserEmail.toLowerCase()
  ) || currentUserEmail.toLowerCase() === OWNER_EMAIL.toLowerCase();

  const handleCreate = async () => {
    if (!newName.trim() || !CLOUD_ENABLED) return;
    setCreating(true);
    const ws = await createWorkspace(user.id, newName.trim());
    if (ws) {
      setWorkspaces((prev) => [...prev, ws]);
      setActiveWs(ws);
      setCloudMeta({ cloudWorkspaceId: ws.id });
      setNewName("");
      flash("Workspace created.");
    } else {
      flash("Failed to create workspace.", false);
    }
    setCreating(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeWs || !CLOUD_ENABLED) return;
    if (!rbac.canInviteMembers) { flash("You don't have permission to invite members.", false); return; }
    setInviting(true);
    const email = inviteEmail.trim().toLowerCase();
    const res   = await inviteMember(activeWs.id, email, inviteRole);
    if (res) {
      flash(`${email} invited as ${inviteRole}.`);
      setInviteEmail("");
      refreshMembers(activeWs.id);
    } else {
      flash("Failed to invite. Make sure the user has signed up first.", false);
    }
    setInviting(false);
  };

  const handleChangeRole = async (member, newRole) => {
    if (!rbac.canChangeRoles) return;
    const ok = await updateMemberRole(activeWs.id, member.user_id, newRole);
    if (ok) {
      setMembers((prev) => prev.map((m) =>
        m.user_id === member.user_id ? { ...m, role: newRole } : m
      ));
      flash("Role updated.");
    } else {
      flash("Failed to update role.", false);
    }
  };

  const handleRemove = async (member) => {
    if (!rbac.canRemoveMembers) return;
    if (member.role === "owner") { flash("Cannot remove the workspace owner.", false); return; }
    const isSelf = member.profiles?.email?.toLowerCase() === currentUserEmail.toLowerCase();
    if (isSelf) { flash("Cannot remove yourself.", false); return; }
    const ok = await removeMember(activeWs.id, member.user_id);
    if (ok) {
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      flash("Member removed.");
    } else {
      flash("Failed to remove member.", false);
    }
  };

  const handleActivate = (ws) => {
    setCloudMeta({ cloudWorkspaceId: ws.id });
    setActiveWs(ws);
  };

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in w-full max-w-2xl rounded-xl border flex flex-col"
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
              <div className="text-[11px]" style={{ color: T.dim }}>Team collaboration and access control</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
            <X size={13} />
          </button>
        </div>

        {!CLOUD_ENABLED && (
          <div className="mx-5 mt-4 rounded-lg border px-3 py-3 text-xs"
            style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.22)", color: T.accent }}>
            Cloud not configured. Workspaces require Supabase.
          </div>
        )}

        {CLOUD_ENABLED && (
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left — workspace list */}
            <div className="w-52 shrink-0 flex flex-col border-r overflow-y-auto" style={{ borderColor: T.border }}>
              <div className="px-3 py-2.5 border-b" style={{ borderColor: T.border }}>
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                  Your Workspaces
                </div>
              </div>

              {loading ? (
                <div className="px-3 py-4 flex items-center gap-2 text-xs" style={{ color: T.muted }}>
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </div>
              ) : workspaces.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center" style={{ color: T.muted }}>No workspaces yet</div>
              ) : (
                <div className="p-2 space-y-0.5 flex-1">
                  {workspaces.map((ws) => {
                    const isActive  = activeWs?.id === ws.id;
                    const isCurrent = cloudWorkspaceId === ws.id;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => handleActivate(ws)}
                        className="w-full rounded-lg px-2.5 py-2 text-left"
                        style={{
                          background: isActive ? T.accentDim : "transparent",
                          border: `1px solid ${isActive ? "rgba(245,158,11,0.3)" : "transparent"}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md shrink-0 text-[10px] font-bold"
                            style={{ background: isActive ? T.accent : T.s3, color: isActive ? "#000" : T.dim }}>
                            {ws.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium" style={{ color: isActive ? T.accent : T.text }}>
                              {ws.name}
                            </div>
                            <div className="text-[9.5px]" style={{ color: T.muted }}>
                              {ws.role && <RoleBadge role={ws.role} />}
                              {isCurrent && " · Active"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Create workspace */}
              <div className="border-t p-3 space-y-2" style={{ borderColor: T.border }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New workspace name"
                  className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                  style={inputStyle}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="w-full inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold"
                  style={{ background: T.accent, color: "#000", opacity: (!newName.trim() || creating) ? 0.5 : 1 }}
                >
                  {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Create
                </button>
              </div>
            </div>

            {/* Right — workspace detail */}
            <div className="flex-1 flex flex-col min-w-0">
              {!activeWs ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <Building2 size={28} style={{ color: T.border, margin: "0 auto 8px" }} />
                    <div className="text-xs" style={{ color: T.muted }}>Select or create a workspace</div>
                  </div>
                </div>
              ) : !isMember ? (
                /* Access denied — user is not a member */
                <div className="flex flex-1 items-center justify-center px-6">
                  <div className="text-center space-y-2">
                    <AlertCircle size={28} style={{ color: "#ef4444", margin: "0 auto" }} />
                    <div className="text-sm font-semibold" style={{ color: T.text }}>Access Denied</div>
                    <div className="text-xs" style={{ color: T.muted }}>
                      You are not a member of <strong>{activeWs.name}</strong>.
                      <br />Ask an admin to invite you.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Workspace header */}
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: T.border }}>
                    <div>
                      <div className="text-sm font-bold" style={{ color: T.text }}>{activeWs.name}</div>
                      <div className="text-[10.5px]" style={{ color: T.muted }}>
                        {members.length} member{members.length !== 1 ? "s" : ""}
                        {" · "}Your role: <span style={{ color: ROLES[rbac.role]?.color }}>{ROLES[rbac.role]?.label}</span>
                      </div>
                    </div>
                    {cloudWorkspaceId !== activeWs.id && (
                      <button
                        onClick={() => handleActivate(activeWs)}
                        className="rounded-lg border px-3 py-1 text-xs font-semibold"
                        style={{ background: T.accent, color: "#000", borderColor: T.accent }}>
                        Set Active
                      </button>
                    )}
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 border-b px-4 pt-2 pb-0" style={{ borderColor: T.border }}>
                    {[["members","Members"],
                      ...(rbac.canInviteMembers ? [["invite","Invite"]] : [])
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setTab(v)}
                        className="px-3 py-1.5 text-xs font-medium border-b-2"
                        style={{ borderColor: tab === v ? T.accent : "transparent", color: tab === v ? T.accent : T.muted }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* Status message */}
                  {statusMsg.text && (
                    <div
                      className="mx-4 mt-2 rounded-lg border px-3 py-1.5 text-xs flex items-center gap-1.5"
                      style={{
                        background: statusMsg.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                        borderColor: statusMsg.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
                        color: statusMsg.ok ? "#10b981" : "#ef4444",
                      }}
                    >
                      {statusMsg.ok ? <Check size={11} /> : <AlertCircle size={11} />}
                      {statusMsg.text}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4">

                    {/* Members tab */}
                    {tab === "members" && (
                      <div className="space-y-2">
                        {members.length === 0 && (
                          <div className="text-xs text-center py-6" style={{ color: T.muted }}>No members yet</div>
                        )}
                        {members.map((m) => {
                          const isOwnerRow = m.role === "owner";
                          const isSelf     = m.profiles?.email?.toLowerCase() === currentUserEmail.toLowerCase();
                          const canRemoveRow = rbac.canRemoveMembers && !isOwnerRow && !isSelf;
                          return (
                            <div
                              key={m.id ?? m.user_id}
                              className="flex items-center gap-3 rounded-lg border px-3 py-2"
                              style={{ background: T.s2, borderColor: T.border }}
                            >
                              <Avatar name={m.profiles?.name ?? m.user_id} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-medium" style={{ color: T.text }}>
                                  {m.profiles?.name ?? "Unknown"}
                                  {isSelf && <span className="ml-1 text-[10px]" style={{ color: T.muted }}>(you)</span>}
                                </div>
                                <div className="truncate text-[10px]" style={{ color: T.muted }}>
                                  {m.profiles?.email ?? m.user_id}
                                </div>
                              </div>
                              <RoleSelect
                                currentRole={m.role}
                                memberEmail={m.profiles?.email}
                                currentUserEmail={currentUserEmail}
                                rbac={rbac}
                                onChangeRole={(newRole) => handleChangeRole(m, newRole)}
                              />
                              {canRemoveRow && (
                                <button
                                  onClick={() => handleRemove(m)}
                                  className="rounded-md p-1 opacity-40 hover:opacity-100 transition-opacity"
                                  style={{ color: "#ef4444" }}
                                  title="Remove member"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Invite tab */}
                    {tab === "invite" && rbac.canInviteMembers && (
                      <div className="space-y-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>
                            <Mail size={10} className="inline mr-1" />Email address
                          </label>
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                            style={inputStyle}
                            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                          />
                          <p className="mt-1 text-[10px]" style={{ color: T.muted }}>
                            User must have already created a DataCanvas account.
                          </p>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium" style={{ color: T.dim }}>Role</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ["admin",       "Admin",       "Manage members and all content"],
                              ["developer",   "Developer",   "Create visuals and datasets"],
                              ["contributor", "Contributor", "Edit dashboards and comment"],
                              ["viewer",      "Viewer",      "Read-only access"],
                            ].map(([v, l, desc]) => (
                              <button
                                key={v}
                                onClick={() => setInviteRole(v)}
                                className="rounded-lg border p-2 text-left"
                                style={{
                                  background: inviteRole === v ? T.accentDim : T.s2,
                                  borderColor: inviteRole === v ? "rgba(245,158,11,0.3)" : T.border,
                                }}
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs font-semibold flex items-center gap-1"
                                    style={{ color: inviteRole === v ? T.accent : T.text }}>
                                    {ROLE_ICON[v]} {l}
                                  </span>
                                  {inviteRole === v && <UserCheck size={11} style={{ color: T.accent }} />}
                                </div>
                                <div className="text-[10px]" style={{ color: T.muted }}>{desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleInvite}
                          disabled={!inviteEmail.trim() || inviting}
                          className="w-full rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2"
                          style={{ background: T.accent, color: "#000", opacity: (!inviteEmail.trim() || inviting) ? 0.5 : 1 }}
                        >
                          {inviting ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                          {inviting ? "Sending…" : "Send Invite"}
                        </button>

                        {/* Role summary */}
                        <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: T.border, background: T.s2 }}>
                          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>Role Summary</div>
                          {Object.entries(ROLES).filter(([r]) => r !== "owner").map(([r, info]) => (
                            <div key={r} className="flex items-start gap-2">
                              <span className="text-[9.5px] font-bold mt-0.5 shrink-0" style={{ color: info.color, width: 70 }}>{info.label}</span>
                              <span className="text-[10px]" style={{ color: T.muted }}>{info.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
