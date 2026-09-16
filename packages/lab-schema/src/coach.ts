import { z } from "zod";
import { LIMITS } from "./limits.js";
import { LayerIdSchema, ObservableIdSchema, ParamIdSchema } from "./ids.js";

export const CoachConfigSchema = z.object({
  voice: z.enum(["peer", "socratic", "terse"]).default("peer"),
  maxWordsPerMessage: z.number().int().min(8).max(LIMITS.maxCoachWords).default(34),
  triggers: z.object({
    clampNoEffect: z.boolean().default(true),
    regimeChange: z.boolean().default(true),
    notableReached: z.boolean().default(true),
    idleMs: z.number().int().min(8000).max(60000).default(20000),
    thrash: z.boolean().default(true),
  }),
  /** ≥8s, except prediction-resolved which always fires. A chatty coach is a worse teacher. */
  debounceMs: z.number().int().min(8000).max(60000).default(8000),
  /** The only pre-scripted line in the product. Everything else reacts to the learner. */
  openingLine: z.string().max(90).optional(),
});
export type CoachConfig = z.infer<typeof CoachConfigSchema>;

export const CoachTriggerSchema = z.enum([
  "clamp-no-effect", "regime-change", "notable-reached", "idle", "thrash",
  "prediction-resolved", "learner-asked", "beat-entered",
]);
export type CoachTrigger = z.infer<typeof CoachTriggerSchema>;

export const HighlightSchema = z.object({
  layer: LayerIdSchema.optional(),
  entity: z.number().int().min(0).optional(),
  observable: ObservableIdSchema.optional(),
  param: ParamIdSchema.optional(),
});
export type Highlight = z.infer<typeof HighlightSchema>;

export const CoachMessageSchema = z.object({
  id: z.string(),
  trigger: CoachTriggerSchema,
  /** Word count enforced server-side by BACKEND before this goes on the wire. */
  text: z.string().min(1).max(320),
  highlight: HighlightSchema.nullable().default(null),
  /**
   * The coach's hands. It can OFFER an action as a button — it never changes state itself.
   * The learner always does the acting.
   */
  suggestedAction: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("set-param"), param: ParamIdSchema, value: z.number() }),
    z.object({ kind: z.literal("apply-preset"), presetId: z.string() }),
    z.object({ kind: z.literal("advance-beat") }),
  ]).nullable().default(null),
  createdAt: z.string().datetime(),
});
export type CoachMessage = z.infer<typeof CoachMessageSchema>;
