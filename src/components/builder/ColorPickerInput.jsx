/**
 * ColorPickerInput — full color picker with:
 *   • Native browser color wheel (for gradient selection)
 *   • HEX text input with live preview
 *   • 20 preset swatches
 */
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../styles/theme";

const PRESETS = [
  "#ef4444","#f97316","var(--dc-accent)","#eab308","#84cc16",
  "#22c55e","#10b981","var(--dc-accent)","#06b6d4","#3b82f6",
  "#6366f1","#8b5cf6","#a855f7","#ec4899","#f43f5e",
  "#ffffff","#d1d5db","#9ca3af","#4b5563","#111827",
];

export default function ColorPickerInput({ value = "#ef4444", onChange, label, size = "sm" }) {
  const T = useTheme();
  const [open, setOpen]   = useState(false);
  const [hex,  setHex]    = useState(value);
  const containerRef      = useRef(null);

  /* sync prop → local state */
  useEffect(() => { setHex(value || "#ef4444"); }, [value]);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const commit = (raw) => {
    let clean = raw.trim();
    if (!clean.startsWith("#")) clean = "#" + clean;
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      setHex(clean);
      onChange?.(clean);
      return true;
    }
    return false;
  };

  const pick = (color) => { setHex(color); onChange?.(color); };

  const swatch = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <div className="relative inline-block" ref={containerRef}>
      {label && (
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: T.muted }}>
          {label}
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${swatch} flex items-center justify-center rounded-lg border-2 cursor-pointer transition hover:scale-105`}
        style={{ background: hex, borderColor: open ? T.accent : "rgba(255,255,255,0.2)" }}
        title={hex}
      />

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-[200] mt-1 rounded-xl border shadow-2xl p-3"
          style={{
            background: T.surface,
            borderColor: T.border,
            minWidth: 220,
            left: 0,
            top: "100%",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Native picker + HEX input side by side */}
          <div className="mb-3 flex items-center gap-2">
            <input
              type="color"
              value={hex}
              onChange={(e) => pick(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border p-0.5 shrink-0"
              style={{ background: T.s2, borderColor: T.border }}
              title="Open color wheel"
            />
            <div
              className="flex-1 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
              style={{ background: T.s2, borderColor: T.border }}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: hex }} />
              <input
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commit(e.target.value)}
                className="w-full bg-transparent text-xs mono outline-none"
                style={{ color: T.text }}
                placeholder="#000000"
                maxLength={7}
              />
            </div>
          </div>

          {/* Presets */}
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
            Presets
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pick(c)}
                className="h-6 w-6 rounded-md border-2 transition hover:scale-110 shrink-0"
                style={{
                  background: c,
                  borderColor: hex.toLowerCase() === c.toLowerCase() ? T.accent : "rgba(128,128,128,0.25)",
                }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
