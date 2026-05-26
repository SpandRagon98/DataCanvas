import { useState } from "react";
import { Database, Plus, Trash2, Edit2, Check, X, Layers } from "lucide-react";
import { useStore } from "../../store/useStore";
import ImportModal from "../import/ImportModal";
import { useTheme } from "../../styles/theme";

const SOURCE_BADGE = {
  demo: { label: "demo", color: "#6366f1" },
  file: { label: "file", color: "#10b981" },
  api:  { label: "api",  color: "#f59e0b" },
  join: { label: "join", color: "#60a5fa" },
};

export default function DatasetSlots() {
  const T = useTheme();
  const datasets       = useStore((s) => s.datasets);
  const activeDatasetId = useStore((s) => s.activeDatasetId);
  const addDataset     = useStore((s) => s.addDataset);
  const activateDataset = useStore((s) => s.activateDataset);
  const removeDataset  = useStore((s) => s.removeDataset);
  const renameDataset  = useStore((s) => s.renameDataset);

  const [importOpen, setImportOpen]   = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [editName, setEditName]       = useState("");

  const startRename = (ds, e) => {
    e.stopPropagation();
    setEditingId(ds.id);
    setEditName(ds.name);
  };

  const commitRename = (id) => {
    renameDataset(id, editName.trim() || "Unnamed Dataset");
    setEditingId(null);
  };

  const handleKeyDown = (e, id) => {
    if (e.key === "Enter") commitRename(id);
    if (e.key === "Escape") setEditingId(null);
  };

  return (
    <div
      className="rounded-xl border p-5 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: T.accentDim }}
          >
            <Layers size={16} color={T.accent} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: T.text }}>
              Datasets
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: T.s3, color: T.dim }}
              >
                {datasets.length}
              </span>
            </h2>
            <p className="text-xs" style={{ color: T.muted }}>
              Click a card to activate — active dataset powers all visuals
            </p>
          </div>
        </div>

        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-80"
          style={{ background: T.accentDim, borderColor: "rgba(245,158,11,0.25)", color: T.accent }}
        >
          <Plus size={13} /> Add Dataset
        </button>
      </div>

      {/* Dataset cards */}
      <div className="flex flex-wrap gap-3">
        {datasets.map((ds) => {
          const isActive = ds.id === activeDatasetId;
          const isEditing = editingId === ds.id;
          const badge = SOURCE_BADGE[ds.sourceType] || SOURCE_BADGE.file;

          return (
            <div
              key={ds.id}
              onClick={() => !isActive && !isEditing && activateDataset(ds.id)}
              className="relative flex min-w-[200px] max-w-[260px] flex-1 flex-col gap-2 rounded-xl border p-4 transition"
              style={{
                background: isActive ? T.accentDim : T.s2,
                borderColor: isActive ? T.accent : T.border,
                cursor: isActive ? "default" : "pointer",
                boxShadow: isActive ? `0 0 0 2px ${T.accent}33` : "none",
              }}
            >
              {/* Active chip */}
              {isActive && (
                <span
                  className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: T.accent, color: "#000" }}
                >
                  Active
                </span>
              )}

              {/* Dataset icon + source badge */}
              <div className="flex items-center gap-2">
                <Database size={16} style={{ color: isActive ? T.accent : T.muted }} />
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase mono"
                  style={{ background: `${badge.color}22`, color: badge.color }}
                >
                  {badge.label}
                </span>
              </div>

              {/* Name (editable) */}
              {isEditing ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, ds.id)}
                    className="flex-1 rounded-lg border px-2 py-1 text-sm outline-none"
                    style={{ background: T.surface, borderColor: T.accent, color: T.text }}
                  />
                  <button
                    onClick={() => commitRename(ds.id)}
                    className="rounded-lg p-1"
                    style={{ color: T.accent }}
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg p-1"
                    style={{ color: T.muted }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <p className="truncate text-sm font-semibold pr-12" style={{ color: T.text }}>
                  {ds.name}
                </p>
              )}

              {/* Stats */}
              <div className="flex gap-3 text-xs" style={{ color: T.muted }}>
                <span>
                  <span style={{ color: T.text, fontWeight: 600 }}>{ds.rows.length.toLocaleString()}</span> rows
                </span>
                <span>
                  <span style={{ color: T.text, fontWeight: 600 }}>{ds.columns.length}</span> cols
                </span>
              </div>

              {/* Action buttons */}
              {!isEditing && (
                <div className="flex items-center gap-1 mt-1">
                  <button
                    onClick={(e) => startRename(ds, e)}
                    className="rounded-lg border px-2 py-1 text-xs transition hover:opacity-80"
                    style={{ background: T.surface, borderColor: T.border, color: T.dim }}
                    title="Rename"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDataset(ds.id);
                    }}
                    disabled={datasets.length <= 1}
                    className="rounded-lg border px-2 py-1 text-xs transition hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: T.surface, borderColor: T.border, color: T.error || "#ef4444" }}
                    title={datasets.length <= 1 ? "Cannot remove the only dataset" : "Remove dataset"}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Import modal — adds to collection without full reset */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={({ rows, columns, types }) => {
          addDataset({
            name: `Dataset ${datasets.length + 1}`,
            rows,
            columns,
            dataTypes: types,
            sourceType: "file",
          });
        }}
      />
    </div>
  );
}
