/**
 * One-off icon generator: renders premium PNG app icons from the Vizora mark.
 * Run: node scripts/gen-icons.mjs   (requires sharp, dev-only)
 *
 * Produces transparent-friendly tab favicons + app-store-style rounded icons
 * for PWA / taskbar / Apple touch.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });

// Inner artwork of the Vizora mark (matches public/vizora-logo.svg)
const ART = `
  <defs>
    <linearGradient id="vBlade" x1="72" y1="78" x2="300" y2="432" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2563eb"/><stop offset="1" stop-color="#0891b2"/>
    </linearGradient>
    <linearGradient id="vBars" x1="296" y1="120" x2="444" y2="400" gradientUnits="userSpaceOnUse">
      <stop stop-color="#22d3ee"/><stop offset="1" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <path d="M72 78 H168 L300 432 H236 Z" fill="url(#vBlade)"/>
  <rect x="296" y="250" width="40" height="150" rx="8" fill="url(#vBars)"/>
  <rect x="350" y="195" width="40" height="205" rx="8" fill="url(#vBars)"/>
  <rect x="404" y="140" width="40" height="260" rx="8" fill="url(#vBars)"/>
  <polyline points="316,232 370,177 424,122" stroke="#1d4ed8" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="316" cy="232" r="16" fill="#2563eb"/>
  <circle cx="370" cy="177" r="16" fill="#0ea5e9"/>
  <circle cx="424" cy="122" r="16" fill="#14b8a6"/>
`;

// App-icon style: rounded white tile + centered logo (good on any taskbar/dock)
function tileSVG(size, { bg = "#ffffff", radius = 0.22, pad = 0.18, fullBleed = false } = {}) {
  const r = Math.round(size * radius);
  const inner = fullBleed ? size : size * (1 - pad * 2);
  const offset = (size - inner) / 2;
  const scale = inner / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${bg}"/>` : ""}
    <g transform="translate(${offset} ${offset}) scale(${scale})">${ART}</g>
  </svg>`;
}

// Transparent favicon (logo only, slight pad)
function bareSVG(size, pad = 0.06) {
  const inner = size * (1 - pad * 2);
  const offset = (size - inner) / 2;
  const scale = inner / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <g transform="translate(${offset} ${offset}) scale(${scale})">${ART}</g>
  </svg>`;
}

const jobs = [
  ["public/favicon-32.png",          bareSVG(32)],
  ["public/favicon-16.png",          bareSVG(16)],
  ["public/icon-192.png",            tileSVG(192)],
  ["public/icon-512.png",            tileSVG(512)],
  ["public/icon-maskable-512.png",   tileSVG(512, { pad: 0.0, fullBleed: false, radius: 0, bg: "#ffffff" })],
  ["public/apple-touch-icon.png",    tileSVG(180, { radius: 0, bg: "#ffffff" })],
];

for (const [out, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}
console.log("done");
