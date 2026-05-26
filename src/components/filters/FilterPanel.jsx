import { useState } from "react";
import { Bookmark, Plus, Trash2, ChevronDown, ChevronUp, Calendar, X, Filter } from "lucide-react";
import { useEffectiveData } from "../../hooks/useEffectiveData";
import { useStore } from "../../store/useStore";
import { getUniqueValues, RELATIVE_DATE_LABELS, isRelativeDateFilter } from "../../utils/filterEngine";
import { useTheme } from "../../styles/theme";

// ── Multi-select checkbox filter ───────────────────────────────────────────
function StringFilter({ field, values, filterValue, onSet, T }) {
  const [open, setOpen] = useState(false);
  const [valSearch, setValSearch] = useState("");

  const selected = Array.isArray(filterValue)
    ? filterValue.map(String)
    : filterValue && filterValue !== ""
    ? [String(filterValue)]
    : [];

  const toggle = (v) => {
    const sv   = String(v);
    const next = selected.includes(sv) ? selected.filter((x) => x !== sv) : [...selected, sv];
    onSet(next.length === 0 ? "" : next);
  };

  const displayed = values.filter((v) =>
    String(v).toLowerCase().includes(valSearch.toLowerCase())
  );

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs"
        style={{
          background: T.s2,
          borderColor: selected.length ? T.accent : T.border,
          color: T.text,
          transition: "border-color 150ms ease",
        }}
      >
        <span style={{ color: selected.length ? T.accent : T.dim }}>
          {selected.length === 0 ? "All values" : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        {open ? <ChevronUp size={11} style={{ color: T.muted }} /> : <ChevronDown size={11} style={{ color: T.muted }} />}
      </button>

      {open && (
        <div
          className="mt-1 rounded-xl border p-2 anim-slide-down"
          style={{ background: T.s2, borderColor: T.border }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <input
              value={valSearch}
              onChange={(e) => setValSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 rounded-lg border px-2 py-1 text-[11px] outline-none"
              style={{ background: T.surface, borderColor: T.border, color: T.text }}
            />
            <button
              onClick={() => onSet(values.map(String))}
              className="rounded-lg border px-2 py-1 text-[11px]"
              style={{ background: T.surface, borderColor: T.border, color: T.dim }}
            >All</button>
            <button
              onClick={() => onSet("")}
              className="rounded-lg border px-2 py-1 text-[11px]"
              style={{ background: T.surface, borderColor: T.border, color: T.dim }}
            >None</button>
          </div>
          <div className="max-h-32 space-y-0.5 overflow-y-auto">
            {displayed.map((v) => {
              const sv      = String(v);
              const checked = selected.includes(sv);
              return (
                <label
                  key={sv}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[12px] transition-colors"
                  style={{ color: T.text, background: checked ? T.accentDim : "transparent" }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(v)} className="accent-amber-500" />
                  <span className="truncate">{sv || "(blank)"}</span>
                </label>
              );
            })}
            {!displayed.length && (
              <p className="py-1 text-center text-[11px]" style={{ color: T.muted }}>No values match</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Date filter ────────────────────────────────────────────────────────────
function DateFilter({ filterValue, onSet, T }) {
  const isRange    = typeof filterValue === "object" && filterValue !== null;
  const isRelative = typeof filterValue === "string" && isRelativeDateFilter(filterValue);
  const [tab, setTab] = useState(isRange ? "range" : "relative");
  const rangeVal   = isRange ? filterValue : { from: "", to: "" };

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };

  return (
    <div className="space-y-2">
      <div
        className="inline-flex rounded-xl border p-0.5"
        style={{ background: T.s2, borderColor: T.border }}
      >
        {["relative", "range"].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); onSet(""); }}
            className="rounded-[9px] px-3 py-1 text-[11px] font-medium capitalize"
            style={{
              background: tab === t ? T.surface : "transparent",
              color:      tab === t ? T.accent  : T.dim,
              boxShadow:  tab === t ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              transition: "all 150ms ease",
            }}
          >
            {t === "relative" ? "Relative" : "Range"}
          </button>
        ))}
      </div>

      {tab === "relative" && (
        <select
          value={isRelative ? filterValue : ""}
          onChange={(e) => onSet(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
          style={inputStyle}
        >
          <option value="">All dates</option>
          {RELATIVE_DATE_LABELS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      )}

      {tab === "range" && (
        <div className="space-y-1.5">
          {[["from", "From"], ["to", "To"]].map(([key, ph]) => (
            <div key={key} className="flex items-center gap-2">
              <Calendar size={11} style={{ color: T.muted, flexShrink: 0 }} />
              <input
                type="date"
                value={rangeVal[key] || ""}
                onChange={(e) => onSet({ ...rangeVal, [key]: e.target.value })}
                className="flex-1 rounded-xl border px-2 py-1.5 text-xs outline-none"
                style={inputStyle}
                placeholder={ph}
              />
            </div>
          ))}
          {(rangeVal.from || rangeVal.to) && (
            <button
              onClick={() => onSet("")}
              className="flex items-center gap-1 text-[11px]"
              style={{ color: T.muted }}
            >
              <X size={10} /> Clear range
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Active badge ───────────────────────────────────────────────────────────
function ActiveBadge({ filterValue, T }) {
  if (!filterValue || filterValue === "") return null;
  if (Array.isArray(filterValue) && !filterValue.length) return null;

  let label = "";
  if (Array.isArray(filterValue)) label = `${filterValue.length}`;
  else if (typeof filterValue === "object") {
    const parts = [];
    if (filterValue.from) parts.push(`≥${filterValue.from}`);
    if (filterValue.to)   parts.push(`≤${filterValue.to}`);
    label = parts.join(" ") || "•";
  } else {
    label = "•";
  }

  return (
    <span
      className="ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
      style={{ background: T.accentDim, color: T.accent }}
    >
      {label}
    </span>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────
export default function FilterPanel() {
  const T = useTheme();
  const { rows, columns, dataTypes } = useEffectiveData();
  const filters              = useStore((s) => s.filters);
  const setGlobalFilter      = useStore((s) => s.setGlobalFilter);
  const clearGlobalFilters   = useStore((s) => s.clearGlobalFilters);
  const filterBookmarks      = useStore((s) => s.filterBookmarks);
  const saveFilterBookmark   = useStore((s) => s.saveFilterBookmark);
  const applyFilterBookmark  = useStore((s) => s.applyFilterBookmark);
  const deleteFilterBookmark = useStore((s) => s.deleteFilterBookmark);

  const [bookmarkName, setBookmarkName] = useState("");

  const filterableFields = columns.filter((c) => dataTypes[c] !== "number");
  const activeCount = Object.values(filters).filter(
    (v) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold leading-none" style={{ color: T.text }}>
            <Filter size={11} style={{ color: T.accent }} />
            Filters
            {activeCount > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: T.accent, color: "#000" }}
              >
                {activeCount}
              </span>
            )}
          </h2>
          <p className="mt-1 text-[11px]" style={{ color: T.muted }}>Global report filters</p>
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearGlobalFilters}
            className="rounded-xl border px-2.5 py-1.5 text-[11px]"
            style={{ borderColor: T.border, background: T.s2, color: T.dim }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-3">
        {filterableFields.map((field) => {
          const values      = getUniqueValues(rows, field);
          const isDate      = dataTypes[field] === "date";
          const filterValue = filters[field] ?? "";

          return (
            <div key={field}>
              <label className="mb-1 flex items-center text-[11.5px] font-medium" style={{ color: T.dim }}>
                {field}
                <ActiveBadge filterValue={filterValue} T={T} />
              </label>

              {isDate ? (
                <DateFilter filterValue={filterValue} onSet={(v) => setGlobalFilter(field, v)} T={T} />
              ) : (
                <StringFilter
                  field={field} values={values} filterValue={filterValue}
                  onSet={(v) => setGlobalFilter(field, v)} T={T}
                />
              )}
            </div>
          );
        })}

        {/* Saved Filters */}
        <div className="border-t pt-3" style={{ borderColor: T.border }}>
          <div className="mb-2 flex items-center gap-1.5">
            <Bookmark size={11} style={{ color: T.accent }} />
            <span className="text-[11px] font-semibold" style={{ color: T.dim }}>Saved Filters</span>
          </div>

          <div className="mb-2.5 flex gap-1.5">
            <input
              value={bookmarkName}
              onChange={(e) => setBookmarkName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && bookmarkName.trim()) {
                  saveFilterBookmark(bookmarkName.trim());
                  setBookmarkName("");
                }
              }}
              placeholder="Bookmark name…"
              className="flex-1 rounded-xl border px-2.5 py-1.5 text-[11.5px] outline-none"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}
            />
            <button
              onClick={() => {
                if (bookmarkName.trim()) { saveFilterBookmark(bookmarkName.trim()); setBookmarkName(""); }
              }}
              className="rounded-xl border px-2.5 py-1.5"
              style={{ background: T.accentDim, borderColor: "rgba(245,158,11,0.2)", color: T.accent }}
            >
              <Plus size={12} />
            </button>
          </div>

          {filterBookmarks.length === 0 ? (
            <p className="text-[11px]" style={{ color: T.muted }}>No saved filters yet</p>
          ) : (
            <div className="space-y-1.5">
              {filterBookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
                  style={{ background: T.s2, borderColor: T.border }}
                >
                  <button
                    onClick={() => applyFilterBookmark(bm.id)}
                    className="flex-1 truncate text-left text-[11.5px]"
                    style={{ color: T.text }}
                  >
                    {bm.name}
                  </button>
                  <button onClick={() => deleteFilterBookmark(bm.id)} style={{ color: T.muted }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
