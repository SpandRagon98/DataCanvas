/**
 * useComputeWorker — React hook wrapping the compute Web Worker.
 *
 * Creates a shared singleton worker. Requests are dispatched via
 * unique IDs with Promise-based responses so callers use async/await.
 *
 * Falls back gracefully: if Workers are unavailable (SSR, old browser, error)
 * sendRequest rejects and the caller should catch + fall back to main-thread JS.
 */

import { useCallback, useEffect, useRef } from "react";

// ── Shared worker singleton ────────────────────────────────────────────────

let _worker    = null;
let _pendingMap = new Map(); // id → { resolve, reject }
let _reqCounter = 0;
let _workerFailed = false;

function getWorker() {
  if (_workerFailed) return null;
  if (_worker) return _worker;

  try {
    _worker = new Worker(
      new URL("../workers/compute.worker.js", import.meta.url),
      { type: "module" }
    );

    _worker.onmessage = ({ data }) => {
      const pending = _pendingMap.get(data.id);
      if (!pending) return;
      _pendingMap.delete(data.id);
      if (data.ok) pending.resolve(data.result);
      else pending.reject(new Error(data.error));
    };

    _worker.onerror = (err) => {
      console.warn("[ComputeWorker] Error:", err.message);
      // Reject all pending and mark worker as failed
      for (const { reject } of _pendingMap.values()) {
        reject(new Error("Worker error: " + err.message));
      }
      _pendingMap.clear();
      _worker = null;
      _workerFailed = true;
    };

    return _worker;
  } catch (e) {
    console.warn("[ComputeWorker] Could not create worker:", e.message);
    _workerFailed = true;
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Returns { sendRequest } where:
 *   sendRequest(type, payload) → Promise<result>
 *
 * Rejects if the worker is unavailable.
 */
export function useComputeWorker() {
  const sendRequest = useCallback((type, payload) => {
    return new Promise((resolve, reject) => {
      const worker = getWorker();
      if (!worker) {
        reject(new Error("Compute worker unavailable"));
        return;
      }
      const id = ++_reqCounter;
      _pendingMap.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
    });
  }, []);

  return { sendRequest };
}

/** Rows above this threshold use the compute worker for post-processing. */
export const WORKER_THRESHOLD = 2000;
