import { NotImplemented } from "@instinct/shared";
import type { Program } from "./expr-parser.js";

/**
 * The ONLY place a model-authored expression is allowed to run (doc 00 N3).
 *
 * Three load-bearing constraints:
 *  - zero allocation per evaluation (the stack is pre-allocated on the instance)
 *  - a step budget, so a pathological program halts instead of hanging the tab
 *  - non-finite results are reported, never propagated into a renderer
 */
export interface VmContext {
  slab: Float64Array;
  t: number;
  dt: number;
  frame: number;
  /** Entity index and count — bound only when running a perEntity program. */
  i: number;
  n: number;
  /** Base slab offset of the current entity set's first attr column. */
  entityBase: number;
  entityCount: number;
  /** Previous-tick scalar region, for `prev(x)` and simultaneous assignment. */
  prevScalars: Float64Array;
  rand: () => number;
}

export class ExprVm {
  private readonly stack: Float64Array;

  constructor(maxStack = 64) {
    this.stack = new Float64Array(maxStack);
  }

  /**
   * Returns the result, or NaN if the step budget was exceeded or the program produced a
   * non-finite value. The caller (SimCore) decides what to do — skip the assignment and report
   * divergence. The VM never throws on the hot path; throwing per frame is its own perf problem.
   */
  eval(_program: Program, _ctx: VmContext): number {
    // TODO(BACKEND): tight `while` over a switch on Op. NO allocation, NO closures, and NO
    // try/catch inside the loop. Budget: LIMITS.maxVmSteps.
    throw new NotImplemented("lab-sim/ExprVm.eval");
  }

  /** Evaluate a perEntity program across a whole column, writing into `out`. */
  evalColumn(
    _program: Program,
    _ctx: VmContext,
    _out: Float64Array,
    _outOffset: number,
  ): void {
    // TODO(BACKEND): loop i in [0,n) reusing ONE VmContext — mutate ctx.i, never rebuild it
    throw new NotImplemented("lab-sim/ExprVm.evalColumn");
  }
}

/** Fixed function table from the schema's EXPR_FUNCTIONS. Indexed by the parser, never by name. */
export function makeFunctionTable(_rand: () => number): {
  fn1: ReadonlyArray<(a: number) => number>;
  fn2: ReadonlyArray<(a: number, b: number) => number>;
  fn3: ReadonlyArray<(a: number, b: number, c: number) => number>;
} {
  // TODO(BACKEND): build in EXPR_FUNCTIONS order. rand/randn/noise* close over the SEEDED prng
  // — Math.random() here silently breaks prediction replay and quiz grading.
  throw new NotImplemented("lab-sim/makeFunctionTable");
}
