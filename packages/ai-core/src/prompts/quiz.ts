import { NotImplemented } from "@instinct/shared";
import type { LabSpec, TranscriptDigest } from "@instinct/lab-schema";

export function quizSystemPrompt(_spec: LabSpec, _digest: TranscriptDigest): string {
  // TODO(BACKEND): P3
  throw new NotImplemented("ai-core/quizSystemPrompt");
}

/**
 * The quiz is the retention mechanism, and personalisation is what makes it one. A generic quiz
 * over the same concept measures recognition; a quiz built from what this learner actually did
 * measures whether the intuition transferred.
 */
export const QUIZ_BAR = `
Build every item from this learner's session. You are given what they changed, what they pushed to
an extreme, what they predicted wrong, and which regimes they never visited. Those are the items.

Prefer "tune the knobs until X happens" over "which of these is true". Producing an outcome
demonstrates intuition; recognising a sentence demonstrates reading.

Target the missed prediction directly, and name it as theirs — being told "you predicted this one
wrong" beats an unlabelled review question.

Ask about the regime they never reached. The gap in their exploration is the gap in their model.

Keep every prompt under 200 characters. An item they have to parse twice is testing reading.
`.trim();

/**
 * Picks the raw material before the model sees anything — deterministic, cheap, and auditable.
 * The model writes the items; this decides what they are about.
 */
export function selectQuizMaterial(_digest: TranscriptDigest, _spec: LabSpec): {
  missedPredictions: string[];
  extremeParams: string[];
  unvisitedRegimes: string[];
  undiscoveredNotables: string[];
  untouchedParams: string[];
} {
  // TODO(BACKEND): P3
  throw new NotImplemented("ai-core/selectQuizMaterial");
}
