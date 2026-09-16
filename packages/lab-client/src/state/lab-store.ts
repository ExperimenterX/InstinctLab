import type {
  BeatId, CoachMessage, ObservableId, ParamId, Phase, PredictionAnswer, PredictionId, Preset,
} from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { SimCore } from "@instinct/lab-sim";
import type { Clock } from "../clock.js";
import type { LabBus } from "../bus/lab-bus.js";
import type { Store } from "./create-store.js";

/**
 * Ring 1 — input-rate UI state.
 *
 * `paramValues` is a DISPLAY MIRROR, not the source of truth. The slab is the truth; if they ever
 * disagree, the slab wins. The mirror exists to render "0.85" next to a knob and to serialise the
 * session.
 */
export interface LabUiState {
  phase: Phase;
  beatId: BeatId | null;
  paramValues: Readonly<Record<string, number>>;
  unlockedParams: ReadonlySet<string>;
  running: boolean;
  speed: number;
  /** Written at ≤10Hz by `sampleObservables`. NEVER per frame. */
  observableSamples: Readonly<Record<string, number>>;
  coachMessages: readonly CoachMessage[];
  discoveredNotables: ReadonlySet<string>;
  goalProgress: Readonly<Record<string, number>>;
  /** True during PREDICT — the sim is frozen and the canvas shows a commit affordance. */
  frozen: boolean;
  frame: number;
}

export interface LabStore extends Store<LabUiState> {
  /**
   * THE HOT PATH (doc 04). Order is load-bearing:
   *   1. sim.poke(slot, v)   — the sim sees it THIS tick; no await, no React
   *   2. store mirror update — notifies only knob-label subscribers
   *   3. bus.emit            — ring buffer, no network
   * The canvas is not involved in steps 2–3; it already read the value off the slab.
   */
  setParam(id: ParamId, value: number): void;

  setPhase(phase: Phase): void;
  setBeat(id: BeatId): void;
  applyPreset(preset: Preset): void;
  unlockParams(ids: readonly ParamId[]): void;

  play(): void;
  pause(): void;
  stepOnce(n?: number): void;
  scrubTo(frame: number): void;
  setSpeed(multiplier: number): void;

  freeze(): void;
  thaw(): void;
  commitPrediction(id: PredictionId, answer: PredictionAnswer): void;

  pushCoachMessage(msg: CoachMessage): void;

  /** Called from the clock's onTick when `frame % 6 === 0` — 60fps in, 10Hz out. */
  sampleObservables(sim: SimCore, ids: readonly ObservableId[]): void;

  /** Resolve a param id to a slab slot ONCE, at knob mount. Never call this per frame. */
  slotFor(id: ParamId): number;

  dispose(): void;
}

export interface LabStoreDeps {
  sim: SimCore;
  clock: Clock;
  bus: LabBus;
  onPredictionCommit?: (id: PredictionId, answer: PredictionAnswer) => void;
}

export function createLabStore(_deps: LabStoreDeps): LabStore {
  // TODO(FRONTEND): setParam, slotFor, sampleObservables, play/pause first — those four unblock
  // the whole UI.
  throw new NotImplemented("lab-client/createLabStore");
}
