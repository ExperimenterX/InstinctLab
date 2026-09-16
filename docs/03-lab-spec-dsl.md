# 03 — The LabSpec DSL

The LabSpec is the artifact the AI authors and the client executes. It is the interface between
"an AI understood the concept" and "a learner can play with it".

Authoritative definition: `packages/lab-schema/src/**`. This doc is the human-readable spec and the
rationale. **If the two disagree, the Zod schema wins and this doc is the bug.**

Owner: **API**. Consumers: BACKEND (model, expressions), FRONTEND (stage), BACKEND (authoring prompts), FRONTEND (controls, beats).

---

## 1. Top-level shape

```ts
interface LabSpec {
  specVersion: "1.0";         // rejected if unknown
  id: LabId;
  meta: Meta;                 // what concept, what angle, what archetype
  model: Model;               // state, params, derived values, dynamics
  stage: Stage;               // how state becomes pixels
  controls: Control[];        // what the learner can touch
  beats: Beat[];              // the teaching script (See → … → Recall)
  assessment: AssessmentPlan; // predictions + quiz blueprint
  coach: CoachConfig;         // trigger thresholds and voice
}
```

Ordering matters for streaming: `meta`, `model`, `stage`, `controls`, `beats` are emitted in that
order and each is independently valid, so the client mounts progressively (doc 02).

---

## 2. `meta`

```ts
interface Meta {
  concept: string;            // learner's raw input, verbatim
  title: string;              // ≤ 48 chars, e.g. "TCP Congestion Window"
  domain: Domain;             // cs | physics | biology | math | networking
                              // | finance | chemistry | systems | other
  archetype: ArchetypeId;     // one of the ten (§5)
  teachingAngle: string;      // ≤ 140 chars: the ONE insight this lab exists to deliver
  bigIdea: string;            // ≤ 90 chars, shown on the recall card
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;   // 3..12
  prerequisites: string[];    // ≤ 3, short phrases
}
```

`teachingAngle` is the most important field in the spec. It is what keeps a lab from being a
generic diagram. *"Window growth is multiplicative until loss, then additive — that asymmetry is
the whole algorithm."* BACKEND's composer prompt must derive every knob and question from it. A lab
whose knobs don't test the teaching angle is a failed lab.

---

## 3. `model` — the simulation

```ts
interface Model {
  params: Param[];            // learner-controllable scalars
  vars: Var[];                // internal simulation state
  entities?: EntitySet[];     // repeated bodies (nodes, cells, particles)
  derived: Derived[];         // computed each tick from params/vars/entities
  dynamics: Dynamics;         // how state advances
  observables: Observable[];  // what the learner is meant to watch
  notables?: Notable[];       // interesting states worth congratulating
  invariants?: Invariant[];   // must always hold; violation ⇒ sim.diverged
  tickRate: number;           // 1..120 Hz target
  timeScale: number;          // sim seconds per wall second, 0.05..20
}
```

### `Param`
```ts
interface Param {
  id: ParamId;                // snake_case, stable, referenced by controls & exprs
  label: string;              // ≤ 24 chars, learner-facing
  unit?: string;              // "ms", "kg", "%", "$"
  min: number; max: number; step: number; default: number;
  scale?: "linear" | "log";
  affects: string[];          // observable ids — used by the clamp-no-effect detector
  explain: string;            // ≤ 80 chars: what this knob physically means
}
```

### `Var`
```ts
interface Var {
  id: VarId;
  init: Expr;                 // evaluated once at reset
  clamp?: [number, number];   // applied every tick
  history?: number;           // keep last N values in a ring buffer for plotting
}
```

### `EntitySet`
Entities are the reason this DSL generalises. One `EntitySet` is a homogeneous population with
per-entity numeric attributes stored **column-wise** (struct-of-arrays) so the sim stays cache-friendly.

```ts
interface EntitySet {
  id: EntitySetId;            // "nodes", "cells", "particles"
  count: Expr;                // resolved at reset; clamped to limits.maxEntities
  attrs: Record<string, Expr>;// per-entity init; `i` and `n` are in scope
  topology?: Topology;        // ring | grid | random | star | chain | mesh | explicit
  links?: LinkSpec;           // edges between entities of this or another set
}
```

`attrs` expressions are evaluated per-entity with `i` (index) and `n` (count) bound — that is how
the AI writes *"lay 40 nodes on a circle"* without writing code:

```json
{ "id": "nodes", "count": "40",
  "attrs": { "x": "50 + 38*cos(2*PI*i/n)", "y": "50 + 38*sin(2*PI*i/n)", "load": "0" },
  "topology": "ring" }
```

### `Derived`
```ts
interface Derived { id: DerivedId; expr: Expr; reduce?: Reduce; over?: EntitySetId; }
// reduce: sum | mean | max | min | count | countWhere
```
`over` + `reduce` aggregates across an entity set: `{ id: "total_load", over: "nodes",
reduce: "sum", expr: "load" }`. This is how observables stay declarative.

### `Dynamics` — three flavours, in order of preference

```ts
type Dynamics =
  | { kind: "expr";   step: Assignment[]; entityStep?: Record<EntitySetId, Assignment[]> }
  | { kind: "kernel"; kernel: KernelId; config: Record<string, Expr> }
  | { kind: "rules";  rules: Rule[] };
```

**`expr`** — the default. A list of assignments evaluated once per tick against the expr VM.
Assignments are **simultaneous**: all right-hand sides read the previous tick's values, so the AI
never has to reason about ordering.

```json
{ "kind": "expr", "step": [
  { "target": "cwnd", "expr": "loss ? cwnd/2 : cwnd + (cwnd < ssthresh ? cwnd : 1)" }
]}
```

**`kernel`** — a named numerical integrator in `lab-sim/sim/kernels`, for dynamics an
expression list models badly. Fixed set (BACKEND owns): `verlet`, `spring-damper`, `nbody-gravity`,
`diffusion-2d`, `cellular-automaton`, `queue-network`, `logistic-growth`, `random-walk`,
`sir-epidemic`, `gradient-descent`. The AI picks one and configures it; it cannot add one.

**`rules`** — guarded transitions, for `state-machine` and discrete-event labs.
```ts
interface Rule { when: Expr; then: Assignment[]; once?: boolean; label?: string }
```

### `Observable`
```ts
interface Observable {
  id: ObservableId;
  label: string;
  source: DerivedId | VarId;
  format?: "number" | "percent" | "currency" | "bytes" | "duration" | "integer";
  precision?: number;
  thresholds?: { at: number; regime: string }[];  // drives regime-change coach trigger
  goodDirection?: "up" | "down" | "none";
}
```

### `Notable`
```ts
interface Notable { id: string; when: Expr; label: string; insight: string }  // insight ≤ 100 chars
```
`when` is polled at ≤ 4 Hz (not every tick). First entry fires a `notable-reached` event; the
runtime marks it discovered in the transcript, and the quiz builder prefers **undiscovered**
notables for its questions.

---

## 4. `Expr` — the expression language

A string, parsed once at compile time into a bytecode program, executed by BACKEND's `expr-vm`.
**Nothing else may execute it.** (N3, doc 00.)

**In scope:** param ids, var ids, derived ids, observable ids, `t` (sim seconds), `dt`, `i`, `n`
(entity context only), entity attrs of the current set, `prev(id)`, and aggregates
`sum(set.attr)`, `mean(set.attr)`, `max/min/count(set.attr)`.

**Operators:** `+ - * / % ^`, `== != < <= > >=`, `&& || !`, ternary `? :`, parentheses.

**Functions (fixed table):** `abs ceil floor round sign sqrt cbrt exp log log2 log10 sin cos tan
asin acos atan atan2 min max clamp lerp step smoothstep mod hypot rand randn noise1 noise2`.

`rand`/`randn`/`noise*` draw from a **seeded PRNG** owned by `SimCore`. The seed is part of the
session so a lab is reproducible and a prediction can be replayed. Never `Math.random()`.

**Forbidden and rejected at parse time:** identifiers not in scope, property access (`.` other
than in `set.attr` aggregates), indexing, assignment, function definitions, any call not in the
table. Depth ≤ 24 nodes deep, ≤ 512 nodes total, ≤ 2000 VM steps per evaluation.

Non-finite result ⇒ the assignment is skipped and `sim.diverged` is emitted. The sim must never
propagate `NaN` into a renderer.

---

## 5. `stage` — state becomes pixels

```ts
interface Stage {
  archetype: ArchetypeId;
  viewport: { w: 100; h: 100 };   // spec space; always 100×100, renderer transforms
  background?: "grid" | "plain" | "axes" | "dark-grid";
  layers: Layer[];                // painted in order, ≤ limits.maxLayers
  annotations?: Annotation[];     // labels, arrows, brackets, regions
  legend?: LegendItem[];
  camera?: { follow?: string; zoom?: Expr };
  config: ArchetypeConfig;        // discriminated on archetype
}
```

A `Layer` binds an entity set or a derived series to a visual mark, with **expression-bound
channels**:

```ts
interface Layer {
  id: string;
  mark: "circle" | "rect" | "line" | "path" | "arrow" | "text" | "cell" | "curve" | "area" | "token";
  from: EntitySetId | "self" | { series: VarId | DerivedId };
  channels: {
    x?: Expr; y?: Expr; w?: Expr; h?: Expr; r?: Expr;
    fill?: ColorExpr; stroke?: ColorExpr; alpha?: Expr;
    label?: Expr | string; rotation?: Expr; thickness?: Expr;
  };
  interactive?: { drag?: "x" | "y" | "xy"; click?: string; hover?: string };
}
```

`ColorExpr` is either a palette token (`"accent"`, `"warn"`, `"muted"`, `"ok"`, `"series.0"`…) or a
scale: `{ scale: "sequential" | "diverging" | "categorical", by: Expr, domain: [number, number] }`.
**Raw hex is rejected.** The palette lives in `lab-renderers/draw/theme.ts` and must satisfy
light/dark contrast — the AI does not get to pick colours, only meanings. (FRONTEND: the `dataviz` skill
governs that palette.)

### The ten archetypes

Each has a typed `config`. FRONTEND owns the renderers; API owns the config schemas.

| `archetype` | `config` highlights | Interaction it affords |
|---|---|---|
| `graph-network` | `layout`, `directed`, `edgeWeightBy`, `packetFlow` | drag nodes, cut edges, inject a packet |
| `grid-automaton` | `cols`, `rows`, `stateColors`, `neighborhood`, `wrap` | paint cells, seed patterns |
| `particle-field` | `bounds`, `trails`, `forceField`, `collide` | drag bodies, add/remove, impulse |
| `function-plot` | `xDomain`, `yDomain`, `series[]`, `xLabel`, `yLabel`, `markers` | scrub x, drag a control point |
| `sequence-array` | `cells`, `cursors[]`, `compareHighlight`, `swapAnim` | pick indices, step the algorithm |
| `pipeline-flow` | `stages[]`, `queues[]`, `tokenRate`, `capacity` | throttle a stage, resize a queue |
| `state-machine` | `states[]`, `transitions[]`, `activeState`, `history` | fire an event, force a state |
| `compounding-ledger` | `periods`, `series[]`, `contributionAt`, `bars` | change a rate mid-timeline |
| `layered-stack` | `layers[]`, `traversal`, `encapsulation` | send a message down, open a layer |
| `free-canvas` | `draw: DrawOp[]` — declarative op list only | whatever the ops declare |

`free-canvas` is the escape hatch, **not** a code channel: `DrawOp[]` is a validated list of
primitive draw operations with expression-bound arguments. BACKEND must justify choosing it in
`meta.teachingAngle` and prefer one of the nine whenever it fits.

---

## 6. `beats` — the teaching script

```ts
interface Beat {
  id: BeatId;
  phase: "see" | "interact" | "experiment" | "predict" | "understand" | "recall";
  caption?: string;             // ≤ 90 chars. THE ONLY PROSE. Optional by design.
  unlock?: { params?: ParamId[]; time?: boolean; layers?: string[] };
  focus?: { layer?: string; entity?: Expr; observable?: ObservableId };
  presets?: Preset[];           // named starting points, never answers
  goal?: Goal;                  // what advances this beat
  onEnter?: Assignment[];       // e.g. reset, or jump to a regime
  autoAdvanceMs?: number;       // only legal on `see`
}

type Goal =
  | { kind: "param-changed"; param: ParamId; times?: number }
  | { kind: "observable-reached"; observable: ObservableId; op: "gt"|"lt"|"between"; value: number | [number, number] }
  | { kind: "notable-discovered"; notable?: string; count?: number }
  | { kind: "prediction-committed"; prediction: PredictionId }
  | { kind: "time-elapsed"; ms: number }
  | { kind: "manual" };
```

Rules BACKEND must satisfy and FRONTEND must enforce:
- Exactly one beat per phase minimum; `interact` unlocks **exactly one** param.
- `see` unlocks no params. The learner watches first.
- The learner may always scrub back to a completed beat; goals never re-lock.
- A beat with no `goal` defaults to `manual` (a "continue" affordance).

---

## 7. `assessment` — predictions and quiz

```ts
interface AssessmentPlan {
  predictions: Prediction[];    // 1..3, inline during the PREDICT phase
  quizBlueprint: QuizBlueprint; // how to generate the final quiz
  masteryThreshold: number;     // 0..1, default 0.7
}

interface Prediction {
  id: PredictionId;
  beat: BeatId;
  question: string;             // ≤ 120 chars, specific and falsifiable
  freeze: true;                 // always; the sim pauses to ask
  answer:
    | { kind: "numeric"; observable: ObservableId; tolerance: number; unit?: string }
    | { kind: "direction"; observable: ObservableId }          // up | down | flat
    | { kind: "choice"; options: string[]; correctIndex: number }
    | { kind: "point"; layer: string; tolerance: number }       // click on canvas
    | { kind: "ordering"; items: string[]; correctOrder: number[] };
  resolve: { runForMs: number; then: "reveal" | "reveal-and-annotate" };
  whyCorrect: string;           // ≤ 140 chars, shown only after commit
  commonWrong?: { pattern: string; because: string }[];  // misconception → targeted correction
}

interface QuizBlueprint {
  itemCount: number;            // 3..5
  mustCover: ("teachingAngle" | "missedPrediction" | "unvisitedRegime"
            | "extremeKnob" | "undiscoveredNotable")[];
  allowInteractive: boolean;    // prefer "tune the knobs to reach X" items
  difficultyCurve: "flat" | "rising";
}
```

The quiz is **not** in the spec. The blueprint is. Actual items are generated at RECALL time from
the blueprint plus the session transcript, so they reflect what this learner did (doc 01 §6,
doc 05 `/assessment`).

`commonWrong` is high-leverage: it lets the coach say *"you predicted it would keep climbing — most
people do, because…"* instead of "incorrect".

---

## 8. `coach`

```ts
interface CoachConfig {
  voice: "peer" | "socratic" | "terse";
  maxWordsPerMessage: number;   // ≤ 40, enforced server-side by BACKEND
  triggers: {
    clampNoEffect?: boolean; regimeChange?: boolean; notableReached?: boolean;
    idleMs?: number; thrash?: boolean;
  };
  debounceMs: number;           // ≥ 8000 except prediction-resolved
  openingLine?: string;         // ≤ 90 chars, the only pre-scripted line
}
```

---

## 9. Limits (`lab-schema/src/limits.ts`)

Every one of these is a hard Zod bound, not a lint. AI-authored numbers are hostile numbers.

| Limit | Value |
|---|---|
| `maxEntities` (per set) | 2000 |
| `maxEntitySets` | 4 |
| `maxLinks` | 6000 |
| `maxParams` | 8 |
| `maxVars` | 24 |
| `maxDerived` | 24 |
| `maxLayers` | 12 |
| `maxBeats` | 12 |
| `maxExprNodes` | 512 |
| `maxExprDepth` | 24 |
| `maxVmSteps` | 2000 |
| `maxTickRate` | 120 |
| `maxSpecBytes` | 131072 |
| `maxHistory` (per var) | 2048 |
| `maxDrawOps` (`free-canvas`) | 200 |

`maxParams: 8` is pedagogical, not technical. Nine knobs is not a lab, it's a cockpit.

---

## 10. Worked example (abridged)

*Concept: "why does adding lanes to a highway not fix traffic"* → `particle-field`.

```json
{
  "specVersion": "1.0",
  "meta": {
    "concept": "why does adding lanes to a highway not fix traffic",
    "title": "Induced Demand", "domain": "systems", "archetype": "particle-field",
    "teachingAngle": "Capacity raises throughput only until latent demand refills it; congestion returns to the same equilibrium.",
    "bigIdea": "Demand expands to fill capacity.",
    "difficulty": 3, "estimatedMinutes": 6, "prerequisites": ["rates", "equilibrium"]
  },
  "model": {
    "params": [
      { "id": "lanes", "label": "Lanes", "min": 1, "max": 8, "step": 1, "default": 2,
        "affects": ["throughput", "avg_speed"], "explain": "Parallel capacity of the road" },
      { "id": "demand_elasticity", "label": "Demand response", "min": 0, "max": 1.5, "step": 0.05,
        "default": 0.9, "affects": ["cars_on_road"], "explain": "How fast new trips appear when it gets faster" }
    ],
    "vars": [{ "id": "cars_on_road", "init": "40", "clamp": [0, 600], "history": 512 }],
    "entities": [{
      "id": "cars", "count": "cars_on_road",
      "attrs": { "x": "rand()*100", "lane": "floor(rand()*lanes)", "v": "1" }
    }],
    "derived": [
      { "id": "density", "expr": "cars_on_road / (lanes * 100)" },
      { "id": "avg_speed", "expr": "clamp(1 - density*2.2, 0.05, 1)" },
      { "id": "throughput", "expr": "avg_speed * cars_on_road" }
    ],
    "dynamics": { "kind": "expr", "step": [
      { "target": "cars_on_road",
        "expr": "cars_on_road + demand_elasticity * (avg_speed - 0.45) * 6 * dt" }
    ]},
    "observables": [
      { "id": "avg_speed", "label": "Avg speed", "source": "avg_speed", "format": "percent",
        "thresholds": [{ "at": 0.3, "regime": "jammed" }], "goodDirection": "up" },
      { "id": "throughput", "label": "Cars/min", "source": "throughput", "format": "number", "precision": 0 }
    ],
    "notables": [{
      "id": "equilibrium-returns", "when": "lanes >= 5 && avg_speed < 0.5",
      "label": "Back to crawling", "insight": "Five lanes, same speed as two — demand caught up."
    }],
    "tickRate": 60, "timeScale": 1
  },
  "stage": {
    "archetype": "particle-field", "viewport": { "w": 100, "h": 100 }, "background": "plain",
    "layers": [{
      "id": "cars", "mark": "rect", "from": "cars",
      "channels": { "x": "x", "y": "20 + lane*(60/lanes)", "w": "1.6", "h": "max(1.2, 50/lanes/6)",
                    "fill": { "scale": "diverging", "by": "v", "domain": [0, 1] } }
    }],
    "config": { "bounds": "wrap-x", "trails": false, "collide": false }
  },
  "controls": [
    { "id": "c_lanes", "param": "lanes", "kind": "stepper", "prominence": "primary" },
    { "id": "c_elast", "param": "demand_elasticity", "kind": "slider", "prominence": "secondary" }
  ],
  "beats": [
    { "id": "b1", "phase": "see", "caption": "Two lanes, moving traffic.", "autoAdvanceMs": 4000 },
    { "id": "b2", "phase": "interact", "caption": "Add a lane.", "unlock": { "params": ["lanes"] },
      "goal": { "kind": "param-changed", "param": "lanes", "times": 1 } },
    { "id": "b3", "phase": "experiment", "unlock": { "params": ["lanes", "demand_elasticity"], "time": true },
      "presets": [{ "label": "No demand response", "set": { "demand_elasticity": 0 } }],
      "goal": { "kind": "notable-discovered", "count": 1 } },
    { "id": "b4", "phase": "predict", "goal": { "kind": "prediction-committed", "prediction": "p1" } },
    { "id": "b5", "phase": "understand" },
    { "id": "b6", "phase": "recall" }
  ],
  "assessment": {
    "predictions": [{
      "id": "p1", "beat": "b4",
      "question": "Jump from 2 lanes to 8. Where does avg speed settle after 30s?",
      "freeze": true,
      "answer": { "kind": "numeric", "observable": "avg_speed", "tolerance": 0.12 },
      "resolve": { "runForMs": 3000, "then": "reveal-and-annotate" },
      "whyCorrect": "It settles near the original speed — the extra room filled with new trips.",
      "commonWrong": [{ "pattern": "high", "because": "you held demand fixed; demand is a function of speed" }]
    }],
    "quizBlueprint": { "itemCount": 4,
      "mustCover": ["teachingAngle", "missedPrediction", "unvisitedRegime"],
      "allowInteractive": true, "difficultyCurve": "rising" },
    "masteryThreshold": 0.7
  },
  "coach": { "voice": "peer", "maxWordsPerMessage": 34,
    "triggers": { "clampNoEffect": true, "regimeChange": true, "notableReached": true, "idleMs": 20000, "thrash": true },
    "debounceMs": 8000, "openingLine": "Watch the flow, then give it another lane." }
}
```

Note what makes this a *lab* and not a diagram: `cars_on_road` is driven by `avg_speed`, so the
learner's intervention feeds back on itself. **The teaching angle is encoded in the dynamics, not
in the caption.** That is the bar for every spec BACKEND generates.
