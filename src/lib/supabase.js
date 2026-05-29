import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** True when Supabase is configured in .env */
export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON && !SUPABASE_URL.includes("your-project"));

export const supabase = CLOUD_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

// ── Auth ─────────────────────────────────────────────────────────────────────

export const getSession = () => supabase?.auth.getSession();
export const getUser    = () => supabase?.auth.getUser();

export const signInWithEmail = (email, password) =>
  supabase?.auth.signInWithPassword({ email, password }) ?? Promise.resolve({ error: null });

export const signUpWithEmail = (email, password, name) =>
  supabase?.auth.signUp({
    email,
    password,
    options: { data: { name } },
  }) ?? Promise.resolve({ error: null });

export const signInWithGoogle = () =>
  supabase?.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${import.meta.env.VITE_SITE_URL || window.location.origin}/#/`,
    },
  }) ?? Promise.resolve({ error: null });

export const signOut = () => supabase?.auth.signOut() ?? Promise.resolve({});

export const onAuthChange = (cb) =>
  supabase?.auth.onAuthStateChange(cb) ?? { data: null };

// ── Workbooks ─────────────────────────────────────────────────────────────────

export const saveWorkbook = async ({ id, name, data, workspaceId }) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (id) {
    const { data: existing } = await supabase
      .from("workbooks")
      .select("version")
      .eq("id", id)
      .single();

    const newVersion = (existing?.version ?? 0) + 1;

    // Save version snapshot
    await supabase.from("workbook_versions").insert({
      workbook_id: id,
      data,
      version: newVersion,
      saved_by: user.id,
    });

    const { data: wb, error } = await supabase
      .from("workbooks")
      .update({ name, data, version: newVersion, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    return error ? null : wb;
  } else {
    const { data: wb, error } = await supabase
      .from("workbooks")
      .insert({
        owner_id: user.id,
        workspace_id: workspaceId || null,
        name: name || "Untitled Workbook",
        data,
        version: 1,
      })
      .select()
      .single();
    return error ? null : wb;
  }
};

export const loadWorkbooks = async () => {
  if (!supabase) return [];
  const { data } = await supabase
    .from("workbooks")
    .select("id, name, updated_at, version, workspace_id")
    .order("updated_at", { ascending: false });
  return data ?? [];
};

export const loadWorkbookById = async (id) => {
  if (!supabase) return null;
  const { data } = await supabase.from("workbooks").select("*").eq("id", id).single();
  return data;
};

export const getWorkbookVersions = async (workbookId) => {
  if (!supabase) return [];
  const { data } = await supabase
    .from("workbook_versions")
    .select("id, version, data, created_at, saved_by")
    .eq("workbook_id", workbookId)
    .order("version", { ascending: false })
    .limit(50);
  return data ?? [];
};

// ── Workspaces ────────────────────────────────────────────────────────────────

/**
 * Return only workspaces where the current user is an explicit member.
 * Pass userId, or omit to auto-detect from auth.
 */
export const getMyWorkspaces = async (userId) => {
  if (!supabase) return [];
  const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, owner_id)")
    .eq("user_id", uid);
  // Filter out nulls (RLS may block some rows) and return with role attached
  return (data ?? [])
    .filter((m) => m.workspaces != null)
    .map((m) => ({ ...m.workspaces, role: m.role }));
};

/** Pass (userId, name) or just (name) */
export const createWorkspace = async (userIdOrName, maybeName) => {
  if (!supabase) return null;
  const name     = maybeName ?? userIdOrName;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: ws } = await supabase
    .from("workspaces")
    .insert({ name, owner_id: user.id })
    .select()
    .single();
  if (ws) {
    await supabase.from("workspace_members").insert({
      workspace_id: ws.id, user_id: user.id, role: "admin",
    });
  }
  return ws;
};

export const inviteMember = async (workspaceId, email, role = "viewer") => {
  if (!supabase) return null;
  // Always compare emails lowercase
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .single();
  if (!profile) return null;
  const { error } = await supabase.from("workspace_members").upsert({
    workspace_id: workspaceId,
    user_id: profile.id,
    role,
  });
  return error ? null : { success: true };
};

export const getWorkspaceMembers = async (workspaceId) => {
  if (!supabase) return [];
  const { data } = await supabase
    .from("workspace_members")
    .select("id, role, user_id, profiles(id, name, email, avatar_url)")
    .eq("workspace_id", workspaceId);
  return data ?? [];
};

// ── Sharing ───────────────────────────────────────────────────────────────────

export const createShareLink = async ({ workbookId, dashboardId, expiresInDays }) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;
  const { data } = await supabase
    .from("shared_links")
    .insert({
      workbook_id: workbookId,
      dashboard_id: dashboardId,
      created_by: user?.id,
      expires_at: expiresAt,
    })
    .select()
    .single();
  return data;
};

export const getSharedLink = async (token) => {
  if (!supabase) return null;
  const { data } = await supabase
    .from("shared_links")
    .select("*, workbooks(data)")
    .eq("token", token)
    .single();
  if (!data) return null;
  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
};

// ── Comments ──────────────────────────────────────────────────────────────────

/**
 * Returns comments normalised to:
 *   { id, author_name, body, visual_id, created_at, resolved_at, replies: [...] }
 */
export const getComments = async (workbookId) => {
  if (!supabase) return [];
  const { data } = await supabase
    .from("comments")
    .select(`
      id, author_name, body, visual_id, created_at, resolved_at,
      comment_replies ( id, author_name, body, created_at )
    `)
    .eq("workbook_id", workbookId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((c) => ({
    ...c,
    replies: c.comment_replies ?? [],
  }));
};

/**
 * addComment(workbookId, { author_id, author_name, body, visual_id })
 */
export const addComment = async (workbookId, { author_id, author_name, body, visual_id = null }) => {
  if (!supabase) return null;
  const { data } = await supabase
    .from("comments")
    .insert({ workbook_id: workbookId, author_id, author_name, body, visual_id })
    .select("id, author_name, body, visual_id, created_at, resolved_at")
    .single();
  return data ? { ...data, replies: [] } : null;
};

/**
 * addReply(commentId, { author_id, author_name, body })
 */
export const addReply = async (commentId, { author_id, author_name, body }) => {
  if (!supabase) return null;
  const { data } = await supabase
    .from("comment_replies")
    .insert({ comment_id: commentId, author_id, author_name, body })
    .select("id, author_name, body, created_at")
    .single();
  return data;
};

/**
 * resolveComment(id) — toggles resolved state, returns updated comment
 */
export const resolveComment = async (commentId) => {
  if (!supabase) return null;
  // Fetch current state
  const { data: current } = await supabase
    .from("comments")
    .select("resolved_at")
    .eq("id", commentId)
    .single();
  const resolved_at = current?.resolved_at ? null : new Date().toISOString();
  const { data } = await supabase
    .from("comments")
    .update({ resolved_at })
    .eq("id", commentId)
    .select("id, resolved_at")
    .single();
  return data;
};

export const deleteComment = async (commentId) => {
  if (!supabase) return;
  await supabase.from("comments").delete().eq("id", commentId);
};

// ── Scheduled Reports ─────────────────────────────────────────────────────────

export const getScheduledReports = async (workbookId) => {
  if (!supabase) return [];
  const { data } = await supabase
    .from("scheduled_reports")
    .select("*")
    .eq("workbook_id", workbookId)
    .order("created_at", { ascending: false });
  return data ?? [];
};

/**
 * upsertScheduledReport(workbookId, reportData)
 */
export const upsertScheduledReport = async (workbookId, report) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const payload = { ...report, workbook_id: workbookId, created_by: user?.id };
  const { data } = await supabase
    .from("scheduled_reports")
    .upsert(payload)
    .select()
    .single();
  return data;
};

export const deleteScheduledReport = async (id) => {
  if (!supabase) return;
  await supabase.from("scheduled_reports").delete().eq("id", id);
};

// ── Realtime ──────────────────────────────────────────────────────────────────

export const subscribeWorkbook = (workbookId, onChange) => {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`workbook:${workbookId}`)
    .on("broadcast", { event: "mutation" }, (payload) => onChange(payload.payload))
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const broadcastMutation = (workbookId, mutation) => {
  if (!supabase) return;
  supabase.channel(`workbook:${workbookId}`).send({
    type: "broadcast",
    event: "mutation",
    payload: mutation,
  });
};

export const trackPresence = (workbookId, userInfo) => {
  if (!supabase) return { untrack: () => {}, onSync: () => {}, channel: null };
  const channel = supabase.channel(`presence:${workbookId}`, {
    config: { presence: { key: userInfo.id } },
  });
  channel.track(userInfo);
  return {
    channel,
    onSync: (cb) => {
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        cb(Object.values(state).flat());
      });
    },
    untrack: () => {
      channel.untrack();
      supabase.removeChannel(channel);
    },
  };
};

// ── Member role management ────────────────────────────────────────────────────

/**
 * Update a workspace member's role.
 * Only admins / owners should call this (enforced at RLS level too).
 */
export const updateMemberRole = async (workspaceId, userId, role) => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select()
    .single();
  return error ? null : data;
};

/**
 * Remove a member from a workspace entirely.
 * Only admins / owners should call this.
 */
export const removeMember = async (workspaceId, userId) => {
  if (!supabase) return false;
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  return !error;
};

export const subscribeComments = (workbookId, onInsert) => {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`comments:${workbookId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "comments", filter: `workbook_id=eq.${workbookId}` },
      onInsert
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};
