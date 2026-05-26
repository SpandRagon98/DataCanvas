import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',

  // DuckDB-WASM must not be pre-bundled by Vite — it manages its own WASM
  // loading and relies on dynamic imports at runtime.
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },

  // Enable module-type Web Workers (needed for compute.worker.js ES imports)
  worker: {
    format: 'es',
  },
})
