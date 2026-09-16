# OWNER — Frontend (canvas, state, UI)

> Read [`00-START-HERE.md`](00-START-HERE.md) first — especially **§4 on domain-agnosticism** —
> then **[`04-state-management.md`](04-state-management.md), which is the design for
> `lab-client`, already decided**, then [`03-lab-spec-dsl.md`](03-lab-spec-dsl.md) §5.

**OWNS**
```
packages/lab-client      frame clock, the three state rings, event bus, React bindings, transport
packages/lab-renderers   ten canvas archetypes, draw primitives, theme, hit-testing
apps/web                 Vite + React SPA: three screens and the components
```

**READS** `packages/lab-schema`, `packages/lab-sim`, `packages/shared`, `docs/**`

You own the largest slice, and it is the part the learner actually touches.

---

## Your job

You own the reason this product feels alive. The premise is that the learner's hand and the
picture feel connected; that is a latency requirement, and you are the latency.

Also: **the SEE phase is entirely yours.** A learner should be able to describe what is on screen
before reading a word. If they read the caption first and then hunt for the point, the lab failed
no matter how correct everything upstream was.

**Build archetypes, never topics.** A file named `tcp-slow-start.ts` in `lab-renderers` is a bug.
You will never know what concept is being taught, and that is correct — the AI maps the topic onto
your grammar. Your job is to make each grammar expressive enough that it can.

---

## The state architecture, in one paragraph

State changes at three wildly different rates, so it lives in three rings. **Ring 0** is the
simulation: a `Float64Array` mutated in place at 60fps, which the canvas reads directly — React
never sees it. **Ring 1** is input-rate UI state in a hand-rolled store with per-atom
subscriptions, so moving one slider notifies only that slider's label. **Ring 2** is network-rate
session state driven by SSE, where ordinary React rendering is fine. Data flows down freely and up
only sampled (observables at 10Hz, never 60). Doc 04 is the full spec; treat it as decided.

> **A note on the framework choice**, since it comes up: we are on Vite rather than a
> meta-framework, but *not* because React is too slow for this. React is never in the frame loop
> — the three-ring model exists precisely so it isn't, and swapping frameworks would not change a
> single frame of canvas performance. The reasons are different and are written up in
> [`adr/0002-frontend-stack.md`](adr/0002-frontend-stack.md). Worth reading once so you do not
> re-litigate it, and so you know which problems the choice does and does not solve.

---

## Priority order

### P1 — One archetype rendering real data at 60fps
`resolveTheme` → `primitives` (circle/line/polyline/axes/text) → `createScene` →
`functionPlotRenderer.compile/draw`.

Acceptance: the schema's `example-spec` fixture rendering expression-bound data, animating, and
holding 60fps with the simulation running.

`function-plot` first because it is the fallback spec's archetype — once it works, no generation
failure can leave a learner staring at a blank canvas.

### P2 — `LabCanvas` + the runtime bundle
`createScene` completeness (resize/DPR, pointer → hit-test → drag → pokes, highlight pulse, the
frame-boundary error guard, `capture()` for the recall card), plus `useLabRuntimeFor` and
`LabCanvas`.

**This is where the dev-environment hazards live — see below.** Budget time for them.

### P3 — The stores and hooks
`createStore` → `createLabStore` (`setParam`, `slotFor`, `sampleObservables`, `play`/`pause`) →
`createSessionStore.applyStreamEvent` → `createRafClock` → the React hooks.

Those unblock every component, so they come before any component work beyond `LabCanvas`.

### P4 — The lab screen for real
Knob panel, observable HUD, phase rail, time controls, presets, coach dock, progressive mount
(skeleton → live canvas → knobs → phase rail).

### P5 — Four more archetypes
`sequence-array`, `graph-network`, `grid-automaton`, `particle-field` — roughly the widest topic
coverage per hour of work. **Register each in `registry.ts` as you finish it**, and make
`buildArchetypeManifest` include only implemented ones: offering the AI an archetype that throws
is worse than offering it fewer choices.

### P6 — Predict modal, quiz UI, recap, the remaining five archetypes
### P7 — `LabBus`, `EventRecorder`, `TriggerDetector`, snapshot scrubbing
### P8 — `createWorkerClock` and the worker. Do not start here; `RafClock` covers nearly every lab.

---

## The rules you cannot bend

1. **`draw()` and `step()` allocate nothing.** No arrays, no objects, no template strings for
   colours. These loops run up to 2000× per frame; an allocation is a GC sawtooth, and a sawtooth
   is a stuttering lab.
2. **`LabCanvas` mounts once per spec and takes zero animated props.** If you are adding a prop
   that changes during play, it belongs in the sim or behind an imperative scene call.
3. **`sim.poke(slot, v)` before the store mirror, always.** The simulation must never lag the
   display.
4. **Observables come from the 10Hz sample**, never the slab, in DOM code. A number changing 60×
   a second is unreadable anyway, and reading it in React costs 50 re-renders a second.
5. **Resolve a param's slot once, at mount.** If `useParam` resolves on every render you have
   quietly reintroduced the string lookup the design removes.
6. **No React import in `lab-renderers`.** It is pure canvas; `apps/web` wraps it.
7. **Spec space in, pixels out.** Every primitive takes 0–100 coordinates and applies the viewport
   transform itself. No archetype does transform arithmetic.
8. **Resolve everything possible in `compile()`** — parsed channel programs, colour LUTs, layout,
   geometry, scratch buffers. `draw()` should be arithmetic and canvas calls, nothing else.
9. **Never trust a number from the spec.** Clamp counts, radii, thicknesses, and op counts at
   compile time. A radius of 1e9 is a frozen tab.
10. **A render error is caught at the frame boundary**, not inside the loop. Freeze the last good
    frame, report once, keep the session alive — the learner can still read the knobs and coach.
11. **`prefers-reduced-motion` turns off trails and tweens**, never the simulation.
12. **Generous hit targets** — ≥3 spec units regardless of visual size. A learner who cannot grab
    a node concludes the lab is broken.
13. **Coalesce events, never sample them.** The quiz depends on a complete transcript.

---

## Dev-environment hazards (budget real time for these)

Both are development-only and both can eat an afternoon:

- **React StrictMode double-invokes effects.** A naive `useEffect` that builds the runtime or
  opens the SSE stream will build two simulations and two streams against one session.
- **Vite HMR re-executes modules.** A runtime held in a `useRef` is rebuilt on every edit,
  resetting a simulation you were mid-experiment on — which is maddening precisely because this
  app's whole value is in the middle of an experiment.

Both have the same fix: a **module-scope `Map<sessionId, LabRuntime>`** that outlives component
lifecycles and HMR cycles. Dispose on real unmount only. Do this in P2, not later.

---

## Visual judgement calls, already made

These come up in every archetype, and getting them wrong teaches the wrong thing:

- **Lock the y-axis** when a knob changes (`function-plot`, `compounding-ledger`). A rescaling
  axis makes a growing curve look static — it hides the exact effect the learner should feel.
- **Edges under nodes**, always. An edge over a node reads as a line through it.
- **Curve bidirectional transition pairs in opposite directions** (`state-machine`), or they
  overlap into one unreadable line.
- **Make the bottleneck obvious** (`pipeline-flow`). Spotting it is the lesson; it should not
  require reading a number.
- **Encapsulation must visibly accumulate and peel** (`layered-stack`), or it is just a list.
- **Swap animation is the lesson** (`sequence-array`). Interpolate over `swapAnimMs`.
- **Above ~2500 cells, `grid-automaton` uses `ImageData` + `putImageData`**, not per-cell
  `fillRect`.

Before choosing any colour, run the **`dataviz` skill**. It carries a validated palette and a
contrast checker. The spec cannot contain hex — colour is entirely your call, which makes it
entirely your responsibility. Palette lives in `lab-renderers/draw/theme.ts`, and Tailwind must
mirror those token names rather than fork the values.

---

## UI voice

- **Minimal passive reading.** Captions are ≤90 chars and often absent. The canvas dominates.
- **One knob during INTERACT.** That single moment establishes the contract that the simulation
  obeys the learner. Do not clutter it.
- **Presets read as experiments, never answers.** "No damping", not "the correct setting".
- **Never preview a prediction's outcome.** No hover hints, no live value. Freeze, ask, resolve.
- **A dropped stream is a chip, not a modal.** The simulation is local; they can keep playing.
- **Label quiz provenance honestly.** "You predicted this one wrong" beats an unlabelled question.

---

## Handoff notes (fill in before you stop)

```md
**Works:**
**Registered archetypes:**
**Measured: re-renders per sim second / frame draw ms at 500 entities:**
**Throws NotImplemented:**
**Assumed of others:**
**Deviations from doc 04:**
**Next session starts with:**
```
