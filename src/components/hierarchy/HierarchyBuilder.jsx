import { useState } from "react";
import { ChevronDown, Layers3 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useEffectiveData } from "../../hooks/useEffectiveData";
import { validateHierarchy } from "../../utils/hierarchyUtils";
import { useTheme } from "../../styles/theme";

export default function HierarchyBuilder() {
  const T = useTheme();
  const { columns } = useEffectiveData({ applyScenario: false });
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
    setError("");
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
    <div
      className="rounded-[18px] border p-5 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: T.accentDim }}
        >
          <Layers3 size={16} color={T.accent} />
        </div>
        <div>
          <h2 className="text-[14px] font-bold leading-none" style={{ color: T.text }}>
            Create Hierarchy
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: T.dim }}>
            Example: Brand → Product → SKU
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hierarchy name"
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ background: T.s2, borderColor: T.border, color: T.text }}
        />

        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full appearance-none rounded-xl border px-3 py-2 pr-10 text-sm outline-none"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}
            >
              <option value="">Select field</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: T.dim }}
            />
          </div>

          <button
            onClick={addLevel}
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: T.accent, color: "#000" }}
          >
            Add Level
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {levels.map((level) => (
            <span
              key={level}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5"
              style={{ background: T.s2, borderColor: T.border, color: T.text }}
            >
              {level}
              <button onClick={() => removeLevel(level)} style={{ color: T.dim }}>
                ×
              </button>
            </span>
          ))}
        </div>

        {error && (
          <div className="text-sm" style={{ color: T.error }}>
            {error}
          </div>
        )}

        <button
          onClick={saveHierarchy}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold btn-primary"
          style={{ background: T.accent, color: "#000", boxShadow: "0 2px 8px rgba(245,158,11,0.20)" }}
        >
          Save Hierarchy
        </button>
      </div>
    </div>
  );
}
