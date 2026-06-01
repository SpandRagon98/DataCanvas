import { useState, useEffect, useMemo } from "react";
import { GitBranch, Info, Plus, Pencil, Trash2, Database, Table2, ChevronDown } from "lucide-react";
import { useStore } from "../store/useStore";
import { useTheme } from "../styles/theme";
import ModelCanvas from "../components/modelling/ModelCanvas";
import RelationshipPanel from "../components/modelling/RelationshipPanel";

export default function DataModelling() {
  const T             = useTheme();
  const datasets      = useStore((s) => s.datasets);
  const relationships = useStore((s) => s.relationships);
  const modelPages    = useStore((s) => s.modelPages);
  const activeModelPageId = useStore((s) => s.activeModelPageId);
  const seedDefaultModelPage = useStore((s) => s.seedDefaultModelPage);
  const addModelPage         = useStore((s) => s.addModelPage);
  const removeModelPage      = useStore((s) => s.removeModelPage);
  const renameModelPage      = useStore((s) => s.renameModelPage);
  const setActiveModelPage   = useStore((s) => s.setActiveModelPage);
  const addDatasetToModelPage = useStore((s) => s.addDatasetToModelPage);

  const [selectedRelId, setSelectedRelId] = useState(null);
  const [editingPageId, setEditingPageId] = useState(null);
  const [draftPageName, setDraftPageName] = useState("");
  const [tablesOpen,    setTablesOpen]    = useState(false);

  // Seed a default page if none exist yet
  useEffect(() => {
    if (modelPages.length === 0) seedDefaultModelPage();
  }, [modelPages.length, seedDefaultModelPage]);

  const activePage = useMemo(
    () => modelPages.find((p) => p.id === activeModelPageId) || modelPages[0] || null,
    [modelPages, activeModelPageId]
  );

  const selectedRel = relationships.find((r) => r.id === selectedRelId) ?? null;

  // Tables not yet on the active page
  const availableTables = useMemo(
    () => datasets.filter((d) => !activePage?.datasetIds?.includes(d.id)),
    [datasets, activePage]
  );

  const activeCount   = relationships.filter((r) => r.active !== false).length;
  const inactiveCount = relationships.length - activeCount;

  const commitRename = () => {
    if (editingPageId) renameModelPage(editingPageId, draftPageName.trim() || "Untitled Page");
    setEditingPageId(null);
    setDraftPageName("");
  };

  const tableCount = activePage?.datasetIds?.length ?? 0;

  return (
    <div className="flex flex-col" style={{ height: "100%", background: T.bg }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0 border-b"
        style={{ background: T.surface, borderColor: T.border }}>
        <GitBranch size={16} style={{ color: T.accent }} />
        <span className="text-sm font-bold tracking-tight" style={{ color: T.text }}>Data Model</span>

        <div className="flex items-center gap-1.5 ml-1">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: T.accent + "22", color: T.accent }}>
            {tableCount} table{tableCount !== 1 ? "s" : ""}
          </span>
          {relationships.length > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "#60a5fa22", color: "#60a5fa" }}>
              {activeCount} active rel{activeCount !== 1 ? "s" : ""}
            </span>
          )}
          {inactiveCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "#4b556322", color: T.muted }}>
              {inactiveCount} inactive
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Tables palette dropdown */}
        <div className="relative">
          <button
            onClick={() => setTablesOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium"
            style={{ background: tablesOpen ? T.accentDim : T.s2, borderColor: tablesOpen ? "rgba(245,158,11,0.28)" : T.border, color: tablesOpen ? T.accent : T.dim }}
          >
            <Table2 size={12} /> Tables <ChevronDown size={11} />
          </button>
          {tablesOpen && (
            <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border shadow-2xl overflow-hidden"
              style={{ background: T.surface, borderColor: T.border }}
              onMouseLeave={() => setTablesOpen(false)}>
              <div className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-widest"
                style={{ borderColor: T.border, color: T.muted }}>
                Add tables to this page
              </div>
              <div className="max-h-72 overflow-y-auto p-1.5">
                {availableTables.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-center" style={{ color: T.muted }}>
                    All tables are on this page
                  </div>
                ) : (
                  availableTables.map((ds) => (
                    <div
                      key={ds.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("modelDatasetId", ds.id); e.dataTransfer.effectAllowed = "copy"; }}
                      onClick={() => { addDatasetToModelPage(activePage.id, ds.id); }}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-grab transition hover:opacity-80"
                      style={{ background: T.s2 }}
                      title="Drag onto canvas or click to add"
                    >
                      <Database size={13} style={{ color: T.accent, flexShrink: 0 }} />
                      <span className="flex-1 truncate text-xs font-medium" style={{ color: T.text }}>{ds.name}</span>
                      <span className="text-[10px]" style={{ color: T.muted }}>{ds.columns.length} cols</span>
                      <Plus size={12} style={{ color: T.muted }} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Help tip */}
        <div className="flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10px]"
          style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
          <Info size={10} />
          <span>Drag a column's port dot to another table to define a relationship</span>
        </div>
      </div>

      {/* ── Page tabs ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 shrink-0 border-b overflow-x-auto"
        style={{ background: T.surface, borderColor: T.border }}>
        {modelPages.map((p) => {
          const isActive = p.id === activePage?.id;
          return (
            <div key={p.id}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 shrink-0"
              style={{ background: isActive ? T.accentDim : T.s2, borderColor: isActive ? "rgba(245,158,11,0.28)" : T.border }}>
              {editingPageId === p.id ? (
                <input autoFocus value={draftPageName}
                  onChange={(e) => setDraftPageName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditingPageId(null); setDraftPageName(""); } }}
                  className="rounded border px-1.5 py-0.5 text-xs outline-none"
                  style={{ background: T.surface, borderColor: T.border, color: T.text, width: 90 }} />
              ) : (
                <button onClick={() => setActiveModelPage(p.id)} className="text-xs font-semibold"
                  style={{ color: isActive ? T.accent : T.text }}>
                  {p.name}
                </button>
              )}
              <button onClick={() => { setEditingPageId(p.id); setDraftPageName(p.name); }}
                className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity" style={{ color: T.dim }}>
                <Pencil size={10} />
              </button>
              {modelPages.length > 1 && (
                <button onClick={() => removeModelPage(p.id)}
                  className="rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity" style={{ color: T.dim }}>
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          );
        })}
        <button onClick={() => addModelPage()}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0"
          style={{ background: T.accent, color: "#000" }}>
          <Plus size={11} /> New Page
        </button>
      </div>

      {/* ── Canvas + panel ── */}
      <div className="flex flex-1 min-h-0">
        <ModelCanvas
          page={activePage}
          selectedRelId={selectedRelId}
          onSelectRel={setSelectedRelId}
        />
        {selectedRel && (
          <RelationshipPanel
            key={selectedRel.id}
            relationship={selectedRel}
            onClose={() => setSelectedRelId(null)}
          />
        )}
      </div>
    </div>
  );
}
