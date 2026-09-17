import { bTreeNode } from "../../../concepts/b-tree/node.js";

/**
 * The renderer's standalone example. It reuses the b-tree concept node's spec, so the renderer
 * and the concept can never drift apart — if one breaks, both do, loudly.
 */
export const STRUCTURE_DIAGRAM_FIXTURE = bTreeNode.spec;
