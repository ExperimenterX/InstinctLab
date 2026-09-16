import { z } from "zod";
import { NotImplemented } from "@instinct/shared";
import { LIMITS } from "./limits.js";

/**
 * An `Expr` is a string of whitelisted arithmetic, parsed once and executed ONLY by
 * lab-sim's expr-vm (N3, doc 03 §4). It is never eval'd, never `new Function`'d.
 *
 * API owns the surface (this file: what's legal). BACKEND owns the parser and VM.
 */
export const ExprSchema = z.string().min(1).max(LIMITS.maxExprChars).brand<"Expr">();
export type Expr = z.infer<typeof ExprSchema>;

/** The complete, closed function table. Adding to it is an API+BACKEND decision, not a spec decision. */
export const EXPR_FUNCTIONS = [
  "abs", "ceil", "floor", "round", "sign", "sqrt", "cbrt",
  "exp", "log", "log2", "log10",
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "min", "max", "clamp", "lerp", "step", "smoothstep", "mod", "hypot",
  // seeded via SimCore's PRNG — never Math.random()
  "rand", "randn", "noise1", "noise2",
  // reads the previous tick's value; how the AI writes a difference equation
  "prev",
] as const;
export type ExprFunction = (typeof EXPR_FUNCTIONS)[number];

/** Aggregates over an entity set, written `sum(nodes.load)`. */
export const EXPR_AGGREGATES = ["sum", "mean", "max", "min", "count", "countWhere"] as const;
export type ExprAggregate = (typeof EXPR_AGGREGATES)[number];

export const EXPR_CONSTANTS = { PI: Math.PI, E: Math.E, TAU: Math.PI * 2 } as const;

/** Always in scope. `i`/`n` only inside an entity context. */
export const EXPR_IMPLICIT_SCOPE = ["t", "dt", "frame", "i", "n"] as const;

export const ReduceSchema = z.enum(EXPR_AGGREGATES);
export type Reduce = z.infer<typeof ReduceSchema>;

/**
 * Simultaneous assignment: all right-hand sides read the PREVIOUS tick, so the AI never has to
 * reason about statement order (doc 03 §3). BACKEND implements this with a double-buffered scalar region.
 */
export const AssignmentSchema = z.object({
  target: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  expr: ExprSchema,
});
export type Assignment = z.infer<typeof AssignmentSchema>;

export interface ExprIssue {
  code:
    | "unknown-identifier"
    | "unknown-function"
    | "property-access"
    | "too-deep"
    | "too-many-nodes"
    | "syntax"
    | "assignment-not-allowed";
  message: string;
  offset?: number;
}

/**
 * Static check: are all identifiers in scope and all calls in the table?
 * Called by API's spec refinement and by BACKEND's repair loop. BACKEND's parser is the implementation.
 */
export function checkExprScope(
  _expr: string,
  _scope: { scalars: string[]; entityAttrs?: string[]; entitySets?: string[]; allowIndexVars?: boolean },
): ExprIssue[] {
  // TODO(API): delegate to BACKEND's parser once exposed; until then, identifier extraction + set difference
  throw new NotImplemented("lab-schema/checkExprScope");
}
