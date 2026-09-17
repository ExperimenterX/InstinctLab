# plan.md — the Finance & Trading canvas

> **Scope of this plan: the canvas.** Spec in, pixels and interaction out. No AI, no HTTP, no
> persistence, no coach model calls. Labs are hand-authored JSON fixtures that the canvas
> compiles and runs.
>
> Read `docs/00-START-HERE.md`, `docs/03-lab-spec-dsl.md`, `docs/04-state-management.md` and
> `docs/11-canvas-design.md` first. This plan does not restate them; it extends them for finance
> and turns them into an ordered build.

---

## 0. What "only the canvas" means here

**In scope**

| Layer | Package | State today |
|---|---|---|
| Theme, primitives, viewport transform, axes | `packages/lab-renderers/src/draw` | stubs |
| Stage compiler (LabSpec → draw-ready) | `packages/lab-renderers/src/compile` | does not exist |
| Archetype renderers | `packages/lab-renderers/src/archetypes` | stubs |
| Scene host + hit-testing + direct manipulation | `packages/lab-renderers/src/draw/scene.ts` | stub |
| Numeric runtime that feeds the canvas | `packages/lab-sim` | stubs |
| Spec shapes for the above | `packages/lab-schema` | real Zod, needs additions |
| Shell: canvas, knobs, readouts, phase rail | `apps/web` | working, but on a private mini-schema |

**Out of scope, untouched:** `packages/ai-core`, `packages/persistence`, `apps/api`,
`services/api`, coach triggers that need a model call, quiz generation, SSE, sessions.

A canvas with no numbers is a blank box, so the minimum of `lab-sim` needed to drive a frame is
**in scope**: the expression compiler, the slab, the seeded RNG, and the kernels the two example
labs call. That is a deliberate widening of "canvas part" and the rest of the plan assumes it.

---

## 1. The starting position, honestly

There are two parallel stacks in this repository and they do not agree.

**Stack A — `packages/*`.** The architecture from the docs. `lab-schema` is real, complete Zod.
Everything else throws `NotImplemented`. Roughly 2,700 lines of typed stubs, no behaviour.

**Stack B — `apps/web/src/*`.** A working ~2,100-line MVP on its own private schema in
`apps/web/src/spec/schema.ts`. It has a real sandboxed expression compiler, a real function-plot
renderer with good axis and label craft, a knob panel that bypasses React, a prediction panel and
a quiz panel. It works today with no API key.

Stack B has no notion of time. Its lab is `y = f(x, params)`, re-sampled whenever a knob moves.
There is no state that evolves, no entities, no ticks, no randomness, no history. **Every
interesting finance concept is path-dependent**, so Stack B cannot express a single lab this plan
is about.

### Decision: build Stack A, harvest Stack B

Adopt `lab-schema` as the contract and build the canvas in `lab-renderers` + `lab-sim`. Port the
good parts of Stack B rather than rewriting them:

| From | To | Note |
|---|---|---|
| `apps/web/src/expr/compile.ts` | `lab-sim/src/expr-parser.ts`, `expr-vm.ts` | Keep the `Map`-not-object whitelist and the prototype-chain reasoning verbatim. Change the output from a closure tree to slot-addressed bytecode. |
| `apps/web/src/canvas/plot.ts` — `niceTicks`, `fmtTick`, `drawGrid`, `drawAxisLabels`, `drawSeriesLabel`, `drawMarker` | `lab-renderers/src/draw/axis.ts`, `labels.ts` | ~200 lines of real craft. Port to spec space. |
| `apps/web/src/canvas/theme.ts` | `lab-renderers/src/draw/theme.ts` | Re-check against the `dataviz` skill; the token set is larger now. |
| `apps/web/src/components/LabCanvas.tsx` mount pattern | `lab-renderers/src/draw/scene.ts` + a thin host component | The "zero animated props, overlay through a ref" pattern is correct. Keep it. |
| `apps/web/src/state/labStore.ts` | `lab-client/src/state/lab-store.ts` | Correct design already. |
| `apps/web/src/spec/schema.ts`, `parse.ts`, `fixture.ts` | **delete** | Superseded by `lab-schema`. |

Do the port as part of the phases below, not as a big-bang migration. `apps/web` must keep
running at every commit.

---

## 2. Eight design decisions

These are the load-bearing ones. Everything in the file plan follows from them.

### D1 — Two clocks: recompute and playhead

A price path is not stepped forward in real time. It is **computed whole, then revealed**.

```
  param change  ──►  mark path dirty
  next frame    ──►  recompute pass: run every `pass: "path"` kernel over all N bars, once
  every frame   ──►  playhead advances; renderer draws bars [0 .. cursor]
```

Why this and not a per-tick stochastic sim:

- **Scrubbing is free.** Moving the time cursor is an integer assignment, not a replay.
- **Prediction freeze/resolve is free.** The outcome already exists; resolving is moving the
  cursor and un-dimming.
- **Knob response is instant and complete.** The learner sees the *whole* effect of wider
  volatility immediately, not the next few bars of it.
- **Grading is trivial and identical to what was on screen**, because the whole path is a pure
  function of `(noise tape, params)`.

Kernels therefore declare a pass:

```ts
pass: "path"   // runs on recompute, writes whole entity columns
pass: "tick"   // runs every step, mutates scalars (order-book animation, playhead effects)
```

A lab may use either or both. The depth-ladder example is tick-only; the trading example is
path-dominant with one tick stage.

### D2 — Common random numbers (the noise tape)

**The single most important decision for finance labs.**

If dragging the volatility knob also reshuffles the random draws, the learner sees a different
market, cannot attribute the change to their action, and learns nothing. The lab silently becomes
a slot machine.

So: at reset, draw `bars × maxPaths` standard normals from the seeded PRNG into one
`Float64Array` — the **noise tape**. Every path is a pure function `f(tape, params)`. Turning up
volatility scales the *same* wiggles. The learner sees "same market, louder".

- The tape is allocated once at compile, filled at reset, never reallocated.
- A **"New market"** control advances the tape seed. Resampling is always explicit and
  learner-initiated. Nothing else may reseed.
- Box–Muller over `mulberry32`, both in `lab-sim/src/rng.ts`. `Math.random()` anywhere on a
  simulation path is a bug that breaks replay and grading.

### D3 — Bars are an EntitySet; rings are for accumulation

Two time-series storages, one rule for choosing:

- **Bar columns** (`EntitySet` with attrs `t, o, h, l, c, …`) when the series is *recomputed*
  from the tape on a param change. Price, equity along the path, per-bar drawdown, quantiles.
- **History rings** (`Var.history`) when the series *accumulates irreversibly* from what the
  learner did and must survive a param change. Knob-change trails, session-level tallies.

Finance labs are almost entirely the first. That reuses the slab and the column views wholesale;
no new storage machinery is needed.

Reading a bar column at the playhead needs one new expression form, because indexing is forbidden:

```
at(bars.equity, cursor)     // → scalar; same syntax family as sum(nodes.load)
```

### D4 — Three finance archetypes, defined structurally

Add three. Each is a grammar, and each must prove it by rendering a non-finance fixture (§8).

| id | Structural definition | Finance reading | Non-finance proof fixture |
|---|---|---|---|
| `market-tape` | One ordered index axis, one or more stacked value panes, bar/candle marks, horizontal level marks, point event marks, optional right-edge marginal distribution | price path, equity curve, drawdown, fills, Monte Carlo fan | population under carrying capacity (port of the existing Stack B fixture) |
| `payoff-profile` | Piecewise value over one continuous axis, composed from additive legs, with a total, zero crossings, a current-position marker, and signed region shading | option payoffs, hedges, leverage and liquidation | marginal tax brackets |
| `depth-ladder` | Two-sided quantity distribution over a sorted discrete key axis, with a consumption sweep and a resulting weighted average | order book, slippage, market impact | supply/demand at auction |

No file under `archetypes/` may contain the words "stock", "option", "order" outside a comment. A
file named `stop-loss.ts` is a bug, same rule as before.

`market-tape` gets **panes**: an ordered list of vertically stacked regions, each with its own
y-domain, height fraction and scale. Price over equity over drawdown in one canvas, one shared
x-axis. Without panes, every finance lab needs three canvases.

### D5 — Money axes are not generic axes

- **y-domain locked by default.** Already the rule; it matters twice as much here. A rescaling
  axis makes a doubling look like a wiggle.
- **`yScale: "log"` for anything that compounds.** On a linear axis a 10% move at $10 and at $100
  are different heights, which teaches the wrong thing about returns. Log is the honest default
  once a path can cover more than about one doubling.
- **Percent and P&L panes anchor at zero** and always draw the zero line, in `fg`, above the grid
  and below the series.
- **Formats:** extend the observable format enum with `bps`, `compact` (`$1.2M`), `signed-percent`
  (`+3.4%`), `multiple` (`2.4×`). `precision` still applies.
- **Drawdown panes invert**: zero at the top, worst at the bottom.

### D6 — Direct manipulation is the lesson, not a feature

Each finance archetype ships one canvas-native gesture, and in each case that gesture *is* the
teaching moment:

| Archetype | Gesture | What it teaches by hand |
|---|---|---|
| `market-tape` | drag a horizontal level (stop, target, strike) | stop distance versus noise amplitude |
| `depth-ladder` | drag the order-size handle | your size is part of your price |
| `payoff-profile` | drag the strike or the spot marker | where the profile bends and why |

Rules: hit band for a horizontal level is ±3 spec units across the full pane width; the pick
radius floor of 3 spec units applies to everything; a drag writes a param through
`SimCore.poke` on the same tick and never through React; a drag on a path-dirtying param triggers
one recompute on the next frame, not one per pointer event.

`market-tape` also supports a **crosshair scrub** that reads the bar under the cursor into the
readout panel. That is a read, not a param write, and must not dirty the path.

### D7 — Channels evaluate in batch, per column, never per entity per property

The hot path. One VM pass per channel per frame into a pre-allocated scratch array, then a tight
draw loop over typed arrays:

```ts
evalColumn(program, out: Float64Array, n: number, ctx)   // one pass
```

Plus, all decided at compile time:

- **Constant folding.** A channel program with no variable references collapses to a number, and
  the draw loop takes a constant branch.
- **Colour LUTs.** A `ColorScale` quantises to 64 pre-resolved strings. No string building, ever.
- **Batch by fill style.** Candles draw in two passes, up-bars then down-bars: two `fillStyle`
  assignments per frame instead of `n`.
- **Min/max decimation.** When bars exceed available pixel columns, decimate per column keeping
  both the min and the max so spikes survive. A price chart that drops its wicks is a lie.

`draw()` allocates nothing. The perf harness in §7 proves it rather than asserting it.

### D8 — Ensemble recompute is chunked; the highlighted path is synchronous

Monte Carlo is how a finance lab stops being an anecdote. But 256 paths × 240 bars on every knob
tick will stutter the knob, and a stuttering knob is a product failure.

- The **highlighted path** (path 0) recomputes synchronously, always. The knob feels instant.
- The **ensemble** recomputes in chunks of ~32 paths per frame, with the fan fading in as it
  fills and an honest progress state.
- A new knob event **cancels and restarts** the chunked pass. No queueing.
- `maxEnsemblePaths: 256`, `maxBars: 1024`, both hard Zod bounds.

No Worker in this phase. Revisit only if the frame budget in §7 fails with the chunker in place.

---

## 3. The compile pipeline

One path from JSON to pixels. Everything expensive happens once.

```
LabSpec (JSON fixture)
   │
   ├─ 1. validateLabSpec          lab-schema      Zod + cross-field refinements + archetype↔config pairing
   │
   ├─ 2. layoutSlab               lab-sim         params | vars | derived | entity columns | history rings
   │                                              → ParamTable: every id resolved to an integer slot
   │
   ├─ 3. compileExpr × all        lab-sim         model exprs AND stage channel exprs → slot-addressed
   │                                              bytecode. Constant-folds. Rejects out-of-scope ids.
   │
   ├─ 4. allocate                 lab-sim         slab Float64Array, noise tape, prev-buffer, scratch
   │
   ├─ 5. compileStage             lab-renderers   per layer: resolve `from` to (columnBase, count),
   │                                              compile channels, resolve colours to constants or LUTs,
   │                                              size scratch arrays → CompiledLayer[]
   │
   ├─ 6. archetype.compile        lab-renderers   geometry caches: pane rects, axis ticks, bar x-positions,
   │                                              ladder level rects
   │
   └─ CompiledLab ──► Scene.attach(canvas, sim)
                         │
                         ├─ frame: sim.recomputeIfDirty()   D1 path pass, D8 chunked ensemble
                         ├─ frame: sim.step(dt)             tick kernels + playhead
                         ├─ frame: archetype.draw(...)      arithmetic + canvas calls only
                         └─ 10Hz:  sample observables ──► React
```

Two invariants the reviewer checks on every renderer PR:

1. Nothing in step 5 or 6 happens inside `draw`. No `slotOf`, no string lookup, no `Map.get`.
2. `draw` is wrapped in try/catch **at the frame boundary**, not inside the loop. On a throw:
   freeze the last good frame, report once, keep the session alive.

---

## 4. Schema additions

All under `packages/lab-schema`, which `docs/00-START-HERE.md` assigns to API. Log every item
below in `docs/CONTRACT-REQUESTS.md` as it lands, so the contract history stays readable.

### 4.1 `meta.ts`

```ts
ArchetypeIdSchema: add "market-tape", "payoff-profile", "depth-ladder"

MetaSchema: add
  synthetic: z.literal(true)     // required on every finance-domain lab; see §9
```

### 4.2 `model.ts`

```ts
KernelIdSchema: add
  "gbm-path"          pass:path   geometric Brownian motion from the tape → o,h,l,c
  "ou-path"           pass:path   Ornstein–Uhlenbeck mean reversion
  "jump-diffusion"    pass:path   GBM + compound Poisson jumps
  "bracket-exec"      pass:path   entry/stop/target walk over a bar column → position, fills, equity
  "portfolio-account" pass:path   cash, position, mark-to-market, margin, drawdown
  "book-depth"        pass:tick   shape a two-sided ladder from a decay profile
  "order-sweep"       pass:tick   walk a size through the ladder → consumed, avg fill
  "book-refill"       pass:tick   replenish consumed levels at a rate

// NEW dynamics kind — composition, because finance is inherently staged:
//   generate path → execute against it → account for it
DynamicsSchema: add
  { kind: "stack", stages: Array<
      | { stage: "kernel"; kernel: KernelId; config: Record<string, Expr> }
      | { stage: "expr";   step: Assignment[] }
      | { stage: "rules";  rules: Rule[] }
    > }   // min 1, max 6, run in declared order
```

Each kernel declares, in `lab-sim/src/kernels/manifest.ts`, its pass, its required config keys and
the columns it writes. `validateLabSpec` checks that every declared output set and attribute
exists in the model. A kernel writing to a column nobody declared is a validation error, not a
runtime surprise.

### 4.3 `expr.ts`

```ts
EXPR_AGGREGATES: add "at"     // at(set.attr, index) → scalar, clamped index, no indexing syntax
```

### 4.4 `stage.ts`

```ts
MarkSchema: add "candle", "band", "level", "histogram", "marker"

PaneSchema = {
  id, label, heightFraction (0.1..1), yDomain: [n,n] | "auto",
  yScale: "linear" | "log", anchorZero: boolean, invert: boolean, format: Format
}

MarketTapeConfigSchema = {
  indexAttr: string,                    // the ordered x attribute, usually "t"
  barCount: Expr,                       // ≤ LIMITS.maxBars
  panes: Pane[],                        // 1..3, stacked top to bottom, shared x-axis
  cursorVar: VarId,                     // the playhead
  reveal: "progressive" | "instant",
  crosshair: boolean,
  marginal: { of: string; bins: number } | undefined,   // right-edge terminal distribution
  fan: { set: EntitySetId; quantiles: number[] } | undefined,
  xLabel: string
}

PayoffProfileConfigSchema = {
  xDomain: [n,n], xLabel, yLabel,
  legs: Array<{ label, expr: Expr, color: PaletteToken, visible: Expr }>,  // 1..6
  total: boolean,
  spotMarker: Expr | undefined,
  shadeSign: boolean,                   // green above zero, red below, plus a label — never colour alone
  breakevens: boolean,
  density: { expr: Expr; height: number } | undefined   // probability strip under the x-axis
}

DepthLadderConfigSchema = {
  setId: EntitySetId,
  priceAttr, bidAttr, askAttr, consumedAttr: string,
  levels: number,                       // 4..80
  tickSize: Expr,
  midMarker: Expr,
  sweep: { sizeParam: ParamId; side: Expr; animMs: number } | undefined,
  avgFillMarker: Expr | undefined,
  orientation: "vertical" | "horizontal"
}

ArchetypeConfigSchema: add the three above to the union.
```

### 4.5 `limits.ts`

```ts
maxBars: 1024
maxEnsemblePaths: 256
maxLadderLevels: 80
maxPanes: 3
maxLegs: 6
maxKernelStages: 6
```

### 4.6 The refinement that is currently a TODO

`stage.ts` line ~230 carries a `TODO(API)` noting that the `config` union does not enforce
pairing with `archetype`. With thirteen archetypes instead of ten, a mismatched config becomes
much more likely, and it fails mid-frame rather than at parse.

**Do this first, before any renderer work.** A `superRefine` on `StageSchema` that switches on
`archetype` and re-parses `config` with the one matching schema.

---

## 5. Runtime additions (`lab-sim`)

```
src/rng.ts                 mulberry32, Box–Muller normals, NoiseTape (alloc once, fill on reset,
                           advance-seed on explicit "New market")
src/expr-parser.ts         tokenise → AST → slot-addressed bytecode. Port the whitelist and the
                           Map-not-object reasoning from apps/web/src/expr/compile.ts.
src/expr-vm.ts             eval(program, ctx) and evalColumn(program, out, n, ctx) — D7
src/param-table.ts         layoutSlab: params | vars | derived | entity columns | history rings
src/sim-core.ts            compile, reset, step, poke, read, view, countOf, observable,
                           recomputeIfDirty, setCursor, snapshot/restore, checkFinite
src/dirty.ts               param → dependent path kernels. Poking a param marks exactly the
                           stages that read it. Conservative is fine; wrong is not.
src/ensemble.ts            chunked Monte Carlo (D8): start, advance(budgetPaths), cancel, quantiles
src/kernels/manifest.ts    per-kernel pass, required config, declared output columns
src/kernels/*.ts           the eight kernels in §4.2
```

`lab-sim` keeps its DOM-free tsconfig. If a kernel reaches for `performance` or `window` it will
not compile, and that is the point.

---

## 6. The two example labs

Both live in `packages/lab-schema/src/fixtures/` as typed, `validateLabSpec`-checked constants, so
a schema change breaks them at typecheck rather than at runtime. Both are abridged below —
observables, beats and assessment are shown in shape, and the implementer fills the remaining
captions to the word limits in doc 03.

### 6.1 Trading — "Why does my stop-loss keep getting hit?"

**Archetype** `market-tape` · **Domain** finance · **Difficulty** 3 · **~7 min**

**Teaching angle.** *A stop is a bet against noise, not against direction: set it inside one bar's
volatility and the path taps it long before your edge has time to pay.*

**Big idea.** Stop distance is measured in volatility, not dollars.

Why this lab earns its place: the feedback loop is real (a stop-out forces a re-entry at a worse
price, which changes the next stop, which changes the next outcome), the surprise is strong and
reproducible (a genuinely positive edge reliably loses money at a tight stop), and it exercises
every hard part of the design at once — noise tape, path kernels, stacked panes, ensemble fan,
and a draggable level.

```jsonc
{
  "specVersion": "1.0",
  "meta": {
    "concept": "why does my stop loss keep getting hit",
    "title": "Stops and Noise",
    "domain": "finance",
    "archetype": "market-tape",
    "synthetic": true,
    "teachingAngle": "A stop inside one bar of volatility is a bet against noise; the path taps it before the edge pays.",
    "bigIdea": "Stop distance is measured in volatility, not dollars.",
    "difficulty": 3,
    "estimatedMinutes": 7,
    "prerequisites": ["percent returns", "volatility as a range"]
  },

  "model": {
    "params": [
      { "id": "stop_distance_atr", "label": "Stop distance", "unit": "ATR",
        "min": 0.25, "max": 5, "step": 0.25, "default": 1,
        "affects": ["net_pnl", "stop_rate"],
        "explain": "How far below entry the stop sits, in average bar ranges" },
      { "id": "volatility_pct", "label": "Volatility", "unit": "%/bar",
        "min": 0.25, "max": 5, "step": 0.25, "default": 1.5,
        "affects": ["stop_rate", "net_pnl"],
        "explain": "Typical size of one bar's move" },
      { "id": "drift_bps", "label": "Your edge", "unit": "bps/bar",
        "min": -20, "max": 40, "step": 1, "default": 10,
        "affects": ["net_pnl", "edge_captured"],
        "explain": "Expected drift per bar before costs" },
      { "id": "take_profit_r", "label": "Target", "unit": "R",
        "min": 0.5, "max": 6, "step": 0.5, "default": 2,
        "affects": ["net_pnl", "win_rate"],
        "explain": "Profit target as a multiple of the risked distance" },
      { "id": "cost_bps", "label": "Cost per trade", "unit": "bps",
        "min": 0, "max": 20, "step": 1, "default": 2,
        "affects": ["net_pnl"],
        "explain": "Spread and commission paid on every entry and exit" },
      { "id": "path_count", "label": "Markets", "unit": "paths",
        "min": 1, "max": 256, "step": 1, "default": 1, "scale": "log",
        "affects": ["stop_rate"],
        "explain": "How many independent markets to run at once" }
    ],

    "vars": [
      { "id": "cursor", "init": "0", "clamp": [0, 239] }
    ],

    "entities": [
      { "id": "bars", "count": "240",
        "attrs": { "t": "i", "o": "100", "h": "100", "l": "100", "c": "100",
                   "equity": "0", "dd": "0", "fill_side": "0", "stop_px": "0" } },
      // Allocated at the ceiling, never at path_count: an entity count is resolved at RESET,
      // so sizing it from a knob would force a reallocation mid-session. `active` is written by
      // the ensemble kernel on every recompute (an init attr would go stale on a knob change);
      // aggregates mask on it.
      { "id": "ens", "count": "256",
        "attrs": { "active": "0", "final_equity": "0", "stops": "0", "max_dd": "0" } },
      { "id": "fan", "count": "240",
        "attrs": { "q10": "0", "q25": "0", "q50": "0", "q75": "0", "q90": "0" } }
    ],

    "derived": [
      // Declaration order IS evaluation order. A derived may only read ones above it.
      { "id": "atr",           "expr": "volatility_pct" },
      { "id": "net_pnl",       "expr": "at(bars.equity, cursor)" },
      { "id": "max_dd",        "expr": "at(bars.dd, cursor)" },
      { "id": "gross_edge",    "expr": "drift_bps / 10000 * cursor * 100" },
      { "id": "edge_captured", "expr": "gross_edge == 0 ? 0 : net_pnl / gross_edge" },
      { "id": "active_paths",  "expr": "max(1, sum(ens.active))" },
      { "id": "stops_avg",     "expr": "sum(ens.stops) / active_paths" },
      { "id": "stop_rate",     "expr": "stops_avg / (stops_avg + 1)" },
      { "id": "win_rate",      "expr": "clamp(1 - stop_rate, 0, 1)" }
    ],

    "dynamics": {
      "kind": "stack",
      "stages": [
        { "stage": "kernel", "kernel": "gbm-path",
          "config": { "sigma": "volatility_pct / 100", "mu": "drift_bps / 10000",
                      "bars": "240", "start": "100", "into": "bars" } },
        { "stage": "kernel", "kernel": "bracket-exec",
          "config": { "over": "bars", "stop": "stop_distance_atr * atr / 100",
                      "target": "stop_distance_atr * take_profit_r * atr / 100",
                      "cost": "cost_bps / 10000", "reentry": "1" } },
        { "stage": "kernel", "kernel": "portfolio-account",
          "config": { "over": "bars", "into_equity": "equity", "into_dd": "dd" } },
        { "stage": "expr",
          "step": [ { "target": "cursor", "expr": "min(239, cursor + 60 * dt)" } ] }
      ]
    },

    "observables": [
      { "id": "net_pnl",       "label": "Net P&L",      "source": "net_pnl",       "format": "signed-percent", "precision": 1, "goodDirection": "up",
        "thresholds": [{ "at": 0, "regime": "losing" }] },
      { "id": "stop_rate",     "label": "Stopped out",  "source": "stop_rate",     "format": "percent", "precision": 0, "goodDirection": "down" },
      { "id": "edge_captured", "label": "Edge kept",    "source": "edge_captured", "format": "percent", "precision": 0, "goodDirection": "up" },
      { "id": "max_dd",        "label": "Worst drawdown","source": "max_dd",       "format": "percent", "precision": 1, "goodDirection": "down" }
    ],

    "notables": [
      { "id": "right-and-losing", "when": "drift_bps > 0 && net_pnl < 0 && cursor > 180",
        "label": "Right, and still losing",
        "insight": "Positive edge, negative P&L — the stop is harvesting noise, not risk." },
      { "id": "stop-widens-out", "when": "stop_distance_atr >= 2.5 && stop_rate < 0.2",
        "label": "The churn stops",
        "insight": "Past about two ATR the path stops tagging the stop and the edge survives." },
      { "id": "vol-scales", "when": "volatility_pct > 3 && stop_distance_atr < 1 && stop_rate > 0.7",
        "label": "Volatility ate the stop",
        "insight": "Same stop in dollars, louder market — the stop is now inside the noise." }
    ],

    "invariants": [
      { "expr": "at(bars.equity, cursor) > -1", "message": "Equity below -100% is not reachable here" }
    ],

    "tickRate": 60,
    "timeScale": 1
  },

  "stage": {
    "archetype": "market-tape",
    "viewport": { "w": 100, "h": 100 },
    "background": "plain",
    "layers": [
      { "id": "candles", "mark": "candle", "from": "bars",
        "channels": { "x": "t", "y": "c", "h": "h", "l": "l", "w": "o" } },
      { "id": "fan-band", "mark": "band", "from": "fan",
        "channels": { "x": "t", "y": "q25", "h": "q75", "fill": "accent-soft", "alpha": "0.35" } },
      { "id": "stop-level", "mark": "level", "from": "self",
        "channels": { "y": "at(bars.stop_px, cursor)", "stroke": "danger", "label": "Stop" },
        "interactive": { "drag": "y" } },
      { "id": "fills", "mark": "marker", "from": "bars",
        "channels": { "x": "t", "y": "c", "alpha": "abs(fill_side)",
                      "fill": { "scale": "diverging", "by": "fill_side", "domain": [-1, 1] } } },
      { "id": "equity", "mark": "curve", "from": "bars",
        "channels": { "x": "t", "y": "equity", "stroke": "series-0" } },
      { "id": "drawdown", "mark": "area", "from": "bars",
        "channels": { "x": "t", "y": "dd", "fill": "warn", "alpha": "0.5" } }
    ],
    "legend": [
      { "label": "Price", "color": "fg", "mark": "candle" },
      { "label": "Equity", "color": "series-0", "mark": "curve" },
      { "label": "Stop", "color": "danger", "mark": "line" }
    ],
    "config": {
      "indexAttr": "t",
      "barCount": "240",
      "cursorVar": "cursor",
      "reveal": "progressive",
      "crosshair": true,
      "xLabel": "Bars",
      "fan": { "set": "fan", "quantiles": [0.1, 0.25, 0.5, 0.75, 0.9] },
      "marginal": { "of": "ens.final_equity", "bins": 24 },
      "panes": [
        { "id": "price",  "label": "Price",    "heightFraction": 0.55, "yDomain": "auto",
          "yScale": "log",    "anchorZero": false, "invert": false, "format": "number" },
        { "id": "equity", "label": "Equity",   "heightFraction": 0.28, "yDomain": [-0.3, 0.5],
          "yScale": "linear", "anchorZero": true,  "invert": false, "format": "signed-percent" },
        { "id": "dd",     "label": "Drawdown", "heightFraction": 0.17, "yDomain": [-0.4, 0],
          "yScale": "linear", "anchorZero": true,  "invert": true,  "format": "percent" }
      ]
    }
  },

  "controls": [
    { "id": "c_stop",  "param": "stop_distance_atr", "kind": "slider",  "prominence": "primary" },
    { "id": "c_vol",   "param": "volatility_pct",    "kind": "slider",  "prominence": "secondary" },
    { "id": "c_drift", "param": "drift_bps",         "kind": "slider",  "prominence": "secondary" },
    { "id": "c_tp",    "param": "take_profit_r",     "kind": "stepper", "prominence": "advanced" },
    { "id": "c_cost",  "param": "cost_bps",          "kind": "slider",  "prominence": "advanced" },
    { "id": "c_paths", "param": "path_count",        "kind": "slider",  "prominence": "advanced" }
  ],

  "beats": [
    { "id": "b1", "phase": "see", "caption": "One market, one stop, 240 bars.", "autoAdvanceMs": 5000 },
    { "id": "b2", "phase": "interact", "caption": "Drag the stop.",
      "unlock": { "params": ["stop_distance_atr"] },
      "goal": { "kind": "param-changed", "param": "stop_distance_atr", "times": 2 } },
    { "id": "b3", "phase": "experiment",
      "unlock": { "params": ["stop_distance_atr","volatility_pct","drift_bps","take_profit_r","cost_bps","path_count"], "time": true },
      "presets": [
        { "label": "Loud market",   "set": { "volatility_pct": 4 } },
        { "label": "Strong edge",   "set": { "drift_bps": 35 } },
        { "label": "256 markets",   "set": { "path_count": 256 } }
      ],
      "goal": { "kind": "notable-discovered", "count": 1 } },
    { "id": "b4", "phase": "predict", "goal": { "kind": "prediction-committed", "prediction": "p1" } },
    { "id": "b5", "phase": "understand" },
    { "id": "b6", "phase": "recall" }
  ],

  "assessment": {
    "predictions": [
      { "id": "p1", "beat": "b4",
        "question": "Edge +10 bps/bar, volatility 1.5%/bar, stop at 0.5 ATR. Net P&L after 240 bars?",
        "freeze": true,
        "answer": { "kind": "numeric", "observable": "net_pnl", "tolerance": 0.05 },
        "resolve": { "runForMs": 2500, "then": "reveal-and-annotate" },
        "whyCorrect": "Negative. The edge is real but the stop sits inside one bar of noise, so it pays costs to exit at random.",
        "commonWrong": [
          { "pattern": "positive", "because": "you priced the edge and ignored how often noise reaches the stop first" }
        ] }
    ],
    "quizBlueprint": {
      "itemCount": 4,
      "mustCover": ["teachingAngle", "missedPrediction", "unvisitedRegime", "extremeKnob"],
      "allowInteractive": true,
      "difficultyCurve": "rising"
    },
    "masteryThreshold": 0.7
  },

  "coach": {
    "voice": "peer", "maxWordsPerMessage": 34,
    "triggers": { "clampNoEffect": true, "regimeChange": true, "notableReached": true, "idleMs": 20000, "thrash": true },
    "debounceMs": 8000,
    "openingLine": "Same market every time. Move the stop and watch what changes."
  }
}
```

**What makes it a lab and not a chart:** the stop level is *draggable on the canvas*, the noise
tape holds the market fixed while the learner varies the stop, and `path_count` turns one
anecdote into a distribution without changing anything else on screen.

### 6.2 Second lab — "Why did my order fill worse than the price I saw?"

**Archetype** `depth-ladder` · **Domain** finance · **Difficulty** 2 · **~5 min**

I picked market microstructure for the second lab specifically because it is the *least* like the
first: no time axis, no randomness in the main lesson, discrete levels instead of a continuous
path, and a tick-pass kernel instead of a path-pass one. Two labs that both turn out to be line
charts would prove nothing about the compile pipeline. These two together prove it generalises.

**Teaching angle.** *The quote is the top of a ladder, not the price: your size walks down it and
you pay the average of everything you consumed.*

**Big idea.** Price is a function of your own size.

```jsonc
{
  "specVersion": "1.0",
  "meta": {
    "concept": "why did my order fill worse than the price i saw",
    "title": "Walking the Book",
    "domain": "finance",
    "archetype": "depth-ladder",
    "synthetic": true,
    "teachingAngle": "The quote is the top of a ladder: your size walks down it and you pay the average of what you consumed.",
    "bigIdea": "Price is a function of your own size.",
    "difficulty": 2,
    "estimatedMinutes": 5,
    "prerequisites": ["bid and ask", "weighted average"]
  },

  "model": {
    "params": [
      { "id": "order_size", "label": "Order size", "unit": "lots",
        "min": 1, "max": 5000, "step": 1, "default": 200, "scale": "log",
        "affects": ["slippage_bps", "avg_fill"],
        "explain": "How much you are trying to buy right now" },
      { "id": "book_depth", "label": "Liquidity", "unit": "×",
        "min": 0.2, "max": 3, "step": 0.1, "default": 1,
        "affects": ["slippage_bps", "levels_used"],
        "explain": "How much size is resting at each price level" },
      { "id": "spread_ticks", "label": "Spread", "unit": "ticks",
        "min": 1, "max": 20, "step": 1, "default": 2,
        "affects": ["slippage_bps"],
        "explain": "Distance between the best bid and the best ask" },
      { "id": "slice_count", "label": "Slices", "unit": "orders",
        "min": 1, "max": 20, "step": 1, "default": 1,
        "affects": ["slippage_bps", "fill_rate"],
        "explain": "Split the order into this many pieces, spaced over time" },
      { "id": "refill_rate", "label": "Refill speed", "unit": "%/s",
        "min": 0, "max": 100, "step": 5, "default": 30,
        "affects": ["slippage_bps", "fill_rate"],
        "explain": "How fast other traders replace the size you took" },
      { "id": "decay_shape", "label": "Book shape",
        "min": 0.3, "max": 3, "step": 0.1, "default": 1,
        "affects": ["slippage_bps"],
        "explain": "Low: depth concentrated at the touch. High: depth spread out." }
    ],

    "vars": [
      { "id": "consumed_qty", "init": "0" },
      { "id": "notional",     "init": "0" },
      { "id": "sweep_phase",  "init": "0", "clamp": [0, 1] },
      { "id": "slices_done",  "init": "0" }
    ],

    "entities": [
      { "id": "levels", "count": "40",
        "attrs": {
          "price":    "100 + (i - 20) * 0.01",
          "bid_qty":  "i < 20 ? 500 * book_depth * exp(-abs(i - 19) / (6 * decay_shape)) : 0",
          "ask_qty":  "i >= 20 ? 500 * book_depth * exp(-abs(i - 20) / (6 * decay_shape)) : 0",
          "consumed": "0"
        } }
    ],

    "derived": [
      { "id": "top_of_book",  "expr": "100 + spread_ticks * 0.005" },
      { "id": "avg_fill",     "expr": "consumed_qty > 0 ? notional / consumed_qty : top_of_book" },
      { "id": "slippage_bps", "expr": "(avg_fill - top_of_book) / top_of_book * 10000" },
      { "id": "levels_used",  "expr": "countWhere(levels.consumed)" },
      { "id": "fill_rate",    "expr": "clamp(consumed_qty / max(1, order_size), 0, 1)" },
      { "id": "impact_ticks", "expr": "(avg_fill - top_of_book) / 0.01" },
      { "id": "cost_dollars", "expr": "(avg_fill - top_of_book) * consumed_qty" }
    ],

    "dynamics": {
      "kind": "stack",
      "stages": [
        { "stage": "kernel", "kernel": "book-depth",
          "config": { "set": "levels", "depth": "book_depth", "shape": "decay_shape",
                      "spread": "spread_ticks", "tick": "0.01" } },
        { "stage": "kernel", "kernel": "order-sweep",
          "config": { "set": "levels", "size": "order_size / max(1, slice_count)",
                      "side": "1", "phase": "sweep_phase",
                      "into_qty": "consumed_qty", "into_notional": "notional" } },
        { "stage": "kernel", "kernel": "book-refill",
          "config": { "set": "levels", "rate": "refill_rate / 100" } },
        { "stage": "expr", "step": [
          { "target": "sweep_phase", "expr": "min(1, sweep_phase + dt * 1.5)" },
          { "target": "slices_done", "expr": "sweep_phase >= 1 ? min(slice_count, slices_done + 1) : slices_done" }
        ] }
      ]
    },

    "observables": [
      { "id": "avg_fill",     "label": "Avg fill",     "source": "avg_fill",     "format": "currency", "precision": 3, "goodDirection": "down" },
      { "id": "slippage_bps", "label": "Slippage",     "source": "slippage_bps", "format": "bps",      "precision": 1, "goodDirection": "down",
        "thresholds": [{ "at": 10, "regime": "expensive" }, { "at": 50, "regime": "painful" }] },
      { "id": "levels_used",  "label": "Levels eaten", "source": "levels_used",  "format": "integer",  "precision": 0, "goodDirection": "down" },
      { "id": "fill_rate",    "label": "Filled",       "source": "fill_rate",    "format": "percent",  "precision": 0, "goodDirection": "up" }
    ],

    "notables": [
      { "id": "superlinear", "when": "order_size > 1500 && slippage_bps > 4 * (order_size / 1000)",
        "label": "Cost grows faster than size",
        "insight": "Doubling the order more than doubled the cost — depth thins as you descend." },
      { "id": "slicing-wins", "when": "slice_count >= 8 && refill_rate > 40 && slippage_bps < 5",
        "label": "Patience is liquidity",
        "insight": "Slicing let the book refill between fills, so you bought near the touch." },
      { "id": "thin-book", "when": "book_depth < 0.4 && slippage_bps > 25",
        "label": "Nobody home",
        "insight": "In a thin book your own order is most of the volume, so it is most of the price." }
    ],

    "tickRate": 60,
    "timeScale": 1
  },

  "stage": {
    "archetype": "depth-ladder",
    "viewport": { "w": 100, "h": 100 },
    "background": "plain",
    "layers": [
      { "id": "bids", "mark": "rect", "from": "levels",
        "channels": { "y": "price", "w": "bid_qty", "fill": "ok" } },
      { "id": "asks", "mark": "rect", "from": "levels",
        "channels": { "y": "price", "w": "ask_qty", "fill": "danger" } },
      { "id": "eaten", "mark": "rect", "from": "levels",
        "channels": { "y": "price", "w": "consumed", "fill": "warn", "alpha": "0.85" } },
      { "id": "touch", "mark": "level", "from": "self",
        "channels": { "y": "top_of_book", "stroke": "muted", "label": "Quote" } },
      { "id": "avg", "mark": "level", "from": "self",
        "channels": { "y": "avg_fill", "stroke": "accent", "label": "Your fill" } },
      { "id": "size-handle", "mark": "marker", "from": "self",
        "channels": { "x": "clamp(order_size / 50, 2, 96)", "y": "top_of_book", "fill": "accent" },
        "interactive": { "drag": "x" } }
    ],
    "legend": [
      { "label": "Bids", "color": "ok", "mark": "rect" },
      { "label": "Asks", "color": "danger", "mark": "rect" },
      { "label": "You took", "color": "warn", "mark": "rect" }
    ],
    "config": {
      "setId": "levels",
      "priceAttr": "price", "bidAttr": "bid_qty", "askAttr": "ask_qty", "consumedAttr": "consumed",
      "levels": 40,
      "tickSize": "0.01",
      "midMarker": "top_of_book",
      "avgFillMarker": "avg_fill",
      "orientation": "vertical",
      "sweep": { "sizeParam": "order_size", "side": "1", "animMs": 700 }
    }
  },

  "controls": [
    { "id": "c_size",   "param": "order_size",   "kind": "slider",  "prominence": "primary" },
    { "id": "c_depth",  "param": "book_depth",   "kind": "slider",  "prominence": "secondary" },
    { "id": "c_spread", "param": "spread_ticks", "kind": "stepper", "prominence": "secondary" },
    { "id": "c_slices", "param": "slice_count",  "kind": "stepper", "prominence": "advanced" },
    { "id": "c_refill", "param": "refill_rate",  "kind": "slider",  "prominence": "advanced" },
    { "id": "c_shape",  "param": "decay_shape",  "kind": "slider",  "prominence": "advanced" }
  ],

  "beats": [
    { "id": "b1", "phase": "see", "caption": "Resting size at every price.", "autoAdvanceMs": 4000 },
    { "id": "b2", "phase": "interact", "caption": "Buy more.",
      "unlock": { "params": ["order_size"] },
      "goal": { "kind": "param-changed", "param": "order_size", "times": 2 } },
    { "id": "b3", "phase": "experiment",
      "unlock": { "params": ["order_size","book_depth","spread_ticks","slice_count","refill_rate","decay_shape"], "time": true },
      "presets": [
        { "label": "Thin book",   "set": { "book_depth": 0.3 } },
        { "label": "Slice it up", "set": { "slice_count": 10, "refill_rate": 60 } },
        { "label": "Size it up",  "set": { "order_size": 3000 } }
      ],
      "goal": { "kind": "notable-discovered", "count": 1 } },
    { "id": "b4", "phase": "predict", "goal": { "kind": "prediction-committed", "prediction": "p1" } },
    { "id": "b5", "phase": "understand" },
    { "id": "b6", "phase": "recall" }
  ],

  "assessment": {
    "predictions": [
      { "id": "p1", "beat": "b4",
        "question": "200 lots cost you 4 bps. One order for 2000 lots — how many bps?",
        "freeze": true,
        "answer": { "kind": "numeric", "observable": "slippage_bps", "tolerance": 8 },
        "resolve": { "runForMs": 1500, "then": "reveal-and-annotate" },
        "whyCorrect": "Far more than 40. Each extra lot fills deeper, so cost grows faster than size.",
        "commonWrong": [
          { "pattern": "40", "because": "you scaled the cost linearly; depth thins as you walk down" }
        ] }
    ],
    "quizBlueprint": {
      "itemCount": 3,
      "mustCover": ["teachingAngle", "missedPrediction", "undiscoveredNotable"],
      "allowInteractive": true,
      "difficultyCurve": "flat"
    },
    "masteryThreshold": 0.7
  },

  "coach": {
    "voice": "terse", "maxWordsPerMessage": 30,
    "triggers": { "clampNoEffect": true, "regimeChange": true, "notableReached": true, "idleMs": 20000, "thrash": true },
    "debounceMs": 8000,
    "openingLine": "The green and red bars are other people's orders. Buy some."
  }
}
```

### 6.3 Third fixture — the generality regression

Port the existing `apps/web/src/spec/fixture.ts` carrying-capacity lab to `market-tape` with one
pane and no candles. It is not a product lab. It exists so that CI fails the moment a finance
assumption gets baked into an archetype. Same job for `payoff-profile` (marginal tax brackets)
and `depth-ladder` (supply and demand at auction) when those land.

---

## 7. Build order

Each phase ends green: `pnpm typecheck` passes, `apps/web` runs, and the phase's acceptance
criterion is demonstrable on screen.

### P0 — Contract and foundations

1. `stage.ts` archetype↔config `superRefine` (§4.6). **First, before any renderer.**
2. Schema additions from §4. Log each in `docs/CONTRACT-REQUESTS.md`.
3. `draw/theme.ts` — run the `dataviz` skill, build the token map for both modes, and the three
   scale LUTs. Do not eyeball the palette.
4. `draw/viewport.ts` — `computeViewport`, `toSpecSpace`, DPR capped at 2.
5. `draw/primitives.ts` — the existing stub list plus `candle`, `band`, `level`, `histogram`.
6. `draw/axis.ts` — port `niceTicks` / `fmtTick` from `plot.ts`, add log ticks and the money
   formats from D5.

**Done when:** a test page draws a themed grid, axes and every primitive in both light and dark,
at three aspect ratios, with no layout drift.

### P1 — The runtime minimum

7. `lab-sim/src/rng.ts` — `mulberry32`, Box–Muller, `NoiseTape`.
8. `expr-parser.ts` / `expr-vm.ts` — port the whitelist from Stack B, emit slot-addressed
   bytecode, add `evalColumn` and `at(set.attr, i)`. Keep the `Map`-not-object comment.
9. `param-table.ts` — `layoutSlab`.
10. `sim-core.ts` — `compile`, `reset`, `poke`, `read`, `view`, `countOf`, `observable`,
    `checkFinite`, `setCursor`.
11. `dirty.ts` + `kernels/manifest.ts` + `kernels/gbm-path.ts`.
12. `recomputeIfDirty` wired to the path pass.

**Done when:** a Node test compiles the trading fixture, recomputes the path, and asserts that
changing `volatility_pct` scales the bars while leaving their *signs* identical — the noise tape
working, proven numerically rather than by eye.

### P2 — market-tape and the trading lab

13. `compile/stage-compiler.ts` + `compile/color.ts` — D7 in full.
14. `archetypes/market-tape.ts` — panes, candles, curves, areas, levels, markers, progressive
    reveal, crosshair, decimation.
15. `draw/scene.ts` — attach, resize via `ResizeObserver`, frame-boundary error guard, hit-test
    dispatch, pointer → `onDrag` → poke.
16. `kernels/bracket-exec.ts`, `kernels/portfolio-account.ts`.
17. Draggable stop level.
18. `apps/web` host: mount `Scene`, wire `labStore` to `SimCore.poke`, readouts at 10Hz, fixture
    picker in dev.

**Done when:** the trading lab plays end to end. Dragging the stop changes the equity pane within
one frame. Dragging volatility keeps the same market shape. The "right, and still losing" notable
fires.

### P3 — depth-ladder and the slippage lab

19. `kernels/book-depth.ts`, `order-sweep.ts`, `book-refill.ts`.
20. `archetypes/depth-ladder.ts` — level rects, sweep animation, consumed overlay, avg-fill level.
21. Draggable order-size handle.

**Done when:** the slippage lab plays end to end and the superlinear notable fires at 2000 lots in
a 1× book.

### P4 — Ensemble, payoff-profile, phases

22. `ensemble.ts` chunked Monte Carlo + the fan and marginal layers in `market-tape`.
23. `archetypes/payoff-profile.ts` + a third finance fixture.
24. `archetypes/function-plot.ts` and `compounding-ledger.ts` — cheap once the stage compiler
    exists, and `function-plot` is the documented degradation fallback.
25. Beat machinery: param locking per phase, presets, predict freeze and dim, resolve annotation.

**Done when:** `path_count` at 256 shows a fan with no knob stutter, and the full six-phase loop
runs on the trading lab.

### P5 — Hardening

26. Perf harness: a scripted 30-second drag, reporting frame time p50/p95 and GC events.
27. Fixture regression: every fixture validates, compiles, runs 600 frames headless, and asserts
    no non-finite value reaches a channel.
28. Golden-frame tests: hash a rendered frame at a fixed seed and viewport per archetype.
29. Accessibility pass: `prefers-reduced-motion` disables reveal and sweep tweens but never the
    simulation; contrast re-check.

---

## 8. Acceptance criteria

Budgets from `docs/00-START-HERE.md` §8 apply unchanged. These are the canvas-specific additions.

| Check | Target |
|---|---|
| Full frame draw, 240 bars + 40 ladder levels + 3 panes | ≤ 8 ms |
| Knob drag → visible change | ≤ 1 frame |
| Path recompute, 240 bars, single path | ≤ 1 ms |
| Ensemble recompute, 256 paths × 240 bars, chunked | ≤ 400 ms wall, **zero** frames over 16 ms |
| GC sawtooth over a 30 s drag profile | none |
| React re-renders per simulation second | ≤ 12 |
| Same tape, different params | bar-to-bar sign sequence unchanged |
| `reset(seed)` twice | bit-identical slab |
| Every fixture | validates, and 600 headless frames produce no non-finite channel value |
| Every archetype | renders its non-finance proof fixture |

---

## 9. Guardrails

Carried over, non-negotiable:

- No topic files under `archetypes/`. Grammars only.
- No raw hex in a spec. Colour is a meaning; `theme.ts` owns pixels.
- No `Math.random()` on any simulation path.
- No allocation in `draw()` or in a kernel's inner loop.
- Nothing that moves lives in React state.
- No `eval` / `new Function` / dynamic `import()` on a spec-authored string.
- Stubs throw `NotImplemented`; never return `{}` or `null as any`.

New, because this is finance:

- **Every finance lab carries `meta.synthetic: true`,** and the canvas paints a persistent
  "simulated — not market data" chip in the corner of any `market-tape` or `depth-ladder` pane.
  It is part of the frame, not a dismissible toast.
- **No lab presents itself as a backtest, a signal, or a recommendation.** Captions and coach
  copy describe mechanisms. "Widen your stop to 2 ATR" is out; "past about two ATR the path stops
  tagging the stop" is in.
- **No real market data and no broker or exchange connection** in this project. Paths come from
  the tape.
- **Honest precision.** Doc 01 already forbids claiming precision the sim does not have; in
  finance that means never showing a P&L to more decimals than the model earns, and never
  implying a fill is achievable.

---

## 10. Open questions for the implementer

Each has a default so nothing blocks. Change one only with a reason written down.

1. **Ensemble in a Worker?** Default no. Revisit only if the P5 harness shows the chunker missing
   frames.
2. **`payoff-profile` in P4 or P2?** Default P4. It is the simplest of the three renderers, so
   pull it forward if `market-tape` slips and something shippable is needed.
3. **Keep `apps/web/src/spec/*` during the migration?** Default: keep until P2 ships, then delete
   in one commit. Two schemas living side by side past that point will be copied from by mistake.
4. **`at(set.attr, i)` as an aggregate or a distinct node type?** Default: aggregate, reusing the
   `set.attr` parse path. It is the smallest change to the expression grammar.
5. **Candle bodies below one pixel.** Default: floor the body to one device pixel and keep the
   wick, so a quiet market reads as quiet rather than as missing.
