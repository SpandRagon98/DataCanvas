/**
 * DatasetPane — vertical, collapsible dataset list for the Data Source tab.
 *
 * - Native Calendar (isSystemTable) is pinned at the top with a "Native" badge
 *   and cannot be renamed or removed.
 * - Click a dataset to activate it (drives preview/profiler everywhere).
 * - Collapses to an icon-only rail; expands to full names + metadata.
 * Reuses existing store state + ImportModal — no duplicate dataset system.
 */

import { useState } from "react";
import {
  Database, Plus, Trash2, Pencil, Check, X, Calendar,
  PanelLeftClose, PanelLeftOpen, Layers,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import ImportModal from "../import/ImportModal";
import { useTheme } from "../../styles/theme";

const SOURCE_BADGE = {
  demo: { label: "demo",   color: "#6366f1" },
  file: { label: "file",   color: "#10b981" },
  api:  { label: "api",    color: "var(--dc-accent)" },
  join: { label: "join",   color: "#60a5fa" },
  system: { label: "Native", color: "var(--dc-accent)" },
};

export default function DatasetPane({ collapsed, onToggleCollapse }) {
  const T               = useTheme();
  const datasets        = useStore((s) => s.datasets);
  const activeDatasetId = useStore((s) => s.activeDatasetId);
  const addDataset      = useStore((s) => s.addDataset);
  const activateDataset = useStore((s) => s.activateDataset);
  const removeDataset   = useStore((s) => s.removeDataset);
  const renameDataset   = useStore((s) => s.renameDataset);

  const [importOpen, setImportOpen] = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [editName,   setEditName]   = useState("");

  // System datasets (Calendar) first, then the rest in original order.
  const ordered = [
    ...datasets.filter((d) => d.isSystemTable),
    ...datasets.filter((d) => !d.isSystemTable),
  ];
  const realCount = datasets.filter((d) => !d.isSystemTable).length;

  const startRename = (ds, e) => { e.stopPropagation(); setEditingId(ds.id); setEditName(ds.name); };
  const commitRename = (id) => { renameDataset(id, editName.trim() || "Unnamed Dataset"); setEditingId(null); };

  const badgeFor = (ds) => ds.isSystemTable ? SOURCE_BADGE.system : (SOURCE_BADGE[ds.sourceType] || SOURCE_BADGE.file);

  // ── Collapsed rail ──
  if (collapsed) {
    return (
      <div
        className="shrink-0 flex flex-col items-center gap-1 border-r py-2"
        style={{ width: 56, background: T.surface, borderColor: T.border, transition: "width 180ms ease" }}
      >
        <button onClick={onToggleCollapse} title="Expand datasets"
          className="flex h-9 w-9 items-center justify-center rounded-xl mb-1"
          style={{ color: T.muted }}>
          <PanelLeftOpen size={16} />
        </button>
        <button onClick={() => setImportOpen(true)} title="Add dataset"
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: T.accentDim, color: T.accent }}>
          <Plus size={15} />
        </button>
        <div className="my-1 h-px w-7" style={{ background: T.border }} />
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto w-full items-center">
          {ordered.map((ds) => {
            const isActive = ds.id === activeDatasetId;
            const Icon = ds.isSystemTable ? Calendar : Database;
            return (
              <button key={ds.id} onClick={() => activateDataset(ds.id)} title={ds.name}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl transition"
                style={{
                  background: isActive ? T.accentDim : "transparent",
                  color: isActive ? T.accent : T.muted,
                  border: `1px solid ${isActive ? T.accent : "transparent"}`,
                }}>
                <Icon size={15} />
              </button>
            );
          })}
        </div>
        <ImportModal open={importOpen} onClose={() => setImportOpen(false)}
          onImport={({ rows, columns, types }) =>
            addDataset({ name: `Dataset ${realCount + 1}`, rows, columns, dataTypes: types, sourceType: "file" })} />
      </div>
    );
  }

  // ── Expanded pane ──
  return (
    <div
      className="shrink-0 flex flex-col border-r"
      style={{ width: 248, background: T.surface, borderColor: T.border, transition: "width 180ms ease" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0" style={{ borderColor: T.border }}>
        <Layers size={14} style={{ color: T.accent }} />
        <span className="text-[13px] font-semibold" style={{ color: T.text }}>Datasets</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: T.s3, color: T.dim }}>{realCount}</span>
        <div className="flex-1" />
        <button onClick={onToggleCollapse} title="Collapse datasets"
          className="rounded-lg p-1" style={{ color: T.muted }}>
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* Add dataset */}
      <div className="px-2.5 pt-2.5 pb-1.5 shrink-0">
        <button onClick={() => setImportOpen(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-90"
          style={{ background: T.accentDim, borderColor: "rgba(var(--dc-accent-rgb),0.25)", color: T.accent }}>
          <Plus size={14} /> Add Dataset
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1.5">
        {ordered.map((ds) => {
          const isActive  = ds.id === activeDatasetId;
          const isEditing = editingId === ds.id;
          const isSystem  = !!ds.isSystemTable;
          const badge     = badgeFor(ds);
          const Icon      = isSystem ? Calendar : Database;

          return (
            <div key={ds.id}
              onClick={() => !isEditing && activateDataset(ds.id)}
              className="group relative rounded-xl border p-2.5 transition"
              style={{
                background: isActive ? T.accentDim : T.s2,
                borderColor: isActive ? T.accent : T.border,
                cursor: isActive ? "default" : "pointer",
                boxShadow: isActive ? `0 0 0 1px ${T.accent}55` : "none",
              }}>
              {/* Top row: icon + badge + active dot */}
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={13} style={{ color: isActive ? T.accent : T.muted, flexShrink: 0 }} />
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase mono"
                  style={{ background: `${badge.color}22`, color: badge.color }}>
                  {badge.label}
                </span>
                {isActive && (
                  <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{ background: T.accent, color: "#000" }}>Active</span>
                )}
              </div>

              {/* Name (editable for non-system) */}
              {isEditing ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input autoFocus value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(ds.id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 min-w-0 rounded-lg border px-2 py-1 text-[13px] outline-none"
                    style={{ background: T.surface, borderColor: T.accent, color: T.text }} />
                  <button onClick={() => commitRename(ds.id)} className="rounded p-1" style={{ color: T.accent }}><Check size={12} /></button>
                  <button onClick={() => setEditingId(null)} className="rounded p-1" style={{ color: T.muted }}><X size={12} /></button>
                </div>
              ) : (
                <div className="text-[13px] font-semibold leading-snug break-words" style={{ color: T.text }}>
                  {ds.name}
                </div>
              )}

              {/* Metadata */}
              <div className="mt-1 flex gap-2.5 text-[10.5px]" style={{ color: T.muted }}>
                <span><span style={{ color: T.dim, fontWeight: 600 }}>{ds.rows.length.toLocaleString()}</span> rows</span>
                <span><span style={{ color: T.dim, fontWeight: 600 }}>{ds.columns.length}</span> cols</span>
              </div>

              {/* Actions (non-system only) */}
              {!isEditing && !isSystem && (
                <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => startRename(ds, e)} title="Rename"
                    className="rounded-lg border px-2 py-1 transition hover:opacity-80"
                    style={{ background: T.surface, borderColor: T.border, color: T.dim }}>
                    <Pencil size={10} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); removeDataset(ds.id); }}
                    disabled={realCount < 1}
                    title="Remove dataset"
                    className="rounded-lg border px-2 py-1 transition hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: T.surface, borderColor: T.border, color: "#ef4444" }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
              {!isEditing && isSystem && (
                <div className="mt-1.5 text-[10px]" style={{ color: T.muted }}>
                  System dataset · always available
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)}
        onImport={({ rows, columns, types }) =>
          addDataset({ name: `Dataset ${realCount + 1}`, rows, columns, dataTypes: types, sourceType: "file" })} />
    </div>
  );
}
