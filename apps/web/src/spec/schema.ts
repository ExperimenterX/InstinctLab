import { z } from "zod";

/**
 * The MVP LabSpec — the contract between the model and the canvas.
 *
 * Deliberately small. One archetype (a function plot), 1–3 knobs, one prediction, three quiz
 * questions. Every bound here is a real bound: model output is untrusted input, and an
 * unclamped sample count or domain is a frozen tab.
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

export const SERIES_COLORS = ["series-1", "series-2", "series-3"] as const;

export const SeriesSchema = z.object({
  label: z.string().min(1).max(24),
  /** Arithmetic in `x` and any declared param id. */
  expr: z.string().min(1).max(400),
  color: z.enum(SERIES_COLORS),
  style: z.enum(["line", "dashed"]).default("line"),
});
export type Series = z.infer<typeof SeriesSchema>;

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

export const LabSpecSchema = z.object({
  title: z.string().min(2).max(48),
  /** The only prose on screen. Short on purpose. */
  caption: z.string().min(4).max(90),
  /** The ONE mechanism this lab exists to teach. Must be a mechanism, not a restatement. */
  teaching_angle: z.string().min(20).max(160),
  x_label: z.string().min(1).max(24),
  y_label: z.string().min(1).max(24),
  x_domain: z.tuple([z.number().finite(), z.number().finite()]),
  y_domain: z.tuple([z.number().finite(), z.number().finite()]),
  params: z.array(ParamSchema).min(1).max(3),
  series: z.array(SeriesSchema).min(1).max(3),
  observables: z.array(ObservableSchema).min(1).max(2),
  prediction: PredictionSchema,
  quiz: z.array(QuizItemSchema).length(3),
});
export type LabSpec = z.infer<typeof LabSpecSchema>;

/** The client never needs the answers until it grades, and grading is local in the MVP. */
export type PublicQuizItem = Omit<QuizItem, "correct_index" | "why">;
