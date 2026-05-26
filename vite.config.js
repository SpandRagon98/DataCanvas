import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',

  // DuckDB-WASM is loaded from CDN at runtime via a dynamic import with
  // @vite-ignore — Rollup never sees it, so no bundling or resolution needed.
  // build.target must be 'esnext' to allow top-level await (used by DuckDB
  // internally) to survive the Rollup output without transformation errors.
  build: {
    target: 'esnext',
  },

  // Enable module-type Web Workers (needed for compute.worker.js ES imports)
  worker: {
    format: 'es',
  },
})
