import { NotImplemented } from "@instinct/shared";
import type { ArchetypeManifest } from "@instinct/lab-schema";

export function plannerSystemPrompt(_manifest: ArchetypeManifest): string {
  // TODO(BACKEND): P1. Shares the manifest section with the composer prompt so the prefix caches
  // across both calls — keep the stable text byte-identical between the two.
  throw new NotImplemented("ai-core/plannerSystemPrompt");
}

/**
 * The planner's whole job, in priority order.
 *
 * The archetype choice is the highest-leverage decision in the pipeline: get it wrong and no
 * amount of good composition recovers the lab (doc 08 scores this at ≥7/10).
 */
export const PLANNER_BAR = `
Choose the archetype whose visual grammar the concept actually has — nodes and edges, a lattice,
free bodies, a curve, an indexed sequence, stages and queues, states and transitions,
accumulating periods, or nested layers. Match the structure, not the subject.

Write the teaching angle as a mechanism the learner could be wrong about. "Compound interest
grows money over time" is a restatement. "Time dominates rate, and the knee is later than anyone
guesses" is a mechanism.

If the concept is too vague to simulate, ask one clarifying question instead of guessing.
If it cannot be simulated at all, name the nearest concept that can be, and say so plainly.
`.trim();
