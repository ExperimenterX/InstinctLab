import type { CoachTrigger, LabSpec, ObservableId, ParamId } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { SimCore } from "@instinct/lab-sim";
import type { LabUiState } from "../state/lab-store.js";

/**
 * Local, RULE-BASED trigger detection. A model call per interaction would be slow and noisy, so
 * the client detects the *situation* cheaply and the server explains it (doc 02 §coach policy).
 *
 * This is also the mechanism behind journey J2 (doc 01): a learner who pushes a knob to its limit
 * and sees nothing happen gets told why, instead of concluding the lab is broken. Dead ends
 * become lessons — but only if we detect them.
 */
export interface DetectedTrigger {
  trigger: CoachTrigger;
  param?: ParamId;
  observable?: ObservableId;
  regime?: string;
  notable?: string;
  /** Observable delta while the param sat at its bound. Near-zero means saturated. */
  observableDelta?: number;
}

export interface TriggerDetectorOptions {
  /** ≥8000 except prediction-resolved. A chatty coach is a worse teacher. */
  debounceMs: number;
  idleMs: number;
  /** ε for "the knob moved but nothing happened". */
  noEffectEpsilon?: number;
  /** Reversals of the same param within 10s that count as thrashing. */
  thrashThreshold?: number;
}

export interface TriggerDetector {
  /** Called from the clock's onTick at ≤4Hz, not every frame. */
  poll(sim: SimCore, state: LabUiState, nowMs: number): readonly DetectedTrigger[];
  noteParamChange(param: ParamId, from: number, to: number, nowMs: number): void;
  reset(): void;
}

export function createTriggerDetector(
  _spec: LabSpec,
  _opts: TriggerDetectorOptions,
): TriggerDetector {
  // TODO(FRONTEND):
  //  clamp-no-effect  param at bound AND max |Δ| across param.affects < ε over ~1s
  //  regime-change    sim.pollRegimeChanges()
  //  notable-reached  sim.pollNotables()
  //  idle             no bus event for idleMs during interact/experiment; fires ONCE then silent
  //  thrash           same param reversed > threshold within 10s
  throw new NotImplemented("lab-client/createTriggerDetector");
}
