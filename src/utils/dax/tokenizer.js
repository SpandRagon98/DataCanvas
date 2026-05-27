/**
 * tokenizer.js — DAX lexer.
 *
 * Produces a flat token stream that the parser consumes.
 * Handles bracketed identifiers ([Column Name]), quoted table names
 * ('My Table'), strings, numbers, operators, and DAX keywords.
 */

export const T = {
  NUMBER:        "NUMBER",
  STRING:        "STRING",
  IDENT:         "IDENT",         // bare identifier (function or table name)
  BRACKETED:     "BRACKETED",     // [Column Name] or [Measure Name]
  QUOTED_IDENT:  "QUOTED_IDENT",  // 'Table Name'
  LPAREN:        "LPAREN",
  RPAREN:        "RPAREN",
  COMMA:         "COMMA",
  DOT:           "DOT",
  PLUS:          "PLUS",
  MINUS:         "MINUS",
  STAR:          "STAR",
  SLASH:         "SLASH",
  AMP:           "AMP",            // string concat (&)
  EQ:            "EQ",             // =
  NEQ:           "NEQ",            // <>
  LT:            "LT",
  GT:            "GT",
  LTE:           "LTE",
  GTE:           "GTE",
  AND:           "AND",            // &&
  OR:            "OR",             // ||
  EOF:           "EOF",
};

export class DAXError extends Error {
  constructor(message, pos = -1) {
    super(message);
    this.name = "DAXError";
    this.pos = pos;
  }
}

const isDigit  = (c) => c >= "0" && c <= "9";
const isAlpha  = (c) => (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
const isAlnum  = (c) => isAlpha(c) || isDigit(c);
const isWS     = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";

export function tokenize(source) {
  const tokens = [];
  const s = String(source ?? "");
  const n = s.length;
  let i = 0;

  while (i < n) {
    const c = s[i];

    // ── Whitespace ──
    if (isWS(c)) { i++; continue; }

    // ── Line comment ──  // and --
    if ((c === "/" && s[i + 1] === "/") || (c === "-" && s[i + 1] === "-")) {
      while (i < n && s[i] !== "\n") i++;
      continue;
    }

    // ── Number ──
    if (isDigit(c) || (c === "." && isDigit(s[i + 1]))) {
      const start = i;
      while (i < n && isDigit(s[i])) i++;
      if (s[i] === ".") {
        i++;
        while (i < n && isDigit(s[i])) i++;
      }
      if (s[i] === "e" || s[i] === "E") {
        i++;
        if (s[i] === "+" || s[i] === "-") i++;
        while (i < n && isDigit(s[i])) i++;
      }
      tokens.push({ type: T.NUMBER, value: parseFloat(s.slice(start, i)), pos: start });
      continue;
    }

    // ── String literal ──  "text"
    if (c === '"') {
      const start = i;
      i++;
      let str = "";
      while (i < n && s[i] !== '"') {
        if (s[i] === "\\" && i + 1 < n) {
          const nx = s[i + 1];
          str += nx === "n" ? "\n"
              :  nx === "t" ? "\t"
              :  nx === "r" ? "\r"
              :  nx;
          i += 2;
        } else {
          str += s[i++];
        }
      }
      if (i >= n) throw new DAXError("Unterminated string literal", start);
      i++; // closing "
      tokens.push({ type: T.STRING, value: str, pos: start });
      continue;
    }

    // ── Bracketed identifier ──  [Column Name]
    if (c === "[") {
      const start = i;
      i++;
      let name = "";
      while (i < n && s[i] !== "]") {
        name += s[i++];
      }
      if (i >= n) throw new DAXError("Unterminated bracket reference", start);
      i++; // closing ]
      tokens.push({ type: T.BRACKETED, value: name.trim(), pos: start });
      continue;
    }

    // ── Quoted identifier ──  'Table Name'
    if (c === "'") {
      const start = i;
      i++;
      let name = "";
      while (i < n && s[i] !== "'") {
        name += s[i++];
      }
      if (i >= n) throw new DAXError("Unterminated quoted identifier", start);
      i++; // closing '
      tokens.push({ type: T.QUOTED_IDENT, value: name, pos: start });
      continue;
    }

    // ── Identifier / keyword ──
    if (isAlpha(c)) {
      const start = i;
      while (i < n && isAlnum(s[i])) i++;
      tokens.push({ type: T.IDENT, value: s.slice(start, i), pos: start });
      continue;
    }

    // ── Two-character operators ──
    if (c === "<" && s[i + 1] === ">") { tokens.push({ type: T.NEQ, pos: i }); i += 2; continue; }
    if (c === "<" && s[i + 1] === "=") { tokens.push({ type: T.LTE, pos: i }); i += 2; continue; }
    if (c === ">" && s[i + 1] === "=") { tokens.push({ type: T.GTE, pos: i }); i += 2; continue; }
    if (c === "&" && s[i + 1] === "&") { tokens.push({ type: T.AND, pos: i }); i += 2; continue; }
    if (c === "|" && s[i + 1] === "|") { tokens.push({ type: T.OR,  pos: i }); i += 2; continue; }

    // ── Single-character operators ──
    const map = {
      "(": T.LPAREN, ")": T.RPAREN,
      ",": T.COMMA,  ".": T.DOT,
      "+": T.PLUS,   "-": T.MINUS,
      "*": T.STAR,   "/": T.SLASH,
      "&": T.AMP,    "=": T.EQ,
      "<": T.LT,     ">": T.GT,
    };
    if (map[c]) {
      tokens.push({ type: map[c], pos: i });
      i++;
      continue;
    }

    throw new DAXError(`Unexpected character '${c}'`, i);
  }

  tokens.push({ type: T.EOF, pos: i });
  return tokens;
}
