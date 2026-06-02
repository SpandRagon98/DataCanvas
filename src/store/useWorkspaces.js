/**
 * useWorkspaces — workspace + cloud-file + membership store.
 *
 * Persisted to localStorage (key: vizora.workspaces) so workspaces and saved
 * files survive refresh and login/logout. Works in both local-auth and
 * cloud-auth modes (everything is scoped by the current user's email).
 *
 * Model:
 *   workspace = { id, name, ownerEmail, members: [{ email, role }], createdAt }
 *   file      = { id, workspaceId, name, ownerEmail, data, createdAt, updatedAt }
 *
 * Roles: owner > editor > viewer
 *   owner  — full control (manage members, rename/delete workspace + files)
 *   editor — open + save/rename/delete files
 *   viewer — open/view files only (cannot save)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

const uid = (p) =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `${p}_${crypto.randomUUID()}`
    : `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const norm = (e) => String(e || "").trim().toLowerCase();
export const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());

const ROLE_RANK = { owner: 3, editor: 2, viewer: 1 };

export const useWorkspaces = create(
  persist(
    (set, get) => ({
      workspaces: [],
      files: [],

      // ── Selectors ──
      /** Workspaces the user owns or is a member of. */
      listForUser: (email) => {
        const e = norm(email);
        return get().workspaces.filter(
          (w) => norm(w.ownerEmail) === e || (w.members || []).some((m) => norm(m.email) === e)
        );
      },

      filesForWorkspace: (workspaceId) =>
        get().files
          .filter((f) => f.workspaceId === workspaceId)
          .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),

      /** Role of a user in a workspace, or null if no access. */
      roleOf: (workspaceId, email) => {
        const e = norm(email);
        const ws = get().workspaces.find((w) => w.id === workspaceId);
        if (!ws) return null;
        if (norm(ws.ownerEmail) === e) return "owner";
        const m = (ws.members || []).find((mm) => norm(mm.email) === e);
        return m ? m.role : null;
      },

      canEdit: (workspaceId, email) => {
        const r = get().roleOf(workspaceId, email);
        return r === "owner" || r === "editor";
      },
      canManage: (workspaceId, email) => get().roleOf(workspaceId, email) === "owner",

      // ── Workspace actions ──
      createWorkspace: (name, ownerEmail) => {
        const trimmed = String(name || "").trim();
        const owner = norm(ownerEmail);
        if (!trimmed) return { ok: false, error: "Workspace name is required." };
        if (!owner)   return { ok: false, error: "You must be signed in." };
        const dup = get().workspaces.some(
          (w) => norm(w.ownerEmail) === owner && w.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (dup) return { ok: false, error: "You already have a workspace with this name." };

        const ws = {
          id: uid("ws"),
          name: trimmed,
          ownerEmail: owner,
          members: [{ email: owner, role: "owner" }],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ workspaces: [...s.workspaces, ws] }));
        return { ok: true, workspace: ws };
      },

      renameWorkspace: (id, name, byEmail) => {
        if (get().roleOf(id, byEmail) !== "owner") return { ok: false, error: "Only the owner can rename." };
        const trimmed = String(name || "").trim();
        if (!trimmed) return { ok: false, error: "Name is required." };
        set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name: trimmed } : w)) }));
        return { ok: true };
      },

      deleteWorkspace: (id, byEmail) => {
        if (get().roleOf(id, byEmail) !== "owner") return { ok: false, error: "Only the owner can delete." };
        set((s) => ({
          workspaces: s.workspaces.filter((w) => w.id !== id),
          files: s.files.filter((f) => f.workspaceId !== id),
        }));
        return { ok: true };
      },

      // ── Membership actions (owner only) ──
      addMember: (workspaceId, email, role, byEmail) => {
        if (get().roleOf(workspaceId, byEmail) !== "owner") return { ok: false, error: "Only the owner can add members." };
        const e = norm(email);
        if (!isValidEmail(e)) return { ok: false, error: "Enter a valid email address." };
        const ws = get().workspaces.find((w) => w.id === workspaceId);
        if (!ws) return { ok: false, error: "Workspace not found." };
        if (norm(ws.ownerEmail) === e) return { ok: false, error: "That user is the owner." };
        if ((ws.members || []).some((m) => norm(m.email) === e))
          return { ok: false, error: "That user already has access." };
        const r = ROLE_RANK[role] ? role : "viewer";
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, members: [...(w.members || []), { email: e, role: r }] } : w
          ),
        }));
        return { ok: true };
      },

      updateMemberRole: (workspaceId, email, role, byEmail) => {
        if (get().roleOf(workspaceId, byEmail) !== "owner") return { ok: false, error: "Only the owner can change roles." };
        const e = norm(email);
        const r = ROLE_RANK[role] ? role : "viewer";
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id !== workspaceId ? w : {
              ...w,
              members: (w.members || []).map((m) =>
                norm(m.email) === e && m.role !== "owner" ? { ...m, role: r } : m
              ),
            }
          ),
        }));
        return { ok: true };
      },

      removeMember: (workspaceId, email, byEmail) => {
        if (get().roleOf(workspaceId, byEmail) !== "owner") return { ok: false, error: "Only the owner can remove members." };
        const e = norm(email);
        const ws = get().workspaces.find((w) => w.id === workspaceId);
        if (ws && norm(ws.ownerEmail) === e) return { ok: false, error: "Cannot remove the owner." };
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id !== workspaceId ? w : { ...w, members: (w.members || []).filter((m) => norm(m.email) !== e) }
          ),
        }));
        return { ok: true };
      },

      // ── File actions ──
      /** Create a new file (snapshot) in a workspace. Requires edit access. */
      saveFile: ({ workspaceId, name, data, byEmail }) => {
        if (!get().canEdit(workspaceId, byEmail)) return { ok: false, error: "You don't have permission to save here." };
        const trimmed = String(name || "").trim() || "Untitled File";
        const file = {
          id: uid("file"),
          workspaceId,
          name: trimmed,
          ownerEmail: norm(byEmail),
          data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ files: [...s.files, file] }));
        return { ok: true, file };
      },

      /** Update an existing file's data (and optionally name). Requires edit access. */
      updateFile: (fileId, { data, name }, byEmail) => {
        const f = get().files.find((x) => x.id === fileId);
        if (!f) return { ok: false, error: "File not found." };
        if (!get().canEdit(f.workspaceId, byEmail)) return { ok: false, error: "You don't have permission to save changes." };
        set((s) => ({
          files: s.files.map((x) =>
            x.id === fileId
              ? { ...x, ...(data !== undefined ? { data } : {}), ...(name ? { name: name.trim() } : {}), updatedAt: new Date().toISOString() }
              : x
          ),
        }));
        return { ok: true };
      },

      renameFile: (fileId, name, byEmail) => {
        const f = get().files.find((x) => x.id === fileId);
        if (!f) return { ok: false, error: "File not found." };
        if (!get().canEdit(f.workspaceId, byEmail)) return { ok: false, error: "You don't have permission to rename." };
        const trimmed = String(name || "").trim();
        if (!trimmed) return { ok: false, error: "Name is required." };
        set((s) => ({ files: s.files.map((x) => (x.id === fileId ? { ...x, name: trimmed, updatedAt: new Date().toISOString() } : x)) }));
        return { ok: true };
      },

      deleteFile: (fileId, byEmail) => {
        const f = get().files.find((x) => x.id === fileId);
        if (!f) return { ok: false, error: "File not found." };
        if (!get().canEdit(f.workspaceId, byEmail)) return { ok: false, error: "You don't have permission to delete." };
        set((s) => ({ files: s.files.filter((x) => x.id !== fileId) }));
        return { ok: true };
      },

      getFile: (fileId) => get().files.find((x) => x.id === fileId) || null,
    }),
    {
      name: "vizora.workspaces",
      version: 1,
    }
  )
);
