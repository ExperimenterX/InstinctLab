import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/** Free bodies moving under forces, with optional trails and collision. */
export const particleFieldRenderer: ArchetypeRenderer = {
  id: "particle-field",
  compile() {
    // TODO(FRONTEND): if trails, pre-allocate the ring (n × trailLength × 2 floats) — this is the
    // largest allocation in the package, so clamp it against the entity count
    throw new NotImplemented("particle-field.compile");
  },
  draw() {
    // TODO(FRONTEND): trails (single path per particle, or a fading full-canvas overlay) → bodies →
    // velocity arrows if declared. Trails are off under reducedMotion.
    throw new NotImplemented("particle-field.draw");
  },
  hitTest() {
    throw new NotImplemented("particle-field.hitTest");
  },
  onDrag() {
    // dragging a body should also impart velocity — grabbing and flinging is how learners
    // discover momentum without being told about it
    throw new NotImplemented("particle-field.onDrag");
  },
};

export const particleFieldDescriptor: ArchetypeDescriptor = {
  id: "particle-field",
  summary: "Free bodies in 2D moving under forces, with optional trails and collisions.",
  bestFor: [
    "continuous motion under forces",
    "emergent collective behaviour from many bodies",
    "conservation and equilibrium",
    "anything with position, velocity, and interaction",
  ],
  supportedMarks: ["circle", "rect", "arrow", "path"],
  interactions: ["drag a body", "fling to impart velocity", "add or remove bodies", "apply an impulse"],
  maxEntities: 2000,
  examples: ["orbital mechanics", "gas pressure", "flocking", "elastic collisions"],
  renderer: particleFieldRenderer,
};
