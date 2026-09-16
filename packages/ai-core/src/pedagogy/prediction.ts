import type { LabSpec, PredictRequest, PredictResponse } from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

/**
 * The UNDERSTAND phase lives here. Grading is arithmetic; the explanation is the product.
 *
 * Order of operations matters (doc 05): the commit is persisted before the verdict is computed,
 * so a learner cannot retry a prediction and have the second attempt count.
 */
export interface ResolveInput {
  spec: LabSpec;
  request: PredictRequest;
  /** Observable values after `resolve.runForMs`, from a server-side headless re-run. */
  actual: Record<string, number>;
}

export async function resolvePrediction(
  _input: ResolveInput,
): Promise<Result<PredictResponse, Error>> {
  // TODO(BACKEND): P4.
  //  1. grade deterministically (tolerance / direction / index / point distance / order)
  //  2. match against the spec's `commonWrong` patterns — a named misconception beats a verdict
  //  3. generate the explanation: ≤40 words, MUST cite the learner's own number, and explain
  //     the DELTA between their guess and the outcome rather than restating the concept
  //  4. pick the annotation target so FRONTEND can highlight the thing that caused the surprise
  throw new NotImplemented("ai-core/resolvePrediction");
}

/** Pure grading, no model call. Shared with the quiz grader. */
export function gradePredictionAnswer(
  _spec: LabSpec,
  _request: PredictRequest,
  _actual: Record<string, number>,
): { verdict: "correct" | "close" | "wrong"; delta: number | null } {
  // TODO(BACKEND): P4. "close" exists so a learner with the right intuition and the wrong arithmetic
  // is told they were right about the mechanism.
  throw new NotImplemented("ai-core/gradePredictionAnswer");
}
