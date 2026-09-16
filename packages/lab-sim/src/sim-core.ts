import type { EntitySetId, LabSpec, ObservableId, ParamId } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { ParamTable } from "./param-table.js";
import type { SimSnapshot } from "./snapshot.js";

/**
 * Ring 0 — the simulation. A flat Float64Array: not objects, not React state, not immutable
 * snapshots. One allocation at compile time, mutated in place forever after (doc 04).
 *
 * HARD RULES:
 *  - `step()` allocates NOTHING. No array/object literals, no closures, no .map, no spread, no
 *    string concat. An allocation here is a GC sawtooth, and a sawtooth is a stuttering knob —
 *    which is a product failure, because the whole premise is that the learner's hand and the
 *    picture feel connected.
 *  - No `window`, no `document`, no React, no timers. This is what lets the same code run in the
 *    browser, in a Worker, and headless in Node for grading. The package tsconfig omits the DOM
 *    lib so a violation won't compile.
 */
export interface SimCoreOptions {
  maxEntities: number;
  seed: number;
  /** From prefers-reduced-motion. Lowers the effective tick rate; never disables the sim. */
  reducedMotion?: boolean;
}

export interface DivergenceInfo {
  frame: number;
  reason: string;
  slot: number;
}

export class SimCore {
  /** The source of truth for anything numeric and moving. Stores only mirror it. */
  readonly slab!: Float64Array;
  readonly table!: ParamTable;
  t = 0;
  frame = 0;

  /**
   * Allocate the slab, compile every Expr to bytecode, lay out entities, evaluate inits.
   * Entity counts are clamped HERE against `opts.maxEntities` — never at draw time.
   */
  compile(_spec: LabSpec, _opts: SimCoreOptions): void {
    // TODO(BACKEND): layoutSlab → parseExpr for every expr → eval inits → build double buffer
    throw new NotImplemented("SimCore.compile");
  }

  /** Re-run inits with the same seed. A prediction replay must land on an identical state. */
  reset(_seed?: number): void {
    throw new NotImplemented("SimCore.reset");
  }

  /**
   * One tick. Simultaneous assignment via a DOUBLE-BUFFERED scalar region: read buffer A, write
   * buffer B, swap pointers. No copying, and the AI never has to reason about statement order.
   */
  step(_dt: number): void {
    // TODO(BACKEND): 1. swap scalars→prev  2. derived  3. dynamics  4. entityStep columns
    //                5. clamps  6. finite check  7. notables at ≤4Hz
    throw new NotImplemented("SimCore.step");
  }

  /** O(1) synchronous param write. The UI calls this BEFORE touching any store, every time. */
  poke(_slot: number, _value: number): void {
    throw new NotImplemented("SimCore.poke");
  }

  read(_slot: number): number {
    throw new NotImplemented("SimCore.read");
  }

  /** Zero-copy column view for the renderer. Do not retain across a `compile()`. */
  view(_setId: EntitySetId, _attr: string): Float64Array {
    throw new NotImplemented("SimCore.view");
  }

  /** Actual entity count, which may be below the spec's `count` after clamping. */
  countOf(_setId: EntitySetId): number {
    throw new NotImplemented("SimCore.countOf");
  }

  observable(_id: ObservableId): number {
    throw new NotImplemented("SimCore.observable");
  }

  paramSlot(_id: ParamId): number {
    throw new NotImplemented("SimCore.paramSlot");
  }

  snapshot(): SimSnapshot {
    throw new NotImplemented("SimCore.snapshot");
  }

  restore(_s: SimSnapshot): void {
    throw new NotImplemented("SimCore.restore");
  }

  /**
   * Non-finite scan over the ~24-value scalar region — cheap enough to run every tick. On
   * detection the caller restores the last good snapshot and reports. NaN must never reach a
   * renderer.
   */
  checkFinite(): DivergenceInfo | null {
    throw new NotImplemented("SimCore.checkFinite");
  }

  /** Polled at ≤4Hz, not every tick. Returns newly-true notable ids only. */
  pollNotables(): readonly string[] {
    throw new NotImplemented("SimCore.pollNotables");
  }

  /** Observables whose threshold was crossed this tick — drives the regime-change coach trigger. */
  pollRegimeChanges(): readonly { observable: ObservableId; regime: string; value: number }[] {
    throw new NotImplemented("SimCore.pollRegimeChanges");
  }
}
