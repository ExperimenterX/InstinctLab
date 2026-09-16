import type { CoachMessage, ObservableId, ParamId, Phase } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { SimCore } from "@instinct/lab-sim";
import type { LabRuntime } from "./context.js";
import type { LabUiState } from "../state/lab-store.js";
import type { SessionState } from "../state/session-store.js";

/**
 * React bindings. This is the whole surface the UI is allowed to use.
 *
 * There is deliberately NO `useSimValue(id)` that reads per frame. If a component thinks it needs
 * one, it should be drawing on the canvas instead of in the DOM (doc 04).
 */

export function useLabRuntime(): LabRuntime {
  throw new NotImplemented("lab-client/useLabRuntime");
}

/** useSyncExternalStore + selector. The selector must be referentially stable. */
export function useLabStore<T>(_selector: (s: LabUiState) => T): T {
  throw new NotImplemented("lab-client/useLabStore");
}

export function useSessionStore<T>(_selector: (s: SessionState) => T): T {
  throw new NotImplemented("lab-client/useSessionStore");
}

/**
 * Resolves the slab slot ONCE and memoises it. The returned setter does `sim.poke(slot, v)` and
 * then the store mirror, in that order (doc 04 §critical path).
 *
 * If the slot resolves on every render you have quietly reintroduced the string lookup the whole
 * design removes.
 */
export function useParam(_id: ParamId): readonly [number, (v: number) => void] {
  throw new NotImplemented("lab-client/useParam");
}

/** Reads the 10Hz sample, never the slab. A number changing 60×/sec is unreadable anyway. */
export function useObservable(_id: ObservableId): number {
  throw new NotImplemented("lab-client/useObservable");
}

export function usePhase(): Phase {
  throw new NotImplemented("lab-client/usePhase");
}

export function useCoachStream(): readonly CoachMessage[] {
  throw new NotImplemented("lab-client/useCoachStream");
}

/**
 * Imperative escape hatch for the canvas. The canvas component mounts ONCE per spec, grabs this,
 * and reads the slab directly in its own draw loop — it takes zero animated props.
 */
export function useSimHandle(): SimCore {
  throw new NotImplemented("lab-client/useSimHandle");
}

export function useTimeControls(): {
  running: boolean;
  play(): void;
  pause(): void;
  stepOnce(n?: number): void;
  scrubTo(frame: number): void;
  setSpeed(m: number): void;
} {
  throw new NotImplemented("lab-client/useTimeControls");
}
