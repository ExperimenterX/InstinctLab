import type { ConceptNode } from "../types.js";

/**
 * Concept node: B-tree.
 *
 * The mechanism worth teaching is not "a B-tree is a balanced tree" — it is *why databases use
 * one instead of a binary search tree*. The answer is height: a BST over 10 million rows is ~23
 * levels deep, and every level is potentially a disk seek. Raise the branching factor and the
 * height collapses logarithmically, so a real index reaches any row in 3–4 reads.
 *
 * So the knob is `order`, the read-out is height, and the prediction asks what happens to height
 * when you widen the nodes. The learner watches the tree flatten.
 */
export const bTreeNode: ConceptNode = {
  id: "b-tree",
  title: "B-Tree",
  domain: "cs",
  summary:
    "Why database indexes are wide and shallow instead of tall and thin.",

  notes: `
Collected from the standard definition (CLRS ch.18) and the storage-engine rationale.

Key facts the lab encodes:
  - order m = maximum children per node; maximum keys per node = m - 1
  - all leaves at the same depth: height is uniform, so lookup cost is uniform
  - height h ~ log_m(n), so raising m shrinks h logarithmically
  - each node is sized to one disk page / block, which is WHY m is large in practice
  - lookup touches exactly h nodes = h page reads

The tree is built by real sequential insertion with node splits, not drawn as a tidy diagram.
That matters: the learner sees the actual shape the algorithm produces, and the height changes in
discrete steps (only a root split adds a level) rather than sliding smoothly.

Deliberately left out: deletion and rebalancing, B+ tree leaf chaining, and concurrency. Deletion
in particular is the fiddliest part of the structure and teaches nothing about the height argument
that this node exists for.

Renderer: structure-diagram (btree). The search path highlight makes "height = disk reads"
concrete — count the highlighted boxes.
`.trim(),

  spec: {
    title: "B-Tree",
    caption: "Widen the nodes and watch the tree flatten.",
    teaching_angle:
      "Height is what costs you disk reads, and raising the branching factor collapses height logarithmically.",
    params: [
      {
        id: "order",
        label: "Order (max children)",
        min: 3,
        max: 8,
        step: 1,
        default: 3,
        explain: "How many children a node may have — in practice, what fits one disk page",
      },
      {
        id: "keys",
        label: "Keys stored",
        min: 1,
        max: 64,
        step: 1,
        default: 40,
        explain: "How many keys have been inserted into the index",
      },
      {
        id: "lookup",
        label: "Key to find",
        min: 1,
        max: 64,
        step: 1,
        default: 29,
        explain: "The key being searched for — its path is highlighted",
      },
    ],
    observables: [
      {
        id: "reads",
        label: "Nodes read to find it",
        // From the actual tree the renderer built — count the highlighted boxes and it matches.
        expr: "nodes_read",
        format: "number",
        precision: 0,
      },
      {
        id: "height",
        label: "Tree height",
        expr: "tree_height",
        format: "number",
        precision: 0,
      },
    ],
    stage: {
      renderer: "structure-diagram",
      config: {
        layout: "btree",
        count_param: "keys",
        order_param: "order",
        cursor_param: "lookup",
        note: "highlighted path = nodes read to find the key",
      },
    },
    prediction: {
      question:
        "Keep 64 keys and raise the order from 3 to 8. What does the tree height become?",
      observable_id: "height",
      at_params: { order: 8, keys: 64, lookup: 29 },
      tolerance: 0.6,
      why_correct:
        "It halves. Eight-way branching reaches the same 64 keys in far fewer levels, and levels are reads.",
    },
    quiz: [
      {
        prompt: "Why do database indexes use a high branching factor?",
        options: [
          "Fewer levels means fewer disk reads per lookup",
          "It uses less total memory",
          "It makes insertion O(1)",
          "It keeps keys sorted, which a BST cannot do",
        ],
        correct_index: 0,
        why: "Lookup touches one node per level, and each node is a page read. Height is the cost.",
      },
      {
        prompt:
          "Drop the order to 3 and watch the height. Why does it grow so much?",
        options: [
          "Narrower nodes divide the keys less per level, so more levels are needed",
          "The tree becomes unbalanced",
          "More keys are stored overall",
          "The height is unrelated to the order",
        ],
        correct_index: 0,
        why: "Height is log of n in the base of the branching factor — a smaller base means a taller tree.",
      },
      {
        prompt: "Add keys one at a time and watch the height. How does it change?",
        options: [
          "In sudden steps, when the root splits",
          "Smoothly with every key",
          "It never changes",
          "It drops as keys are added",
        ],
        correct_index: 0,
        why: "A B-tree only gains height when the root splits, so height is flat then jumps.",
      },
    ],
  },
};
