import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/** Nested or stacked layers with a traversal that passes through them. */
export const layeredStackRenderer: ArchetypeRenderer = {
  id: "layered-stack",
  compile() {
    // TODO(FRONTEND): stack geometry top→bottom; nesting insets for encapsulation
    throw new NotImplemented("layered-stack.compile");
  },
  draw() {
    // TODO(FRONTEND): layer bands → the traversing payload → encapsulation wrappers accumulating as
    // it descends → the opened layer's detail. Encapsulation only teaches if the wrapper
    // VISIBLY accumulates going down and peels going up — that's the whole point.
    throw new NotImplemented("layered-stack.draw");
  },
  hitTest() {
    throw new NotImplemented("layered-stack.hitTest");
  },
};

export const layeredStackDescriptor: ArchetypeDescriptor = {
  id: "layered-stack",
  summary: "Stacked layers with a payload traversing down and back up, wrapping at each level.",
  bestFor: [
    "hierarchies where each level only knows its own concern",
    "wrapping and unwrapping as something crosses boundaries",
    "nesting, scoping, and containment",
    "traversal through ordered levels",
  ],
  supportedMarks: ["rect", "text", "arrow", "token"],
  interactions: ["send a payload down", "open a layer", "toggle a layer's behaviour"],
  maxEntities: 40,
  examples: ["protocol stacks", "call stacks", "memory layout", "geological strata"],
  renderer: layeredStackRenderer,
};
