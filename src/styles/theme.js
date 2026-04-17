import { useStore } from "../store/useStore";

const SHARED = {
  accent: "#f59e0b",
  accentHover: "#fbbf24",
  accentDim: "rgba(245,158,11,0.12)",
  success: "#10b981",
  error: "#ef4444",
  blue: "#60a5fa",
  purple: "#a78bfa",
  radius: "10px",
  radiusLg: "14px",
  mono: "'Fira Code','SF Mono','Consolas',monospace",
  sans: "'DM Sans',system-ui,-apple-system,sans-serif",
};

export const T_DARK = {
  ...SHARED,
  bg: "#09090b",
  surface: "#111113",
  s2: "#18181b",
  s3: "#1f1f23",
  border: "#2a2a30",
  borderHover: "#3f3f46",
  text: "#e4e4ec",
  muted: "#52525e",
  dim: "#a1a1aa",
  scrollbarThumb: "#2a2a30",
  scrollbarThumbHover: "#3f3f46",
  navBg: "rgba(17,17,19,0.92)",
  navShadow: "0 25px 60px rgba(0,0,0,0.45)",
};

export const T_LIGHT = {
  ...SHARED,
  bg: "#f5f5f7",
  surface: "#ffffff",
  s2: "#f3f4f6",
  s3: "#e5e7eb",
  border: "#e4e4e7",
  borderHover: "#d4d4d8",
  text: "#18181b",
  muted: "#71717a",
  dim: "#52525b",
  scrollbarThumb: "#d4d4d8",
  scrollbarThumbHover: "#a1a1aa",
  navBg: "rgba(255,255,255,0.92)",
  navShadow: "0 18px 40px rgba(15,23,42,0.08)",
};

// Static fallback (kept for any non-React module that imports `T` directly).
export const T = T_DARK;

export const CHART_COLORS = [
  "#f59e0b",
  "#60a5fa",
  "#10b981",
  "#ef4444",
  "#a78bfa",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

export function getThemeObject(mode) {
  return mode === "light" ? T_LIGHT : T_DARK;
}

export function useTheme() {
  const mode = useStore((s) => s.themeMode);
  return getThemeObject(mode);
}

export function applyThemeToDocument(mode) {
  if (typeof document === "undefined") return;
  const t = getThemeObject(mode);
  const root = document.documentElement;

  root.style.setProperty("--dc-bg", t.bg);
  root.style.setProperty("--dc-surface", t.surface);
  root.style.setProperty("--dc-s2", t.s2);
  root.style.setProperty("--dc-s3", t.s3);
  root.style.setProperty("--dc-border", t.border);
  root.style.setProperty("--dc-text", t.text);
  root.style.setProperty("--dc-muted", t.muted);
  root.style.setProperty("--dc-dim", t.dim);
  root.style.setProperty("--dc-accent", t.accent);
  root.style.setProperty("--dc-scrollbar-thumb", t.scrollbarThumb);
  root.style.setProperty("--dc-scrollbar-thumb-hover", t.scrollbarThumbHover);

  root.setAttribute("data-theme", mode === "light" ? "light" : "dark");
}
