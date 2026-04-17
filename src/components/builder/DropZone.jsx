import { useTheme } from "../../styles/theme";

export default function DropZone({ label, value, onDropField, onRemoveField }) {
  const T = useTheme();

  const handleDrop = (e) => {
    e.preventDefault();
    const field = e.dataTransfer.getData("fieldName");
    if (field) onDropField(field);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="min-h-[84px] rounded-2xl border-2 border-dashed p-3 transition"
      style={{
        borderColor: T.border,
        background: T.s2,
      }}
    >
      <div
        className="mono text-xs font-semibold uppercase tracking-wide"
        style={{ color: T.muted }}
      >
        {label}
      </div>

      <div className="mt-3 text-sm">
        {Array.isArray(value) ? (
          value.length ? (
            <div className="flex flex-wrap gap-2">
              {value.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5"
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
                      className="text-sm"
                      style={{ color: T.muted }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ color: T.dim }}>Drop field here</span>
          )
        ) : value ? (
          <span
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5"
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
                className="text-sm"
                style={{ color: T.muted }}
              >
                ×
              </button>
            )}
          </span>
        ) : (
          <span style={{ color: T.dim }}>Drop field here</span>
        )}
      </div>
    </div>
  );
}
