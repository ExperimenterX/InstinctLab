import { z } from "zod";
import { LIMITS } from "./limits.js";
import { AssessmentIdSchema, ObservableIdSchema, ParamIdSchema, PredictionIdSchema, SessionIdSchema } from "./ids.js";
import { BeatIdSchema, PhaseSchema } from "./beats.js";
import { DomainSchema, LabPlanSchema } from "./meta.js";
import { LabSpecSchema } from "./spec.js";
import { ModelSchema } from "./model.js";
import { StageSchema } from "./stage.js";
import { ControlSchema } from "./controls.js";
import { BeatSchema } from "./beats.js";
import { LabEventSchema } from "./events.js";
import { AssessmentSchema, PredictionAnswerSchema, RecallCardSchema } from "./assessment.js";
import { CoachMessageSchema, HighlightSchema } from "./coach.js";
import { GradeResultSchema, ProgressSchema, SessionStatusSchema } from "./session.js";

/**
 * Request/response schemas for every endpoint in docs/05-api-contract.md.
 * API validates EVERY request body with these before doing anything else.
 */

// ── POST /api/labs ────────────────────────────────────────────────────────────────────────────

/**
 * `clientCapabilities` becomes a CEILING on the composer's limits, not a prompt suggestion —
 * models ignore suggestions (doc 05).
 */
export const CreateLabRequestSchema = z.object({
  concept: z.string().min(LIMITS.minConceptChars).max(LIMITS.maxConceptChars),
  hints: z.object({
    domain: DomainSchema.optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    priorKnowledge: z.string().max(200).optional(),
  }).optional(),
  clientCapabilities: z.object({
    sharedArrayBuffer: z.boolean(),
    reducedMotion: z.boolean(),
    maxEntities: z.number().int().min(50).max(LIMITS.maxEntities).optional(),
  }).optional(),
});
export type CreateLabRequest = z.infer<typeof CreateLabRequestSchema>;

export const CreateLabResponseSchema = z.object({
  sessionId: SessionIdSchema,
  streamUrl: z.string(),
  status: z.literal("planning"),
  createdAt: z.string().datetime(),
});
export type CreateLabResponse = z.infer<typeof CreateLabResponseSchema>;

// ── GET /api/labs/:id ─────────────────────────────────────────────────────────────────────────

/** Deliberately excludes the transcript — it can be thousands of events. Use /recap. */
export const GetLabResponseSchema = z.object({
  session: z.object({
    id: SessionIdSchema,
    status: SessionStatusSchema,
    concept: z.string(),
    createdAt: z.string().datetime(),
    rev: z.number().int(),
  }),
  plan: LabPlanSchema.nullable(),
  spec: LabSpecSchema.nullable(),
  progress: ProgressSchema,
  assessment: AssessmentSchema.nullable(),
  recallCard: RecallCardSchema.nullable(),
});
export type GetLabResponse = z.infer<typeof GetLabResponseSchema>;

// ── PATCH /api/labs/:id ───────────────────────────────────────────────────────────────────────

export const PatchLabRequestSchema = z.object({
  rev: z.number().int().nonnegative(),
  phase: PhaseSchema.optional(),
  beatId: BeatIdSchema.optional(),
  completedBeat: BeatIdSchema.optional(),
});
export type PatchLabRequest = z.infer<typeof PatchLabRequestSchema>;

export const PatchLabResponseSchema = z.object({ rev: z.number().int(), progress: ProgressSchema });
export type PatchLabResponse = z.infer<typeof PatchLabResponseSchema>;

// ── POST /api/labs/:id/events ─────────────────────────────────────────────────────────────────

export const PostEventsRequestSchema = z.object({
  events: z.array(LabEventSchema).min(1).max(LIMITS.maxEventsPerBatch),
  clientTime: z.number().nonnegative(),
  frame: z.number().int().nonnegative(),
});
export type PostEventsRequest = z.infer<typeof PostEventsRequestSchema>;

/** Tiny by design — this handler must never be slow. */
export const PostEventsResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  coachPending: z.boolean(),
});
export type PostEventsResponse = z.infer<typeof PostEventsResponseSchema>;

// ── POST /api/labs/:id/predict ────────────────────────────────────────────────────────────────

export const PredictRequestSchema = z.object({
  predictionId: PredictionIdSchema,
  answer: PredictionAnswerSchema,
  /** Proves which frozen state was being predicted. Mismatch downgrades, never 400s. */
  simSnapshotDigest: z.string().max(64),
  observedAtFreeze: z.record(ObservableIdSchema, z.number()),
});
export type PredictRequest = z.infer<typeof PredictRequestSchema>;

export const PredictResponseSchema = z.object({
  verdict: z.enum(["correct", "close", "wrong"]),
  actual: z.union([
    z.object({ observable: ObservableIdSchema, value: z.number() }),
    z.object({ index: z.number().int() }),
  ]).nullable(),
  delta: z.number().nullable(),
  /** ≤40 words, and must reference the learner's own number (doc 01 §5). */
  explanation: z.string().max(320),
  misconception: z.object({ pattern: z.string(), because: z.string() }).nullable(),
  annotate: HighlightSchema.nullable(),
  rev: z.number().int(),
});
export type PredictResponse = z.infer<typeof PredictResponseSchema>;

// ── POST /api/labs/:id/coach ──────────────────────────────────────────────────────────────────

/**
 * The client sends its own state because the server does not mirror the slab — mirroring 60fps
 * state server-side would be absurd. The coach gets a SAMPLE (doc 05).
 */
export const CoachRequestSchema = z.object({
  question: z.string().max(240).optional(),
  currentState: z.object({
    params: z.record(ParamIdSchema, z.number()),
    observables: z.record(ObservableIdSchema, z.number()),
    phase: PhaseSchema,
    beatId: BeatIdSchema,
  }),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export const CoachResponseSchema = z.object({ message: CoachMessageSchema });
export type CoachResponse = z.infer<typeof CoachResponseSchema>;

// ── POST /api/labs/:id/remix ──────────────────────────────────────────────────────────────────

/** A NEW session, not a mutation. "harder" means harder than what this learner demonstrated. */
export const RemixRequestSchema = z.object({
  intent: z.enum(["harder", "simpler", "different-angle", "different-archetype"]),
  note: z.string().max(200).optional(),
});
export type RemixRequest = z.infer<typeof RemixRequestSchema>;

export const RemixResponseSchema = z.object({
  sessionId: SessionIdSchema,
  streamUrl: z.string(),
  parentSessionId: SessionIdSchema,
});
export type RemixResponse = z.infer<typeof RemixResponseSchema>;

// ── POST /api/labs/:id/assessment ─────────────────────────────────────────────────────────────

export const BuildAssessmentRequestSchema = z.object({ regenerate: z.boolean().default(false) });
export type BuildAssessmentRequest = z.infer<typeof BuildAssessmentRequestSchema>;

/** Correct answers are NOT here. They stay server-side until grading. */
export const BuildAssessmentResponseSchema = z.object({ assessment: AssessmentSchema });
export type BuildAssessmentResponse = z.infer<typeof BuildAssessmentResponseSchema>;

// ── POST /api/labs/:id/assessment/grade ───────────────────────────────────────────────────────

export const GradeRequestSchema = z.object({
  assessmentId: AssessmentIdSchema,
  answers: z.array(z.object({
    itemId: z.string(),
    value: z.union([z.number(), z.string(), z.array(z.number())]),
    /** For `tune` items: a cross-check only. The grade comes from a server-side sim re-run. */
    tuneResult: z.object({
      params: z.record(ParamIdSchema, z.number()),
      observables: z.record(ObservableIdSchema, z.number()),
    }).optional(),
  })).min(1).max(LIMITS.maxQuizItems),
});
export type GradeRequest = z.infer<typeof GradeRequestSchema>;

export const GradeResponseSchema = GradeResultSchema.extend({
  recallCard: RecallCardSchema,
  suggestedRemix: z.object({ intent: z.enum(["harder", "different-angle"]) }).nullable(),
});
export type GradeResponse = z.infer<typeof GradeResponseSchema>;

// ── GET /api/labs/:id/recap ───────────────────────────────────────────────────────────────────

export const RecapResponseSchema = z.object({
  recallCard: RecallCardSchema.nullable(),
  summary: z.object({
    conceptTitle: z.string(),
    teachingAngle: z.string(),
    minutesActive: z.number(),
    knobChanges: z.number().int(),
    notablesFound: z.array(z.string()),
    notablesMissed: z.array(z.string()),
    predictions: z.array(z.object({
      question: z.string(), yourAnswer: z.string(), actual: z.string(), correct: z.boolean(),
    })),
    quizScore: z.number().nullable(),
  }),
  replayUrl: z.string(),
  nextConcepts: z.array(z.string()).max(3),
});
export type RecapResponse = z.infer<typeof RecapResponseSchema>;

// ── POST /api/specs/validate ──────────────────────────────────────────────────────────────────

export const ValidateSpecRequestSchema = z.object({
  spec: z.unknown(),
  repair: z.boolean().default(false),
});
export type ValidateSpecRequest = z.infer<typeof ValidateSpecRequestSchema>;

export const ValidateSpecResponseSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.object({
    path: z.string(), code: z.string(), message: z.string(),
    severity: z.enum(["error", "warning"]),
  })),
  repaired: LabSpecSchema.optional(),
  repairNotes: z.array(z.string()).optional(),
});
export type ValidateSpecResponse = z.infer<typeof ValidateSpecResponseSchema>;

// ── GET /api/archetypes ───────────────────────────────────────────────────────────────────────

/**
 * The capability manifest. BACKEND injects this into the composer prompt so the model's options are
 * GENERATED FROM THE CODE THAT EXISTS. This is the main defence against prompt and renderer
 * drifting apart — when FRONTEND adds a config field, the prompt learns about it for free.
 */
export const ArchetypeManifestSchema = z.object({
  archetypes: z.array(z.object({
    id: z.string(),
    summary: z.string(),
    bestFor: z.array(z.string()),
    configSchema: z.unknown(),
    supportedMarks: z.array(z.string()),
    interactions: z.array(z.string()),
    maxEntities: z.number().int(),
    examples: z.array(z.string()),
  })),
  kernels: z.array(z.object({ id: z.string(), summary: z.string(), configSchema: z.unknown() })),
  exprFunctions: z.array(z.string()),
  limits: z.record(z.string(), z.number()),
  specVersion: z.literal("1.0"),
});
export type ArchetypeManifest = z.infer<typeof ArchetypeManifestSchema>;

// ── GET /api/health ───────────────────────────────────────────────────────────────────────────

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  specVersion: z.literal("1.0"),
  adapters: z.object({
    persistence: z.enum(["memory", "sqlite", "redis"]),
    status: z.enum(["up", "down"]),
  }),
  models: z.object({ composer: z.string(), planner: z.string(), reachable: z.boolean() }),
  uptimeSeconds: z.number().nonnegative(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ── SSE stream ────────────────────────────────────────────────────────────────────────────────

/**
 * Spec events are IDEMPOTENT AND REPLAY-SAFE. On reconnect API re-emits lab.model → lab.stage →
 * lab.controls → lab.beats → lab.ready from the persisted spec, so FRONTEND must tolerate receiving
 * any of them twice.
 */
export const StreamEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("lab.plan"), data: LabPlanSchema }),
  z.object({ event: z.literal("lab.model"), data: ModelSchema }),
  z.object({ event: z.literal("lab.stage"), data: StageSchema }),
  z.object({ event: z.literal("lab.controls"), data: z.array(ControlSchema) }),
  z.object({ event: z.literal("lab.beats"), data: z.array(BeatSchema) }),
  z.object({ event: z.literal("lab.ready"), data: z.object({ specId: z.string(), rev: z.number().int() }) }),
  z.object({ event: z.literal("lab.fallback"), data: z.object({ spec: LabSpecSchema, reason: z.string() }) }),
  z.object({ event: z.literal("coach.say"), data: CoachMessageSchema }),
  z.object({ event: z.literal("coach.highlight"), data: HighlightSchema }),
  z.object({ event: z.literal("assessment.ready"), data: AssessmentSchema }),
  z.object({ event: z.literal("session.status"), data: z.object({ status: SessionStatusSchema }) }),
  z.object({
    event: z.literal("error"),
    data: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
  }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type StreamEventName = StreamEvent["event"];
