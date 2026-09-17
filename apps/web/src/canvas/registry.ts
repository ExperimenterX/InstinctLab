import type { CanvasRenderer } from "./types.js";
import { functionPlotRenderer } from "./renderers/function-plot/render.js";
import { structureDiagramRenderer } from "./renderers/structure-diagram/render.js";

/**
 * The canvas renderer registry.
 *
 * A RENDERER compiles a lab spec into pixels. A NODE is a concept (see src/concepts) whose
 * content the AI fills in; a node names the renderer that should draw it.
 *
 * Adding a node is exactly one line here plus your own folder. Nothing else in `src/` changes —
 * the parser, the canvas host, and the generator prompt all read from this list, so three people
 * can land three nodes without touching each other's code or each other's merge conflicts.
 *
 * Only register a renderer once it actually draws. Offering the generator a renderer that throws
 * is worse than offering it fewer choices.
 */
export const RENDERERS: readonly CanvasRenderer<never>[] = [
  functionPlotRenderer as unknown as CanvasRenderer<never>,
  structureDiagramRenderer as unknown as CanvasRenderer<never>,
  // grid-automaton      → person A
  // particle-field      → person A
  // layered-stack       → person A
  // graph-network       → person B
  // state-machine       → person B
  // pipeline-flow       → person B
  // sequence-array      → person C
  // compounding-ledger  → person C
  // free-canvas         → person C
];

const BY_ID = new Map(RENDERERS.map((n) => [n.id, n] as const));

export function getRenderer(id: string): CanvasRenderer<never> | undefined {
  return BY_ID.get(id);
}

export function rendererIds(): string[] {
  return RENDERERS.map((n) => n.id);
}

/**
 * The renderer menu the generator is given. Built from the registry rather than hand-maintained
 * in a prompt string, so the prompt cannot drift out of sync with what actually renders.
 */
export function rendererMenu(): { id: string; label: string; bestFor: string }[] {
  return RENDERERS.map((n) => ({ id: n.id, label: n.label, bestFor: n.bestFor }));
}
