import type { Expr } from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";
import type { ParamTable } from "./param-table.js";

/**
 * Parse → validate scope → emit bytecode. Runs ONCE per expression, at compile time.
 *
 * This is the security boundary for model-authored expressions (doc 00 N3). There is no eval, no
 * `new Function`, no property access, no indexing, no assignment, and no call outside the fixed
 * function table. **Rejecting is always correct; guessing never is.**
 */

/** Stack machine. Operands are slab slots or immediates — never strings. */
export const enum Op {
  PushConst, PushSlot, PushEntityAttr, PushT, PushDt, PushI, PushN, PushPrev,
  Add, Sub, Mul, Div, Mod, Pow, Neg,
  Eq, Neq, Lt, Lte, Gt, Gte, And, Or, Not,
  /** Ternary compiles to these — no branching in the operand stream. */
  JumpIfFalse, Jump,
  CallFn1, CallFn2, CallFn3,
  Aggregate,
  Halt,
}

export interface Program {
  readonly code: Int32Array;
  readonly consts: Float64Array;
  /** Pre-computed so the VM can reject over-budget programs without counting at runtime. */
  readonly maxStack: number;
  readonly nodeCount: number;
  readonly depth: number;
  readonly source: string;
  /** True if the program reads `i`/`n` — it must be run per-entity. */
  readonly perEntity: boolean;
}

export interface ParseScope {
  table: ParamTable;
  /** Set when compiling an entity attr or entityStep — enables `i`, `n`, and bare attr names. */
  entitySet?: string;
  allowAggregates: boolean;
}

export interface ParseError {
  code:
    | "syntax" | "unknown-identifier" | "unknown-function" | "arity"
    | "property-access" | "assignment-not-allowed" | "too-deep" | "too-many-nodes";
  message: string;
  offset: number;
}

export function parseExpr(_src: Expr | string, _scope: ParseScope): Result<Program, ParseError[]> {
  // TODO(BACKEND): Pratt parser → AST → scope check → bytecode.
  // Enforce LIMITS.maxExprDepth and maxExprNodes here, at parse time.
  throw new NotImplemented("lab-sim/parseExpr");
}

/** Identifiers referenced, for the schema's scope check and the AI repair loop. */
export function exprIdentifiers(_src: string): string[] {
  // TODO(BACKEND)
  throw new NotImplemented("lab-sim/exprIdentifiers");
}
