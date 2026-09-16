import { NotImplemented } from "@instinct/shared";
import type { SimCore } from "@instinct/lab-sim";

/**
 * Drives SimCore.step(). Two backends behind one interface — SimCore itself touches no browser
 * global, which is exactly what makes both possible (doc 04 §where the loop runs).
 */
export interface Clock {
  start(): void;
  stop(): void;
  /** Advance exactly n ticks while paused — the step button. */
  stepOnce(n?: number): void;
  setSpeed(multiplier: number): void;
  readonly running: boolean;
  /** Called after each tick. Used for observable sampling and the renderer's draw hook. */
  onTick(fn: (frame: number, t: number) => void): () => void;
}

export interface ClockOptions {
  tickRate: number;
  timeScale: number;
  /** Cap on catch-up steps per frame, so a backgrounded tab can't teleport the sim. */
  maxCatchUpSteps?: number;
}

/**
 * Default backend. requestAnimationFrame with a fixed-timestep accumulator — correct and simple
 * for ≤2000 entities, which covers nearly every lab.
 */
export function createRafClock(_sim: SimCore, _opts: ClockOptions): Clock {
  // TODO(FRONTEND): accumulator loop, clampDt, max 4 catch-up steps
  throw new NotImplemented("lab-client/createRafClock");
}

/**
 * Sim runs in a Worker over a SharedArrayBuffer; the main thread only draws. Used when
 * tickRate > 60 or entities > 800.
 *
 * MUST fall back to createRafClock when SAB is unavailable (missing COOP/COEP headers), and the
 * fallback must be SILENT — a learner should never see a capability message.
 */
export function createWorkerClock(_sim: SimCore, _opts: ClockOptions): Clock {
  // TODO(FRONTEND): last priority. createRafClock covers nearly every lab — do not start here.
  throw new NotImplemented("lab-client/createWorkerClock");
}

export function sharedArrayBufferAvailable(): boolean {
  return typeof SharedArrayBuffer !== "undefined" && typeof Atomics !== "undefined";
}

/** Picks the backend. The UI calls this, never the constructors directly. */
export function createClock(sim: SimCore, opts: ClockOptions, entityTotal: number): Clock {
  const wantsWorker = opts.tickRate > 60 || entityTotal > 800;
  return wantsWorker && sharedArrayBufferAvailable()
    ? createWorkerClock(sim, opts)
    : createRafClock(sim, opts);
}
