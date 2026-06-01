-- Migration 003: Expand workspace_members role constraint to 5-tier RBAC
-- Roles: owner | admin | developer | contributor | viewer
--
-- Previously the check was ('viewer', 'editor', 'admin').
-- We rename 'editor' → 'contributor' and add 'owner' and 'developer'.

-- 1. Rename any existing 'editor' rows to 'contributor' before changing the constraint
UPDATE workspace_members
SET role = 'contributor'
WHERE role = 'editor';

-- 2. Drop the old check constraint (Postgres names it automatically; try both common names)
ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_fkey;

-- 3. Add the new expanded check constraint
ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'developer', 'contributor', 'viewer'));

-- 4. Ensure the id column exists (some installs may have omitted it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_members' AND column_name = 'id'
  ) THEN
    ALTER TABLE workspace_members ADD COLUMN id uuid DEFAULT gen_random_uuid() UNIQUE;
  END IF;
END $$;

-- 5. Verify (informational — will appear in migration logs)
-- SELECT DISTINCT role FROM workspace_members;
