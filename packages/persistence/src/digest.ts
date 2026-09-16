import type { LabEvent, LabSpec, TranscriptDigest } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";

/**
 * Folds a raw event stream into the digest BACKEND's quiz builder consumes.
 *
 * This function is the bridge between "the learner played with a thing" and "the quiz is about
 * what they did" — the product's whole retention mechanism runs through it (doc 01 §6). Getting
 * `extremeParams` or `regimesUnvisited` wrong doesn't error; it just produces a generic quiz,
 * which is the failure mode the product exists to avoid. Test it.
 */
export function foldDigest(
  _spec: LabSpec,
  _events: readonly LabEvent[],
): TranscriptDigest {
  // TODO(BACKEND): P2. Single pass, no per-event allocation. Derive:
  //   minutesActive     — sum of gaps < 30s between events (idle time isn't learning time)
  //   knobChanges       — count of param.change (already coalesced by FRONTEND)
  //   extremeParams     — params with clamp.hit, by bound and count
  //   untouchedParams   — declared params with no param.change. A knob they ignored may be
  //                       the one that mattered — prime quiz material.
  //   notablesFound / Missed        — from notable.reached vs spec.model.notables
  //   regimesVisited / Unvisited    — from regime.change vs observable thresholds
  //   predictions       — from prediction.commit + prediction.resolve pairs
  //   thrashCount, divergences
  throw new NotImplemented("persistence/foldDigest");
}

/**
 * Incremental fold, so a long session doesn't re-scan its whole transcript on every read.
 * Store the accumulator alongside the session and fold only the new tail.
 */
export interface DigestAccumulator {
  apply(events: readonly LabEvent[]): void;
  snapshot(spec: LabSpec): TranscriptDigest;
}

export function createDigestAccumulator(_spec: LabSpec): DigestAccumulator {
  // TODO(BACKEND): P3 — optimisation. Ship foldDigest first.
  throw new NotImplemented("persistence/createDigestAccumulator");
}
