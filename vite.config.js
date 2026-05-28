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

  // Dev proxy — forwards /api/ai requests to the Vercel serverless function
  // or a local Express server running on port 3001 during development.
  server: {
    proxy: {
      '/api/ai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
