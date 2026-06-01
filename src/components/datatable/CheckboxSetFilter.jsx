/**
 * CheckboxSetFilter — AG Grid Community custom filter component.
 * Implements the IFilter interface so AG Grid drives it natively.
 *
 * Pass unique values via column def:
 *   { filter: CheckboxSetFilter, filterParams: { values: [...] } }
 */
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

const CheckboxSetFilter = forwardRef(function CheckboxSetFilter(props, ref) {
  const { filterChangedCallback, colDef } = props;

  /*
   * AG Grid v32 merges every key from the column's `filterParams` object
   * directly into the component's root props (not nested under `filterParams`).
   * So { filterParams: { values: [...] } } in the column def arrives here as
   * props.values — not props.filterParams.values.
   * We fall back to props.filterParams?.values for safety.
   */
  const allValues = props.values ?? props.filterParams?.values ?? [];
  const [selected, setSelected] = useState(() => new Set(allValues));
  const [search,   setSearch]   = useState("");

  // Keep in sync if filterParams.values changes (dataset switch)
  useEffect(() => {
    setSelected(new Set(allValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allValues)]);

  useImperativeHandle(ref, () => ({
    isFilterActive() {
      // Active when NOT all values are selected
      return selected.size < allValues.length;
    },
    doesFilterPass(params) {
      const field = colDef.field;
      const cell  = String(params.data[field] ?? "");
      return selected.has(cell);
    },
    getModel() {
      if (selected.size === allValues.length) return null;
      return { values: [...selected] };
    },
    setModel(model) {
      setSelected(model ? new Set(model.values) : new Set(allValues));
    },
  }));

  // Notify AG Grid whenever selection changes
  useEffect(() => {
    filterChangedCallback?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const toggle = (val) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });

  const visible = search
    ? allValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : allValues;

  const selectAll = () => setSelected(new Set(allValues));
  const clearAll  = () => setSelected(new Set());

  // ── Inline styles (independent of Tailwind so they work inside AG Grid popup) ──
  const s = {
    wrap:       { padding: 10, minWidth: 200, display: "flex", flexDirection: "column", gap: 6, userSelect: "none" },
    search:     { padding: "5px 9px", borderRadius: 8, border: "1px solid rgba(100,100,100,0.5)", background: "rgba(0,0,0,0.25)", color: "inherit", fontSize: 12, outline: "none", width: "100%" },
    actions:    { display: "flex", gap: 10, fontSize: 11 },
    actionBtn:  { color: "#14b8a6", cursor: "pointer", background: "none", border: "none", padding: 0, fontWeight: 600 },
    list:       { overflowY: "auto", maxHeight: 220, display: "flex", flexDirection: "column", gap: 2 },
    row:        { display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12, padding: "2px 0" },
    checkbox:   { cursor: "pointer", accentColor: "#14b8a6", flexShrink: 0 },
    label:      { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 },
    separator:  { height: 1, background: "rgba(100,100,100,0.25)", margin: "2px 0" },
    count:      { fontSize: 10, opacity: 0.5, marginLeft: "auto", flexShrink: 0 },
  };

  const isAllSelected = selected.size === allValues.length;

  return (
    <div style={s.wrap}>
      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search values…"
        style={s.search}
      />

      {/* Select All / Clear All */}
      <div style={s.actions}>
        <button style={s.actionBtn} onClick={selectAll}>Select All</button>
        <button style={s.actionBtn} onClick={clearAll}>Clear All</button>
        <span style={{ ...s.count, marginLeft: "auto" }}>
          {selected.size}/{allValues.length}
        </span>
      </div>

      <div style={s.separator} />

      {/* Value list */}
      <div style={s.list}>
        {visible.length === 0 && (
          <div style={{ fontSize: 11, opacity: 0.5, textAlign: "center", padding: 8 }}>
            No matches
          </div>
        )}
        {visible.map((val) => (
          <label key={val} style={s.row}>
            <input
              type="checkbox"
              checked={selected.has(val)}
              onChange={() => toggle(val)}
              style={s.checkbox}
            />
            <span style={s.label} title={val || "(blank)"}>
              {val || <em style={{ opacity: 0.5 }}>(blank)</em>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
});

export default CheckboxSetFilter;
