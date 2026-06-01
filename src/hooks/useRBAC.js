/**
 * useRBAC — Role-Based Access Control
 *
 * Role hierarchy (highest → lowest):
 *   owner (5) › admin (4) › developer (3) › contributor (2) › viewer (1)
 *
 * OWNER_EMAIL always gets owner-level permissions, regardless of the
 * workspace_members row.  This is the application owner's address and
 * is hardcoded by design.
 */
import { useMemo } from "react";

export const OWNER_EMAIL = "spandan305@gmail.com";

export const ROLES = {
  owner: {
    level: 5,
    label: "Owner",
    color: "var(--dc-accent)",
    desc: "Full control over all workspaces. Cannot be removed.",
  },
  admin: {
    level: 4,
    label: "Admin",
    color: "#60a5fa",
    desc: "Manage workspace settings, members, and all content.",
  },
  developer: {
    level: 3,
    label: "Developer",
    color: "#a78bfa",
    desc: "Create visuals, reports, and upload or edit datasets.",
  },
  contributor: {
    level: 2,
    label: "Contributor",
    color: "#34d399",
    desc: "Edit existing dashboards, add comments, apply filters.",
  },
  viewer: {
    level: 1,
    label: "Viewer",
    color: "#94a3b8",
    desc: "Read-only access. Can interact with charts and export.",
  },
};

export const ROLE_ICONS_MAP = {
  owner:       "Crown",
  admin:       "ShieldCheck",
  developer:   "Code2",
  contributor: "PenLine",
  viewer:      "Eye",
};

/**
 * Returns permission flags for `userEmail` given `members` from a workspace.
 * members items: { user_id, role, profiles: { email } }
 */
export function useRBAC(members = [], userEmail = "") {
  return useMemo(() => {
    const email       = userEmail?.toLowerCase() ?? "";
    const isOwnerMail = email === OWNER_EMAIL.toLowerCase();
    const member      = members.find(
      (m) => m.profiles?.email?.toLowerCase() === email,
    );
    const rawRole  = isOwnerMail ? "owner" : (member?.role ?? "viewer");
    const roleInfo = ROLES[rawRole] ?? ROLES.viewer;
    const level    = roleInfo.level;

    return {
      role:    rawRole,
      roleInfo,
      // Granular permission gates
      canView:             level >= 1,
      canComment:          level >= 2,
      canEditDashboard:    level >= 2,
      canCreateVisuals:    level >= 3,
      canUploadData:       level >= 3,
      canEditDataset:      level >= 3,
      canManageWorkspace:  level >= 4,
      canInviteMembers:    level >= 4,
      canChangeRoles:      level >= 4,
      canRemoveMembers:    level >= 4,
      isOwner:             level >= 5,
    };
  }, [members, userEmail]);
}
