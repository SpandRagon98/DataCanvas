/**
 * aiClient.js — single entry point for all frontend AI calls.
 *
 * The frontend NEVER calls OpenAI/Claude directly.
 * All requests go through the backend endpoint at VITE_AI_API_BASE_URL.
 *
 * Environment variable:
 *   VITE_AI_API_BASE_URL — URL of the AI API endpoint (default: /api/ai)
 */

const AI_API_URL = import.meta.env.VITE_AI_API_BASE_URL || "/api/ai";

/** Whether AI features are available (URL is configured) */
export const AI_ENABLED = Boolean(AI_API_URL);

/**
 * Central AI call helper.
 *
 * @param {Object} params
 * @param {"formula"|"chart_recommendation"|"insights"|"nl_query"|"data_cleaning"|"forecast_explanation"} params.task
 * @param {Object} params.payload — task-specific data
 * @param {AbortSignal} [params.signal] — optional abort signal
 * @returns {Promise<string>} — raw AI response text
 */
export async function callAI({ task, payload, signal }) {
  if (!AI_ENABLED) throw new Error("AI features not configured.");

  const res = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, payload }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg  = body.error || `AI request failed (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();
  return data.result ?? "";
}

/**
 * Parse a JSON string defensively, stripping markdown fences if present.
 */
export function safeParseJSON(text) {
  let cleaned = text.trim();
  // Strip ```json ... ``` fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return { ok: true, data: JSON.parse(cleaned) };
  } catch (e) {
    return { ok: false, error: e.message, raw: text };
  }
}
