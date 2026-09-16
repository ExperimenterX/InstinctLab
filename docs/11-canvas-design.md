# 11 — Canvas design

Owner: **T1**. This is the part of the product the learner actually touches, and the part that has
to feel alive.

---

## The one design principle

**The learner should be able to describe what is on screen before reading a word.**

If they read the caption first and then hunt for the point, the lab has failed no matter how
correct the simulation is. So the canvas dominates, text is peripheral, and the first thing that
happens when a lab loads is motion — not a paragraph.

---

## Screen layout

```
┌──────────────────────────────────────────────────────────┬────────────────────┐
│  Induced Demand                                          │  Avg speed         │
│  Two lanes, moving traffic.                    ← caption │    62%             │
│                                                          │  ▁▂▄▆█▆▄  sparkline│
│                                                          │                    │
│                                                          │  Cars / min        │
│                    T H E   C A N V A S                   │    148             │
│                    (60–70% of viewport)                  │                    │
│                                                          ├────────────────────┤
│                                                          │  Lanes             │
│                                                          │  ──────●───   2    │
│                                                          │                    │
│                                                          │  Demand response   │
│                                                          │  ────●─────  0.9   │
├──────────────────────────────────────────────────────────┴────────────────────┤
│  ● See  ○ Interact  ○ Experiment  ○ Predict  ○ Understand  ○ Recall           │
│  ▶ ⏸ ⏭  ──────────●────  1×        [no demand response]  [wide road]          │
└───────────────────────────────────────────────────────────────────────────────┘
       ╭──────────────────────────────────────────────╮
       │ Five lanes, same speed as two. Demand caught │  ← coach, transient
       │ up.                                          │
       ╰──────────────────────────────────────────────╯
```

**Proportions that matter:** the canvas gets 60–70% of the viewport. The knob panel is narrow and
always visible — knobs below the fold means the learner never finds them. The coach is an overlay
that never reflows the layout, because a layout shift while someone is dragging a slider is
actively hostile.

**Mobile / narrow:** canvas on top at 55vh, knobs in a horizontal scroll strip beneath, phase rail
collapses to a dot row. Do not stack the knobs below the fold.

---

## The ten archetypes

The AI picks one per concept. **They are visual grammars, not topics** — a file named
`tcp-slow-start.ts` in `canvas/archetypes/` is a bug. You will never know what is being taught,
and that is correct.

| Archetype | What it draws | Absorbs concepts like |
|---|---|---|
| `function-plot` | curves over an x/y axis pair | derivatives, PID tuning, dose-response, yield curves |
| `graph-network` | nodes, edges, travelling packets | routing, dependency graphs, contagion, neural nets |
| `grid-automaton` | 2D cell lattice | Game of Life, diffusion, convolution, epidemic spread |
| `particle-field` | free bodies under forces | orbits, gas laws, collisions, flocking |
| `sequence-array` | indexed cells with cursors | sorting, binary search, string algorithms, transcription |
| `pipeline-flow` | stages, queues, tokens | CPU pipelines, TCP windows, assembly lines, tracing |
| `state-machine` | states with guarded transitions | handshakes, regex engines, cell cycle, order lifecycle |
| `compounding-ledger` | balances accumulating per period | compound interest, amortisation, population growth |
| `layered-stack` | nested layers with a traversal | OSI model, call stacks, memory layout, strata |
| `free-canvas` | a declarative list of draw ops | last resort when none of the nine fit |

**Build `function-plot` first.** It is the fallback when generation degrades, so once it works no
failure upstream can leave the learner staring at a blank box. Then `sequence-array`,
`graph-network`, `grid-automaton`, `particle-field` — those four cover the widest topic range per
hour of work.

Every archetype implements the same interface:

```ts
interface Archetype {
  compile(stage: Stage, spec: LabSpec, sim: SimState): Compiled;  // once per spec
  draw(compiled: Compiled, ctx: RenderContext): void;             // every frame
  hitTest(compiled: Compiled, p: Point): Hit | null;
  onDrag?(compiled: Compiled, hit: Hit, p: Point): ParamWrite[];
}
```

`compile` does all the expensive work — parsing expressions, resolving colours, laying out
geometry, allocating scratch buffers. `draw` should be arithmetic and canvas calls, nothing else.

---

## Coordinates: spec space

All spec coordinates are **0–100 on both axes, origin top-left.** The renderer applies one
transform to device pixels, so:

- the same spec looks right on any screen and any aspect ratio (uniform scale + letterbox)
- the AI never has to know about pixels, DPR, or viewport size
- hit-testing works in spec units, so a pick radius is meaningful

Every draw primitive takes spec coordinates and transforms internally. No archetype does transform
arithmetic itself.

Handle DPR once: size the backing store to `cssSize * devicePixelRatio`, scale the context, and
never think about it again.

---

## The render loop

```
requestAnimationFrame
  ├─ sim.step(dt)              mutate the numeric state array in place
  ├─ archetype.draw(state, t)  read that array directly, allocate nothing
  └─ every 6th frame: sample observables → React (10Hz, not 60)
```

**The canvas component mounts once per spec and takes zero animated props.** It grabs a ref to the
state array and owns its own loop. React is not in the frame path at all.

Two rules that follow from that, and they are the difference between 60fps and a slideshow:

1. **`draw()` allocates nothing.** No array literals, no object literals, no template strings for
   colour. These loops run up to 2000× per frame, and an allocation per entity per frame is a GC
   sawtooth you can feel in your fingertips.
2. **Observables reach React at 10Hz.** A number changing 60 times a second is unreadable anyway,
   and reading it in React costs you 50 re-renders a second for no benefit.

Anti-pattern, for the avoidance of doubt:

```tsx
// ❌ this is a slideshow
const [particles, setParticles] = useState([]);
useEffect(() => { requestAnimationFrame(() => setParticles(sim.read())); });

// ✅ mount once, draw imperatively
useEffect(() => scene.attach(canvasRef.current, sim), [specId]);
```

**Error containment:** wrap `draw()` at the frame boundary, not inside the loop. On a throw, freeze
the last good frame and report once. A broken renderer must not take down the session — the learner
can still read the knobs and the coach.

---

## Interaction

**Knobs.** `onInput` writes straight into the simulation state array, then updates the display
value. In that order — the simulation must never lag the number next to the slider. **Never
debounce a knob.** Debouncing is precisely the lag this product exists to avoid.

**Direct canvas manipulation** is what separates a lab from a chart. Where the archetype supports
it: drag a node, paint a cell, fling a particle, scrub a curve, click a state to force it. Dragging
a body should impart velocity, because that is how someone discovers momentum without being told
about it.

**Hit targets are generous — minimum 3 spec units** regardless of how small the mark is drawn. A
learner who cannot grab a node concludes the lab is broken, and they are not wrong.

**Time controls** — play, pause, step, scrub, speed — appear only once a beat unlocks them. Scrub
reads a ring of recent state snapshots, so its range is bounded; show that bound honestly rather
than implying a longer history than exists.

---

## Visual language

**Colour is semantic, never decorative.** The spec asks for meanings (`accent`, `warn`, `ok`,
`muted`, `series-0`…) and the frontend owns the actual values. Raw hex in a spec is rejected. This
means the AI cannot produce an ugly or inaccessible lab — palette quality is entirely your call,
and therefore entirely your responsibility.

Run the **`dataviz` skill** before picking any colour. It carries a validated palette and a
contrast checker; don't eyeball it. Requirements: legible on light and dark, distinguishable under
the common colour-vision deficiencies, and `warn`/`danger` never the *only* signal for a state —
pair with shape or label.

**Motion earns its place.** Animate to show causation (a swap, a packet moving, a wrapper being
added), not to decorate. `prefers-reduced-motion` turns off trails and tweens — never the
simulation itself.

### Judgement calls already made

These come up in nearly every archetype, and getting them wrong teaches the wrong thing:

- **Lock the y-axis when a knob changes.** A rescaling axis makes a growing curve look static — it
  hides the exact effect the learner is supposed to feel. This is the most common way to
  accidentally destroy a lab.
- **Edges under nodes**, always. An edge drawn over a node reads as a line through it.
- **Curve bidirectional transition pairs apart** (`state-machine`), or they overlap into one
  unreadable line.
- **Make the bottleneck obvious** (`pipeline-flow`). Locating it is the lesson; it should not
  require reading a number.
- **Encapsulation must visibly accumulate and peel** (`layered-stack`), or it is just a list.
- **The swap animation is the lesson** (`sequence-array`). Interpolate it; don't jump.
- **Above ~2500 cells** (`grid-automaton`) write into an `ImageData` buffer and `putImageData`
  once. Per-cell `fillRect` at 40k cells will not hold frame.

---

## How the canvas changes across the six phases

The canvas is the same object throughout; what the learner is *allowed* to do changes.

| Phase | Canvas state |
|---|---|
| **See** | animating, all knobs locked. One caption, ≤12 words. Motion before text. |
| **Interact** | exactly **one** knob unlocks, rendered large. This single moment establishes that the simulation obeys them — don't clutter it. |
| **Experiment** | all knobs unlock, presets appear, time controls appear. The coach goes quiet unless something notable happens. |
| **Predict** | **frozen.** A dimmed overlay, the question, and an answer surface — a slider to place a guess, a click target on the canvas, choices. No preview of the outcome, no hover hint. |
| **Understand** | resumes and **annotates**: highlight the entity, mark the learner's guess against the actual on the axis. The explanation points at the picture. |
| **Recall** | the canvas becomes the quiz surface for "tune the knobs until X happens" — reuse it, don't mock it. |

**The PREDICT freeze is the highest-stakes UI in the product.** Committing must feel safe (a wrong
prediction is worth more than a right one) and must be clearly irreversible before they click.

---

## Performance budget

| Metric | Budget |
|---|---|
| Full frame draw, 500 entities | ≤ 8ms |
| Knob drag → visible change | ≤ 1 frame (16ms) |
| React re-renders per simulation second | ≤ 12 |
| No GC sawtooth over a 30s profile | proves the zero-allocation rule holds |

If frames drop, the cause is almost always one of four things, in order of likelihood: an
allocation in `draw()`, a per-frame value pushed into React state, a parameter lookup by string
instead of index, or per-cell `fillRect` on a large grid. Profile before rewriting anything.

---

## Why canvas rather than SVG or WebGL

**Canvas 2D.** SVG was rejected: 2000 DOM nodes churning per frame does not hold 60fps, and
per-node listeners are worse than one hit-test. WebGL was deferred: shader compilation stalls the
first frame, the build gets heavier, and nothing here needs more than ~2000 entities.

Keep canvas-2D specifics behind `canvas/draw/primitives.ts` where it's cheap to do so, so a WebGL
backend stays possible if a lab ever genuinely needs 50k particles.
