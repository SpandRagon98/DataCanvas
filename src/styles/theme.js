import { useStore } from "../store/useStore";

// ── Accent palettes (user-selectable brand color) ─────────────────────────────
// `text` is the readable foreground used on a filled accent surface.
export const ACCENTS = {
  teal:   { hex: "#14b8a6", hover: "#2dd4bf", rgb: "20,184,166",  text: "#06302b" },
  orange: { hex: "#f59e0b", hover: "#fbbf24", rgb: "245,158,11",  text: "#1a1205" },
  blue:   { hex: "#3b82f6", hover: "#60a5fa", rgb: "59,130,246",  text: "#ffffff" },
  purple: { hex: "#8b5cf6", hover: "#a78bfa", rgb: "139,92,246",  text: "#ffffff" },
  green:  { hex: "#22c55e", hover: "#4ade80", rgb: "34,197,94",   text: "#06210f" },
  slate:  { hex: "#64748b", hover: "#94a3b8", rgb: "100,116,139", text: "#ffffff" },
};

// Options for the Settings → General → Theme Color picker (order shown in UI)
export const ACCENT_OPTIONS = [
  { id: "teal",   label: "Teal",   hex: ACCENTS.teal.hex },
  { id: "orange", label: "Orange", hex: ACCENTS.orange.hex },
  { id: "blue",   label: "Blue",   hex: ACCENTS.blue.hex },
  { id: "purple", label: "Purple", hex: ACCENTS.purple.hex },
  { id: "green",  label: "Green",  hex: ACCENTS.green.hex },
  { id: "slate",  label: "Slate",  hex: ACCENTS.slate.hex },
];

export const DEFAULT_ACCENT = "teal";

const SHARED = {
  // Defaults (teal) — overridden per selected accent by getThemeObject().
  accent:       "#14b8a6",
  accentHover:  "#2dd4bf",
  accentDim:    "rgba(20,184,166,0.10)",
  accentText:   "#06302b",
  accentRgb:    "20,184,166",
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
  glowAccent: "0 0 0 1px rgba(20,184,166,0.16), 0 4px 20px rgba(20,184,166,0.12)",

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
  // ── Glassmorphism-inspired light theme ──
  // Soft gradient background so the frosted sidebar glass actually shows depth
  bg:               "linear-gradient(145deg, #eef2f8 0%, #e6eaf2 100%)",
  bgSolid:          "#eef2f8",   // use where gradient won't work
  surface:          "#ffffff",
  // Semi-transparent sidebar to enable backdrop-filter blur
  sidebarBg:        "rgba(255,255,255,0.86)",
  s2:               "rgba(246,248,252,0.92)",
  s3:               "#eef1f7",
  s4:               "#e2e8f0",
  border:           "rgba(15,23,42,0.08)",
  borderHover:      "rgba(15,23,42,0.15)",
  text:             "#0f172a",
  muted:            "#64748b",
  dim:              "#475569",
  scrollbarThumb:      "#cbd5e1",
  scrollbarThumbHover: "#94a3b8",
  navBg: "rgba(255,255,255,0.92)",

  // Softer, premium shadows
  shadowSm:  "0 1px 4px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
  shadow:    "0 4px 14px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.05)",
  shadowMd:  "0 8px 28px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.06)",
  shadowLg:  "0 16px 48px rgba(15,23,42,0.11), 0 4px 14px rgba(15,23,42,0.06)",
  shadowXl:  "0 28px 72px rgba(15,23,42,0.14), 0 8px 24px rgba(15,23,42,0.08)",

  // Brighter glow for light mode
  glowAccent: "0 0 0 1px rgba(20,184,166,0.2), 0 4px 24px rgba(20,184,166,0.18)",
};

// Static fallback (for non-React modules that import `T` directly).
export const T = T_DARK;

export const CHART_COLORS = [
  "#14b8a6","#60a5fa","#10b981","#ef4444",
  "#a78bfa","#ec4899","#06b6d4","#84cc16",
];

export const COLOR_PALETTES = {
  default: ["#14b8a6","#60a5fa","#10b981","#ef4444","#a78bfa","#ec4899","#06b6d4","#84cc16"],
  ocean:   ["#0ea5e9","#22d3ee","#38bdf8","#0891b2","#7dd3fc","#0284c7","#67e8f9","#0e7490"],
  forest:  ["#10b981","#4ade80","#86efac","#059669","#16a34a","#84cc16","#65a30d","#15803d"],
  sunset:  ["#f97316","#ef4444","#fb923c","#ec4899","#fbbf24","#facc15","#f43f5e","#fcd34d"],
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

/**
 * Build the active theme object for a mode + selected accent.
 * Accent-derived fields (accent, accentHover, accentDim, accentText, glow)
 * are computed so a single setting recolors the whole app.
 */
export function getThemeObject(mode, accentId = DEFAULT_ACCENT) {
  const base = mode === "light" ? T_LIGHT : T_DARK;
  const a = ACCENTS[accentId] || ACCENTS[DEFAULT_ACCENT];
  const glowAlpha1 = mode === "light" ? 0.2  : 0.16;
  const glowAlpha2 = mode === "light" ? 0.18 : 0.12;
  return {
    ...base,
    accent:      a.hex,
    accentHover: a.hover,
    accentDim:   `rgba(${a.rgb},0.10)`,
    accentText:  a.text,
    accentRgb:   a.rgb,
    glowAccent:  `0 0 0 1px rgba(${a.rgb},${glowAlpha1}), 0 4px 20px rgba(${a.rgb},${glowAlpha2})`,
  };
}

export function useTheme() {
  const mode   = useStore((s) => s.themeMode);
  const accent = useStore((s) => s.themeAccent);
  return getThemeObject(mode, accent);
}

export function applyThemeToDocument(mode, accentId = DEFAULT_ACCENT) {
  if (typeof document === "undefined") return;
  const t = getThemeObject(mode, accentId);
  const a = ACCENTS[accentId] || ACCENTS[DEFAULT_ACCENT];
  const root = document.documentElement;

  root.style.setProperty("--dc-bg",                    t.bg);
  root.style.setProperty("--dc-surface",               t.surface);
  root.style.setProperty("--dc-s2",                    t.s2);
  root.style.setProperty("--dc-s3",                    t.s3);
  root.style.setProperty("--dc-border",                t.border);
  root.style.setProperty("--dc-text",                  t.text);
  root.style.setProperty("--dc-muted",                 t.muted);
  root.style.setProperty("--dc-dim",                   t.dim);
  root.style.setProperty("--dc-accent",                a.hex);
  root.style.setProperty("--dc-accent-hover",          a.hover);
  root.style.setProperty("--dc-accent-rgb",            a.rgb);
  root.style.setProperty("--dc-scrollbar-thumb",       t.scrollbarThumb);
  root.style.setProperty("--dc-scrollbar-thumb-hover", t.scrollbarThumbHover);

  root.setAttribute("data-theme", mode === "light" ? "light" : "dark");
}
