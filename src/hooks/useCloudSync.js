import { useCallback, useEffect, useRef, useState } from "react";
import { CLOUD_ENABLED, saveWorkbook, loadWorkbookById } from "../lib/supabase";
import { useStore } from "../store/useStore";

const AUTOSAVE_DELAY = 4000; // ms debounce

/**
 * Handles cloud auto-save and conflict detection.
 * Returns { workbookId, isSaving, lastSaved, forceSave, loadCloud }.
 */
export function useCloudSync(user) {
  const [workbookId, setWorkbookId] = useState(useStore.getState().cloudWorkbookId ?? null);
  const [isSaving,   setIsSaving]   = useState(false);
  const [lastSaved,  setLastSaved]  = useState(null);
  const [conflict,   setConflict]   = useState(false);

  const debounceRef  = useRef(null);
  const serverVerRef = useRef(null); // last known server version

  const getSnapshot = () => {
    const s = useStore.getState();
    return {
      rawData: s.rawData, columns: s.columns, dataTypes: s.dataTypes,
      datasets: s.datasets, activeDatasetId: s.activeDatasetId,
      apiConnectors: s.apiConnectors,
      filters: s.filters, visuals: s.visuals, activeVisualId: s.activeVisualId,
      hierarchies: s.hierarchies, dashboards: s.dashboards,
      activeDashboardId: s.activeDashboardId, themeMode: s.themeMode,
      calculatedFields: s.calculatedFields, scenarios: s.scenarios,
      activeScenarioId: s.activeScenarioId, filterBookmarks: s.filterBookmarks,
    };
  };

  const forceSave = useCallback(async (nameOverride) => {
    if (!CLOUD_ENABLED || !user) return;
    setIsSaving(true);
    try {
      const s  = useStore.getState();
      const wb = await saveWorkbook({
        id: workbookId,
        name: nameOverride || s.cloudWorkbookName || "My Workbook",
        data: getSnapshot(),
        workspaceId: s.cloudWorkspaceId,
      });
      if (wb) {
        setWorkbookId(wb.id);
        serverVerRef.current = wb.version;
        setLastSaved(new Date());
        setConflict(false);
        useStore.getState().setCloudMeta({ cloudWorkbookId: wb.id });
      }
    } finally {
      setIsSaving(false);
    }
  }, [user, workbookId]);

  const loadCloud = useCallback(async (id) => {
    if (!CLOUD_ENABLED) return;
    const wb = await loadWorkbookById(id);
    if (wb?.data) {
      useStore.getState().loadWorkbook(wb.data);
      setWorkbookId(wb.id);
      serverVerRef.current = wb.version;
      useStore.getState().setCloudMeta({ cloudWorkbookId: wb.id, cloudWorkbookName: wb.name });
    }
  }, []);

  // Debounced auto-save on store changes
  useEffect(() => {
    if (!CLOUD_ENABLED || !user) return;

    const unsub = useStore.subscribe((state, prev) => {
      // Skip if only cloud meta changed
      if (state.rawData === prev.rawData &&
          state.visuals === prev.visuals &&
          state.dashboards === prev.dashboards &&
          state.filters === prev.filters) return;

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => forceSave(), AUTOSAVE_DELAY);
    });

    return () => {
      unsub();
      clearTimeout(debounceRef.current);
    };
  }, [user, forceSave]);

  return { workbookId, isSaving, lastSaved, conflict, forceSave, loadCloud };
}
