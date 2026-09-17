import { z } from "zod";

/**
 * The SHARED part of a lab spec — everything that is true regardless of which canvas node
 * renders it.
 *
 * `stage.config` is deliberately `unknown` here. The registry validates it against the node's own
 * `configSchema`, which means **adding a node requires no edit to this file**. That is the
 * property that lets three people add three nodes without touching shared code.
 */

export const ParamSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/, "snake_case identifier"),
  label: z.string().min(1).max(24),
  unit: z.string().max(8).optional(),
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().positive().finite(),
  default: z.number().finite(),
  explain: z.string().min(4).max(80),
});
export type Param = z.infer<typeof ParamSchema>;

export const ObservableSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
  label: z.string().min(1).max(24),
  /** Arithmetic in param ids only — no `x`. Resolves to a single number. */
  expr: z.string().min(1).max(400),
  format: z.enum(["number", "percent", "currency"]).default("number"),
  precision: z.number().int().min(0).max(6).default(2),
});
export type Observable = z.infer<typeof ObservableSchema>;

export const PredictionSchema = z.object({
  question: z.string().min(12).max(160),
  observable_id: z.string(),
  /** The configuration to jump to before asking. Makes the question concrete. */
  at_params: z.record(z.string(), z.number().finite()),
  tolerance: z.number().positive(),
  why_correct: z.string().min(12).max(200),
});
export type Prediction = z.infer<typeof PredictionSchema>;

export const QuizItemSchema = z.object({
  prompt: z.string().min(8).max(200),
  options: z.array(z.string().min(1).max(120)).min(2).max(4),
  correct_index: z.number().int().min(0).max(3),
  why: z.string().max(200).default(""),
});
export type QuizItem = z.infer<typeof QuizItemSchema>;

/** Which node renders this lab, plus that node's own config. */
export const StageSchema = z.object({
  renderer: z.string().min(1).max(40),
  config: z.unknown(),
});
export type Stage = z.infer<typeof StageSchema>;

export const LabSpecSchema = z.object({
  title: z.string().min(2).max(48),
  /** The only prose on screen. Short on purpose. */
  caption: z.string().min(4).max(90),
  /** The ONE mechanism this lab exists to teach — a mechanism, not a restatement. */
  teaching_angle: z.string().min(20).max(160),
  params: z.array(ParamSchema).min(1).max(3),
  observables: z.array(ObservableSchema).min(1).max(2),
  stage: StageSchema,
  prediction: PredictionSchema,
  quiz: z.array(QuizItemSchema).length(3),
});
export type LabSpec = z.infer<typeof LabSpecSchema>;
