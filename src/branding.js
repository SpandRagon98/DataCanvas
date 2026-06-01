/**
 * branding.js — centralized brand tokens for Vizora.
 *
 * Keep all user-facing brand values here so a future rebrand is a one-file change.
 * Theme color tokens live in styles/theme.js (accent === BRAND_PRIMARY).
 */

export const APP_NAME    = "Vizora";
export const APP_TAGLINE = "BI Workspace";
export const APP_VERSION = "v7.0";

// Public asset (served from /public)
export const LOGO_SRC = "/vizora-logo.svg";
export const FAVICON_SRC = "/vizora-logo.svg";

// Brand palette (sea-green / teal). Mirrors theme.accent.
export const BRAND_PRIMARY       = "#14b8a6";
export const BRAND_PRIMARY_HOVER = "#2dd4bf";
export const BRAND_PRIMARY_RGB   = "20,184,166";
