/// <reference lib="webworker" />

/**
 * Worker backend for the sim (doc 04 §where the loop runs). Used when tickRate > 60 or
 * entities > 800: the sim ticks here over a SharedArrayBuffer and the main thread only draws.
 *
 * LAST PRIORITY. createRafClock covers nearly every lab — do not start here.
 *
 * Protocol (keep it tiny; every message is main-thread work):
 *   main → worker: { type: "compile", spec, opts, sab }
 *                  { type: "poke", slot, value }
 *                  { type: "play" | "pause" }
 *                  { type: "step", n }
 *                  { type: "reset", seed }
 *   worker → main: { type: "tick", frame, t }        ← throttled, NOT every tick
 *                  { type: "diverged", info }
 *                  { type: "notables", ids }
 *
 * The slab lives in the SAB, so `tick` carries no state — the renderer reads shared memory
 * directly. A per-frame message carrying state would defeat the entire point.
 */

export type WorkerInbound =
  | { type: "compile"; spec: unknown; opts: unknown; sab: SharedArrayBuffer }
  | { type: "poke"; slot: number; value: number }
  | { type: "play" }
  | { type: "pause" }
  | { type: "step"; n: number }
  | { type: "reset"; seed: number };

export type WorkerOutbound =
  | { type: "ready"; slabLength: number }
  | { type: "tick"; frame: number; t: number }
  | { type: "diverged"; info: { frame: number; reason: string; slot: number } }
  | { type: "notables"; ids: string[] };

// TODO(FRONTEND): instantiate SimCore over the SAB-backed Float64Array and drive it with
// setTimeout-based fixed stepping (rAF is unavailable in a worker).
self.addEventListener("message", (_e: MessageEvent<WorkerInbound>) => {
  // intentionally empty until the worker path is needed — see OWNER-FRONTEND.md
});
