import { z } from "zod";

/**
 * Config for the `structure-diagram` renderer.
 *
 * The important difference from `function-plot`: the spec does **not** describe the picture. It
 * names a structure and points at the knobs that parameterise it, and the renderer runs the real
 * algorithm to produce the shape.
 *
 * That split exists because the expression language is arithmetic — it cannot express a tree. So
 * the renderer owns the algorithm and the spec owns the parameters. It also means a concept node
 * for a data structure is small and hard to get wrong: there is no geometry to author.
 */

export const StructureDiagramConfigSchema = z.object({
  /**
   * `chain` — nodes in a row with next-pointers (linked list, queue, ring)
   * `btree`  — a real B-tree, built by sequential insertion with splits
   */
  layout: z.enum(["chain", "btree"]),

  /** Param driving how many elements/keys exist. */
  count_param: z.string().min(1),

  /** `btree` only: param driving max children per node. Ignored for `chain`. */
  order_param: z.string().min(1).optional(),

  /**
   * Param driving the highlighted position — the element being searched for, or the index being
   * reached. This is what makes the cost visible rather than merely stated.
   */
  cursor_param: z.string().min(1).optional(),

  /** Shown above the diagram. Short — it is a legend, not an explanation. */
  note: z.string().max(80).optional(),
});
export type StructureDiagramConfig = z.infer<typeof StructureDiagramConfigSchema>;
