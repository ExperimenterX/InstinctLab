import { z } from "zod";
import { BeatIdSchema, ObservableIdSchema, ParamIdSchema, PredictionIdSchema } from "./ids.js";
import { PhaseSchema } from "./beats.js";

/**
 * The transcript. This is NOT analytics — it is the raw material for the personalised quiz
 * (doc 01 §6), so it must be complete. Coalesce, never sample.
 */
export const LabEventKindSchema = z.enum([
  "param.change", "preset.apply",
  "entity.drag", "entity.click",
  "time.play", "time.pause", "time.step", "time.scrub",
  "beat.enter", "beat.complete",
  "notable.reached", "regime.change", "clamp.hit",
  "prediction.commit", "prediction.resolve",
  "coach.shown", "coach.asked",
  "quiz.answer",
  "sim.diverged", "render.error",
]);
export type LabEventKind = z.infer<typeof LabEventKindSchema>;

const base = {
  /** Client monotonic ms since session start. Server never trusts this for ordering. */
  at: z.number().nonnegative(),
  frame: z.number().int().nonnegative(),
  phase: PhaseSchema,
  beatId: BeatIdSchema.nullable(),
};

/**
 * A 200-event slider drag is coalesced into ONE event with `samples` and `durationMs`.
 * Uncoalesced drags flood the transcript and drown the signal the quiz builder needs (doc 04).
 */
export const LabEventSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base, kind: z.literal("param.change"), param: ParamIdSchema,
    from: z.number(), to: z.number(), samples: z.number().int().min(1), durationMs: z.number().nonnegative(),
    hitBound: z.enum(["min", "max"]).nullable().default(null),
  }),
  z.object({ ...base, kind: z.literal("preset.apply"), presetId: z.string() }),
  z.object({ ...base, kind: z.literal("entity.drag"), layer: z.string(), entity: z.number().int(), x: z.number(), y: z.number() }),
  z.object({ ...base, kind: z.literal("entity.click"), layer: z.string(), entity: z.number().int() }),
  z.object({ ...base, kind: z.literal("time.play") }),
  z.object({ ...base, kind: z.literal("time.pause") }),
  z.object({ ...base, kind: z.literal("time.step"), steps: z.number().int().min(1) }),
  z.object({ ...base, kind: z.literal("time.scrub"), toFrame: z.number().int().nonnegative() }),
  z.object({ ...base, kind: z.literal("beat.enter"), beat: BeatIdSchema }),
  z.object({ ...base, kind: z.literal("beat.complete"), beat: BeatIdSchema, elapsedMs: z.number().nonnegative() }),
  z.object({ ...base, kind: z.literal("notable.reached"), notable: z.string() }),
  z.object({ ...base, kind: z.literal("regime.change"), observable: ObservableIdSchema, regime: z.string(), value: z.number() }),
  z.object({ ...base, kind: z.literal("clamp.hit"), param: ParamIdSchema, bound: z.enum(["min", "max"]), observableDelta: z.number() }),
  z.object({ ...base, kind: z.literal("prediction.commit"), prediction: PredictionIdSchema, answerDigest: z.string() }),
  z.object({ ...base, kind: z.literal("prediction.resolve"), prediction: PredictionIdSchema, verdict: z.enum(["correct", "close", "wrong"]) }),
  z.object({ ...base, kind: z.literal("coach.shown"), messageId: z.string(), trigger: z.string() }),
  z.object({ ...base, kind: z.literal("coach.asked"), chars: z.number().int().nonnegative() }),
  z.object({ ...base, kind: z.literal("quiz.answer"), itemId: z.string(), correct: z.boolean() }),
  z.object({ ...base, kind: z.literal("sim.diverged"), reason: z.string().max(80) }),
  z.object({ ...base, kind: z.literal("render.error"), message: z.string().max(200) }),
]);
export type LabEvent = z.infer<typeof LabEventSchema>;

/**
 * Digest of the transcript, computed by BACKEND and consumed by BACKEND's quiz builder.
 * This is the whole reason the transcript exists.
 */
export const TranscriptDigestSchema = z.object({
  minutesActive: z.number().nonnegative(),
  knobChanges: z.number().int().nonnegative(),
  /** Params the learner pushed to a bound — prime quiz material. */
  extremeParams: z.array(z.object({ param: ParamIdSchema, bound: z.enum(["min", "max"]), times: z.number().int() })),
  /** Params never touched — a knob they ignored may be the one that mattered. */
  untouchedParams: z.array(ParamIdSchema),
  notablesFound: z.array(z.string()),
  notablesMissed: z.array(z.string()),
  regimesVisited: z.array(z.string()),
  regimesUnvisited: z.array(z.string()),
  predictions: z.array(z.object({
    prediction: PredictionIdSchema,
    verdict: z.enum(["correct", "close", "wrong"]),
    theirValue: z.number().nullable(),
    actualValue: z.number().nullable(),
  })),
  thrashCount: z.number().int().nonnegative(),
  divergences: z.number().int().nonnegative(),
});
export type TranscriptDigest = z.infer<typeof TranscriptDigestSchema>;
