import { z } from "zod";
import { LabIdSchema } from "./ids.js";

export const DomainSchema = z.enum([
  "cs", "physics", "biology", "math", "networking",
  "finance", "chemistry", "systems", "economics", "other",
]);
export type Domain = z.infer<typeof DomainSchema>;

/** The ten renderer archetypes (doc 03 §5). Visual grammars, never topics. */
export const ArchetypeIdSchema = z.enum([
  "graph-network",
  "grid-automaton",
  "particle-field",
  "function-plot",
  "sequence-array",
  "pipeline-flow",
  "state-machine",
  "compounding-ledger",
  "layered-stack",
  "free-canvas",
]);
export type ArchetypeId = z.infer<typeof ArchetypeIdSchema>;

export const MetaSchema = z.object({
  concept: z.string().min(3).max(280),
  title: z.string().min(2).max(48),
  domain: DomainSchema,
  archetype: ArchetypeIdSchema,
  /**
   * The most important field in the spec. The ONE insight the lab exists to deliver, stated as a
   * mechanism. "Compound interest grows money" is a failure; "time dominates rate, and the knee
   * is later than anyone guesses" is the bar. Every knob and question derives from this.
   */
  teachingAngle: z.string().min(20).max(140),
  bigIdea: z.string().min(8).max(90),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  estimatedMinutes: z.number().int().min(3).max(12),
  prerequisites: z.array(z.string().max(40)).max(3),
});
export type Meta = z.infer<typeof MetaSchema>;

/**
 * Output of the fast PLAN stage — emitted at ~1.2s so the learner sees a shell before the
 * full spec exists (doc 02). Also the fallback source if COMPOSE fails validation twice.
 */
export const LabPlanSchema = z.object({
  labId: LabIdSchema,
  title: z.string().min(2).max(48),
  domain: DomainSchema,
  archetype: ArchetypeIdSchema,
  teachingAngle: z.string().min(20).max(140),
  bigIdea: z.string().min(8).max(90),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  /** Candidate knobs — names and ranges only; COMPOSE turns these into real Params. */
  variables: z.array(z.object({
    label: z.string().max(24),
    why: z.string().max(80),
    range: z.tuple([z.number(), z.number()]),
  })).min(1).max(8),
  observables: z.array(z.object({ label: z.string().max(24), why: z.string().max(80) })).min(1).max(8),
  /** Set when the concept isn't directly simulable and the plan pivoted to an adjacent angle. */
  narrowedFrom: z.string().max(280).optional(),
  clarifyingQuestion: z.string().max(140).optional(),
});
export type LabPlan = z.infer<typeof LabPlanSchema>;
