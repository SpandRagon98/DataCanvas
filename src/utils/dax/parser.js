/**
 * parser.js — DAX recursive-descent parser.
 *
 * Grammar (operator-precedence ascending):
 *   expr        : logicalOr
 *   logicalOr   : logicalAnd ( '||' logicalAnd )*
 *   logicalAnd  : comparison ( '&&' comparison )*
 *   comparison  : concat ( ('=' | '<>' | '<' | '>' | '<=' | '>=') concat )?
 *   concat      : addition ( '&' addition )*
 *   addition    : multiplication ( ('+' | '-') multiplication )*
 *   multiplication : unary ( ('*' | '/') unary )*
 *   unary       : '-' unary | primary
 *   primary     : NUMBER | STRING | '(' expr ')'
 *               | IDENT '(' args? ')'                    (function call)
 *               | (IDENT | QUOTED_IDENT) BRACKETED       (Table[Col])
 *               | BRACKETED                              (bare column or measure ref)
 *               | IDENT                                  (TRUE / FALSE / BLANK)
 */

import { tokenize, T, DAXError } from "./tokenizer.js";

// AST node helpers
const NumNode    = (value)              => ({ type: "number", value });
const StrNode    = (value)              => ({ type: "string", value });
const BoolNode   = (value)              => ({ type: "bool", value });
const BlankNode  = ()                   => ({ type: "blank" });
const RefNode    = (name, pos)          => ({ type: "ref", name, pos });
const ColRefNode = (table, column, pos) => ({ type: "colref", table, column, pos });
const CallNode   = (name, args, pos)    => ({ type: "call", name, args, pos });
const BinopNode  = (op, left, right)    => ({ type: "binop", op, left, right });
const UnaryNode  = (op, operand)        => ({ type: "unaryop", op, operand });

export function parse(source) {
  const tokens = tokenize(source);
  let pos = 0;

  const peek    = () => tokens[pos];
  const peekAt  = (n) => tokens[pos + n];
  const eat     = () => tokens[pos++];
  const at      = (type) => peek().type === type;
  const expect  = (type, msg) => {
    const t = peek();
    if (t.type !== type) {
      throw new DAXError(`Expected ${msg ?? type} but got ${t.type}`, t.pos);
    }
    return eat();
  };

  // ── expr ──
  function parseExpr() {
    return parseLogicalOr();
  }

  function parseLogicalOr() {
    let left = parseLogicalAnd();
    while (at(T.OR)) {
      eat();
      const right = parseLogicalAnd();
      left = BinopNode("OR", left, right);
    }
    return left;
  }

  function parseLogicalAnd() {
    let left = parseComparison();
    while (at(T.AND)) {
      eat();
      const right = parseComparison();
      left = BinopNode("AND", left, right);
    }
    return left;
  }

  function parseComparison() {
    let left = parseConcat();
    if ([T.EQ, T.NEQ, T.LT, T.GT, T.LTE, T.GTE].includes(peek().type)) {
      const op = eat().type;
      const right = parseConcat();
      return BinopNode(op, left, right);
    }
    return left;
  }

  function parseConcat() {
    let left = parseAddition();
    while (at(T.AMP)) {
      eat();
      const right = parseAddition();
      left = BinopNode("AMP", left, right);
    }
    return left;
  }

  function parseAddition() {
    let left = parseMultiplication();
    while (at(T.PLUS) || at(T.MINUS)) {
      const op = eat().type;
      const right = parseMultiplication();
      left = BinopNode(op, left, right);
    }
    return left;
  }

  function parseMultiplication() {
    let left = parseUnary();
    while (at(T.STAR) || at(T.SLASH)) {
      const op = eat().type;
      const right = parseUnary();
      left = BinopNode(op, left, right);
    }
    return left;
  }

  function parseUnary() {
    if (at(T.MINUS)) {
      eat();
      return UnaryNode("NEG", parseUnary());
    }
    if (at(T.PLUS)) {
      eat();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();

    if (tok.type === T.NUMBER) { eat(); return NumNode(tok.value); }
    if (tok.type === T.STRING) { eat(); return StrNode(tok.value); }

    if (tok.type === T.LPAREN) {
      eat();
      const e = parseExpr();
      expect(T.RPAREN, "')'");
      return e;
    }

    // Bracketed reference — column or measure
    if (tok.type === T.BRACKETED) {
      eat();
      return RefNode(tok.value, tok.pos);
    }

    // Identifier — function call, Table[Col], or keyword
    if (tok.type === T.IDENT || tok.type === T.QUOTED_IDENT) {
      const ident = eat();

      // Function call?
      if (at(T.LPAREN)) {
        eat();
        const args = [];
        if (!at(T.RPAREN)) {
          args.push(parseExpr());
          while (at(T.COMMA)) {
            eat();
            args.push(parseExpr());
          }
        }
        expect(T.RPAREN, "')'");
        return CallNode(ident.value.toUpperCase(), args, ident.pos);
      }

      // Table[Column]?
      if (at(T.BRACKETED)) {
        const col = eat();
        return ColRefNode(ident.value, col.value, ident.pos);
      }

      // Bare keyword
      const upper = ident.value.toUpperCase();
      if (upper === "TRUE")  return BoolNode(true);
      if (upper === "FALSE") return BoolNode(false);
      if (upper === "BLANK") return BlankNode();
      if (upper === "NULL")  return BlankNode();

      throw new DAXError(`Unexpected identifier '${ident.value}'`, ident.pos);
    }

    throw new DAXError(`Unexpected token: ${tok.type}`, tok.pos);
  }

  // ── Entry point ──
  const ast = parseExpr();
  if (peek().type !== T.EOF) {
    throw new DAXError(`Unexpected token after expression: ${peek().type}`, peek().pos);
  }
  return ast;
}

/**
 * Walk the AST and call `visitor(node)` for every node.
 * Useful for extracting referenced columns/measures.
 */
export function walk(node, visitor) {
  visitor(node);
  switch (node.type) {
    case "binop":   walk(node.left,    visitor); walk(node.right, visitor); break;
    case "unaryop": walk(node.operand, visitor); break;
    case "call":    for (const a of node.args) walk(a, visitor); break;
    default: break;
  }
}

/**
 * Extract the set of column names and bare measure references in a formula.
 */
export function extractReferences(ast) {
  const cols     = new Set();
  const refs     = new Set();   // bare [Name] — could be column or measure
  const calls    = new Set();
  walk(ast, (n) => {
    if (n.type === "colref")  cols.add(n.column);
    if (n.type === "ref")     refs.add(n.name);
    if (n.type === "call")    calls.add(n.name);
  });
  return { columnRefs: [...cols], bareRefs: [...refs], functions: [...calls] };
}
