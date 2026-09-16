import type { Assessment, LabSpec, TranscriptDigest } from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

/**
 * Builds the RECALL quiz from the blueprint + the session transcript.
 *
 * The answer key is returned separately and never leaves the server (`Session.assessmentKey`).
 * API must not include it in any response.
 */
export interface BuildQuizResult {
  assessment: Assessment;
  /** Server-side only. `tune` items store the target; graded by re-running the sim. */
  key: unknown;
}

export async function buildQuiz(
  _spec: LabSpec,
  _digest: TranscriptDigest,
): Promise<Result<BuildQuizResult, Error>> {
  // TODO(BACKEND): P4. selectQuizMaterial → generateStructured against AssessmentSchema →
  // verify every `mustCover` entry from the blueprint is actually covered, and re-ask once if not.
  throw new NotImplemented("ai-core/buildQuiz");
}

/**
 * Template fallback over the spec's declared params and observables. Used when generation fails
 * — a plain quiz still beats no quiz, because the session's value is in the recall step.
 */
export function templateQuiz(_spec: LabSpec, _digest: TranscriptDigest): BuildQuizResult {
  // TODO(BACKEND): P4
  throw new NotImplemented("ai-core/templateQuiz");
}
