import type { ConceptNode } from "../types.js";

/**
 * Concept node: linked list.
 *
 * The teaching angle is the one thing people get wrong about linked lists. Everyone learns
 * "insertion is O(1)" and then reaches for a linked list expecting fast inserts — but the O(1) is
 * only the pointer write. Getting to the position is a walk, and the walk is O(n).
 *
 * So the lab puts the two costs side by side as separate read-outs and lets the learner move the
 * target index. The highlighted run of nodes on the canvas *is* the walk, which makes the cost
 * visible instead of asserted.
 */
export const linkedListNode: ConceptNode = {
  id: "linked-list",
  title: "Linked List",
  domain: "cs",
  summary:
    "Why a data structure with O(1) insertion can still be slow to insert into.",

  notes: `
Collected from the standard cost model (CLRS ch.10) plus the practical failure mode people hit.

Key facts the lab encodes:
  - insert/delete given a node reference: O(1) — one or two pointer writes
  - access/search by index: O(n) — you must follow next-pointers from the head
  - head insertion: O(1) total, because no walk is needed
  - no random access, and (the real-world reason arrays usually win) no locality

Deliberately left out: doubly-linked variants, tail pointers, and cache-line arithmetic. Each is
true and each would blur the single mechanism this node exists to teach. A separate node can
cover "why arrays beat lists in practice despite the same asymptotics".

Renderer: structure-diagram (chain). The highlight from head to the target index is the traversal,
so the lesson is the picture rather than the number.
`.trim(),

  spec: {
    title: "Linked List",
    caption: "Reaching a node means walking to it. Move the target.",
    teaching_angle:
      "The pointer write is O(1), but finding where to write it is O(n) — the walk is the cost, not the insert.",
    params: [
      {
        id: "length",
        label: "List length",
        min: 1,
        max: 40,
        step: 1,
        default: 12,
        explain: "How many nodes are chained together",
      },
      {
        id: "target",
        label: "Target index",
        min: 0,
        max: 39,
        step: 1,
        default: 7,
        explain: "The index you want to insert at or read",
      },
    ],
    observables: [
      {
        id: "steps_to_reach",
        label: "Hops to reach it",
        // From the renderer, so the number always equals the highlighted run of nodes.
        expr: "hops",
        format: "number",
        precision: 0,
      },
      {
        id: "writes_to_insert",
        label: "Pointer writes",
        // Constant by construction — that contrast against `hops` is the entire lesson.
        expr: "pointer_writes",
        format: "number",
        precision: 0,
      },
    ],
    stage: {
      renderer: "structure-diagram",
      config: {
        layout: "chain",
        count_param: "length",
        cursor_param: "target",
        note: "highlighted = nodes you must touch to reach the target",
      },
    },
    prediction: {
      question:
        "Set the list to 40 nodes and the target to the last index. How many hops to reach it?",
      observable_id: "steps_to_reach",
      at_params: { length: 40, target: 39 },
      tolerance: 2,
      why_correct:
        "40 — one per node. The insert itself is still a single write; the expense was getting there.",
    },
    quiz: [
      {
        prompt:
          "Insertion into a linked list is O(1). Why can inserting at index 30 still be slow?",
        options: [
          "You must walk 30 nodes to find the position first",
          "Insertion is actually O(n log n)",
          "Memory allocation dominates",
          "The list must be re-sorted",
        ],
        correct_index: 0,
        why: "The O(1) describes the pointer write once you are there. Arriving is the O(n) part.",
      },
      {
        prompt: "Which insertion is genuinely O(1) with no walk?",
        options: [
          "At the head",
          "At the middle index",
          "At the tail of a singly-linked list",
          "At a sorted position",
        ],
        correct_index: 0,
        why: "The head is already in hand, so there is nothing to traverse.",
      },
      {
        prompt: "Set the target to 0 and watch the read-out. What does that tell you?",
        options: [
          "Cost depends on position, not on the operation",
          "Linked lists are always fast",
          "The list length does not matter",
          "Reading is faster than writing",
        ],
        correct_index: 0,
        why: "Same structure, same operation, one hop instead of forty — position is the variable.",
      },
    ],
  },
};
