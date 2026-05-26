import { useState, useMemo } from "react";
import { GitMerge, Play, AlertCircle, CheckCircle2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { joinDatasets } from "../../utils/joinEngine";
import { useTheme } from "../../styles/theme";

const JOIN_TYPES = [
  { value: "inner", label: "Inner",  desc: "Only rows with matching keys in both datasets" },
  { value: "left",  label: "Left",   desc: "All left rows + matched right rows" },
  { value: "outer", label: "Full Outer", desc: "All rows from both datasets" },
  { value: "cross", label: "Cross",  desc: "Every left row paired with every right row" },
];

export default function JoinBuilder() {
  const T = useTheme();
  const datasets   = useStore((s) => s.datasets);
  const addDataset = useStore((s) => s.addDataset);

  const [leftId, setLeftId]     = useState(datasets[0]?.id ?? "");
  const [rightId, setRightId]   = useState(datasets[1]?.id ?? datasets[0]?.id ?? "");
  const [joinType, setJoinType] = useState("inner");
  const [leftKey, setLeftKey]   = useState("");
  const [rightKey, setRightKey] = useState("");
  const [resultName, setResultName] = useState("");
  const [preview, setPreview]   = useState(null); // { rows, columns } | null
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const leftDs  = datasets.find((d) => d.id === leftId);
  const rightDs = datasets.find((d) => d.id === rightId);

  const needsKeys = joinType !== "cross";

  const defaultResultName = useMemo(() => {
    if (!leftDs || !rightDs) return "";
    return `${leftDs.name} ${joinType.toUpperCase()} ${rightDs.name}`;
  }, [leftDs, rightDs, joinType]);

  const handlePreview = () => {
    setError("");
    setSuccess("");
    if (!leftDs || !rightDs) { setError("Select both datasets."); return; }
    if (needsKeys && (!leftKey || !rightKey)) { setError("Select join keys for both datasets."); return; }
    try {
      const result = joinDatasets({
        leftRows: leftDs.rows,
        rightRows: rightDs.rows,
        leftKey: needsKeys ? leftKey : undefined,
        rightKey: needsKeys ? rightKey : undefined,
        leftName: leftDs.name,
        rightName: rightDs.name,
        how: joinType,
      });
      setPreview(result);
    } catch (e) {
      setError(`Join failed: ${e.message}`);
    }
  };

  const handleCreate = () => {
    setError("");
    setSuccess("");
    if (!leftDs || !rightDs) { setError("Select both datasets."); return; }
    if (needsKeys && (!leftKey || !rightKey)) { setError("Select join keys."); return; }
    try {
      const result = joinDatasets({
        leftRows: leftDs.rows,
        rightRows: rightDs.rows,
        leftKey: needsKeys ? leftKey : undefined,
        rightKey: needsKeys ? rightKey : undefined,
        leftName: leftDs.name,
        rightName: rightDs.name,
        how: joinType,
      });
      if (!result.rows.length) { setError("Join produced 0 rows. Check your keys."); return; }

      // Detect column types
      const dataTypes = {};
      result.columns.forEach((col) => {
        const vals = result.rows.map((r) => r[col]);
        let nums = 0, dates = 0, ne = 0;
        vals.forEach((v) => {
          if (v === "" || v == null) return;
          ne++;
          if (!isNaN(Number(v))) nums++;
          if (!isNaN(Date.parse(v))) dates++;
        });
        if (ne === 0) dataTypes[col] = "string";
        else if (nums === ne) dataTypes[col] = "number";
        else if (dates === ne) dataTypes[col] = "date";
        else dataTypes[col] = "string";
      });

      addDataset({
        name: resultName.trim() || defaultResultName,
        rows: result.rows,
        columns: result.columns,
        dataTypes,
        sourceType: "join",
        sourceConfig: { leftId, rightId, leftKey, rightKey, joinType },
      });
      setPreview(null);
      setSuccess(`Created "${resultName.trim() || defaultResultName}" — ${result.rows.length.toLocaleString()} rows, ${result.columns.length} columns.`);
    } catch (e) {
      setError(`Join failed: ${e.message}`);
    }
  };

  const inputStyle = { background: T.s2, borderColor: T.border, color: T.text };

  return (
    <div
      className="rounded-xl border p-5 shadow-sm"
      style={{ background: T.surface, borderColor: T.border }}
    >
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: "rgba(96,165,250,0.12)" }}
        >
          <GitMerge size={16} style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: T.text }}>Join Builder</h2>
          <p className="text-xs" style={{ color: T.muted }}>
            Blend two datasets into a new virtual dataset
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Dataset selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: T.dim }}>Left Dataset</label>
            <select
              value={leftId}
              onChange={(e) => { setLeftId(e.target.value); setLeftKey(""); setPreview(null); }}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            >
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: T.dim }}>Right Dataset</label>
            <select
              value={rightId}
              onChange={(e) => { setRightId(e.target.value); setRightKey(""); setPreview(null); }}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            >
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {/* Join type */}
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: T.dim }}>Join Type</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {JOIN_TYPES.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => { setJoinType(value); setPreview(null); }}
                className="rounded-xl border px-2 py-2 text-left text-xs transition"
                style={{
                  background: joinType === value ? T.accentDim : T.s2,
                  borderColor: joinType === value ? T.accent : T.border,
                  color: joinType === value ? T.accent : T.dim,
                }}
                title={desc}
              >
                <div className="font-semibold">{label}</div>
                <div className="mt-0.5 opacity-70 leading-tight" style={{ fontSize: "10px" }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Key columns (hidden for cross join) */}
        {needsKeys && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: T.dim }}>
                Left Key Column
              </label>
              <select
                value={leftKey}
                onChange={(e) => { setLeftKey(e.target.value); setPreview(null); }}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">Select column…</option>
                {(leftDs?.columns || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: T.dim }}>
                Right Key Column
              </label>
              <select
                value={rightKey}
                onChange={(e) => { setRightKey(e.target.value); setPreview(null); }}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">Select column…</option>
                {(rightDs?.columns || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Result name */}
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: T.dim }}>Result Dataset Name</label>
          <input
            value={resultName}
            onChange={(e) => setResultName(e.target.value)}
            placeholder={defaultResultName || "Enter a name…"}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        {/* Error / success */}
        {error && (
          <div
            className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
            style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div
            className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
            style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)", color: "#10b981" }}
          >
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            {success}
          </div>
        )}

        {/* Preview result */}
        {preview && (
          <div
            className="rounded-xl border p-3"
            style={{ background: T.s2, borderColor: T.border }}
          >
            <p className="mb-2 text-xs font-semibold" style={{ color: T.dim }}>
              Preview — {preview.rows.length.toLocaleString()} rows · {preview.columns.length} columns
            </p>
            <div className="overflow-auto rounded-lg">
              <table className="min-w-full text-xs">
                <thead>
                  <tr style={{ background: T.s3 }}>
                    {preview.columns.map((c) => (
                      <th
                        key={c}
                        className="border-b px-3 py-2 text-left font-medium truncate max-w-[120px]"
                        style={{ borderColor: T.border, color: T.dim }}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : T.s3 }}>
                      {preview.columns.map((c) => (
                        <td
                          key={c}
                          className="border-b px-3 py-1.5 truncate max-w-[120px]"
                          style={{ borderColor: T.border, color: T.muted }}
                        >
                          {String(row[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handlePreview}
            className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ background: T.s2, borderColor: T.border, color: T.dim }}
          >
            Preview
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{ background: T.accent, color: "#000" }}
          >
            <Play size={13} /> Create Join Dataset
          </button>
        </div>
      </div>
    </div>
  );
}
