import type { ArchetypeNode } from "./types.js";
import { functionPlotNode } from "./archetypes/function-plot/render.js";

/**
 * The node registry.
 *
 * Adding a node is exactly one line here plus your own folder. Nothing else in `src/` changes —
 * the parser, the canvas host, and the generator prompt all read from this list, so three people
 * can land three nodes without touching each other's code or each other's merge conflicts.
 *
 * Only register a node once it actually renders. Offering the generator an archetype that throws
 * is worse than offering it fewer choices.
 */
export const NODES: readonly ArchetypeNode<never>[] = [
  functionPlotNode as unknown as ArchetypeNode<never>,
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

const BY_ID = new Map(NODES.map((n) => [n.id, n] as const));

export function getNode(id: string): ArchetypeNode<never> | undefined {
  return BY_ID.get(id);
}

export function nodeIds(): string[] {
  return NODES.map((n) => n.id);
}

/**
 * The archetype menu the generator is given. Built from the registry rather than hand-maintained
 * in a prompt string, so the prompt cannot drift out of sync with what actually renders.
 */
export function archetypeMenu(): { id: string; label: string; bestFor: string }[] {
  return NODES.map((n) => ({ id: n.id, label: n.label, bestFor: n.bestFor }));
}
