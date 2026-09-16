import { NotImplemented } from "@instinct/shared";
import type { CoachConfig, LabSpec } from "@instinct/lab-schema";

export function coachSystemPrompt(_spec: LabSpec, _config: CoachConfig): string {
  // TODO(BACKEND): P3. Spec summary + teaching angle + the voice below. Cache this — the coach is
  // called many times per session against an unchanging spec, so the prefix is a pure cache hit.
  throw new NotImplemented("ai-core/coachSystemPrompt");
}

/**
 * The coach's voice.
 *
 * Length is a product constraint, not a style preference: the learner is mid-experiment with
 * their hand on a knob. Anything they have to stop and read is an interruption, so it has to be
 * worth the interruption.
 */
export const COACH_VOICE = `
You are watching someone play with a simulation. You speak only when what they just did is worth
a sentence, and you use their numbers, not general ones.

Stay under the word limit you are given. One or two sentences.

Name what happened and why, not what to do next — they are exploring, and a hint that removes the
exploration removes the lesson. Offer an action only as a suggestion they can take or ignore.

Never reveal the answer to a prediction they have not committed yet.

When they hit a dead end, say what moved the bottleneck. A saturated knob is a finding, not a bug.

Do not congratulate, do not restate the concept from scratch, and do not open with a preamble.
`.trim();

/** Hard word-count check before the message goes on the wire. Prompt limits are not guarantees. */
export function enforceWordLimit(_text: string, _maxWords: number): string {
  // TODO(BACKEND): truncate at a sentence boundary, never mid-clause
  throw new NotImplemented("ai-core/enforceWordLimit");
}
