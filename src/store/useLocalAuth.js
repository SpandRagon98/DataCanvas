/**
 * useLocalAuth — client-side auth store for offline/local mode.
 *
 * When CLOUD_ENABLED is false, this provides:
 *   - User registration / login with email + password (localStorage)
 *   - Session persistence across reloads
 *   - Workspace members with role management
 *   - Owner email always gets full access
 *
 * Passwords are stored as simple SHA-256 hex digests. This is NOT
 * production-grade security — it's appropriate for a local-first
 * BI tool running on a single machine / GitHub Pages.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OWNER_EMAIL } from "../hooks/useRBAC";

// Simple SHA-256 hash (Web Crypto API, available in all modern browsers)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const useLocalAuth = create(
  persist(
    (set, get) => ({
      // All registered local users: [{ email, name, passwordHash, createdAt }]
      localUsers: [],

      // Currently logged-in user: { email, name } | null
      currentUser: null,

      // Workspace members with roles: [{ email, role }]
      // Owner email is always implicitly owner even if not in this list
      workspaceMembers: [],

      // ── Actions ──

      /**
       * Register a new user. Returns { ok, error }.
       */
      register: async (email, name, password) => {
        const trimEmail = email?.trim().toLowerCase();
        const trimName = name?.trim();
        if (!trimEmail || !password) return { ok: false, error: "Email and password are required." };
        if (password.length < 4) return { ok: false, error: "Password must be at least 4 characters." };

        const existing = get().localUsers.find(
          (u) => u.email.toLowerCase() === trimEmail
        );
        if (existing) return { ok: false, error: "An account with this email already exists." };

        const passwordHash = await hashPassword(password);
        const user = {
          email: trimEmail,
          name: trimName || trimEmail.split("@")[0],
          passwordHash,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          const localUsers = [...state.localUsers, user];
          // If this is the owner email, auto-add to workspace as owner
          const isOwner = trimEmail === OWNER_EMAIL.toLowerCase();
          let workspaceMembers = state.workspaceMembers;
          if (isOwner && !workspaceMembers.find((m) => m.email === trimEmail)) {
            workspaceMembers = [...workspaceMembers, { email: trimEmail, role: "owner" }];
          }
          return { localUsers, currentUser: { email: trimEmail, name: user.name }, workspaceMembers };
        });

        return { ok: true, error: null };
      },

      /**
       * Log in an existing user. Returns { ok, error }.
       */
      login: async (email, password) => {
        const trimEmail = email?.trim().toLowerCase();
        if (!trimEmail || !password) return { ok: false, error: "Email and password are required." };

        const user = get().localUsers.find(
          (u) => u.email.toLowerCase() === trimEmail
        );
        if (!user) return { ok: false, error: "No account found with this email. Please sign up first." };

        const passwordHash = await hashPassword(password);
        if (user.passwordHash !== passwordHash) {
          return { ok: false, error: "Incorrect password." };
        }

        // Check if user is authorized (owner or workspace member)
        const isOwner = trimEmail === OWNER_EMAIL.toLowerCase();
        const isMember = get().workspaceMembers.some(
          (m) => m.email.toLowerCase() === trimEmail
        );
        if (!isOwner && !isMember) {
          return { ok: false, error: "You are not authorized to access this workspace. Contact the owner." };
        }

        set({ currentUser: { email: trimEmail, name: user.name } });
        return { ok: true, error: null };
      },

      /**
       * Log out
       */
      logout: () => set({ currentUser: null }),

      /**
       * Add a member to the workspace (owner/admin only)
       */
      addWorkspaceMember: (email, role = "viewer") => {
        const trimEmail = email?.trim().toLowerCase();
        if (!trimEmail) return { ok: false, error: "Email is required." };

        const exists = get().workspaceMembers.some(
          (m) => m.email.toLowerCase() === trimEmail
        );
        if (exists) return { ok: false, error: "This user is already a workspace member." };

        set((state) => ({
          workspaceMembers: [...state.workspaceMembers, { email: trimEmail, role }],
        }));
        return { ok: true, error: null };
      },

      /**
       * Update a member's role
       */
      updateWorkspaceMemberRole: (email, newRole) => {
        const trimEmail = email?.trim().toLowerCase();
        if (trimEmail === OWNER_EMAIL.toLowerCase()) return; // Can't change owner
        set((state) => ({
          workspaceMembers: state.workspaceMembers.map((m) =>
            m.email.toLowerCase() === trimEmail ? { ...m, role: newRole } : m
          ),
        }));
      },

      /**
       * Remove a member from the workspace
       */
      removeWorkspaceMember: (email) => {
        const trimEmail = email?.trim().toLowerCase();
        if (trimEmail === OWNER_EMAIL.toLowerCase()) return; // Can't remove owner
        set((state) => ({
          workspaceMembers: state.workspaceMembers.filter(
            (m) => m.email.toLowerCase() !== trimEmail
          ),
        }));
      },

      /**
       * Get the role of the current user
       */
      getCurrentRole: () => {
        const { currentUser, workspaceMembers } = get();
        if (!currentUser) return "viewer";
        const email = currentUser.email.toLowerCase();
        if (email === OWNER_EMAIL.toLowerCase()) return "owner";
        const member = workspaceMembers.find((m) => m.email.toLowerCase() === email);
        return member?.role ?? "viewer";
      },
    }),
    {
      name: "datacanvas.local-auth",
      version: 1,
    }
  )
);
