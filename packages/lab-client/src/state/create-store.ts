import { NotImplemented } from "@instinct/shared";

/**
 * ~60 lines, zero dependencies. Deliberately not zustand/redux: we need PER-ATOM subscriptions so
 * moving one slider notifies only the components reading that slider. A whole-store notification
 * at pointer rate re-renders a knob panel that did not change (doc 04 §Ring 1).
 */
export interface Store<S extends object> {
  getSnapshot(): S;
  subscribe(listener: () => void): () => void;
  /** The point of this file — subscribe to one key, get notified only when that key changes. */
  subscribeKey<K extends keyof S>(key: K, listener: (value: S[K]) => void): () => void;
  set(partial: Partial<S> | ((s: S) => Partial<S>)): void;
  /** Coalesces notifications — applying a preset sets 4 params and notifies once. */
  batch(fn: () => void): void;
}

export function createStore<S extends object>(_initial: S): Store<S> {
  // TODO(FRONTEND): key→Set<listener> map plus a global listener set. `set` diffs shallowly and
  // notifies only changed keys. `batch` collects dirty keys and flushes on exit.
  throw new NotImplemented("lab-client/createStore");
}
