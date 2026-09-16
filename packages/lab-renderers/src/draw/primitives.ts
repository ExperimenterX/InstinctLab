import { NotImplemented } from "@instinct/shared";
import type { RenderContext } from "../types.js";

/**
 * Canvas-2D primitives in SPEC SPACE — every function takes 0–100 coordinates and applies the
 * viewport transform itself. No archetype does its own transform arithmetic.
 *
 * ALLOCATE NOTHING. No arrays, no objects, no template strings for colours (resolve tokens at
 * compile time). These run up to 2000× per frame.
 *
 * Keep canvas-2D specifics behind this file where it's cheap to do so — a WebGL backend stays
 * possible if a lab ever needs >2000 entities (doc 02 §rendering substrate).
 */

export function circle(_rc: RenderContext, _x: number, _y: number, _r: number, _fill: string): void {
  throw new NotImplemented("primitives/circle");
}

export function rect(_rc: RenderContext, _x: number, _y: number, _w: number, _h: number, _fill: string): void {
  throw new NotImplemented("primitives/rect");
}

export function line(_rc: RenderContext, _x1: number, _y1: number, _x2: number, _y2: number, _stroke: string, _width: number): void {
  throw new NotImplemented("primitives/line");
}

export function arrow(_rc: RenderContext, _x1: number, _y1: number, _x2: number, _y2: number, _stroke: string, _width: number): void {
  throw new NotImplemented("primitives/arrow");
}

/** Text is expensive — batch by style and avoid per-entity `measureText`. */
export function text(
  _rc: RenderContext, _s: string, _x: number, _y: number,
  _align: CanvasTextAlign, _color: string, _size: number,
): void {
  throw new NotImplemented("primitives/text");
}

/** Polyline from a Float64Array pair — the series/trace path. One `beginPath`, one `stroke`. */
export function polyline(
  _rc: RenderContext, _xs: Float64Array, _ys: Float64Array, _n: number,
  _stroke: string, _width: number,
): void {
  throw new NotImplemented("primitives/polyline");
}

export function area(
  _rc: RenderContext, _xs: Float64Array, _ys: Float64Array, _n: number, _baseline: number, _fill: string,
): void {
  throw new NotImplemented("primitives/area");
}

export function grid(_rc: RenderContext, _step: number, _color: string): void {
  throw new NotImplemented("primitives/grid");
}

export function axes(
  _rc: RenderContext, _xLabel: string, _yLabel: string,
  _xDomain: readonly [number, number], _yDomain: readonly [number, number],
): void {
  throw new NotImplemented("primitives/axes");
}

/** Focus pulse for a coach highlight or a beat's `focus`. Time-based, so it needs `rc.t`. */
export function pulseRing(_rc: RenderContext, _x: number, _y: number, _r: number, _color: string): void {
  throw new NotImplemented("primitives/pulseRing");
}
