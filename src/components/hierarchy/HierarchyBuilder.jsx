import { useState } from "react";
import { useStore } from "../../store/useStore";
import { validateHierarchy } from "../../utils/hierarchyUtils";

export default function HierarchyBuilder() {
  const columns = useStore((s) => s.columns);
  const addHierarchy = useStore((s) => s.addHierarchy);

  const [name, setName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState("");

  const addLevel = () => {
    if (!selectedLevel) return;
    if (levels.includes(selectedLevel)) return;
    setLevels([...levels, selectedLevel]);
    setSelectedLevel("");
  };

  const removeLevel = (level) => {
    setLevels(levels.filter((l) => l !== level));
  };

  const saveHierarchy = () => {
    const result = validateHierarchy(levels);
    if (!name.trim()) {
      setError("Please enter a hierarchy name.");
      return;
    }
    if (!result.valid) {
      setError(result.message);
      return;
    }

    addHierarchy({
      name: name.trim(),
      levels,
    });

    setName("");
    setLevels([]);
    setSelectedLevel("");
    setError("");
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Create Hierarchy</h2>
      <p className="mt-1 text-sm text-slate-500">
        Example: Brand → Product → SKU
      </p>

      <div className="mt-4 space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hierarchy name"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />

        <div className="flex gap-3">
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value="">Select field</option>
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>

          <button
            onClick={addLevel}
            className="rounded-xl bg-slate-900 px-4 py-2 text-white"
          >
            Add Level
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {levels.map((level) => (
            <span
              key={level}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
            >
              {level}
              <button
                onClick={() => removeLevel(level)}
                className="text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          onClick={saveHierarchy}
          className="rounded-xl bg-slate-900 px-4 py-2 text-white"
        >
          Save Hierarchy
        </button>
      </div>
    </div>
  );
}
