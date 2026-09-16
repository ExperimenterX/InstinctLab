import type { EntitySetId, LabSpec } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";

/**
 * Strings die at compile time.
 *
 * Every expression compiles to bytecode addressing INTEGER SLOTS — no string lookup, no Map.get,
 * no property access on the hot path. `slotOf` is compile-time only; calling it inside `step()`
 * or `draw()` defeats the entire design (doc 04 §ParamTable).
 */
export interface ParamTable {
  slotOf(id: string): number;
  /** Dense, ordered. The frontend resolves a knob's slot ONCE at mount. */
  readonly paramSlots: Int32Array;
  readonly paramIds: readonly string[];
  /** entityBase[setId][attr] = first slab index of that column. */
  readonly entityBase: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly count: Readonly<Record<string, number>>;
  /** Slab boundaries: [0,paramEnd) params, [paramEnd,varEnd) vars, [varEnd,derivedEnd) derived. */
  readonly paramEnd: number;
  readonly varEnd: number;
  readonly derivedEnd: number;
  readonly slabLength: number;
}

export interface LayoutOptions {
  /** Device ceiling. Entity counts are clamped HERE, at compile time, never at draw time. */
  maxEntities: number;
}

/**
 * Slab layout (doc 04):
 *   [0 .. P)        params
 *   [P .. V)        vars
 *   [V .. D)        derived
 *   [D .. D+n)      entities.<set>.<attr0>   ← one contiguous column per attribute
 *   [D+n .. D+2n)   entities.<set>.<attr1>
 *
 * Struct-of-arrays, not array-of-structs: the renderer iterates one attribute at a time, so
 * columns stay in cache and a column view costs no copy and no object churn.
 */
export function layoutSlab(_spec: LabSpec, _opts: LayoutOptions): ParamTable {
  // TODO(BACKEND): walk params → vars → derived → entity columns, resolving `count` exprs first
  throw new NotImplemented("lab-sim/layoutSlab");
}

export function entityColumn(
  _table: ParamTable,
  _set: EntitySetId,
  _attr: string,
): [start: number, length: number] {
  // TODO(BACKEND)
  throw new NotImplemented("lab-sim/entityColumn");
}
