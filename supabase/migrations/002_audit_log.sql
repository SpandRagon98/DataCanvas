-- ── Audit Log ──────────────────────────────────────────────────────────────
-- Immutable append-only table. Rows are never updated or deleted by the app.
-- Captures every meaningful user action for compliance + debugging.

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  workbook_id UUID        REFERENCES workbooks(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT,
  action      TEXT        NOT NULL,
  target      TEXT,
  detail      TEXT
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_workbook ON audit_log (workbook_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_log (user_id,     ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log (action,      ts DESC);

-- Row Level Security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop policies first so this script is safely re-runnable
DROP POLICY IF EXISTS "audit_select_own_workbooks"      ON audit_log;
DROP POLICY IF EXISTS "audit_select_workspace_members"  ON audit_log;
DROP POLICY IF EXISTS "audit_insert_own"                ON audit_log;
DROP POLICY IF EXISTS "audit_no_update"                 ON audit_log;
DROP POLICY IF EXISTS "audit_no_delete"                 ON audit_log;

-- Users can read audit events for workbooks they own
CREATE POLICY "audit_select_own_workbooks" ON audit_log
  FOR SELECT
  USING (
    workbook_id IN (
      SELECT id FROM workbooks WHERE owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Workspace members can read audit events for shared workbooks
CREATE POLICY "audit_select_workspace_members" ON audit_log
  FOR SELECT
  USING (
    workbook_id IN (
      SELECT w.id
      FROM workbooks w
      JOIN workspace_members wm ON wm.workspace_id = w.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Any authenticated user can insert their own events
CREATE POLICY "audit_insert_own" ON audit_log
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Prevent all updates and deletes (immutable log)
CREATE POLICY "audit_no_update" ON audit_log
  FOR UPDATE USING (false);

CREATE POLICY "audit_no_delete" ON audit_log
  FOR DELETE USING (false);
