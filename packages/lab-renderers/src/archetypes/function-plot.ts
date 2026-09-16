import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/**
 * Curves over an axis pair. Series are either an Expr evaluated with `x` in scope, or a trace
 * read from a var's history ring.
 *
 * FRONTEND: this is your P1. It is the fallback spec's archetype, so if it works, no generation failure
 * can ever leave the learner with a blank canvas (doc 02 §failure policy).
 */
export const functionPlotRenderer: ArchetypeRenderer = {
  id: "function-plot",
  compile() {
    // TODO(FRONTEND): parse series exprs; pre-allocate xs/ys Float64Arrays at the sample count;
    // resolve "auto" yDomain from a first pass, then LOCK it — a y-axis that rescales every
    // frame makes the curve look static while the numbers change, which teaches the opposite
    // of the intended lesson.
    throw new NotImplemented("function-plot.compile");
  },
  draw() {
    // TODO(FRONTEND): axes → grid → markers → series (one beginPath per series) → scrub cursor
    throw new NotImplemented("function-plot.draw");
  },
  hitTest() {
    // nearest point along x, for the scrub cursor and `point` predictions
    throw new NotImplemented("function-plot.hitTest");
  },
};

export const functionPlotDescriptor: ArchetypeDescriptor = {
  id: "function-plot",
  summary: "One or more curves over an x/y axis pair, with markers and a scrub cursor.",
  bestFor: [
    "a quantity that depends continuously on another",
    "comparing two or more response curves",
    "trade-off surfaces where the shape is the insight",
    "anything with a knee, threshold, or asymptote",
  ],
  supportedMarks: ["curve", "area", "line", "text", "circle"],
  interactions: ["scrub x", "drag a control point", "click to place a prediction"],
  maxEntities: 0,
  examples: ["dose-response", "learning-rate stability", "yield curves", "derivative of a function"],
  renderer: functionPlotRenderer,
};
