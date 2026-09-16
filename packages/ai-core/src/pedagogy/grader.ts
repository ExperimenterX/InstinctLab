import type {
  Assessment, GradeRequest, GradeResponse, LabSpec, RecallCard, TranscriptDigest,
} from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

export interface GradeInput {
  spec: LabSpec;
  assessment: Assessment;
  key: unknown;
  request: GradeRequest;
  digest: TranscriptDigest;
  seed: number;
}

export async function gradeQuiz(_input: GradeInput): Promise<Result<GradeResponse, Error>> {
  // TODO(BACKEND): P4. Per item kind:
  //   choice/numeric/order → deterministic against the key
  //   tune                 → runHeadless(spec, submittedParams, withinMs, seed), then check the
  //                          target. The client's `tuneResult` is a cross-check, never the grade
  //                          — client-reported success is not trustworthy.
  //   explain              → model-graded against the teaching angle, generous on wording and
  //                          strict on mechanism. Someone who has the idea and not the vocabulary
  //                          has learned the thing we were teaching.
  throw new NotImplemented("ai-core/gradeQuiz");
}

/**
 * The retention artifact: one image, one sentence, one knob. This is what the learner sees
 * tomorrow, so `keyKnob` must be the knob that actually mattered — read it from the transcript,
 * not from the spec's `prominence`.
 */
export async function buildRecallCard(
  _spec: LabSpec,
  _digest: TranscriptDigest,
  _canvasDataUrl: string | null,
): Promise<Result<RecallCard, Error>> {
  // TODO(BACKEND): P4
  throw new NotImplemented("ai-core/buildRecallCard");
}
