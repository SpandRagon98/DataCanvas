import { useEffect, useState } from "react";
import {
  Building2, X, Plus, Mail, UserCheck, Crown,
  Eye, Trash2, ChevronDown, Users,
} from "lucide-react";
import {
  CLOUD_ENABLED, getMyWorkspaces, createWorkspace,
  inviteMember, getWorkspaceMembers,
} from "../../lib/supabase";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../styles/theme";

const ROLE_LABELS = { owner: "Owner", admin: "Admin", viewer: "Viewer" };
const ROLE_COLORS = {
  owner:  { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  admin:  { bg: "rgba(96,165,250,0.12)",  color: "#60a5fa" },
  viewer: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
};

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] ?? ROLE_COLORS.viewer;
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase"
      style={c}
    >
      {ROLE_LABELS[role] ?? role}
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

export default function WorkspaceManager({ open, onClose, user }) {
  const T                   = useTheme();
  const setCloudMeta        = useStore((s) => s.setCloudMeta);
  const cloudWorkspaceId    = useStore((s) => s.cloudWorkspaceId);

  const [workspaces,   setWorkspaces]   = useState([]);
  const [members,      setMembers]      = useState([]);
  const [activeWs,     setActiveWs]     = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [newName,      setNewName]      = useState("");
  const [inviteEmail,  setInviteEmail]  = useState("");
  const [inviteRole,   setInviteRole]   = useState("viewer");
  const [inviting,     setInviting]     = useState(false);
  const [inviteMsg,    setInviteMsg]    = useState("");
  const [tab,          setTab]          = useState("members"); // "members" | "invite"

  useEffect(() => {
    if (!open || !CLOUD_ENABLED || !user) return;
    setLoading(true);
    getMyWorkspaces(user.id).then((data) => {
      setWorkspaces(data ?? []);
      if (!activeWs && data?.length) setActiveWs(data[0]);
      setLoading(false);
    });
  }, [open, user?.id]);

  useEffect(() => {
    if (!activeWs) return;
    getWorkspaceMembers(activeWs.id).then((data) => setMembers(data ?? []));
  }, [activeWs?.id]);

  if (!open) return null;

  const handleCreate = async () => {
    if (!newName.trim() || !CLOUD_ENABLED) return;
    setCreating(true);
    const ws = await createWorkspace(user.id, newName.trim());
    if (ws) {
      setWorkspaces((prev) => [...prev, ws]);
      setActiveWs(ws);
      setNewName("");
    }
    setCreating(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeWs || !CLOUD_ENABLED) return;
    setInviting(true);
    setInviteMsg("");
    const res = await inviteMember(activeWs.id, inviteEmail.trim(), inviteRole);
    if (res) {
      setInviteMsg("Invite sent!");
      setInviteEmail("");
      // refresh members
      getWorkspaceMembers(activeWs.id).then((data) => setMembers(data ?? []));
    } else {
      setInviteMsg("Failed to invite. Check the email and try again.");
    }
    setInviting(false);
    setTimeout(() => setInviteMsg(""), 3000);
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
        className="anim-scale-in w-full max-w-xl rounded-xl border flex flex-col"
        style={{
          background: T.surface,
          borderColor: T.border,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: T.accentDim }}>
              <Building2 size={14} color={T.accent} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: T.text }}>Workspaces</div>
              <div className="text-[11px]" style={{ color: T.dim }}>Manage your teams and shared dashboards</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
            <X size={13} />
          </button>
        </div>

        {!CLOUD_ENABLED && (
          <div className="mx-5 mt-4 rounded-lg border px-3 py-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.22)", color: T.accent }}>
            Cloud not configured. Workspaces require Supabase.
          </div>
        )}

        {CLOUD_ENABLED && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left — workspace list */}
            <div
              className="w-48 shrink-0 flex flex-col border-r overflow-y-auto"
              style={{ borderColor: T.border }}
            >
              <div className="px-3 py-2.5 border-b" style={{ borderColor: T.border }}>
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                  Your Workspaces
                </div>
              </div>

              {loading ? (
                <div className="px-3 py-4 text-xs" style={{ color: T.muted }}>Loading…</div>
              ) : workspaces.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center" style={{ color: T.muted }}>No workspaces yet</div>
              ) : (
                <div className="p-2 space-y-0.5 flex-1">
                  {workspaces.map((ws) => {
                    const isActive = activeWs?.id === ws.id;
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
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-md shrink-0 text-[10px] font-bold"
                            style={{ background: isActive ? T.accent : T.s3, color: isActive ? "#000" : T.dim }}
                          >
                            {ws.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium" style={{ color: isActive ? T.accent : T.text }}>
                              {ws.name}
                            </div>
                            {isCurrent && (
                              <div className="text-[9.5px]" style={{ color: T.muted }}>Active</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Create new */}
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
                  <Plus size={11} />
                  Create
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
              ) : (
                <>
                  {/* WS header */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: T.border }}>
                    <div className="text-sm font-bold" style={{ color: T.text }}>{activeWs.name}</div>
                    <div className="text-[10.5px]" style={{ color: T.muted }}>
                      {members.length} member{members.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 border-b px-4 pt-2 pb-0" style={{ borderColor: T.border }}>
                    {[["members","Members"],["invite","Invite"]].map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setTab(v)}
                        className="px-3 py-1.5 text-xs font-medium border-b-2"
                        style={{
                          borderColor: tab === v ? T.accent : "transparent",
                          color: tab === v ? T.accent : T.muted,
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {tab === "members" && (
                      <div className="space-y-2">
                        {members.length === 0 && (
                          <div className="text-xs text-center py-6" style={{ color: T.muted }}>No members yet</div>
                        )}
                        {members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-3 rounded-lg border px-3 py-2"
                            style={{ background: T.s2, borderColor: T.border }}
                          >
                            <Avatar name={m.profiles?.name ?? m.user_id} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium" style={{ color: T.text }}>
                                {m.profiles?.name ?? "Unknown"}
                              </div>
                              <div className="truncate text-[10px]" style={{ color: T.muted }}>
                                {m.profiles?.email ?? m.user_id}
                              </div>
                            </div>
                            <RoleBadge role={m.role} />
                          </div>
                        ))}
                      </div>
                    )}

                    {tab === "invite" && (
                      <div className="space-y-3">
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
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: T.dim }}>Role</label>
                          <div className="flex gap-2">
                            {[["viewer","Viewer","Can view dashboards"],["admin","Admin","Can edit everything"]].map(([v, l, desc]) => (
                              <button
                                key={v}
                                onClick={() => setInviteRole(v)}
                                className="flex-1 rounded-lg border p-2 text-left"
                                style={{
                                  background: inviteRole === v ? T.accentDim : T.s2,
                                  borderColor: inviteRole === v ? "rgba(245,158,11,0.3)" : T.border,
                                }}
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs font-semibold" style={{ color: inviteRole === v ? T.accent : T.text }}>{l}</span>
                                  {inviteRole === v && (
                                    <UserCheck size={11} style={{ color: T.accent }} />
                                  )}
                                </div>
                                <div className="text-[10px]" style={{ color: T.muted }}>{desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {inviteMsg && (
                          <div
                            className="rounded-lg border px-3 py-2 text-xs"
                            style={{
                              background: inviteMsg.startsWith("Failed") ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                              borderColor: inviteMsg.startsWith("Failed") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                              color: inviteMsg.startsWith("Failed") ? "#ef4444" : "#10b981",
                            }}
                          >
                            {inviteMsg}
                          </div>
                        )}

                        <button
                          onClick={handleInvite}
                          disabled={!inviteEmail.trim() || inviting}
                          className="w-full rounded-lg py-2 text-sm font-semibold"
                          style={{ background: T.accent, color: "#000", opacity: (!inviteEmail.trim() || inviting) ? 0.5 : 1 }}
                        >
                          {inviting ? "Sending…" : "Send Invite"}
                        </button>
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
