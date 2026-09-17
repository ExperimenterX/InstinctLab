import type { ConceptNode } from "./types.js";
import { carryingCapacityNode } from "./carrying-capacity/node.js";
import { linkedListNode } from "./linked-list/node.js";
import { bTreeNode } from "./b-tree/node.js";

/**
 * The concept-node registry.
 *
 * A node is where information about one concept lands; the canvas compiles it into an interactive
 * page at /node/<id>. Adding a node is one folder plus one line here — nodes never import each
 * other, so people can add them in parallel.
 *
 * Renderers live in src/canvas/renderers and are shared: `linked-list` and `b-tree` both use
 * `structure-diagram`. A node picks a renderer; it does not write drawing code.
 */
export const CONCEPTS: readonly ConceptNode[] = [
  carryingCapacityNode,
  linkedListNode,
  bTreeNode,
];

const BY_ID = new Map(CONCEPTS.map((c) => [c.id, c] as const));

export function getConcept(id: string): ConceptNode | undefined {
  return BY_ID.get(id);
}

export function conceptIds(): string[] {
  return CONCEPTS.map((c) => c.id);
}

export type { ConceptNode };
