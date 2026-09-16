# 04 — State management (the 3-ring model)

Owner: **FRONTEND**. Mandatory reading for **FRONTEND** and **FRONTEND**.

The premise of the product is that the learner's hand and the picture feel connected. That is a
latency requirement, and latency requirements are architecture, not optimisation. This document is
the architecture.

---

## The core idea

State in an Instinct Lab session changes at **three wildly different rates**. Putting them in one
store means the slowest consumer pays the fastest producer's cost — 60 React re-renders a second,
each reconciling a knob panel that did not change.

So: three rings, three update rates, three mechanisms, and a hard rule about what may cross.

```
         RATE          WHERE                      MECHANISM              REACT?
Ring 0   60–120 Hz     SimCore Float64Array slab  in-place mutation      NEVER
Ring 1   pointer rate  LabStore (vanilla store)   atom subscriptions     selective
Ring 2   network rate  SessionStore               immutable snapshots    yes
```

**Data flows down freely. Data flows up only sampled.**

---

## Ring 0 — SimCore: the numeric slab

The simulation is a flat `Float64Array`. Not objects. Not React state. Not immutable snapshots.
One allocation at compile time, mutated in place forever after.

```ts
class SimCore {
  readonly slab: Float64Array;      // all params, vars, derived, entity attrs
  readonly table: ParamTable;       // id → slot index, built once
  t = 0; frame = 0; running = false;

  compile(spec: LabSpec): void;     // allocate slab, compile exprs to bytecode, layout entities
  reset(seed?: number): void;
  step(dt: number): void;           // ONE tick, zero allocation
  poke(slot: number, value: number): void;   // O(1) param write, synchronous
  read(slot: number): number;
  snapshot(): SimSnapshot;          // cheap slab copy, for predict/scrub/rollback
  restore(s: SimSnapshot): void;
  view(setId: EntitySetId, attr: string): Float64Array;  // zero-copy column view
}
```

### Slab layout

Computed once by `compile()`. Scalars first, then entity columns, struct-of-arrays:

```
[0 .. P)             params        (8 max)
[P .. V)             vars
[V .. D)             derived
[D .. D+n)           entities.cars.x     ← one contiguous column per attribute
[D+n .. D+2n)        entities.cars.y
...
```

Why struct-of-arrays and not `{x, y}[]`: the renderer iterates one attribute at a time
(`for i: draw at x[i], y[i]`), so columns stay in cache, and `view()` hands the renderer a
`Float64Array` with **no copy and no object churn**. 2000 entities × 60fps × array-of-objects is
120k object reads a second and a GC pause you can feel in your fingertips.

### The ParamTable — strings die at compile time

```ts
interface ParamTable {
  slotOf(id: string): number;             // compile-time only
  readonly paramSlots: Int32Array;        // dense, ordered
  readonly entityBase: Record<string, Record<string, number>>;
  readonly count: Record<string, number>;
}
```

Every expression is compiled to bytecode addressing **integer slots**. There is no string lookup,
no `Map.get`, no property access on the hot path. `poke()` takes a slot, not an id — FRONTEND resolves
the id to a slot **once** when it mounts the knob.

### Zero-allocation rule for `step()`

`step()` must not allocate. No array literals, no object literals, no closures, no `.map`, no
spread, no string concatenation. Scratch space is pre-allocated on the instance. This is the
single most important line of code review in `lab-sim`: an allocation in `step()` is a GC
sawtooth, and a GC sawtooth is a stuttering knob.

Simultaneous assignment (doc 03 §3) is implemented with a **double-buffered scalar region**: read
from buffer A, write to buffer B, swap pointers. No copying.

### Divergence guard

After each step, check the scalar region for non-finite values (SIMD-free loop, ~24 values, free).
On detection: `restore(lastGoodSnapshot)`, pause, emit `sim.diverged`. Snapshot the last good
state every 30 frames.

### Where the loop runs

`Clock` drives `step()`. Two backends behind one interface:

- **`RafClock`** (default) — `requestAnimationFrame`, fixed-timestep accumulator, max 4 catch-up
  steps per frame to survive a background tab. Simplest, and correct for ≤2000 entities.
- **`WorkerClock`** — the sim runs in a Web Worker over a `SharedArrayBuffer`; the main thread only
  draws. Used when `tickRate > 60` or `entities > 800`. Falls back to `RafClock` when SAB is
  unavailable (no COOP/COEP headers), and this fallback must be silent to the learner.

`SimCore` is written **backend-agnostic**: it never touches `window`, `document`, or React.
That is what makes the worker path possible and the unit tests trivial.

---

## Ring 1 — LabStore: input-rate UI state

A hand-rolled vanilla store (~60 lines, no dependency) with **per-atom subscriptions**, so moving
one slider notifies only the components reading that slider.

```ts
interface LabStore {
  getSnapshot(): LabUiState;
  subscribe(listener: () => void): () => void;                  // whole store
  subscribeKey<K extends keyof LabUiState>(k: K, l: (v: LabUiState[K]) => void): () => void;

  setParam(id: ParamId, value: number): void;   // → SimCore.poke + LabBus.emit
  setPhase(phase: Phase): void;
  setBeat(id: BeatId): void;
  applyPreset(p: Preset): void;
  play(): void; pause(): void; stepOnce(): void; scrubTo(frame: number): void;
  commitPrediction(id: PredictionId, answer: PredictionAnswer): void;
}

interface LabUiState {
  phase: Phase; beatId: BeatId | null;
  paramValues: Record<ParamId, number>;   // DISPLAY mirror only — never the source of truth
  unlockedParams: ReadonlySet<ParamId>;
  running: boolean; speed: number;
  observableSamples: Record<ObservableId, number>;  // written at ≤10Hz, never per frame
  coachMessages: CoachMessage[];
  discoveredNotables: ReadonlySet<string>;
  goalProgress: Record<BeatId, number>;
}
```

### The critical path, exactly

```ts
// FRONTEND's slider onChange — this is the whole hot path
onInput(v: number) {
  simCore.poke(slotRef.current, v);   // 1. sim sees it THIS tick. no await, no React.
  store.setParam(paramId, v);         // 2. display mirror, notifies only knob-label subscribers
}
```

The canvas is **not** involved in step 2. It already picked up the change in step 1, because it
reads the slab. A slider drag at 120 events/sec produces **zero** canvas re-renders and one cheap
label update per event.

`paramValues` in the store is a *mirror*, for showing "0.85" next to the knob and for serialising
the session. The slab is the truth. If they ever disagree, the slab wins.

### Sampling: how Ring 0 talks to Ring 2

Observable read-outs (the HUD numbers) update at **10 Hz**, not 60. One `setInterval`-free sampler
driven off the frame counter:

```ts
if (frame % 6 === 0) store.sampleObservables(simCore);   // 60fps → 10Hz
```

A number changing 60 times a second is unreadable anyway, so this costs the learner nothing and
saves 50 re-renders a second. **FRONTEND: never read an observable outside `observableSamples`.**

---

## Ring 2 — SessionStore: network-rate state

Immutable snapshots, ordinary React rendering, driven by SSE. This is the only ring where
`useSyncExternalStore` returning a fresh object is fine.

```ts
interface SessionState {
  sessionId: SessionId; status: SessionStatus;
  plan: LabPlan | null; spec: LabSpec | null;
  streamPhase: "idle" | "planning" | "composing" | "ready" | "failed";
  assessment: Assessment | null;
  recallCard: RecallCard | null;
  transcriptCursor: number; connection: "open" | "reconnecting" | "closed";
}
```

Spec deltas arrive as SSE events and are merged in order (`lab.plan`, `lab.model`, `lab.stage`,
`lab.controls`, `lab.beats`, `lab.ready`). On `lab.model`, `SessionStore` hands the partial spec to
`SimCore.compile()`; on `lab.stage`, FRONTEND mounts the renderer. That is the progressive-mount
contract from doc 02.

---

## React bindings (FRONTEND provides, FRONTEND consumes)

```ts
useLabStore<T>(sel: (s: LabUiState) => T): T        // useSyncExternalStore + selector
useParam(id: ParamId): [number, (v: number) => void] // resolves slot ONCE, memoised
useObservable(id: ObservableId): number              // reads the 10Hz sample
useSimHandle(): SimCore                              // imperative escape hatch for canvas
usePhase(): Phase
useCoachStream(): CoachMessage[]
```

There is deliberately **no `useSimValue(id)` that reads per frame.** If a component thinks it needs
one, it should be drawing on the canvas instead of in the DOM.

---

## LabBus — events and the transcript

Every learner action is recorded. This is not analytics — it is the **raw material for the quiz**
(doc 01 §6), so it cannot be lossy or sampled away.

```ts
class LabBus {
  emit(e: LabEvent): void;                 // ring buffer, capacity 4096, zero alloc
  subscribe(kind: LabEventKind, fn: (e: LabEvent) => void): () => void;
  flush(): LabEvent[];                     // drains for POST /events
}
```

Event kinds (API owns the union): `param.change`, `preset.apply`, `entity.drag`, `entity.click`,
`time.play`, `time.pause`, `time.step`, `time.scrub`, `beat.enter`, `beat.complete`,
`notable.reached`, `regime.change`, `clamp.hit`, `prediction.commit`, `prediction.resolve`,
`coach.shown`, `quiz.answer`, `sim.diverged`, `render.error`.

**Flush policy:** every 2000ms, or at 64 buffered events, or immediately for
`prediction.commit` / `beat.complete` / `quiz.answer` (these gate server-side progress).
`navigator.sendBeacon` on `pagehide`. Fire-and-forget: a failed flush retries once, then drops.
**A dropped event must never block the sim or the UI.**

`param.change` is **coalesced before flush**: a 200-event slider drag becomes one event with
`{from, to, samples: 200, durationMs}`. Uncoalesced drags would flood the transcript and drown the
signal the quiz builder needs.

---

## Snapshots: predict, scrub, rollback

One mechanism serves three features.

```ts
interface SimSnapshot { t: number; frame: number; scalars: Float64Array; entities: Float64Array; seed: number }
```

- **PREDICT** — `snapshot()` on freeze; the learner commits; `resolve.runForMs` runs; compare. If
  the learner wants to re-run, `restore()` and go again from the identical state (same PRNG seed).
- **Scrub bar** — a ring of the last 300 snapshots at 4 Hz (≈75s of history). Bounded memory:
  `300 × slabBytes`; at 2000 entities × 6 attrs that is ~29 MB, so FRONTEND **must** drop the snapshot
  rate to 2 Hz above 1000 entities. Budget the memory, don't hope.
- **Divergence rollback** — as above.

---

## Hard rules

1. **No per-frame React state.** No exceptions. (N2, doc 00.)
2. **No allocation in `step()` or `draw()`.**
3. The canvas component mounts **once** per spec and takes zero animated props.
4. `poke()` before `setParam()`, always — the sim must never lag the display.
5. Observables are read from the 10 Hz sample, never from the slab, in DOM code.
6. `SimCore` imports nothing from React, the DOM, or `lab-renderers`.
7. Entity counts are clamped at compile time, never at draw time.
8. Every `subscribe` returns an unsubscribe, and every caller uses it.
9. The slab is the source of truth for anything numeric and moving. The store mirrors it.
10. Events are coalesced, never sampled — the quiz depends on completeness.

---

## Anti-patterns, with the fix

```ts
// ❌ 60 re-renders/sec, reconciling a knob panel that didn't change
const [cars, setCars] = useState([]);
useEffect(() => { const id = requestAnimationFrame(() => setCars(sim.getCars())); }, [cars]);

// ✅ mount once, draw imperatively
useEffect(() => renderer.attach(canvasRef.current, sim), [specId]);
```

```ts
// ❌ string lookup on the hot path, and a React round-trip before the sim sees the value
onChange={v => setState(s => ({ ...s, params: { ...s.params, [id]: v } }))}

// ✅ slot resolved once at mount; sim updated synchronously
const [value, set] = useParam(id);
```

```ts
// ❌ per-frame DOM text thrash
<span>{sim.read(slot)}</span>

// ✅ 10Hz sampled
<span>{useObservable("avg_speed")}</span>
```
