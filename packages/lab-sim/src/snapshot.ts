import { NotImplemented } from "@instinct/shared";
import type { SimCore } from "./sim-core.js";

/**
 * One mechanism, three features (doc 04 §snapshots):
 *  - PREDICT: freeze, learner commits, resolve, optionally replay from the identical state
 *  - scrub bar: a ring of recent snapshots
 *  - divergence rollback: restore the last good state on a NaN
 *
 * The identical-state guarantee rests on `seed`: the sim's randomness is seeded, so a replay
 * reproduces the exact outcome. That is what makes a prediction fair.
 */
export interface SimSnapshot {
  t: number;
  frame: number;
  scalars: Float64Array;
  entities: Float64Array;
  seed: number;
  /** Cheap digest, compared server-side on prediction commit. */
  digest: string;
}

export interface SnapshotRingOptions {
  capacity: number;
  hz: number;
}

export interface SnapshotRing {
  push(sim: SimCore): void;
  /** Nearest snapshot at or before `frame`. */
  at(frame: number): SimSnapshot | null;
  latest(): SimSnapshot | null;
  clear(): void;
  readonly bytes: number;
  readonly length: number;
}

export function createSnapshotRing(_opts: SnapshotRingOptions): SnapshotRing {
  // TODO(BACKEND): pre-allocate `capacity` slabs ONCE; push() copies into the next slot and
  // never allocates.
  throw new NotImplemented("lab-sim/createSnapshotRing");
}

/**
 * Budget the memory, don't hope. 300 snapshots at 2000 entities × 6 attrs is ~29MB, which is why
 * the rate drops as entity count rises.
 */
export function ringOptionsFor(entityTotal: number, slabLength: number): SnapshotRingOptions {
  const bytesPerSnapshot = slabLength * 8;
  const budget = 32 * 1024 * 1024;
  const capacity = Math.max(30, Math.min(300, Math.floor(budget / Math.max(1, bytesPerSnapshot))));
  return { capacity, hz: entityTotal > 1000 ? 2 : 4 };
}
