import type { Beat, BeatId, Goal, LabSpec, Phase } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { LabUiState } from "./lab-store.js";

/**
 * Pure selectors over Ring 1 / Ring 2 state. Keep them cheap and referentially stable — every one
 * of these runs inside a React render.
 */

export function currentBeat(_spec: LabSpec, _state: LabUiState): Beat | null {
  throw new NotImplemented("lab-client/currentBeat");
}

export function nextBeat(_spec: LabSpec, _beatId: BeatId): Beat | null {
  throw new NotImplemented("lab-client/nextBeat");
}

/** 0..1. Drives the phase rail's progress indicator. */
export function goalProgress(_goal: Goal, _state: LabUiState): number {
  throw new NotImplemented("lab-client/goalProgress");
}

export function isGoalMet(_goal: Goal, _state: LabUiState): boolean {
  throw new NotImplemented("lab-client/isGoalMet");
}

/**
 * Which params are touchable right now — the union of every unlock up to the current beat.
 * Goals never re-lock: the learner may always scrub back to a completed beat and keep playing.
 */
export function unlockedParamsFor(_spec: LabSpec, _beatId: BeatId): ReadonlySet<string> {
  throw new NotImplemented("lab-client/unlockedParamsFor");
}

export function phaseOf(_spec: LabSpec, _beatId: BeatId): Phase | null {
  throw new NotImplemented("lab-client/phaseOf");
}

/** Time controls appear only once a beat unlocks them (`unlock.time`). */
export function timeControlsEnabled(_spec: LabSpec, _state: LabUiState): boolean {
  throw new NotImplemented("lab-client/timeControlsEnabled");
}
