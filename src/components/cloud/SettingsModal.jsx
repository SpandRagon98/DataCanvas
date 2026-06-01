/**
 * SettingsModal — fixed-size settings overlay with three tabs:
 *   Profile     – user info, role in active workspace, sign out
 *   Workspace   – workspace list / local member management
 *   Preferences – theme toggle, app info
 */
import { useState, useEffect, useCallback } from "react";
import {
  X, User, Building2, Sliders, Crown, ShieldCheck, Code2,
  PenLine, Eye, Plus, Trash2, Check, LogOut, AlertCircle,
  Sun, Moon, Mail, RefreshCw, UserPlus, Users,
} from "lucide-react";
import {
  CLOUD_ENABLED, signOut,
  getMyWorkspaces, createWorkspace,
  inviteMember, getWorkspaceMembers,
  updateMemberRole, removeMember,
} from "../../lib/supabase";
import { useStore }      from "../../store/useStore";
import { useLocalAuth }  from "../../store/useLocalAuth";
import { useTheme }      from "../../styles/theme";
import { ROLES, OWNER_EMAIL } from "../../hooks/useRBAC";

// ── Shared micro-components ────────────────────────────────────────────────

const ROLE_ICONS = {
  owner:       Crown,
  admin:       ShieldCheck,
  developer:   Code2,
  contributor: PenLine,
  viewer:      Eye,
};

function RoleBadge({ role, size = "sm" }) {
  const r    = ROLES[role] ?? ROLES.viewer;
  const Icon = ROLE_ICONS[role] ?? Eye;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md font-semibold uppercase"
      style={{
        background: r.color + "1a",
        color:      r.color,
        fontSize:   size === "sm" ? 9.5 : 11,
        padding:    size === "sm" ? "2px 6px" : "3px 8px",
      }}
    >
      <Icon size={size === "sm" ? 9 : 11} />
      {r.label}
    </span>
  );
}

function AvatarCircle({ name, avatarUrl, size = 36 }) {
  const COLORS  = ["#14b8a6","#60a5fa","#34d399","#f472b6","#a78bfa","#fb923c"];
  const color   = COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length];
  const initials= (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const fs      = size <= 28 ? 9 : size <= 36 ? 12 : size <= 52 ? 16 : 22;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl} alt={initials}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color, color: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: fs, fontWeight: 700, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────────────────

function ProfileTab({ user, members, activeWs, onClose, T }) {
  const [signingOut, setSigningOut] = useState(false);
  const localLogout = useLocalAuth((s) => s.logout);

  const name      = user?.user_metadata?.name ?? user?.email ?? "Guest";
  const email     = user?.email ?? "";
  const avatarUrl = user?.user_metadata?.avatar_url;
  const isOwner   = email.toLowerCase() === OWNER_EMAIL.toLowerCase();

  // Determine role from members list (cloud) or local auth
  const myRole = (() => {
    if (isOwner) return "owner";
    if (CLOUD_ENABLED) {
      const myMember = members?.find((m) => m.profiles?.email?.toLowerCase() === email.toLowerCase());
      return myMember?.role ?? "viewer";
    }
    // Local mode
    const localMembers = useLocalAuth.getState().workspaceMembers;
    const match = localMembers.find((m) => m.email.toLowerCase() === email.toLowerCase());
    return match?.role ?? "viewer";
  })();

  const handleSignOut = async () => {
    setSigningOut(true);
    if (CLOUD_ENABLED) {
      await signOut();
    } else {
      localLogout();
    }
    setSigningOut(false);
    onClose();
    // Force reload for local auth to show login screen
    if (!CLOUD_ENABLED) {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Avatar + name hero */}
      <div
        className="flex flex-col items-center gap-3 py-8 px-6 border-b"
        style={{ borderColor: T.border }}
      >
        <AvatarCircle name={name} avatarUrl={avatarUrl} size={72} />
        <div className="text-center">
          <div className="text-base font-bold" style={{ color: T.text }}>{name}</div>
          <div className="text-sm mt-0.5" style={{ color: T.dim }}>{email}</div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <RoleBadge role={myRole} size="md" />
          </div>
          {activeWs && (
            <div className="mt-1 text-[10.5px]" style={{ color: T.muted }}>
              in <span style={{ color: T.text, fontWeight: 600 }}>{activeWs.name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-4">
        {/* Owner banner */}
        {isOwner && (
          <div
            className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
            style={{ background: "rgba(20,184,166,0.08)", borderColor: "rgba(20,184,166,0.25)" }}
          >
            <Crown size={14} style={{ color: "#14b8a6", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="text-xs font-semibold" style={{ color: "#14b8a6" }}>Application Owner</div>
              <div className="text-[10.5px] mt-0.5" style={{ color: "#14b8a6", opacity: 0.75 }}>
                Full permissions across all workspaces
              </div>
            </div>
          </div>
        )}

        {/* Account info card */}
        <div>
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: T.muted }}
          >
            Account Details
          </div>
          <div
            className="rounded-xl border divide-y"
            style={{ background: T.s2, borderColor: T.border, "--tw-divide-opacity": 1 }}
          >
            {[
              { label: "Email",    value: email },
              { label: "Provider", value: CLOUD_ENABLED ? (user?.app_metadata?.provider || "email") : "local" },
              { label: "Role",     value: ROLES[myRole]?.label ?? "Viewer" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between px-3 py-2"
                style={{ borderColor: T.border }}
              >
                <span className="text-xs" style={{ color: T.dim }}>{label}</span>
                <span className="text-[11px] font-medium mono" style={{ color: T.text }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="px-6 pb-6 mt-auto">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition"
          style={{
            background:   "rgba(239,68,68,0.07)",
            borderColor:  "rgba(239,68,68,0.22)",
            color:        "#ef4444",
            opacity:      signingOut ? 0.6 : 1,
          }}
        >
          <LogOut size={14} />
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
}

// ── Local Workspace Tab (no Supabase) ─────────────────────────────────────

function LocalWorkspaceTab({ user, T }) {
  const workspaceMembers        = useLocalAuth((s) => s.workspaceMembers);
  const localUsers              = useLocalAuth((s) => s.localUsers);
  const addWorkspaceMember      = useLocalAuth((s) => s.addWorkspaceMember);
  const updateWorkspaceMemberRole = useLocalAuth((s) => s.updateWorkspaceMemberRole);
  const removeWorkspaceMember   = useLocalAuth((s) => s.removeWorkspaceMember);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("viewer");
  const [inviteMsg,   setInviteMsg]   = useState({ text: "", ok: true });
  const [innerTab,    setInnerTab]    = useState("members");

  const userEmail = user?.email ?? "";
  const isOwner   = userEmail.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const myMember  = workspaceMembers.find((m) => m.email.toLowerCase() === userEmail.toLowerCase());
  const myRole    = isOwner ? "owner" : (myMember?.role ?? "viewer");
  const myLevel   = ROLES[myRole]?.level ?? 1;
  const canManage = myLevel >= ROLES.admin.level;

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    const trimEmail = inviteEmail.trim().toLowerCase();

    // Check if user has registered
    const isRegistered = localUsers.some((u) => u.email.toLowerCase() === trimEmail);

    const res = addWorkspaceMember(trimEmail, inviteRole);
    if (res.ok) {
      setInviteMsg({
        text: isRegistered
          ? `Added ${trimEmail} as ${ROLES[inviteRole]?.label ?? inviteRole}`
          : `Added ${trimEmail} as ${ROLES[inviteRole]?.label ?? inviteRole}. They must create an account to sign in.`,
        ok: true,
      });
      setInviteEmail("");
    } else {
      setInviteMsg({ text: res.error, ok: false });
    }
    setTimeout(() => setInviteMsg({ text: "", ok: true }), 4500);
  };

  const iStyle = {
    background:   T.s2,
    borderColor:  T.border,
    color:        T.text,
    outline:      "none",
    borderRadius: 10,
    border:       `1px solid ${T.border}`,
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-3 border-b shrink-0"
        style={{ borderColor: T.border }}
      >
        <div className="text-sm font-bold" style={{ color: T.text }}>Local Workspace</div>
        <div className="text-[10.5px] mt-0.5" style={{ color: T.muted }}>
          {workspaceMembers.length} member{workspaceMembers.length !== 1 ? "s" : ""}
          {" · "}Your role:{" "}
          <span style={{ color: ROLES[myRole]?.color ?? T.dim, fontWeight: 600 }}>
            {ROLES[myRole]?.label ?? "Viewer"}
          </span>
        </div>
      </div>

      {/* Inner tabs */}
      <div
        className="flex gap-0 border-b px-5 pt-1.5 pb-0 shrink-0"
        style={{ borderColor: T.border }}
      >
        {[["members", "Members"], ...(canManage ? [["invite", "Add Member"]] : [])].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setInnerTab(v)}
            className="mr-3 pb-2 text-xs font-medium border-b-2"
            style={{
              borderColor: innerTab === v ? T.accent : "transparent",
              color:       innerTab === v ? T.accent : T.muted,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Members list */}
        {innerTab === "members" && (
          <div className="space-y-1.5">
            {workspaceMembers.length === 0 && (
              <div className="py-8 text-center text-xs" style={{ color: T.muted }}>
                No members yet. Use the Add Member tab to add people.
              </div>
            )}
            {workspaceMembers.map((m) => {
              const mEmail   = m.email;
              const localU   = localUsers.find((u) => u.email.toLowerCase() === mEmail.toLowerCase());
              const mName    = localU?.name ?? mEmail.split("@")[0];
              const isOwnerM = mEmail.toLowerCase() === OWNER_EMAIL.toLowerCase();
              const mRole    = isOwnerM ? "owner" : m.role;
              const isMe     = mEmail.toLowerCase() === userEmail.toLowerCase();
              const mLevel   = ROLES[mRole]?.level ?? 1;
              const canEdit  = canManage && !isOwnerM && !isMe && mLevel < myLevel;

              return (
                <div
                  key={mEmail}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2"
                  style={{
                    background:  isMe ? T.accentDim : T.s2,
                    borderColor: isMe ? "rgba(20,184,166,0.22)" : T.border,
                  }}
                >
                  <AvatarCircle name={mName} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold" style={{ color: T.text }}>
                        {mName}
                      </span>
                      {isMe && (
                        <span
                          className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold"
                          style={{ background: T.s3, color: T.muted }}
                        >
                          you
                        </span>
                      )}
                      {!localU && (
                        <span
                          className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold"
                          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                        >
                          not registered
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[10px]" style={{ color: T.muted }}>
                      {mEmail}
                    </div>
                  </div>

                  {/* Role selector / badge */}
                  {canEdit ? (
                    <select
                      value={mRole}
                      onChange={(e) => updateWorkspaceMemberRole(mEmail, e.target.value)}
                      className="rounded-lg border text-[10px] px-1.5 py-1 font-semibold"
                      style={{
                        background:  T.surface,
                        borderColor: T.border,
                        color:       ROLES[mRole]?.color ?? T.dim,
                        outline:     "none",
                      }}
                    >
                      {Object.entries(ROLES)
                        .filter(([, r]) => r.level < myLevel)
                        .sort(([, a], [, b]) => b.level - a.level)
                        .map(([key, r]) => (
                          <option key={key} value={key}>{r.label}</option>
                        ))}
                    </select>
                  ) : (
                    <RoleBadge role={mRole} />
                  )}

                  {/* Remove button */}
                  {canEdit && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${mName} from workspace?`)) {
                          removeWorkspaceMember(mEmail);
                        }
                      }}
                      className="rounded-lg p-1 opacity-40 hover:opacity-100 transition-opacity"
                      style={{ color: "#ef4444" }}
                      title="Remove from workspace"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Member */}
        {innerTab === "invite" && canManage && (
          <div className="space-y-3 max-w-sm">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: T.dim }}>
                <Mail size={10} className="inline mr-1" />
                Email address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                placeholder="user@example.com"
                className="w-full px-3 py-2.5 text-sm"
                style={iStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: T.dim }}>
                Role
              </label>
              <div className="space-y-1.5">
                {Object.entries(ROLES)
                  .filter(([, r]) => r.level < myLevel)
                  .sort(([, a], [, b]) => b.level - a.level)
                  .map(([key, r]) => {
                    const Icon     = ROLE_ICONS[key] ?? Eye;
                    const selected = inviteRole === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setInviteRole(key)}
                        className="w-full rounded-xl border p-2.5 text-left flex items-start gap-3"
                        style={{
                          background:  selected ? r.color + "12" : T.s2,
                          borderColor: selected ? r.color + "40" : T.border,
                        }}
                      >
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg mt-0.5"
                          style={{ background: selected ? r.color + "22" : T.s3 }}
                        >
                          <Icon size={12} style={{ color: selected ? r.color : T.dim }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: selected ? r.color : T.text }}
                            >
                              {r.label}
                            </span>
                            {selected && <Check size={10} style={{ color: r.color }} />}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>
                            {r.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {inviteMsg.text && (
              <div
                className="rounded-xl border px-3 py-2 text-xs"
                style={{
                  background:  inviteMsg.ok ? "rgba(16,185,129,0.08)"  : "rgba(239,68,68,0.08)",
                  borderColor: inviteMsg.ok ? "rgba(16,185,129,0.25)"  : "rgba(239,68,68,0.25)",
                  color:       inviteMsg.ok ? "#10b981"                 : "#ef4444",
                }}
              >
                {inviteMsg.text}
              </div>
            )}

            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim()}
              className="w-full rounded-xl py-2.5 text-sm font-semibold"
              style={{
                background: T.accent,
                color:      "#000",
                opacity:    !inviteEmail.trim() ? 0.5 : 1,
              }}
            >
              <UserPlus size={13} className="inline mr-1.5" />
              Add Member
            </button>

            <div
              className="rounded-xl border px-3 py-2.5 text-[10.5px] leading-relaxed"
              style={{ background: T.s2, borderColor: T.border, color: T.muted }}
            >
              Add a user's email to grant them workspace access. They must create
              an account on the login page before they can sign in.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cloud Workspace Tab (Supabase) ────────────────────────────────────────

function CloudWorkspaceTab({ user, onMembersChange, onActiveWsChange, T }) {
  const setCloudMeta      = useStore((s) => s.setCloudMeta);
  const cloudWorkspaceId  = useStore((s) => s.cloudWorkspaceId);

  const [workspaces,   setWorkspaces]   = useState([]);
  const [members,      setMembers]      = useState([]);
  const [activeWs,     setActiveWs]     = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [newWsName,    setNewWsName]    = useState("");
  const [inviteEmail,  setInviteEmail]  = useState("");
  const [inviteRole,   setInviteRole]   = useState("viewer");
  const [inviting,     setInviting]     = useState(false);
  const [inviteMsg,    setInviteMsg]    = useState({ text: "", ok: true });
  const [innerTab,     setInnerTab]     = useState("members");

  const userEmail = user?.email ?? "";
  const isOwner   = userEmail.toLowerCase() === OWNER_EMAIL.toLowerCase();

  const myMember = members.find((m) => m.profiles?.email?.toLowerCase() === userEmail.toLowerCase());
  const myRole   = isOwner ? "owner" : (myMember?.role ?? "viewer");
  const myLevel  = ROLES[myRole]?.level ?? 1;
  const canManage= myLevel >= ROLES.admin.level;

  const loadWorkspaces = useCallback(async () => {
    if (!CLOUD_ENABLED || !user) return;
    setLoading(true);
    const data = await getMyWorkspaces(user.id);
    const list = data ?? [];
    setWorkspaces(list);
    if (list.length && !activeWs) {
      const first = list[0];
      setActiveWs(first);
      onActiveWsChange?.(first);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  useEffect(() => {
    if (!activeWs) { setMembers([]); onMembersChange?.([]); return; }
    getWorkspaceMembers(activeWs.id).then((data) => {
      const list = data ?? [];
      setMembers(list);
      onMembersChange?.(list);
    });
  }, [activeWs?.id]);

  const selectWs = (ws) => {
    setActiveWs(ws);
    onActiveWsChange?.(ws);
    setCloudMeta({ cloudWorkspaceId: ws.id });
  };

  const handleCreate = async () => {
    if (!newWsName.trim() || !CLOUD_ENABLED) return;
    setCreating(true);
    const ws = await createWorkspace(user.id, newWsName.trim());
    if (ws) {
      const newList = [...workspaces, { ...ws, role: "owner" }];
      setWorkspaces(newList);
      selectWs(ws);
      setNewWsName("");
    }
    setCreating(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeWs) return;
    setInviting(true);
    setInviteMsg({ text: "", ok: true });
    const res = await inviteMember(activeWs.id, inviteEmail.trim(), inviteRole);
    if (res) {
      setInviteMsg({
        text: `Invited ${inviteEmail} as ${ROLES[inviteRole]?.label ?? inviteRole}`,
        ok: true,
      });
      setInviteEmail("");
      const data = await getWorkspaceMembers(activeWs.id);
      const list  = data ?? [];
      setMembers(list);
      onMembersChange?.(list);
    } else {
      setInviteMsg({
        text: "User not found. They must sign up first, then you can add them.",
        ok: false,
      });
    }
    setInviting(false);
    setTimeout(() => setInviteMsg({ text: "", ok: true }), 4500);
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!activeWs) return;
    const ok = await updateMemberRole(activeWs.id, userId, newRole);
    if (ok) {
      const updated = members.map((m) =>
        m.user_id === userId ? { ...m, role: newRole } : m,
      );
      setMembers(updated);
      onMembersChange?.(updated);
    }
  };

  const handleRemove = async (userId, memberName) => {
    if (!activeWs) return;
    if (!window.confirm(`Remove ${memberName} from "${activeWs.name}"?`)) return;
    const ok = await removeMember(activeWs.id, userId);
    if (ok) {
      const updated = members.filter((m) => m.user_id !== userId);
      setMembers(updated);
      onMembersChange?.(updated);
    }
  };

  const iStyle = {
    background:   T.s2,
    borderColor:  T.border,
    color:        T.text,
    outline:      "none",
    borderRadius: 10,
    border:       `1px solid ${T.border}`,
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Workspace list ── */}
      <div
        className="flex w-44 shrink-0 flex-col border-r overflow-hidden"
        style={{ borderColor: T.border }}
      >
        <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: T.border }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
              Workspaces
            </span>
            <button
              onClick={loadWorkspaces}
              title="Refresh"
              className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: T.muted }}
            >
              <RefreshCw size={9} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading && (
            <div className="py-4 text-center text-[11px]" style={{ color: T.muted }}>Loading...</div>
          )}
          {!loading && workspaces.length === 0 && (
            <div className="py-4 text-center text-[11px]" style={{ color: T.muted }}>
              No workspaces yet
            </div>
          )}
          {workspaces.map((ws) => {
            const isActive  = activeWs?.id === ws.id;
            const isCurrent = cloudWorkspaceId === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => selectWs(ws)}
                className="w-full rounded-xl px-2 py-2 text-left"
                style={{
                  background:   isActive ? T.accentDim : "transparent",
                  border:       `1px solid ${isActive ? "rgba(20,184,166,0.28)" : "transparent"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center rounded-lg shrink-0 text-[9px] font-bold"
                    style={{
                      width: 22, height: 22,
                      background: isActive ? T.accent : T.s3,
                      color:      isActive ? "#000" : T.dim,
                    }}
                  >
                    {ws.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium" style={{ color: isActive ? T.accent : T.text }}>
                      {ws.name}
                    </div>
                    {isCurrent && (
                      <div className="text-[9px]" style={{ color: T.muted }}>Active</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Create new workspace */}
        <div className="shrink-0 border-t p-2.5 space-y-1.5" style={{ borderColor: T.border }}>
          <input
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="New workspace..."
            className="w-full px-2.5 py-1.5 text-[11px]"
            style={iStyle}
          />
          <button
            onClick={handleCreate}
            disabled={!newWsName.trim() || creating}
            className="w-full flex items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold"
            style={{
              background: T.accent,
              color:      "#000",
              opacity:    !newWsName.trim() || creating ? 0.5 : 1,
            }}
          >
            <Plus size={10} />
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* ── Workspace detail ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {!activeWs ? (
          <div className="flex flex-col flex-1 items-center justify-center gap-2 py-10">
            <Building2 size={30} style={{ color: T.border }} />
            <div className="text-xs" style={{ color: T.muted }}>Select or create a workspace</div>
          </div>
        ) : (
          <>
            {/* WS header */}
            <div
              className="px-4 py-2.5 border-b shrink-0"
              style={{ borderColor: T.border }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold" style={{ color: T.text }}>
                    {activeWs.name}
                  </div>
                  <div className="text-[10.5px]" style={{ color: T.muted }}>
                    {members.length} member{members.length !== 1 ? "s" : ""}
                    {" · "}
                    Your role:{" "}
                    <span style={{ color: ROLES[myRole]?.color ?? T.dim, fontWeight: 600 }}>
                      {ROLES[myRole]?.label ?? "Viewer"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inner tabs */}
            <div
              className="flex gap-0 border-b px-4 pt-1.5 pb-0 shrink-0"
              style={{ borderColor: T.border }}
            >
              {[["members", "Members"], ["invite", "Invite Member"]].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setInnerTab(v)}
                  className="mr-3 pb-2 text-xs font-medium border-b-2"
                  style={{
                    borderColor: innerTab === v ? T.accent : "transparent",
                    color:       innerTab === v ? T.accent : T.muted,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Members */}
              {innerTab === "members" && (
                <div className="space-y-1.5">
                  {members.length === 0 && (
                    <div className="py-8 text-center text-xs" style={{ color: T.muted }}>
                      No members yet. Use the Invite tab to add people.
                    </div>
                  )}
                  {members.map((m) => {
                    const mEmail   = m.profiles?.email ?? "";
                    const mName    = m.profiles?.name  ?? mEmail ?? "Unknown";
                    const mAvatar  = m.profiles?.avatar_url;
                    const isOwnerM = mEmail.toLowerCase() === OWNER_EMAIL.toLowerCase();
                    const mRole    = isOwnerM ? "owner" : m.role;
                    const isMe     = mEmail.toLowerCase() === userEmail.toLowerCase();
                    const mLevel   = ROLES[mRole]?.level ?? 1;
                    const canEdit  = canManage && !isOwnerM && !isMe && mLevel < myLevel;

                    return (
                      <div
                        key={m.user_id || m.id}
                        className="flex items-center gap-2.5 rounded-xl border px-3 py-2"
                        style={{
                          background:  isMe ? T.accentDim : T.s2,
                          borderColor: isMe ? "rgba(20,184,166,0.22)" : T.border,
                        }}
                      >
                        <AvatarCircle name={mName} avatarUrl={mAvatar} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold" style={{ color: T.text }}>
                              {mName}
                            </span>
                            {isMe && (
                              <span
                                className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold"
                                style={{ background: T.s3, color: T.muted }}
                              >
                                you
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[10px]" style={{ color: T.muted }}>
                            {mEmail}
                          </div>
                        </div>

                        {canEdit ? (
                          <select
                            value={mRole}
                            onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                            className="rounded-lg border text-[10px] px-1.5 py-1 font-semibold"
                            style={{
                              background:  T.surface,
                              borderColor: T.border,
                              color:       ROLES[mRole]?.color ?? T.dim,
                              outline:     "none",
                            }}
                          >
                            {Object.entries(ROLES)
                              .filter(([, r]) => r.level < myLevel)
                              .sort(([, a], [, b]) => b.level - a.level)
                              .map(([key, r]) => (
                                <option key={key} value={key}>{r.label}</option>
                              ))}
                          </select>
                        ) : (
                          <RoleBadge role={mRole} />
                        )}

                        {canEdit && (
                          <button
                            onClick={() => handleRemove(m.user_id, mName)}
                            className="rounded-lg p-1 opacity-40 hover:opacity-100 transition-opacity"
                            style={{ color: "#ef4444" }}
                            title="Remove from workspace"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Invite */}
              {innerTab === "invite" && (
                canManage ? (
                  <div className="space-y-3 max-w-xs">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: T.dim }}>
                        <Mail size={10} className="inline mr-1" />
                        Email address
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="w-full px-3 py-2.5 text-sm"
                        style={iStyle}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: T.dim }}>
                        Role
                      </label>
                      <div className="space-y-1.5">
                        {Object.entries(ROLES)
                          .filter(([, r]) => r.level < myLevel)
                          .sort(([, a], [, b]) => b.level - a.level)
                          .map(([key, r]) => {
                            const Icon     = ROLE_ICONS[key] ?? Eye;
                            const selected = inviteRole === key;
                            return (
                              <button
                                key={key}
                                onClick={() => setInviteRole(key)}
                                className="w-full rounded-xl border p-2.5 text-left flex items-start gap-3"
                                style={{
                                  background:  selected ? r.color + "12" : T.s2,
                                  borderColor: selected ? r.color + "40" : T.border,
                                }}
                              >
                                <div
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg mt-0.5"
                                  style={{ background: selected ? r.color + "22" : T.s3 }}
                                >
                                  <Icon size={12} style={{ color: selected ? r.color : T.dim }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="text-xs font-semibold"
                                      style={{ color: selected ? r.color : T.text }}
                                    >
                                      {r.label}
                                    </span>
                                    {selected && <Check size={10} style={{ color: r.color }} />}
                                  </div>
                                  <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>
                                    {r.desc}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {inviteMsg.text && (
                      <div
                        className="rounded-xl border px-3 py-2 text-xs"
                        style={{
                          background:  inviteMsg.ok ? "rgba(16,185,129,0.08)"  : "rgba(239,68,68,0.08)",
                          borderColor: inviteMsg.ok ? "rgba(16,185,129,0.25)"  : "rgba(239,68,68,0.25)",
                          color:       inviteMsg.ok ? "#10b981"                 : "#ef4444",
                        }}
                      >
                        {inviteMsg.text}
                      </div>
                    )}

                    <button
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || inviting}
                      className="w-full rounded-xl py-2.5 text-sm font-semibold"
                      style={{
                        background: T.accent,
                        color:      "#000",
                        opacity:    !inviteEmail.trim() || inviting ? 0.5 : 1,
                      }}
                    >
                      {inviting ? "Sending invite..." : "Send Invite"}
                    </button>

                    <div
                      className="rounded-xl border px-3 py-2.5 text-[10.5px] leading-relaxed"
                      style={{ background: T.s2, borderColor: T.border, color: T.muted }}
                    >
                      The person must already have a Vizora account.
                      Share the app link first so they can sign up, then add them here.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
                    <AlertCircle size={28} style={{ color: T.border }} />
                    <div className="text-xs text-center" style={{ color: T.muted }}>
                      Only Admins and Owners can invite members.
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Preferences Tab ────────────────────────────────────────────────────────

function PreferencesTab({ T }) {
  const themeMode   = useStore((s) => s.themeMode);
  const toggleTheme = useStore((s) => s.toggleThemeMode);

  return (
    <div className="px-6 py-5 space-y-6 overflow-y-auto h-full">
      {/* Appearance */}
      <section>
        <div
          className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: T.muted }}
        >
          Appearance
        </div>
        <div
          className="flex rounded-xl border p-1"
          style={{ background: T.s2, borderColor: T.border }}
        >
          {[
            { mode: "dark",  Icon: Moon, label: "Dark"  },
            { mode: "light", Icon: Sun,  label: "Light" },
          ].map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => themeMode !== mode && toggleTheme()}
              className="flex flex-1 items-center justify-center gap-2 rounded-[9px] py-2 text-sm font-medium transition"
              style={{
                background: themeMode === mode ? T.surface : "transparent",
                color:      themeMode === mode ? T.text    : T.muted,
                boxShadow:  themeMode === mode ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
              }}
            >
              <Icon size={13} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Roles reference */}
      <section>
        <div
          className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: T.muted }}
        >
          Role Reference
        </div>
        <div className="space-y-1.5">
          {Object.entries(ROLES).map(([key, r]) => {
            const Icon = ROLE_ICONS[key] ?? Eye;
            return (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl border px-3 py-2"
                style={{ background: T.s2, borderColor: T.border }}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: r.color + "1a" }}
                >
                  <Icon size={12} style={{ color: r.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold" style={{ color: r.color }}>{r.label}</div>
                  <div className="text-[10px] truncate" style={{ color: T.muted }}>{r.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* About */}
      <section>
        <div
          className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: T.muted }}
        >
          About
        </div>
        <div
          className="rounded-xl border divide-y"
          style={{ background: T.s2, borderColor: T.border }}
        >
          {[
            { label: "Version",      value: "v7.0"                    },
            { label: "Owner",        value: OWNER_EMAIL                },
            { label: "Cloud mode",   value: CLOUD_ENABLED ? "On" : "Off" },
            { label: "Build target", value: "GitHub Pages (static)"   },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between px-3 py-2"
              style={{ borderColor: T.border }}
            >
              <span className="text-xs" style={{ color: T.dim }}>{label}</span>
              <span
                className="text-[11px] font-medium"
                style={{
                  color: label === "Cloud mode"
                    ? (CLOUD_ENABLED ? "#22c55e" : T.muted)
                    : T.text,
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Root SettingsModal ─────────────────────────────────────────────────────

const TABS = [
  { id: "profile",     icon: User,      label: "Profile"     },
  { id: "workspace",   icon: Building2, label: "Workspace"   },
  { id: "preferences", icon: Sliders,   label: "Preferences" },
];

export default function SettingsModal({ open, onClose, user }) {
  const T = useTheme();
  const [activeTab, setActiveTab] = useState("profile");
  // Shared state so ProfileTab can show workspace-level role (cloud only)
  const [members,  setMembers]  = useState([]);
  const [activeWs, setActiveWs] = useState(null);

  if (!open) return null;

  const name      = user?.user_metadata?.name ?? user?.email ?? "Guest";
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(14px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in flex overflow-hidden rounded-2xl border"
        style={{
          width: 920,
          height: "min(92vh, 720px)",
          background:  T.surface,
          borderColor: T.border,
          boxShadow:   "0 32px 80px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.3)",
        }}
      >
        {/* ── Left nav ── */}
        <div
          className="flex w-44 shrink-0 flex-col border-r"
          style={{ background: T.sidebarBg, borderColor: T.border }}
        >
          {/* User summary */}
          <div className="flex flex-col items-center gap-2 px-4 py-5 border-b" style={{ borderColor: T.border }}>
            <AvatarCircle name={name} avatarUrl={avatarUrl} size={44} />
            <div className="text-center w-full">
              <div className="truncate text-[12.5px] font-bold" style={{ color: T.text }}>{name}</div>
              <div className="truncate text-[10px] mt-0.5" style={{ color: T.muted }}>
                {user?.email ?? "Guest"}
              </div>
            </div>
          </div>

          {/* Tab nav */}
          <nav className="flex-1 p-2 space-y-0.5">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition"
                style={{
                  background:   activeTab === id ? T.accentDim   : "transparent",
                  color:        activeTab === id ? T.accent       : T.dim,
                  border:       `1px solid ${activeTab === id ? "rgba(20,184,166,0.22)" : "transparent"}`,
                }}
              >
                <Icon size={13} strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </nav>

          <div className="px-4 pb-3 text-[10px]" style={{ color: T.muted }}>
            Vizora · v7.0
          </div>
        </div>

        {/* ── Right content ── */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Content header */}
          <div
            className="flex shrink-0 items-center justify-between border-b px-5 py-3"
            style={{ borderColor: T.border }}
          >
            <div className="text-sm font-bold" style={{ color: T.text }}>
              {TABS.find((t) => t.id === activeTab)?.label}
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border p-1.5 transition"
              style={{ background: T.s2, borderColor: T.border, color: T.muted }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Tab body */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "profile" && (
              <ProfileTab
                user={user}
                members={members}
                activeWs={activeWs}
                onClose={onClose}
                T={T}
              />
            )}
            {activeTab === "workspace" && (
              CLOUD_ENABLED ? (
                <CloudWorkspaceTab
                  user={user}
                  onMembersChange={setMembers}
                  onActiveWsChange={setActiveWs}
                  T={T}
                />
              ) : (
                <LocalWorkspaceTab
                  user={user}
                  T={T}
                />
              )
            )}
            {activeTab === "preferences" && (
              <PreferencesTab T={T} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
