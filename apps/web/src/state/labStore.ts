import type { LabSpec } from "../spec/schema.js";

/**
 * Param state, deliberately outside React.
 *
 * A slider drag fires ~120 events a second. If those went through `setState`, every one would
 * reconcile the whole lab subtree — and the canvas, which is the one thing that must not stutter,
 * would be re-rendered by React on every event.
 *
 * Instead: knob input writes here, the canvas reads here inside its own rAF loop, and React only
 * subscribes for the *label* next to each knob and for the read-outs (sampled, ~10Hz). React never
 * sees a per-frame value.
 */
export interface LabStore {
  get(): Readonly<Record<string, number>>;
  getOne(id: string): number;
  set(id: string, value: number): void;
  setMany(values: Record<string, number>): void;
  reset(): void;
  /** Fires on every write — used by knob labels. Cheap; no snapshot object is created. */
  subscribe(fn: () => void): () => void;
  /** Bumped on every write. A cheap way for the canvas to know it must redraw. */
  version(): number;
}

export function createLabStore(spec: LabSpec): LabStore {
  const defaults: Record<string, number> = {};
  for (const p of spec.params) defaults[p.id] = p.default;

  const values: Record<string, number> = { ...defaults };
  const bounds = new Map(spec.params.map((p) => [p.id, p] as const));
  const listeners = new Set<() => void>();
  let rev = 0;

  const notify = () => {
    rev++;
    for (const fn of listeners) fn();
  };

  const clampTo = (id: string, v: number): number => {
    const p = bounds.get(id);
    if (!p) return v;
    if (!Number.isFinite(v)) return p.default;
    return v < p.min ? p.min : v > p.max ? p.max : v;
  };

  return {
    get: () => values,
    getOne: (id) => values[id] ?? 0,
    set(id, value) {
      const next = clampTo(id, value);
      if (values[id] === next) return;      // identical writes are common from range inputs
      values[id] = next;
      notify();
    },
    setMany(next) {
      let changed = false;
      for (const [k, v] of Object.entries(next)) {
        const c = clampTo(k, v);
        if (values[k] !== c) { values[k] = c; changed = true; }
      }
      if (changed) notify();
    },
    reset() {
      Object.assign(values, defaults);
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    version: () => rev,
  };
}

// ── session persistence (no backend in the MVP) ───────────────────────────────────────────────

const KEY = "instinct.session.v1";

export interface PersistedSession {
  spec: LabSpec;
  concept: string;
  savedAt: string;
}

export function saveSession(concept: string, spec: LabSpec): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ spec, concept, savedAt: new Date().toISOString() }));
  } catch {
    // Quota or private mode. Losing resume is acceptable; breaking the lab is not.
  }
}

/**
 * Re-validates on the way back in. A stored spec is untrusted input too — the schema may have
 * changed since it was written, and a stale shape should look like "no session", not a crash.
 */
export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
