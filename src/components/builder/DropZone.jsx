import { useState } from "react";
import { useTheme } from "../../styles/theme";

export default function DropZone({ label, value, onDropField, onRemoveField }) {
  const T = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const field = e.dataTransfer.getData("fieldName");
    if (field) onDropField(field);
  };

  const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`min-h-[68px] rounded-xl border-2 border-dashed p-2.5 transition ${isDragOver ? "drop-active" : ""}`}
      style={{
        borderColor: isDragOver ? undefined : hasValue ? T.accent : T.border,
        background: isDragOver ? undefined : hasValue ? "rgba(20,184,166,0.04)" : T.s2,
      }}
    >
      {/* Label */}
      <div
        className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: isDragOver ? "#14b8a6" : hasValue ? T.accent : T.muted }}
      >
        {label}
      </div>

      {/* Value chips */}
      <div className="text-sm">
        {Array.isArray(value) ? (
          value.length ? (
            <div className="flex flex-wrap gap-1.5">
              {value.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] font-medium"
                  style={{
                    background: T.surface,
                    borderColor: T.border,
                    color: T.text,
                  }}
                >
                  {v}
                  {onRemoveField && (
                    <button
                      type="button"
                      onClick={() => onRemoveField(v)}
                      className="opacity-50 hover:opacity-100 transition-opacity"
                      style={{ color: T.muted, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px]" style={{ color: T.dim }}>
              {isDragOver ? "Release to drop" : "Drop field here"}
            </span>
          )
        ) : value ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] font-medium"
            style={{
              background: T.surface,
              borderColor: T.border,
              color: T.text,
            }}
          >
            {value}
            {onRemoveField && (
              <button
                type="button"
                onClick={() => onRemoveField(value)}
                className="opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: T.muted, lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: T.dim }}>
            {isDragOver ? "Release to drop" : "Drop field here"}
          </span>
        )}
      </div>
    </div>
  );
}
