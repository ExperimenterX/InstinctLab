import type { LabEvent, LabEventKind } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";

/**
 * The transcript feed. This is NOT analytics — it is the raw material for the personalised quiz
 * (doc 01 §6), which is the product's retention mechanism. So it must be COMPLETE.
 *
 * Coalesce, never sample. A 200-event slider drag becomes ONE event with
 * {from, to, samples, durationMs} — that keeps the signal (they swept the whole range) and drops
 * the noise.
 */
export interface LabBus {
  /** Zero-allocation append into a 4096-entry ring buffer. */
  emit(event: LabEvent): void;
  subscribe(kind: LabEventKind, fn: (e: LabEvent) => void): () => void;
  subscribeAll(fn: (e: LabEvent) => void): () => void;
  /** Drains the buffer for POST /events. */
  flush(): LabEvent[];
  readonly pending: number;
  dispose(): void;
}

export interface LabBusOptions {
  capacity?: number;
  /** Coalesce window for param.change on the same param. */
  coalesceMs?: number;
}

export function createLabBus(_opts?: LabBusOptions): LabBus {
  // TODO(FRONTEND): ring buffer + per-kind listener sets + param.change coalescing
  throw new NotImplemented("lab-client/createLabBus");
}
