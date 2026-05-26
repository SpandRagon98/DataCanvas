import { useState } from "react";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { useEffectiveData } from "../../hooks/useEffectiveData";
import { useStore } from "../../store/useStore";
import { getUniqueValues, RELATIVE_DATE_LABELS } from "../../utils/filterEngine";
import { useTheme } from "../../styles/theme";

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
          <h2 className="text-lg font-semibold" style={{ color: T.text }}>Filters</h2>
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

          return (
            <div key={field}>
              <label className="mb-2 block text-sm font-medium" style={{ color: T.text }}>
                {field}
              </label>
              <select
                value={filters[field] ?? ""}
                onChange={(e) => setGlobalFilter(field, e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ background: T.s2, borderColor: T.border, color: T.text }}
              >
                <option value="">All</option>
                {isDate && (
                  <optgroup label="Relative">
                    {RELATIVE_DATE_LABELS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={isDate ? "Specific" : field}>
                  {values.map((v) => (
                    <option key={String(v)} value={v}>{String(v)}</option>
                  ))}
                </optgroup>
              </select>
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
