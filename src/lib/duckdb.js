/**
 * DuckDB-WASM lazy singleton.
 *
 * Loads from jsDelivr CDN on first use (bundle selection is automatic —
 * EH for modern browsers, MVP fallback for older ones).
 * If init fails (offline / CORS / unsupported browser) every exported
 * function returns null/false — the app falls back to the JS engine.
 *
 * Usage:
 *   const ok = await getDuckDB();
 *   if (ok) {
 *     await loadTable('sales', rows);
 *     const data = await queryRows(`SELECT region, SUM(revenue) FROM sales GROUP BY region`);
 *   }
 */

/** Rows above this threshold use DuckDB; smaller datasets use the JS engine. */
export const DUCKDB_THRESHOLD = 5000;

let _db   = null;
let _conn = null;
let _available = null; // null=unknown, true=ready, false=unavailable
let _initPromise = null;

export const isDuckDBAvailable = () => _available === true;

// CDN URL — loaded at runtime so Rollup never tries to bundle it.
// Using /* @vite-ignore */ prevents both the static-analysis error and the
// "unresolved import" fatal warning in production builds.
const _DUCKDB_CDN =
  "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";

async function _init() {
  // eslint-disable-next-line import/no-unresolved
  const duckdb = await import(/* @vite-ignore */ _DUCKDB_CDN);
  const bundles = duckdb.getJsDelivrBundles();
  const bundle  = await duckdb.selectBundle(bundles);

  // Create a blob-URL worker so the cross-origin CDN worker script loads
  const workerBlob = new Blob(
    [`importScripts("${bundle.mainWorker}");`],
    { type: "text/javascript" }
  );
  const workerUrl = URL.createObjectURL(workerBlob);
  const worker = new Worker(workerUrl);

  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  _db = new duckdb.AsyncDuckDB(logger, worker);
  await _db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);
  _conn = await _db.connect();

  URL.revokeObjectURL(workerUrl);
  _available = true;
  console.info(
    `[DuckDB] Ready — ${bundle.mainModule.includes("-eh.") ? "EH" : "MVP"} bundle`
  );
}

/** Returns { db, conn } once ready, or null on failure. */
export async function getDuckDB() {
  if (_available === false) return null;
  if (_available === true && _db && _conn) return { db: _db, conn: _conn };
  if (!_initPromise) {
    _initPromise = _init().catch((e) => {
      console.info("[DuckDB] Unavailable, using JS engine:", e.message);
      _available = false;
      _db = null;
      _conn = null;
      _initPromise = null; // allow retry on next call
    });
  }
  await _initPromise;
  return _available ? { db: _db, conn: _conn } : null;
}

// ── Table management ───────────────────────────────────────────────────────

/** Tracks the data generation that was last loaded. */
let _loadedHash = null;

/** Quick structural hash to detect data changes. */
export function hashRows(rows) {
  if (!rows?.length) return "empty";
  return `${rows.length}:${JSON.stringify(rows[0])}:${JSON.stringify(rows[rows.length - 1])}`;
}

/**
 * Load an array of row objects into a DuckDB table.
 * Uses CSV for maximum loading speed.
 * Returns true on success, false on failure.
 */
export async function loadTable(tableName, rows) {
  if (!rows?.length) return false;
  const ddb = await getDuckDB();
  if (!ddb) return false;

  const { db, conn } = ddb;

  try {
    const cols = Object.keys(rows[0]);

    // Build CSV: header + rows
    const lines = [
      cols.map((c) => JSON.stringify(c)).join(","),
      ...rows.map((r) =>
        cols
          .map((c) => {
            const v = r[c];
            if (v === null || v === undefined) return "";
            if (typeof v === "string") {
              // Escape quotes, wrap in quotes if contains comma/quote/newline
              const s = v.replace(/"/g, '""');
              return /[,"\n]/.test(s) ? `"${s}"` : s;
            }
            return String(v);
          })
          .join(",")
      ),
    ];

    const csv = lines.join("\n");
    const buf = new TextEncoder().encode(csv);
    const fname = `${tableName}.csv`;

    await db.registerFileBuffer(fname, buf);
    await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
    await conn.query(
      `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fname}', header=true)`
    );
    return true;
  } catch (e) {
    console.warn("[DuckDB] loadTable error:", e.message);
    return false;
  }
}

/**
 * Run a SQL query against DuckDB.
 * Returns an array of plain JS objects, or null on failure.
 * BigInt values are coerced to Number.
 */
export async function queryRows(sql) {
  const ddb = await getDuckDB();
  if (!ddb) return null;
  try {
    const result = await ddb.conn.query(sql);
    return result.toArray().map((row) => {
      const obj = {};
      for (const field of result.schema.fields) {
        const v = row[field.name];
        obj[field.name] = typeof v === "bigint" ? Number(v) : v;
      }
      return obj;
    });
  } catch (e) {
    console.warn("[DuckDB] queryRows error:", e.message);
    return null;
  }
}

/** Convenience: returns row count for a table. */
export async function tableRowCount(tableName) {
  const rows = await queryRows(`SELECT COUNT(*) AS n FROM "${tableName}"`);
  return rows?.[0]?.n ?? 0;
}
