import { useEffect, useState } from "react";
import { ClipboardList, X, Trash2, Search, Filter } from "lucide-react";
import { getEntries, clearEntries, subscribe, A } from "../../lib/auditLog";
import { useTheme } from "../../styles/theme";

// ── Display metadata ────────────────────────────────────────────────────────

const ACTION_META = {
  [A.CELL_EDIT]:          { label: "Cell Edit",         color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  [A.ROW_ADD]:            { label: "Row Added",          color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  [A.ROW_DELETE]:         { label: "Row Deleted",        color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  [A.VISUAL_ADDED]:       { label: "Visual Added",       color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  [A.VISUAL_REMOVED]:     { label: "Visual Removed",     color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  [A.VISUAL_CONFIG]:      { label: "Visual Config",      color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  [A.FILTER_CHANGED]:     { label: "Filter Changed",     color: "var(--dc-accent)", bg: "rgba(var(--dc-accent-rgb),0.1)"  },
  [A.FILTER_CLEARED]:     { label: "Filters Cleared",    color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  [A.FILTER_BOOKMARKED]:  { label: "Filter Saved",       color: "var(--dc-accent)", bg: "rgba(var(--dc-accent-rgb),0.1)"  },
  [A.CALC_FIELD_ADDED]:   { label: "Calc Field Added",   color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  [A.CALC_FIELD_REMOVED]: { label: "Calc Field Removed", color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  [A.DASHBOARD_CREATED]:  { label: "Dashboard Created",  color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  [A.DASHBOARD_REMOVED]:  { label: "Dashboard Removed",  color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  [A.DASH_ITEM_ADDED]:    { label: "Visual Pinned",      color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  [A.DASH_ITEM_REMOVED]:  { label: "Visual Unpinned",    color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  [A.DATA_IMPORTED]:      { label: "Data Imported",      color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  [A.WORKBOOK_SAVED]:     { label: "Workbook Saved",     color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  [A.WORKBOOK_LOADED]:    { label: "Workbook Loaded",    color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  [A.SCENARIO_APPLIED]:   { label: "Scenario Applied",   color: "var(--dc-accent)", bg: "rgba(var(--dc-accent-rgb),0.1)"  },
  [A.SCENARIO_ADDED]:     { label: "Scenario Added",     color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  [A.SCENARIO_REMOVED]:   { label: "Scenario Removed",   color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  [A.SHARE_CREATED]:      { label: "Share Link Created", color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  [A.COMMENT_ADDED]:      { label: "Comment Added",      color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  [A.COMMENT_RESOLVED]:   { label: "Comment Resolved",   color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};

function getMeta(action) {
  return ACTION_META[action] ?? { label: action, color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
}

function timeStr(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── ActionBadge ──────────────────────────────────────────────────────────────

function ActionBadge({ action }) {
  const m = getMeta(action);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold whitespace-nowrap"
      style={{ background: m.bg, color: m.color }}
    >
      {m.label}
    </span>
  );
}

// ── AuditLog Modal ────────────────────────────────────────────────────────────

export default function AuditLog({ open, onClose }) {
  const T = useTheme();
  const [entries, setEntries] = useState(() => getEntries());
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all");

  useEffect(() => {
    const unsub = subscribe((log) => setEntries(log));
    return unsub;
  }, []);

  if (!open) return null;

  // Build unique action types for the filter dropdown
  const actionTypes = [...new Set(entries.map((e) => e.action))].sort();

  const visible = entries.filter((e) => {
    if (filter !== "all" && e.action !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = [e.action, e.target, e.detail, e.user_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    }
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-scale-in flex w-full max-w-3xl flex-col rounded-xl border"
        style={{
          background: T.surface,
          borderColor: T.border,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          maxHeight: "84vh",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 pt-4 pb-3"
          style={{ borderColor: T.border }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: T.accentDim }}
            >
              <ClipboardList size={14} color={T.accent} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: T.text }}>
                Audit Log
              </div>
              <div className="text-[11px]" style={{ color: T.dim }}>
                {entries.length.toLocaleString()} event{entries.length !== 1 ? "s" : ""} this session
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { clearEntries(); setEntries([]); }}
              className="rounded-lg border px-2.5 py-1.5 text-xs"
              style={{ background: T.s2, borderColor: T.border, color: T.muted }}
              title="Clear log"
            >
              <Trash2 size={11} />
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border p-1.5"
              style={{ background: T.s2, borderColor: T.border, color: T.muted }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div
          className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5"
          style={{ borderColor: T.border }}
        >
          <div className="relative flex-1">
            <Search
              size={11}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: T.muted }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border px-2.5 py-1.5 text-xs outline-none"
            style={{ background: T.s2, borderColor: T.border, color: T.text }}
          >
            <option value="all">All actions</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>
                {getMeta(a).label}
              </option>
            ))}
          </select>
          <span className="shrink-0 text-xs" style={{ color: T.muted }}>
            {visible.length.toLocaleString()} shown
          </span>
        </div>

        {/* Log table */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14">
              <ClipboardList size={30} style={{ color: T.border }} />
              <div className="text-sm font-medium" style={{ color: T.muted }}>
                No events yet
              </div>
              <div className="text-xs text-center" style={{ color: T.muted }}>
                Actions are automatically recorded as you use Vizora
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead
                className="sticky top-0"
                style={{ background: T.s2 }}
              >
                <tr>
                  {["Time", "Action", "Target", "Detail", "User"].map((h) => (
                    <th
                      key={h}
                      className="border-b px-4 py-2 text-left font-semibold"
                      style={{ borderColor: T.border, color: T.dim }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((e, i) => (
                  <tr
                    key={e.id}
                    style={{ background: i % 2 === 0 ? "transparent" : T.s2 }}
                  >
                    <td
                      className="whitespace-nowrap px-4 py-2"
                      style={{ color: T.muted }}
                    >
                      {timeStr(e.ts)}
                    </td>
                    <td className="px-4 py-2">
                      <ActionBadge action={e.action} />
                    </td>
                    <td
                      className="max-w-[160px] truncate px-4 py-2"
                      style={{ color: T.dim }}
                      title={e.target || ""}
                    >
                      {e.target || "—"}
                    </td>
                    <td
                      className="max-w-[240px] truncate px-4 py-2"
                      style={{ color: T.dim }}
                      title={e.detail || ""}
                    >
                      {e.detail || "—"}
                    </td>
                    <td className="px-4 py-2" style={{ color: T.muted }}>
                      {e.user_name || "local"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t px-4 py-2.5"
          style={{ borderColor: T.border }}
        >
          <p className="text-center text-[10.5px]" style={{ color: T.muted }}>
            In-memory log (max 2,000 events). Cloud persistence enabled when Supabase is configured.
          </p>
        </div>
      </div>
    </div>
  );
}
