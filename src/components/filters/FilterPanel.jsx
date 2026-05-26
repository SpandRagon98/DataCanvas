import { useState } from "react";
import { Bookmark, Plus, Trash2, ChevronDown, ChevronUp, Calendar, X } from "lucide-react";
import { useEffectiveData } from "../../hooks/useEffectiveData";
import { useStore } from "../../store/useStore";
import { getUniqueValues, RELATIVE_DATE_LABELS, isRelativeDateFilter } from "../../utils/filterEngine";
import { useTheme } from "../../styles/theme";

// ── Multi-select checkbox filter for string/boolean columns ──
function StringFilter({ field, values, filterValue, onSet, T }) {
  const [open, setOpen] = useState(false);
  const [valSearch, setValSearch] = useState("");

  // Normalise to array
  const selected = Array.isArray(filterValue)
    ? filterValue.map(String)
    : filterValue && filterValue !== ""
    ? [String(filterValue)]
    : [];

  const toggle = (v) => {
    const sv = String(v);
    const next = selected.includes(sv)
      ? selected.filter((x) => x !== sv)
      : [...selected, sv];
    onSet(next.length === 0 ? "" : next);
  };

  const selectAll = () => onSet(values.map(String));
  const clearAll  = () => onSet("");

  const displayed = values.filter((v) =>
    String(v).toLowerCase().includes(valSearch.toLowerCase())
  );

  return (
    <div>
      {/* Summary chip / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm"
        style={{ background: T.s2, borderColor: selected.length ? T.accent : T.border, color: T.text }}
      >
        <span className="truncate" style={{ color: selected.length ? T.accent : T.dim }}>
          {selected.length === 0
            ? "All"
            : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`}
        </span>
        {open ? <ChevronUp size={13} style={{ color: T.dim }} /> : <ChevronDown size={13} style={{ color: T.dim }} />}
      </button>

      {open && (
        <div
          className="mt-1 rounded-xl border p-2"
          style={{ background: T.s2, borderColor: T.border }}
        >
          {/* Actions */}
          <div className="mb-2 flex items-center gap-2">
            <input
              value={valSearch}
              onChange={(e) => setValSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 rounded-lg border px-2 py-1 text-xs outline-none"
              style={{ background: T.surface, borderColor: T.border, color: T.text }}
            />
            <button
              onClick={selectAll}
              className="rounded-lg border px-2 py-1 text-xs"
              style={{ background: T.surface, borderColor: T.border, color: T.dim }}
            >
              All
            </button>
            <button
              onClick={clearAll}
              className="rounded-lg border px-2 py-1 text-xs"
              style={{ background: T.surface, borderColor: T.border, color: T.dim }}
            >
              None
            </button>
          </div>

          {/* Checkbox list */}
          <div className="max-h-36 space-y-0.5 overflow-y-auto">
            {displayed.map((v) => {
              const sv = String(v);
              const checked = selected.includes(sv);
              return (
                <label
                  key={sv}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition hover:opacity-80"
                  style={{ color: T.text, background: checked ? T.accentDim : "transparent" }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(v)}
                    className="accent-amber-500"
                  />
                  <span className="truncate">{sv || "(blank)"}</span>
                </label>
              );
            })}
            {displayed.length === 0 && (
              <div className="py-1 text-center text-xs" style={{ color: T.muted }}>
                No values match
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Date filter: relative shortcuts + custom from/to range ──
function DateFilter({ field, values, filterValue, onSet, T }) {
  // Detect current mode
  const isRange = typeof filterValue === "object" && filterValue !== null;
  const isRelative = typeof filterValue === "string" && isRelativeDateFilter(filterValue);
  const isExact = typeof filterValue === "string" && filterValue !== "" && !isRelative;

  const [tab, setTab] = useState(isRange ? "range" : "relative");

  const rangeVal = isRange ? filterValue : { from: "", to: "" };

  const setFrom = (v) => onSet({ ...rangeVal, from: v });
  const setTo   = (v) => onSet({ ...rangeVal, to: v });

  const inputStyle = {
    background: T.surface,
    borderColor: T.border,
    color: T.text,
  };

  return (
    <div className="space-y-2">
      {/* Tab toggle */}
      <div
        className="inline-flex rounded-xl border p-0.5"
        style={{ background: T.s2, borderColor: T.border }}
      >
        {["relative", "range"].map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              onSet(""); // reset when switching
            }}
            className="rounded-[10px] px-3 py-1 text-xs font-medium capitalize transition"
            style={{
              background: tab === t ? T.surface : "transparent",
              color: tab === t ? T.accent : T.dim,
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
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
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
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
          <div className="flex items-center gap-2">
            <Calendar size={12} style={{ color: T.muted, flexShrink: 0 }} />
            <input
              type="date"
              value={rangeVal.from || ""}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 rounded-xl border px-2 py-1.5 text-sm outline-none"
              style={inputStyle}
              placeholder="From"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={12} style={{ color: T.muted, flexShrink: 0 }} />
            <input
              type="date"
              value={rangeVal.to || ""}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 rounded-xl border px-2 py-1.5 text-sm outline-none"
              style={inputStyle}
              placeholder="To"
            />
          </div>
          {(rangeVal.from || rangeVal.to) && (
            <button
              onClick={() => onSet("")}
              className="flex items-center gap-1 text-xs"
              style={{ color: T.muted }}
            >
              <X size={11} /> Clear range
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Active filter badge ──
function ActiveBadge({ filterValue, T }) {
  if (!filterValue || filterValue === "") return null;
  if (Array.isArray(filterValue) && filterValue.length === 0) return null;

  let label = "";
  if (Array.isArray(filterValue)) {
    label = `${filterValue.length} value${filterValue.length !== 1 ? "s" : ""}`;
  } else if (typeof filterValue === "object") {
    const parts = [];
    if (filterValue.from) parts.push(`from ${filterValue.from}`);
    if (filterValue.to) parts.push(`to ${filterValue.to}`);
    label = parts.join(" ") || "range";
  } else {
    label = String(filterValue);
  }

  return (
    <span
      className="ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
      style={{ background: T.accentDim, color: T.accent }}
    >
      {label}
    </span>
  );
}

export default function FilterPanel() {
  const T = useTheme();
  const { rows, columns, dataTypes } = useEffectiveData();
  const filters = useStore((s) => s.filters);
  const setGlobalFilter = useStore((s) => s.setGlobalFilter);
  const clearGlobalFilters = useStore((s) => s.clearGlobalFilters);
  const filterBookmarks = useStore((s) => s.filterBookmarks);
  const saveFilterBookmark = useStore((s) => s.saveFilterBookmark);
  const applyFilterBookmark = useStore((s) => s.applyFilterBookmark);
  const deleteFilterBookmark = useStore((s) => s.deleteFilterBookmark);

  const [bookmarkName, setBookmarkName] = useState("");

  const filterableFields = columns.filter((c) => dataTypes[c] !== "number");
  const activeCount = Object.values(filters).filter(
    (v) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  ).length;

  const handleSaveBookmark = () => {
    if (!bookmarkName.trim()) return;
    saveFilterBookmark(bookmarkName.trim());
    setBookmarkName("");
  };

  return (
    <div
      className="h-full rounded-[20px] border p-4 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: T.text }}>
            Filters
            {activeCount > 0 && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: T.accent, color: "#000" }}
              >
                {activeCount}
              </span>
            )}
          </h2>
          <p className="text-sm" style={{ color: T.dim }}>Global report filters</p>
        </div>
        <button
          onClick={clearGlobalFilters}
          className="rounded-xl border px-3 py-2 text-sm transition"
          style={{ borderColor: T.border, background: T.s2, color: T.dim }}
        >
          Clear all
        </button>
      </div>

      <div className="max-h-[calc(100vh-280px)] space-y-4 overflow-y-auto pr-1">
        {filterableFields.map((field) => {
          const values = getUniqueValues(rows, field);
          const isDate = dataTypes[field] === "date";
          const filterValue = filters[field] ?? "";

          return (
            <div key={field}>
              <label className="mb-1.5 flex items-center text-sm font-medium" style={{ color: T.text }}>
                {field}
                <ActiveBadge filterValue={filterValue} T={T} />
              </label>

              {isDate ? (
                <DateFilter
                  field={field}
                  values={values}
                  filterValue={filterValue}
                  onSet={(v) => setGlobalFilter(field, v)}
                  T={T}
                />
              ) : (
                <StringFilter
                  field={field}
                  values={values}
                  filterValue={filterValue}
                  onSet={(v) => setGlobalFilter(field, v)}
                  T={T}
                />
              )}
            </div>
          );
        })}

        {/* Filter Bookmarks */}
        <div className="border-t pt-4" style={{ borderColor: T.border }}>
          <div className="mb-3 flex items-center gap-2">
            <Bookmark size={13} style={{ color: T.accent }} />
            <span className="text-sm font-semibold" style={{ color: T.text }}>Saved Filters</span>
          </div>

          <div className="mb-3 flex gap-2">
            <input
              value={bookmarkName}
              onChange={(e) => setBookmarkName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveBookmark(); }}
              placeholder="Bookmark name…"
              className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}
            />
            <button
              onClick={handleSaveBookmark}
              className="rounded-xl border px-3 py-2"
              style={{ background: T.accentDim, borderColor: "rgba(245,158,11,0.25)", color: T.accent }}
              title="Save current filters as bookmark"
            >
              <Plus size={14} />
            </button>
          </div>

          {filterBookmarks.length === 0 ? (
            <p className="text-xs" style={{ color: T.muted }}>No saved filters yet</p>
          ) : (
            <div className="space-y-2">
              {filterBookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2"
                  style={{ background: T.s2, borderColor: T.border }}
                >
                  <button
                    onClick={() => applyFilterBookmark(bm.id)}
                    className="flex-1 text-left text-sm truncate"
                    style={{ color: T.text }}
                    title={`Apply: ${bm.name}`}
                  >
                    {bm.name}
                  </button>
                  <button
                    onClick={() => deleteFilterBookmark(bm.id)}
                    title="Delete bookmark"
                    style={{ color: T.muted }}
                  >
                    <Trash2 size={12} />
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
