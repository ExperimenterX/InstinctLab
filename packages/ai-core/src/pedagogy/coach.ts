import type { CoachMessage, CoachRequest, CoachTrigger, LabSpec } from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

/**
 * Two entry points, one voice.
 *
 * The cost model is why: a model call per interaction would be slow, expensive, and chatty.
 * Triggers are detected LOCALLY by FRONTEND's rule-based detector and only then explained by a model
 * (doc 02 §coach policy). The client tells us *what happened*; we decide *what's worth saying*.
 */

export interface TriggeredCoachInput {
  spec: LabSpec;
  trigger: CoachTrigger;
  /** Sampled state at the moment the trigger fired — params + observables. */
  state: CoachRequest["currentState"];
  detail: {
    param?: string;
    observable?: string;
    regime?: string;
    notable?: string;
    observableDelta?: number;
  };
  /** Prior messages this session, so the coach doesn't repeat itself. */
  recent: readonly CoachMessage[];
}

export async function coachOnTrigger(
  _input: TriggeredCoachInput,
): Promise<Result<CoachMessage | null, Error>> {
  // TODO(BACKEND): P3. Returns null when the trigger isn't worth a message — silence is a valid and
  // frequently correct answer. Enforce debounce (≥8s) before calling the model, not after:
  // a suppressed message should cost nothing.
  throw new NotImplemented("ai-core/coachOnTrigger");
}

/** Learner-initiated: a question, or a hint request when `question` is absent. */
export async function coachOnAsk(
  _spec: LabSpec,
  _req: CoachRequest,
): Promise<Result<CoachMessage, Error>> {
  // TODO(BACKEND): P3. Hint path: nudge toward an experiment, never state the outcome.
  throw new NotImplemented("ai-core/coachOnAsk");
}
