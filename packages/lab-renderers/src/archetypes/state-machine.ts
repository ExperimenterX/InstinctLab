import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/** States with guarded transitions, one active at a time, plus a visited-path history. */
export const stateMachineRenderer: ArchetypeRenderer = {
  id: "state-machine",
  compile() {
    // TODO(FRONTEND): positions come from the spec (authored, not force-laid — an authored layout
    // reads far better for a state diagram). Pre-compute transition arc control points.
    throw new NotImplemented("state-machine.compile");
  },
  draw() {
    // TODO(FRONTEND): transition arcs (self-loops as arcs above the node) → labels → states →
    // active state emphasised → history trail. Curve arcs in opposite directions for a
    // bidirectional pair, or they overlap into one unreadable line.
    throw new NotImplemented("state-machine.draw");
  },
  hitTest() {
    throw new NotImplemented("state-machine.hitTest");
  },
};

export const stateMachineDescriptor: ArchetypeDescriptor = {
  id: "state-machine",
  summary: "Named states with guarded transitions, an active state, and a visited history.",
  bestFor: [
    "systems with discrete modes and legal transitions",
    "protocols and handshakes",
    "lifecycle and phase progressions",
    "where a system can get stuck, and why",
  ],
  supportedMarks: ["circle", "rect", "arrow", "text"],
  interactions: ["fire an event", "force a state", "step a transition"],
  maxEntities: 12,
  examples: ["connection handshakes", "regex engines", "cell cycle", "order lifecycle"],
  renderer: stateMachineRenderer,
};
