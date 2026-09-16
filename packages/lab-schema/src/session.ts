import { z } from "zod";
import { AssessmentIdSchema, BeatIdSchema, ParamIdSchema, PredictionIdSchema, SessionIdSchema } from "./ids.js";
import { PhaseSchema } from "./beats.js";
import { LabPlanSchema } from "./meta.js";
import { LabSpecSchema } from "./spec.js";
import { AssessmentSchema, PredictionAnswerSchema, RecallCardSchema } from "./assessment.js";

export const SessionStatusSchema = z.enum([
  "planning", "composing", "ready", "assessing", "complete", "failed",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const ProgressSchema = z.object({
  phase: PhaseSchema,
  beatId: BeatIdSchema.nullable(),
  completedBeats: z.array(BeatIdSchema),
  discoveredNotables: z.array(z.string()),
  predictionsCommitted: z.array(PredictionIdSchema),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const CommittedPredictionSchema = z.object({
  predictionId: PredictionIdSchema,
  answer: PredictionAnswerSchema,
  verdict: z.enum(["correct", "close", "wrong"]),
  actualValue: z.number().nullable(),
  delta: z.number().nullable(),
  committedAt: z.string().datetime(),
});
export type CommittedPrediction = z.infer<typeof CommittedPredictionSchema>;

export const GradeResultSchema = z.object({
  assessmentId: AssessmentIdSchema,
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  perItem: z.array(z.object({
    itemId: z.string(),
    correct: z.boolean(),
    expected: z.string(),
    feedback: z.string().max(200),
    replayHint: z.record(ParamIdSchema, z.number()).optional(),
  })),
  mastery: z.object({
    teachingAngle: z.enum(["solid", "shaky", "missing"]),
    notes: z.string().max(280),
  }),
  gradedAt: z.string().datetime(),
});
export type GradeResult = z.infer<typeof GradeResultSchema>;

/**
 * One document per session, versioned by `rev`. Writes are append/patch operations, never a blind
 * whole-document overwrite — events arrive concurrently with phase changes (doc 02 §persistence).
 * BACKEND enforces compare-and-set on `rev`.
 */
export const SessionSchema = z.object({
  id: SessionIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: SessionStatusSchema,
  concept: z.string().max(280),
  /** Set when this session came from POST /remix — the parent's transcript feeds the composer. */
  parentSessionId: SessionIdSchema.nullable().default(null),
  plan: LabPlanSchema.nullable(),
  spec: LabSpecSchema.nullable(),
  /** PRNG seed — makes the lab reproducible so a prediction can be replayed exactly. */
  seed: z.number().int(),
  progress: ProgressSchema,
  predictions: z.array(CommittedPredictionSchema),
  assessment: AssessmentSchema.nullable(),
  /** Correct answers live here, server-side only. NEVER serialised to the client. */
  assessmentKey: z.unknown().nullable(),
  grade: GradeResultSchema.nullable(),
  recallCard: RecallCardSchema.nullable(),
  eventCount: z.number().int().nonnegative(),
  rev: z.number().int().nonnegative(),
});
export type Session = z.infer<typeof SessionSchema>;

/** Client-safe projection. BACKEND and API must use this — never send a raw Session. */
export const PublicSessionSchema = SessionSchema.omit({
  assessmentKey: true, seed: true, expiresAt: true,
});
export type PublicSession = z.infer<typeof PublicSessionSchema>;
