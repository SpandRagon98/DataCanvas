/**
 * Audit Log — immutable append-only event stream.
 *
 * Events are stored in an in-memory ring buffer (max 2000 entries).
 * When Supabase is configured they are also persisted to the audit_log table.
 *
 * Components subscribe via subscribe() and receive live updates.
 */

import { supabase, CLOUD_ENABLED } from "./supabase";

// ── Action constants (use these for type safety) ──────────────────────────

export const A = {
  CELL_EDIT:          "cell_edit",
  ROW_ADD:            "row_add",
  ROW_DELETE:         "row_delete",
  VISUAL_ADDED:       "visual_added",
  VISUAL_REMOVED:     "visual_removed",
  VISUAL_CONFIG:      "visual_config",
  FILTER_CHANGED:     "filter_changed",
  FILTER_CLEARED:     "filter_cleared",
  FILTER_BOOKMARKED:  "filter_bookmarked",
  CALC_FIELD_ADDED:   "calc_field_added",
  CALC_FIELD_REMOVED: "calc_field_removed",
  DASHBOARD_CREATED:  "dashboard_created",
  DASHBOARD_REMOVED:  "dashboard_removed",
  DASH_ITEM_ADDED:    "dash_item_added",
  DASH_ITEM_REMOVED:  "dash_item_removed",
  DATA_IMPORTED:      "data_imported",
  WORKBOOK_SAVED:     "workbook_saved",
  WORKBOOK_LOADED:    "workbook_loaded",
  SCENARIO_APPLIED:   "scenario_applied",
  SCENARIO_ADDED:     "scenario_added",
  SCENARIO_REMOVED:   "scenario_removed",
  SHARE_CREATED:      "share_created",
  COMMENT_ADDED:      "comment_added",
  COMMENT_RESOLVED:   "comment_resolved",
};

// ── In-memory ring buffer ─────────────────────────────────────────────────

const MAX_ENTRIES = 2000;
const _entries    = []; // newest-first
let   _listeners  = [];

export function subscribe(callback) {
  _listeners.push(callback);
  callback([..._entries]); // emit current state immediately
  return () => {
    _listeners = _listeners.filter((l) => l !== callback);
  };
}

function _notify() {
  const snapshot = [..._entries];
  for (const l of _listeners) l(snapshot);
}

// ── Public API ─────────────────────────────────────────────────────────────

let _seq = 0;

/**
 * Append an audit event.
 *
 * @param {object} event
 * @param {string} event.action       - One of A.* constants
 * @param {string} [event.target]     - e.g. visual name, field name
 * @param {string} [event.detail]     - Human-readable change description
 * @param {string} [event.user_id]    - Auth user ID (if signed in)
 * @param {string} [event.user_name]  - Display name
 * @param {string} [event.workbook_id] - Cloud workbook ID (for Supabase sync)
 */
export async function log(event) {
  const entry = {
    id:          `${Date.now()}_${++_seq}`,
    ts:          new Date().toISOString(),
    action:      event.action,
    target:      event.target   || null,
    detail:      event.detail   || null,
    user_id:     event.user_id  || null,
    user_name:   event.user_name || null,
    workbook_id: event.workbook_id || null,
  };

  // Prepend (newest-first)
  _entries.unshift(entry);
  if (_entries.length > MAX_ENTRIES) _entries.length = MAX_ENTRIES;
  _notify();

  // Supabase — best-effort, non-blocking
  if (CLOUD_ENABLED && supabase && entry.workbook_id) {
    supabase
      .from("audit_log")
      .insert({
        id:          entry.id,
        ts:          entry.ts,
        workbook_id: entry.workbook_id,
        user_id:     entry.user_id,
        user_name:   entry.user_name,
        action:      entry.action,
        target:      entry.target,
        detail:      entry.detail,
      })
      .then(() => {})
      .catch(() => {});
  }

  return entry;
}

export function getEntries()  { return [..._entries]; }
export function clearEntries() { _entries.length = 0; _notify(); }
