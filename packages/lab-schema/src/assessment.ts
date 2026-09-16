import { z } from "zod";
import { LIMITS } from "./limits.js";
import { AssessmentIdSchema, BeatIdSchema, LayerIdSchema, ObservableIdSchema, ParamIdSchema, PredictionIdSchema, SessionIdSchema } from "./ids.js";

// ── Predictions (inline, during the PREDICT phase) ────────────────────────────────────────────

export const PredictionAnswerSpecSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numeric"), observable: ObservableIdSchema, tolerance: z.number().positive(), unit: z.string().max(8).optional() }),
  z.object({ kind: z.literal("direction"), observable: ObservableIdSchema }),
  z.object({ kind: z.literal("choice"), options: z.array(z.string().max(80)).min(2).max(5), correctIndex: z.number().int().min(0) }),
  z.object({ kind: z.literal("point"), layer: LayerIdSchema, tolerance: z.number().positive() }),
  z.object({ kind: z.literal("ordering"), items: z.array(z.string().max(40)).min(2).max(6), correctOrder: z.array(z.number().int()) }),
]);
export type PredictionAnswerSpec = z.infer<typeof PredictionAnswerSpecSchema>;

/** What the learner submits. */
export const PredictionAnswerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numeric"), value: z.number().finite() }),
  z.object({ kind: z.literal("direction"), value: z.enum(["up", "down", "flat"]) }),
  z.object({ kind: z.literal("choice"), index: z.number().int().min(0) }),
  z.object({ kind: z.literal("point"), x: z.number(), y: z.number() }),
  z.object({ kind: z.literal("ordering"), order: z.array(z.number().int()) }),
]);
export type PredictionAnswer = z.infer<typeof PredictionAnswerSchema>;

export const PredictionSchema = z.object({
  id: PredictionIdSchema,
  beat: BeatIdSchema,
  /** Specific and falsifiable. "What happens?" is a failure; "where does speed settle?" is the bar. */
  question: z.string().min(12).max(120),
  freeze: z.literal(true),
  answer: PredictionAnswerSpecSchema,
  resolve: z.object({
    runForMs: z.number().int().min(500).max(20000),
    then: z.enum(["reveal", "reveal-and-annotate"]).default("reveal-and-annotate"),
  }),
  /** Shown only AFTER commit. Never leak it into a caption. */
  whyCorrect: z.string().min(12).max(140),
  /**
   * Misconception → targeted correction. High leverage: lets the coach say "most people predict
   * that, because…" instead of "incorrect".
   */
  commonWrong: z.array(z.object({
    pattern: z.string().max(40),
    because: z.string().max(120),
  })).max(3).optional(),
});
export type Prediction = z.infer<typeof PredictionSchema>;

// ── Quiz (generated at RECALL time from blueprint + transcript) ────────────────────────────────

export const QuizBlueprintSchema = z.object({
  itemCount: z.number().int().min(LIMITS.minQuizItems).max(LIMITS.maxQuizItems),
  mustCover: z.array(z.enum([
    "teachingAngle", "missedPrediction", "unvisitedRegime", "extremeKnob", "undiscoveredNotable",
  ])).min(1),
  allowInteractive: z.boolean().default(true),
  difficultyCurve: z.enum(["flat", "rising"]).default("rising"),
});
export type QuizBlueprint = z.infer<typeof QuizBlueprintSchema>;

/**
 * `tune` is the flagship item type: the learner drives the lab to hit a target. It demonstrates
 * transferable intuition rather than recognition, and it's graded by RE-RUNNING THE SIM
 * server-side (doc 05) — client-reported success is not trustworthy.
 */
export const QuizItemSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string(), kind: z.literal("choice"), prompt: z.string().max(200), options: z.array(z.string().max(100)).min(2).max(5) }),
  z.object({ id: z.string(), kind: z.literal("numeric"), prompt: z.string().max(200), unit: z.string().max(8).optional() }),
  z.object({
    id: z.string(), kind: z.literal("tune"), prompt: z.string().max(200),
    target: z.object({
      observable: ObservableIdSchema,
      op: z.enum(["gt", "lt", "between"]),
      value: z.union([z.number(), z.tuple([z.number(), z.number()])]),
      withinMs: z.number().int().min(500).max(30000).default(5000),
    }),
    allowedParams: z.array(ParamIdSchema).min(1),
  }),
  z.object({ id: z.string(), kind: z.literal("order"), prompt: z.string().max(200), items: z.array(z.string().max(60)).min(2).max(6) }),
  z.object({ id: z.string(), kind: z.literal("explain"), prompt: z.string().max(200), maxWords: z.number().int().min(10).max(60) }),
]);
export type QuizItem = z.infer<typeof QuizItemSchema>;

/**
 * `generatedFrom` is returned to the client so items can be labelled honestly
 * ("you predicted this one wrong") — that framing measurably beats unlabelled review.
 */
export const AssessmentSchema = z.object({
  id: AssessmentIdSchema,
  items: z.array(QuizItemSchema).min(LIMITS.minQuizItems).max(LIMITS.maxQuizItems),
  generatedFrom: z.object({
    missedPredictions: z.array(PredictionIdSchema),
    extremeParams: z.array(ParamIdSchema),
    unvisitedRegimes: z.array(z.string()),
    undiscoveredNotables: z.array(z.string()),
  }),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const AssessmentPlanSchema = z.object({
  predictions: z.array(PredictionSchema).min(1).max(LIMITS.maxPredictions),
  quizBlueprint: QuizBlueprintSchema,
  masteryThreshold: z.number().min(0.3).max(1).default(0.7),
});
export type AssessmentPlan = z.infer<typeof AssessmentPlanSchema>;

export const RecallCardSchema = z.object({
  sessionId: SessionIdSchema,
  title: z.string().max(48),
  bigIdea: z.string().max(90),
  keyKnob: z.object({ param: ParamIdSchema, label: z.string().max(24), why: z.string().max(100) }),
  /** Canvas snapshot at the learner's most interesting moment. ≤200KB. */
  imageDataUrl: z.string().optional(),
  retentionQuestion: z.object({
    prompt: z.string().max(160),
    kind: z.enum(["choice", "numeric"]),
    options: z.array(z.string().max(80)).max(4).optional(),
  }),
  createdAt: z.string().datetime(),
});
export type RecallCard = z.infer<typeof RecallCardSchema>;
