import type { LabSpec, ObservableId, ParamId } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";

/**
 * Server-side simulation runs. This is the reason lab-sim is environment-free.
 *
 * Used for:
 *  - grading `tune` quiz items — the learner claims they hit the target; we re-run with their
 *    params and check. Client-reported success is not trustworthy.
 *  - resolving a prediction — run the frozen state forward `resolve.runForMs` and read the
 *    observable, so the verdict is computed from the same engine the learner was watching.
 *
 * Deterministic given the same seed. That is what makes a prediction fair and a grade defensible.
 */
export interface HeadlessRunInput {
  spec: LabSpec;
  params: Readonly<Record<ParamId, number>>;
  forMs: number;
  seed: number;
  /** Start from a snapshot instead of a fresh reset — used for prediction resolution. */
  fromSnapshot?: unknown;
}

export interface HeadlessRunOutput {
  observables: Record<ObservableId, number>;
  finalFrame: number;
  finalT: number;
  diverged: boolean;
}

export function runHeadless(_input: HeadlessRunInput): HeadlessRunOutput {
  // TODO(BACKEND): compile → poke params → fixed-step to forMs → read observables.
  // Fixed timestep only; never wall-clock. Two grading runs of the same submission must
  // produce identical numbers or the grade isn't defensible.
  throw new NotImplemented("lab-sim/runHeadless");
}

/** Step budget guard, so a pathological spec can't hang an API request. */
export const MAX_HEADLESS_STEPS = 20_000;
