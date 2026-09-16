import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/**
 * Indexed cells with labelled cursors. The grammar of anything that walks, compares, or mutates
 * a linear structure.
 */
export const sequenceArrayRenderer: ArchetypeRenderer = {
  id: "sequence-array",
  compile() {
    // TODO(FRONTEND): cell geometry from count + orientation; pre-size the swap-anim scratch
    throw new NotImplemented("sequence-array.compile");
  },
  draw() {
    // TODO(FRONTEND): cells (fill by value scale) → compare highlight → cursors → indices.
    // The swap animation is what makes an algorithm legible — interpolate positions over
    // swapAnimMs, and skip it entirely under reducedMotion.
    throw new NotImplemented("sequence-array.draw");
  },
  hitTest() {
    throw new NotImplemented("sequence-array.hitTest");
  },
};

export const sequenceArrayDescriptor: ArchetypeDescriptor = {
  id: "sequence-array",
  summary: "A row or grid of indexed cells with labelled cursors and comparison highlighting.",
  bestFor: [
    "algorithms that traverse or mutate a linear structure",
    "index/pointer reasoning",
    "bit-level or slot-level state",
    "step-by-step transformations where order matters",
  ],
  supportedMarks: ["cell", "rect", "text", "arrow"],
  interactions: ["pick an index", "step the algorithm", "edit a cell value"],
  maxEntities: 512,
  examples: ["binary search", "bit arrays", "string matching", "in-place partitioning"],
  renderer: sequenceArrayRenderer,
};
