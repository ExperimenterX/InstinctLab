import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/** A 2D cell lattice with a discrete or continuous state per cell. */
export const gridAutomatonRenderer: ArchetypeRenderer = {
  id: "grid-automaton",
  compile() {
    // TODO(FRONTEND): cell size from cols/rows; pre-resolve stateColors to a LUT
    throw new NotImplemented("grid-automaton.compile");
  },
  draw() {
    // TODO(FRONTEND): one pass over the state column. At 200×200 = 40k cells, per-cell fillRect is
    // too slow — write into an ImageData buffer and putImageData once. Above ~2500 cells,
    // switch to that path.
    throw new NotImplemented("grid-automaton.draw");
  },
  hitTest() {
    // integer division by cell size — no scan needed
    throw new NotImplemented("grid-automaton.hitTest");
  },
  onDrag() {
    // painting cells: the single most satisfying interaction in this archetype, make it smooth
    throw new NotImplemented("grid-automaton.onDrag");
  },
};

export const gridAutomatonDescriptor: ArchetypeDescriptor = {
  id: "grid-automaton",
  summary: "A 2D lattice of cells updated from their neighbours.",
  bestFor: [
    "local rules producing global patterns",
    "spatial spread and diffusion",
    "threshold and phase-transition behaviour",
    "neighbourhood operations over a field",
  ],
  supportedMarks: ["cell", "rect", "text"],
  interactions: ["paint cells", "seed a pattern", "step one generation", "clear"],
  maxEntities: 40000,
  examples: ["Game of Life", "heat diffusion", "image convolution", "forest fire"],
  renderer: gridAutomatonRenderer,
};
