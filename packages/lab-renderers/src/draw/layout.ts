import type { Topology } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";

/**
 * Layout helpers, all writing into caller-provided Float64Arrays. No allocation, no return
 * values — the caller owns the memory (usually a slab column).
 *
 * These run at compile time or on a topology change, not per frame.
 */

export function circularLayout(_xs: Float64Array, _ys: Float64Array, _n: number, _cx: number, _cy: number, _r: number): void {
  throw new NotImplemented("layout/circularLayout");
}

export function gridLayout(_xs: Float64Array, _ys: Float64Array, _n: number, _cols: number, _pad: number): void {
  throw new NotImplemented("layout/gridLayout");
}

export function layeredLayout(_xs: Float64Array, _ys: Float64Array, _n: number, _depths: Int32Array): void {
  throw new NotImplemented("layout/layeredLayout");
}

/**
 * Force-directed layout. Runs for a BOUNDED number of iterations at compile time and then
 * freezes — a graph that keeps drifting under the learner's cursor is unusable, and a live force
 * sim competing with the concept's own dynamics for frame budget is worse.
 */
export function forceLayout(
  _xs: Float64Array, _ys: Float64Array, _n: number,
  _edges: Int32Array, _edgeCount: number,
  _iterations?: number,
): void {
  throw new NotImplemented("layout/forceLayout");
}

export function treeLayout(_xs: Float64Array, _ys: Float64Array, _n: number, _parents: Int32Array): void {
  throw new NotImplemented("layout/treeLayout");
}

export function applyTopology(
  _topology: Topology, _xs: Float64Array, _ys: Float64Array, _n: number,
): void {
  throw new NotImplemented("layout/applyTopology");
}

/** Build an edge list (pairs of indices) from a LinkSpec. Bounded by LIMITS.maxLinks. */
export function buildEdges(
  _n: number, _topology: Topology | undefined, _out: Int32Array,
): number {
  throw new NotImplemented("layout/buildEdges");
}
