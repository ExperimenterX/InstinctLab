import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/**
 * The escape hatch — and NOT a code channel. `config.draw` is a validated list of primitive ops
 * with expression-bound arguments (doc 03 §5). There is no string to execute here.
 *
 * Track how often this gets chosen. Above ~15% of generated specs it means the nine real
 * grammars are too narrow, and the fix is to generalise one of them — not to make this more
 * powerful (ADR 0001 §revisit).
 */
export const freeCanvasRenderer: ArchetypeRenderer = {
  id: "free-canvas",
  compile() {
    // TODO(FRONTEND): parse each op's arg exprs; resolve `repeat.over` to a column base
    throw new NotImplemented("free-canvas.compile");
  },
  draw() {
    // TODO(FRONTEND): walk the op list in order, dispatching to primitives. Bounded by
    // LIMITS.maxDrawOps × entity count — compute that product at compile time and reject it
    // there, not per frame.
    throw new NotImplemented("free-canvas.draw");
  },
  hitTest() {
    // ops have no identity, so hit-testing is limited to `repeat.over` columns
    throw new NotImplemented("free-canvas.hitTest");
  },
};

export const freeCanvasDescriptor: ArchetypeDescriptor = {
  id: "free-canvas",
  summary: "A declarative list of primitive draw ops. Last resort when no other grammar fits.",
  bestFor: ["concepts whose visual form matches none of the other nine grammars"],
  supportedMarks: ["circle", "rect", "line", "arrow", "text", "path"],
  interactions: ["whatever the ops declare"],
  maxEntities: 500,
  examples: [],
  renderer: freeCanvasRenderer,
};
