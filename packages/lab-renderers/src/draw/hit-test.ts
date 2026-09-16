import { NotImplemented } from "@instinct/shared";
import type { HitResult, PointerInfo } from "../types.js";

/**
 * Hit-testing in spec space. Canvas has no DOM nodes, so this is ours to own — and it's the
 * reason canvas was chosen over SVG rather than in spite of it: we control the pick radius, so a
 * 1.5-unit dot can still have a comfortable 3-unit touch target.
 *
 * Make targets generous. A learner who can't grab a node concludes the lab is broken.
 */
export const MIN_PICK_RADIUS_SPEC_UNITS = 3;

/** Linear scan over a column pair. Fine to ~2000 entities; add a grid index only if profiling says so. */
export function nearestInColumns(
  _xs: Float64Array, _ys: Float64Array, _n: number,
  _p: PointerInfo, _maxDistance: number,
): { index: number; distance: number } | null {
  throw new NotImplemented("hit-test/nearestInColumns");
}

export function pointInRect(_p: PointerInfo, _x: number, _y: number, _w: number, _h: number): boolean {
  throw new NotImplemented("hit-test/pointInRect");
}

export function distanceToSegment(
  _p: PointerInfo, _x1: number, _y1: number, _x2: number, _y2: number,
): number {
  throw new NotImplemented("hit-test/distanceToSegment");
}

/** Nearest hit across layers, respecting paint order for ties (topmost wins). */
export function pickBest(_candidates: readonly HitResult[]): HitResult | null {
  throw new NotImplemented("hit-test/pickBest");
}
