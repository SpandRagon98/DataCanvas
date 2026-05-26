import { useStore } from "../store/useStore";

const SHARED = {
  accent:       "#f59e0b",
  accentHover:  "#fbbf24",
  accentDim:    "rgba(245,158,11,0.10)",
  success:      "#10b981",
  error:        "#ef4444",
  blue:         "#60a5fa",
  purple:       "#a78bfa",

  radius:   "10px",
  radiusLg: "16px",
  radiusXl: "20px",

  mono: "'JetBrains Mono','Fira Code','SF Mono','Consolas',monospace",
  sans: "'Inter',system-ui,-apple-system,sans-serif",

  // Shadows
  shadowSm:  "0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)",
  shadow:    "0 2px 8px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.14)",
  shadowMd:  "0 4px 16px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.16)",
  shadowLg:  "0 12px 36px rgba(0,0,0,0.38), 0 4px 10px rgba(0,0,0,0.2)",
  shadowXl:  "0 24px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.28)",

  // Glow
  glowAccent: "0 0 0 1px rgba(245,158,11,0.16), 0 4px 20px rgba(245,158,11,0.12)",

  // Transitions
  transition:     "all 160ms cubic-bezier(0.16,1,0.3,1)",
  transitionFast: "all 120ms ease",
};

export const T_DARK = {
  ...SHARED,
  bg:               "#09090b",
  surface:          "#111113",
  sidebarBg:        "#0e0e10",
  s2:               "#18181b",
  s3:               "#1f1f23",
  s4:               "#27272a",
  border:           "#27272d",
  borderHover:      "#3f3f46",
  text:             "#e4e4ec",
  muted:            "#52525e",
  dim:              "#a1a1aa",
  scrollbarThumb:      "#2a2a30",
  scrollbarThumbHover: "#3f3f46",
  navBg: "rgba(14,14,16,0.92)",
};

export const T_LIGHT = {
  ...SHARED,
  bg:               "#f4f4f5",
  surface:          "#ffffff",
  sidebarBg:        "#f8f8f9",
  s2:               "#f3f4f6",
  s3:               "#e5e7eb",
  s4:               "#d1d5db",
  border:           "#e4e4e7",
  borderHover:      "#d4d4d8",
  text:             "#18181b",
  muted:            "#71717a",
  dim:              "#52525b",
  scrollbarThumb:      "#d4d4d8",
  scrollbarThumbHover: "#a1a1aa",
  navBg: "rgba(248,248,249,0.92)",

  // Lighter shadows for light mode
  shadowSm:  "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadow:    "0 2px 8px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
  shadowMd:  "0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
  shadowLg:  "0 12px 36px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.07)",
  shadowXl:  "0 24px 60px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.10)",
};

// Static fallback (for non-React modules that import `T` directly).
export const T = T_DARK;

export const CHART_COLORS = [
  "#f59e0b","#60a5fa","#10b981","#ef4444",
  "#a78bfa","#ec4899","#06b6d4","#84cc16",
];

export const COLOR_PALETTES = {
  default: ["#f59e0b","#60a5fa","#10b981","#ef4444","#a78bfa","#ec4899","#06b6d4","#84cc16"],
  ocean:   ["#0ea5e9","#22d3ee","#38bdf8","#0891b2","#7dd3fc","#0284c7","#67e8f9","#0e7490"],
  forest:  ["#10b981","#4ade80","#86efac","#059669","#16a34a","#84cc16","#65a30d","#15803d"],
  sunset:  ["#f97316","#ef4444","#f59e0b","#ec4899","#fb923c","#fbbf24","#f43f5e","#fcd34d"],
  pastel:  ["#c4b5fd","#93c5fd","#6ee7b7","#fca5a5","#fde68a","#fbcfe8","#a5f3fc","#bef264"],
};

export const PALETTE_LABELS = [
  { id: "default", label: "Default" },
  { id: "ocean",   label: "Ocean"   },
  { id: "forest",  label: "Forest"  },
  { id: "sunset",  label: "Sunset"  },
  { id: "pastel",  label: "Pastel"  },
];

export const getPalette = (name) => COLOR_PALETTES[name] || COLOR_PALETTES.default;

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

  root.style.setProperty("--dc-bg",                    t.bg);
  root.style.setProperty("--dc-surface",               t.surface);
  root.style.setProperty("--dc-s2",                    t.s2);
  root.style.setProperty("--dc-s3",                    t.s3);
  root.style.setProperty("--dc-border",                t.border);
  root.style.setProperty("--dc-text",                  t.text);
  root.style.setProperty("--dc-muted",                 t.muted);
  root.style.setProperty("--dc-dim",                   t.dim);
  root.style.setProperty("--dc-accent",                t.accent);
  root.style.setProperty("--dc-scrollbar-thumb",       t.scrollbarThumb);
  root.style.setProperty("--dc-scrollbar-thumb-hover", t.scrollbarThumbHover);

  root.setAttribute("data-theme", mode === "light" ? "light" : "dark");
}
