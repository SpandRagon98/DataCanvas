import { useEffect, useMemo, useRef, useState } from "react";
import { listFunctions } from "../../utils/dax";
import { useTheme } from "../../styles/theme";

/**
 * DaxEditor — lightweight syntax-highlighting editor for DAX formulas.
 *
 * Implementation: a transparent textarea layered over a pre-block that
 * renders the same text with highlight spans. They share identical font,
 * padding, and line-height so the caret in the textarea visually lines
 * up with the highlighted text behind it.
 *
 * Autocomplete: when the user types A-Z characters, we show a function
 * menu filtered by the prefix. ↑/↓ navigates, Tab/Enter inserts.
 */

const KEYWORDS = new Set(["TRUE", "FALSE", "BLANK", "NULL"]);
const FN_NAMES = listFunctions().map((f) => f.name);
const FN_SET   = new Set(FN_NAMES);

/* ---------- Tokeniser for highlighting only (cheap, regex-based) ---------- */
function highlight(src, T) {
  if (!src) return [];
  // Strip optional leading "=" (Power BI style) before highlighting
  src = src.replace(/^=\s*/, "");
  const out = [];
  let i = 0;
  const n = src.length;

  const push = (text, color, italic = false) =>
    out.push({ text, color, italic });

  while (i < n) {
    const c = src[i];

    // Newline
    if (c === "\n") { push("\n", T.text); i++; continue; }
    // Whitespace
    if (/\s/.test(c)) { push(c, T.text); i++; continue; }

    // Line comments
    if ((c === "/" && src[i + 1] === "/") || (c === "-" && src[i + 1] === "-")) {
      let j = i;
      while (j < n && src[j] !== "\n") j++;
      push(src.slice(i, j), T.muted, true);
      i = j;
      continue;
    }

    // String
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, n);
      push(src.slice(i, j), "#34d399"); // green
      i = j;
      continue;
    }

    // Bracketed
    if (c === "[") {
      let j = i + 1;
      while (j < n && src[j] !== "]") j++;
      j = Math.min(j + 1, n);
      push(src.slice(i, j), "#60a5fa"); // blue
      i = j;
      continue;
    }

    // Quoted identifier
    if (c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== "'") j++;
      j = Math.min(j + 1, n);
      push(src.slice(i, j), "#60a5fa");
      i = j;
      continue;
    }

    // Number
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1]))) {
      let j = i;
      while (j < n && /[0-9.eE+\-]/.test(src[j])) {
        // Avoid swallowing unary signs accidentally
        if ((src[j] === "+" || src[j] === "-") && src[j - 1] !== "e" && src[j - 1] !== "E") break;
        j++;
      }
      push(src.slice(i, j), "var(--dc-accent)"); // amber
      i = j;
      continue;
    }

    // Identifier (function name or keyword)
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const upper = word.toUpperCase();
      let color = T.text;
      let italic = false;
      if (FN_SET.has(upper)) color = "#a78bfa"; // purple — function
      else if (KEYWORDS.has(upper)) { color = "#f87171"; italic = true; } // red
      push(word, color, italic);
      i = j;
      continue;
    }

    // Operators
    if ("()+-*/<>=&|,".includes(c)) {
      push(c, "var(--dc-accent)");
      i++;
      continue;
    }

    push(c, T.text);
    i++;
  }
  return out;
}

/* ---------- Component ---------- */
export default function DaxEditor({
  value = "",
  onChange,
  placeholder = "= SUM ( Sales[Revenue] )",
  minRows = 6,
}) {
  const T = useTheme();
  const taRef    = useRef(null);
  const preRef   = useRef(null);
  const [focus,    setFocus]   = useState(false);
  const [acState,  setAcState] = useState(null); // { prefix, options, selected, anchor }

  /* Highlight cached per render */
  const tokens = useMemo(() => highlight(value, T), [value, T]);

  /* Sync scroll between textarea and highlight overlay */
  const syncScroll = () => {
    if (taRef.current && preRef.current) {
      preRef.current.scrollTop  = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  /* Detect identifier prefix at caret for autocomplete */
  const detectAutocomplete = () => {
    const el = taRef.current;
    if (!el) return null;
    const caret = el.selectionStart;
    if (caret !== el.selectionEnd) return null;
    const before = value.slice(0, caret);
    const match = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(before);
    if (!match) return null;
    const prefix = match[1];
    if (prefix.length < 1) return null;
    // Skip if last char before prefix is `[` (column ref)
    const charBefore = before[before.length - prefix.length - 1];
    if (charBefore === "[" || charBefore === "'") return null;
    const ups = prefix.toUpperCase();
    const options = FN_NAMES.filter((f) => f.startsWith(ups)).slice(0, 10);
    if (!options.length) return null;
    return { prefix, options, selected: 0, anchor: caret - prefix.length };
  };

  /* Refresh AC after each change/cursor move */
  useEffect(() => {
    if (!focus) return;
    setAcState(detectAutocomplete());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focus]);

  const insertAt = (str, start, end) => {
    return value.slice(0, start) + str + value.slice(end);
  };

  const acceptCompletion = () => {
    if (!acState || !taRef.current) return;
    const fnName = acState.options[acState.selected];
    const newText = insertAt(fnName + "(", acState.anchor, taRef.current.selectionStart);
    onChange?.(newText);
    setAcState(null);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      const caret = acState.anchor + fnName.length + 1;
      taRef.current.selectionStart = taRef.current.selectionEnd = caret;
      taRef.current.focus();
    });
  };

  const onKeyDown = (e) => {
    if (acState) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAcState({ ...acState, selected: (acState.selected + 1) % acState.options.length });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAcState({ ...acState, selected: (acState.selected - 1 + acState.options.length) % acState.options.length });
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && acState)) {
        e.preventDefault();
        acceptCompletion();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAcState(null);
        return;
      }
    }
    // Tab → insert 2 spaces (not in AC)
    if (e.key === "Tab" && !acState) {
      e.preventDefault();
      const el = taRef.current;
      const start = el.selectionStart, end = el.selectionEnd;
      const next = insertAt("  ", start, end);
      onChange?.(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
    // Smart brackets
    if (e.key === "(") {
      e.preventDefault();
      const el = taRef.current;
      const start = el.selectionStart, end = el.selectionEnd;
      const sel = value.slice(start, end);
      const next = insertAt(`(${sel})`, start, end);
      onChange?.(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 1 + sel.length;
      });
    }
  };

  /* Common font & padding for textarea + overlay */
  const sharedStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, "Menlo", "Consolas", monospace',
    fontSize:   13,
    lineHeight: "1.55",
    padding:    "12px 14px",
    tabSize:    2,
    whiteSpace: "pre-wrap",
    wordBreak:  "break-word",
  };

  const minHeight = minRows * 1.55 * 13 + 24; // rough

  return (
    <div
      className="relative rounded-xl border overflow-hidden"
      style={{
        background: T.s2,
        borderColor: focus ? T.accent : T.border,
        transition: "border-color 120ms",
        minHeight,
      }}
    >
      {/* Highlight overlay */}
      <pre
        ref={preRef}
        aria-hidden="true"
        style={{
          ...sharedStyle,
          margin: 0,
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          color: T.text,
        }}
      >
        {tokens.map((t, i) => (
          <span key={i} style={{ color: t.color, fontStyle: t.italic ? "italic" : "normal" }}>
            {t.text}
          </span>
        ))}
        {/* Trailing newline to avoid clipping the last line */}
        {value.endsWith("\n") || value === "" ? " " : ""}
      </pre>

      {/* Textarea (caret only, transparent text) */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); setTimeout(() => setAcState(null), 100); }}
        onSelect={() => requestAnimationFrame(() => setAcState(detectAutocomplete()))}
        placeholder={placeholder}
        spellCheck={false}
        style={{
          ...sharedStyle,
          width: "100%",
          minHeight,
          background: "transparent",
          color: "transparent",
          caretColor: T.text,
          border: "none",
          outline: "none",
          resize: "vertical",
          position: "relative",
          zIndex: 1,
        }}
      />

      {/* Autocomplete popup */}
      {acState && (
        <div
          className="absolute z-10 rounded-xl border shadow-xl"
          style={{
            background: T.surface,
            borderColor: T.border,
            top: 38,
            left: 14,
            minWidth: 220,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {acState.options.map((opt, i) => (
            <button
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); }}
              onClick={() => { setAcState({ ...acState, selected: i }); acceptCompletion(); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-left transition"
              style={{
                background: i === acState.selected ? T.accent + "22" : "transparent",
                color: i === acState.selected ? T.accent : T.text,
              }}
            >
              <span style={{ fontFamily: "monospace", fontSize: 11.5 }}>{opt}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 9.5, color: T.muted }}>fn</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
