/**
 * Safe expression compiler for spec-authored arithmetic.
 *
 * Expressions come from a language model, so this is a security boundary, not a utility. There is
 * no `eval`, no `new Function`, and no property access: we tokenise, parse to an AST, and compile
 * to a tree of closures. An identifier that isn't a declared variable or a whitelisted function
 * is a compile error — rejecting a strange expression is always correct, guessing never is.
 *
 * It also sits on the hot path: ~240 samples × up to 3 series, every frame. So the parse happens
 * once and returns a closure; `draw` only ever calls the closure.
 */

export type Scope = Record<string, number>;
export type Compiled = (scope: Scope) => number;

export class ExprError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = "ExprError";
  }
}

// ── Whitelists ────────────────────────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * These are `Map`s, not object literals, and that is deliberate.
 *
 * A plain object looked up by an untrusted key resolves through the prototype chain:
 * `CONSTANTS["constructor"]` returns `Object.prototype.constructor` — a function, not `undefined`
 * — so a `!== undefined` guard silently accepts it and the whitelist is bypassed. `Map` has no
 * such chain, so an unlisted key is always a miss. (Caught by the smoke test, which is why it
 * exists.)
 */
const FN1 = new Map<string, (a: number) => number>([
  ["abs", Math.abs], ["sqrt", Math.sqrt], ["cbrt", Math.cbrt], ["exp", Math.exp],
  ["log", Math.log], ["log2", Math.log2], ["log10", Math.log10],
  ["sin", Math.sin], ["cos", Math.cos], ["tan", Math.tan],
  ["asin", Math.asin], ["acos", Math.acos], ["atan", Math.atan],
  ["floor", Math.floor], ["ceil", Math.ceil], ["round", Math.round], ["sign", Math.sign],
]);

const FN2 = new Map<string, (a: number, b: number) => number>([
  ["min", Math.min], ["max", Math.max], ["pow", Math.pow],
  ["atan2", Math.atan2], ["hypot", Math.hypot],
  ["mod", (a, b) => (b === 0 ? NaN : ((a % b) + b) % b)],
  ["step", (edge, v) => (v < edge ? 0 : 1)],
]);

const FN3 = new Map<string, (a: number, b: number, c: number) => number>([
  ["clamp", clamp],
  ["lerp", (a, b, t) => a + (b - a) * t],
  ["smoothstep", (e0, e1, v) => {
    const t = clamp(e1 === e0 ? 0 : (v - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }],
]);

const CONSTANTS = new Map<string, number>([
  ["PI", Math.PI], ["E", Math.E], ["TAU", Math.PI * 2],
]);

/** Every name an expression may reference without declaring it. */
export const BUILTIN_NAMES: readonly string[] = [
  ...FN1.keys(), ...FN2.keys(), ...FN3.keys(), ...CONSTANTS.keys(),
];

// ── Tokeniser ─────────────────────────────────────────────────────────────────────────────────

type TokKind = "num" | "ident" | "op" | "eof";
interface Tok { kind: TokKind; text: string; value?: number; pos: number }

const OPS = [
  "<=", ">=", "==", "!=", "&&", "||",
  "+", "-", "*", "/", "%", "^", "(", ")", ",", "<", ">", "?", ":", "!",
];

function tokenise(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }

    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j]!)) j++;
      if (src[j] === ".") { j++; while (j < src.length && /[0-9]/.test(src[j]!)) j++; }
      if (src[j] === "e" || src[j] === "E") {
        let k = j + 1;
        if (src[k] === "+" || src[k] === "-") k++;
        if (k < src.length && /[0-9]/.test(src[k]!)) { k++; while (k < src.length && /[0-9]/.test(src[k]!)) k++; j = k; }
      }
      out.push({ kind: "num", text: src.slice(i, j), value: Number(src.slice(i, j)), pos: i });
      i = j; continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j]!)) j++;
      out.push({ kind: "ident", text: src.slice(i, j), pos: i });
      i = j; continue;
    }

    // `.` only ever appears inside a number. A bare dot means property access — refuse it by name
    // so the error is actionable rather than a generic syntax failure.
    if (c === ".") throw new ExprError("Property access is not allowed", i);

    const two = src.slice(i, i + 2);
    if (OPS.includes(two)) { out.push({ kind: "op", text: two, pos: i }); i += 2; continue; }
    if (OPS.includes(c)) { out.push({ kind: "op", text: c, pos: i }); i += 1; continue; }

    throw new ExprError(`Unexpected character ${JSON.stringify(c)}`, i);
  }
  out.push({ kind: "eof", text: "", pos: src.length });
  return out;
}

// ── Parser → closure tree ─────────────────────────────────────────────────────────────────────

export interface CompileOptions {
  /** Variable names the expression may read, e.g. ["x", "lanes"]. */
  variables: readonly string[];
}

export interface CompileResult {
  fn: Compiled;
  /** Declared variables actually referenced. Used to verify a knob does something. */
  referenced: Set<string>;
}

export function compileExpr(src: string, opts: CompileOptions): CompileResult {
  const toks = tokenise(src);
  const allowed = new Set(opts.variables);
  const referenced = new Set<string>();
  let p = 0;

  const peek = () => toks[p]!;
  const at = (text: string) => peek().kind === "op" && peek().text === text;
  const eat = (text: string) => { if (at(text)) { p++; return true; } return false; };
  const expect = (text: string) => {
    if (!eat(text)) throw new ExprError(`Expected ${JSON.stringify(text)}`, peek().pos);
  };

  const ternary = (): Compiled => {
    const cond = logicalOr();
    if (!eat("?")) return cond;
    const a = ternary();
    expect(":");
    const b = ternary();
    return (s) => (cond(s) ? a(s) : b(s));
  };

  function logicalOr(): Compiled {
    let left = logicalAnd();
    while (eat("||")) {
      const right = logicalAnd(), l = left;
      left = (s) => (l(s) || right(s) ? 1 : 0);
    }
    return left;
  }

  function logicalAnd(): Compiled {
    let left = comparison();
    while (eat("&&")) {
      const right = comparison(), l = left;
      left = (s) => (l(s) && right(s) ? 1 : 0);
    }
    return left;
  }

  function comparison(): Compiled {
    let left = additive();
    for (;;) {
      const op = (["<=", ">=", "==", "!=", "<", ">"] as const).find((o) => at(o));
      if (!op) return left;
      p++;
      const right = additive(), l = left;
      switch (op) {
        case "<":  left = (s) => (l(s) < right(s) ? 1 : 0); break;
        case ">":  left = (s) => (l(s) > right(s) ? 1 : 0); break;
        case "<=": left = (s) => (l(s) <= right(s) ? 1 : 0); break;
        case ">=": left = (s) => (l(s) >= right(s) ? 1 : 0); break;
        case "==": left = (s) => (l(s) === right(s) ? 1 : 0); break;
        case "!=": left = (s) => (l(s) !== right(s) ? 1 : 0); break;
      }
    }
  }

  function additive(): Compiled {
    let left = multiplicative();
    for (;;) {
      if (eat("+")) { const r = multiplicative(), l = left; left = (s) => l(s) + r(s); }
      else if (eat("-")) { const r = multiplicative(), l = left; left = (s) => l(s) - r(s); }
      else return left;
    }
  }

  function multiplicative(): Compiled {
    let left = power();
    for (;;) {
      if (eat("*")) { const r = power(), l = left; left = (s) => l(s) * r(s); }
      else if (eat("/")) { const r = power(), l = left; left = (s) => l(s) / r(s); }
      else if (eat("%")) { const r = power(), l = left; left = (s) => FN2.get("mod")!(l(s), r(s)); }
      else return left;
    }
  }

  /** `^` is exponentiation and right-associative: 2^3^2 is 2^(3^2). */
  function power(): Compiled {
    const base = unary();
    if (eat("^")) { const exp = power(); return (s) => Math.pow(base(s), exp(s)); }
    return base;
  }

  function unary(): Compiled {
    if (eat("-")) { const v = unary(); return (s) => -v(s); }
    if (eat("+")) return unary();
    if (eat("!")) { const v = unary(); return (s) => (v(s) ? 0 : 1); }
    return primary();
  }

  function primary(): Compiled {
    const t = peek();

    if (t.kind === "num") { p++; const v = t.value!; return () => v; }

    if (t.kind === "ident") {
      p++;
      const name = t.text;

      if (at("(")) {
        p++;
        const args: Compiled[] = [];
        if (!at(")")) { do { args.push(ternary()); } while (eat(",")); }
        expect(")");

        const f1 = FN1.get(name), f2 = FN2.get(name), f3 = FN3.get(name);
        if (f1 && args.length === 1) { const [a] = args as [Compiled]; return (s) => f1(a(s)); }
        if (f2 && args.length === 2) { const [a, b] = args as [Compiled, Compiled]; return (s) => f2(a(s), b(s)); }
        if (f3 && args.length === 3) { const [a, b, c] = args as [Compiled, Compiled, Compiled]; return (s) => f3(a(s), b(s), c(s)); }
        // min/max are commonly written with more than two arguments; fold them.
        if ((name === "min" || name === "max") && args.length > 2) {
          const fold = name === "min" ? Math.min : Math.max;
          const list = args;
          return (s) => { let acc = list[0]!(s); for (let i = 1; i < list.length; i++) acc = fold(acc, list[i]!(s)); return acc; };
        }
        if (f1 || f2 || f3) throw new ExprError(`${name}() got ${args.length} argument(s)`, t.pos);
        throw new ExprError(`Unknown function ${name}()`, t.pos);
      }

      const k = CONSTANTS.get(name);
      if (k !== undefined) return () => k;

      if (!allowed.has(name)) {
        throw new ExprError(
          `Unknown name "${name}". Available: ${[...opts.variables].join(", ")}`,
          t.pos,
        );
      }
      referenced.add(name);
      return (s) => s[name] ?? 0;
    }

    if (at("(")) { p++; const v = ternary(); expect(")"); return v; }

    throw new ExprError("Expected a value", t.pos);
  }

  const fn = ternary();
  if (peek().kind !== "eof") throw new ExprError("Unexpected trailing input", peek().pos);
  return { fn, referenced };
}

/** Convenience for validation: does it compile, and what does it reference? */
export function tryCompile(
  src: string,
  variables: readonly string[],
): { ok: true; result: CompileResult } | { ok: false; error: string } {
  try {
    return { ok: true, result: compileExpr(src, { variables }) };
  } catch (e) {
    return { ok: false, error: e instanceof ExprError ? `${e.message} (at ${e.position})` : String(e) };
  }
}
