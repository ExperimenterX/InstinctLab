import { z } from "zod";
import { LIMITS } from "./limits.js";
import { AssignmentSchema } from "./expr.js";
import {
  BeatIdSchema, LayerIdSchema, ObservableIdSchema, ParamIdSchema, PredictionIdSchema,
} from "./ids.js";

/** The learning loop. Order is fixed and meaningful (doc 01 §The six phases). */
export const PhaseSchema = z.enum(["see", "interact", "experiment", "predict", "understand", "recall"]);
export type Phase = z.infer<typeof PhaseSchema>;

export const PHASE_ORDER: readonly Phase[] = [
  "see", "interact", "experiment", "predict", "understand", "recall",
] as const;

export const PresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
  label: z.string().min(2).max(28),
  /** Named STARTING POINTS, never answers. "turn off damping", not "the correct setting". */
  set: z.record(z.string(), z.number()),
});
export type Preset = z.infer<typeof PresetSchema>;

export const GoalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("param-changed"), param: ParamIdSchema, times: z.number().int().min(1).max(20).default(1) }),
  z.object({
    kind: z.literal("observable-reached"),
    observable: ObservableIdSchema,
    op: z.enum(["gt", "lt", "between"]),
    value: z.union([z.number(), z.tuple([z.number(), z.number()])]),
  }),
  z.object({ kind: z.literal("notable-discovered"), notable: z.string().max(40).optional(), count: z.number().int().min(1).max(6).default(1) }),
  z.object({ kind: z.literal("prediction-committed"), prediction: PredictionIdSchema }),
  z.object({ kind: z.literal("time-elapsed"), ms: z.number().int().min(500).max(120000) }),
  z.object({ kind: z.literal("manual") }),
]);
export type Goal = z.infer<typeof GoalSchema>;

export const BeatSchema = z.object({
  id: BeatIdSchema,
  phase: PhaseSchema,
  /** THE ONLY PROSE IN THE PRODUCT. Optional by design. ≤90 chars, and shorter is better. */
  caption: z.string().max(LIMITS.maxCaptionChars).optional(),
  unlock: z.object({
    params: z.array(ParamIdSchema).max(LIMITS.maxParams).optional(),
    time: z.boolean().optional(),
    layers: z.array(LayerIdSchema).max(LIMITS.maxLayers).optional(),
  }).optional(),
  focus: z.object({
    layer: LayerIdSchema.optional(),
    entity: z.number().int().min(0).optional(),
    observable: ObservableIdSchema.optional(),
  }).optional(),
  presets: z.array(PresetSchema).max(LIMITS.maxPresetsPerBeat).optional(),
  goal: GoalSchema.default({ kind: "manual" }),
  onEnter: z.array(AssignmentSchema).max(8).optional(),
  /** Legal only on `see` — every other phase waits for the learner. */
  autoAdvanceMs: z.number().int().min(1000).max(15000).optional(),
});
export type Beat = z.infer<typeof BeatSchema>;

export const BeatsSchema = z.array(BeatSchema).min(1).max(LIMITS.maxBeats);

// TODO(API): refine the pedagogical rules — these are product requirements, not style:
//   - at least one beat per phase, and beats appear in PHASE_ORDER
//   - `see` unlocks NO params (the learner watches first)
//   - the first `interact` beat unlocks EXACTLY ONE param
//   - autoAdvanceMs only on `see`
//   - every goal's param/observable/prediction/notable reference resolves
//   - a preset's `set` keys are all declared params, values within range
