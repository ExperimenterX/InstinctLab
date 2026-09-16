# 00 — START HERE (mandatory for all three owners)

Instinct Lab is built by **three people**, each driving a code agent. You own a third of the
system and you will rarely talk to the other two. This document is the only thing keeping you in
sync.

Read this file completely, then `01` and `02`, then your own `docs/OWNER-*.md`. Read the other
owners' folders only through `packages/lab-schema` — that is what the schema is for.

---

## 1. What you are building

A learner types a concept. The AI returns a **LabSpec** — a declarative JSON document. The client
compiles it into a live, interactive canvas simulation with knobs, and walks the learner through
`See → Interact → Experiment → Predict → Understand → Recall`.

The product's single measurable goal: **the learner remembers the concept tomorrow.** Every
decision is judged against that, not against elegance.

---

## 2. Who owns what

| Owner | Owns | Reads | Brief |
|---|---|---|---|
| **BACKEND** | `packages/lab-sim`, `packages/ai-core`, `packages/persistence` | `lab-schema`, `shared` | [`OWNER-BACKEND.md`](OWNER-BACKEND.md) |
| **API** | `packages/lab-schema`, `packages/shared`, `apps/api` | everything (it wires them) | [`OWNER-API.md`](OWNER-API.md) |
| **FRONTEND** | `packages/lab-client`, `packages/lab-renderers`, `apps/web` | `lab-schema`, `lab-sim`, `shared` | [`OWNER-FRONTEND.md`](OWNER-FRONTEND.md) |

**You may create, edit, and delete anything under your OWNS list. You may only read the rest.**
Not to fix a typo, not to unblock yourself. If another owner's stub blocks you, code against its
exported signature and let it throw `NotImplemented` at runtime — that is the expected state
until they ship it.

The deliberate asymmetry: **API owns the contract** (`lab-schema`). They sit between the other
two, so they arbitrate the shapes that cross the boundary. That makes them the integration hub
and, when shapes disagree, the tie-breaker.

---

## 3. The five non-negotiables

Violating any of these breaks someone else's work. No negotiation, no "temporary" exception.

### N1 — The schema is the only contract
`packages/lab-schema` is the single source of truth for every shape crossing a boundary:
AI → server, server → client, client → renderer, client → server.

- **Only API may edit `lab-schema` or `shared`.**
- Need a field that does not exist? Do **not** add it locally, cast to `any`, or widen a type.
  Append a request to [`CONTRACT-REQUESTS.md`](CONTRACT-REQUESTS.md), then write your code as if
  the field already exists with a `TODO(API): CR-###` comment above it, and let the typecheck
  fail loudly.
- A failing typecheck at an agreed boundary is a **feature**. It is how three people working in
  parallel discover they disagreed in seconds instead of at integration.
- Import types: `import type { LabSpec } from "@instinct/lab-schema"`. Never redeclare them.

### N2 — Nothing that moves may live in React state
The simulation runs at 60fps. React re-renders are for network-rate and input-rate data only.

```ts
// ❌ NEVER
useState(particlePositions)
useEffect(() => setTick(t => t + 1))   // rAF driving React
<Canvas particles={particles} />        // per-frame prop
```

The canvas mounts **once**, grabs an imperative handle, and the renderer reads the numeric slab
directly. See [`04-state-management.md`](04-state-management.md) — that document is the design,
already decided.

### N3 — AI output is untrusted input
The composer model emits JSON. Treat it exactly like a request body from the public internet.

- Parse with the Zod schema. Never `JSON.parse` into a typed variable and proceed.
- Never `eval`, `new Function`, or dynamic `import()` on a model-authored string.
- Expression fields in a LabSpec are evaluated by BACKEND's **`expr-vm`** — a whitelisted
  arithmetic interpreter with no property access, no calls outside a fixed math table, and a step
  budget. That VM is the **only** place a model-authored expression may run.
- Clamp every AI-authored numeric before it reaches a renderer or the slab: array lengths, node
  counts, particle counts, tick rates, loop bounds. Limits live in `lab-schema/src/limits.ts`.
- **Constrained decoding does not enforce limits.** Structured output guarantees the *shape*; the
  SDK strips `.min()`/`.max()` and validates them client-side. `validateLabSpec` stays mandatory.

### N4 — Every stub carries an owner marker
Skeleton code must fail loudly, not silently return wrong data.

```ts
export function compileStage(spec: LabSpec): CompiledStage {
  // TODO(FRONTEND): build the draw list from spec.stage.layers
  throw new NotImplemented("lab-renderers/compileStage");
}
```

Use `NotImplemented` from `@instinct/shared`. Never `return null as any`, never `return {}`,
never an empty array a caller would mistake for real data. A silent empty return costs the
integrating owner an afternoon; a thrown error costs them five seconds.

### N5 — Commit early and often
This repo started with nothing committed, and an untracked-file `git mv` has already destroyed
work here once. Commit at the end of every working session, minimum. Message format:
`frontend(renderers): graph-network draws and hit-tests`.

---

## 4. Domain-agnosticism is the hard requirement

The learner may type *anything*: red-black trees, meiosis, BGP route flapping, Bayes' theorem,
options delta, the Krebs cycle, CAP theorem, Doppler shift, gradient descent, gerrymandering.

You cannot special-case topics. The system stays general by splitting the problem in two:

**The AI chooses the pedagogy. The codebase owns the primitives.**

There are **ten renderer archetypes** (doc 03 §5). Each is a parametric visual grammar, not a
topic:

| Archetype | Visual grammar | Example topics it absorbs |
|---|---|---|
| `graph-network` | nodes + edges + packets | routing, dependency graphs, contagion, neural nets |
| `grid-automaton` | 2D cell lattice | Game of Life, diffusion, convolution, epidemic spread |
| `particle-field` | free bodies + forces | orbits, gas laws, collisions, flocking |
| `function-plot` | curves over an axis pair | derivatives, PID tuning, dose-response, yield curves |
| `sequence-array` | indexed cells + cursors | sorting, binary search, string algorithms, transcription |
| `pipeline-flow` | stages + queues + tokens | CPU pipelines, TCP windows, assembly lines, tracing |
| `state-machine` | states + guarded transitions | handshakes, regex engines, cell cycle, game rules |
| `compounding-ledger` | balances over time steps | compound interest, amortisation, population growth |
| `layered-stack` | nested containers + traversal | OSI model, call stacks, memory layout, strata |
| `free-canvas` | escape hatch: declarative draw list | anything the nine above cannot hold |

The AI's job is to look at *"explain BGP route flapping"* and decide: `graph-network`, nodes are
autonomous systems, the knob is link flap frequency, the observable is convergence time.

**FRONTEND: build archetypes, never topics.** A file named `tcp-slow-start.ts` is a bug.
**BACKEND: never hardcode a topic.** A prompt string containing the word "sorting" is a bug.

---

## 5. Where does my change go?

| I am touching… | Folder | Owner |
|---|---|---|
| a type, a Zod schema, a limit constant | `packages/lab-schema` | API |
| ids, `Result`, logger, rate limiting | `packages/shared` | API |
| an HTTP route, SSE framing, validation | `apps/api` | API |
| the sim loop, the expression VM, a kernel | `packages/lab-sim` | BACKEND |
| a prompt, model call, spec repair, quiz generation | `packages/ai-core` | BACKEND |
| reading/writing a session, caching, TTL | `packages/persistence` | BACKEND |
| a store, the frame clock, an event, a React hook | `packages/lab-client` | FRONTEND |
| anything that draws pixels, hit-testing, layout | `packages/lab-renderers` | FRONTEND |
| a component, a screen, styling, the phase UI | `apps/web` | FRONTEND |

---

## 6. Build order and unblocking

```
API ──┬──► BACKEND ──┐
      │              ├──► integration
      └──► FRONTEND ─┘
```

**API ships the schema first, and ships it fast.** The other two typecheck against it. Correct
exported names and signatures matter more than complete refinements — a schema nobody can import
blocks two thirds of the team.

Nobody waits after that. Code against exported signatures that throw `NotImplemented`.

Suggested sequencing to unblock each other soonest:

| Order | API | BACKEND | FRONTEND |
|---|---|---|---|
| 1 | `lab-schema` exports + `shared` | `lab-sim` compile/step/poke | `theme` + `primitives` + `function-plot` |
| 2 | `GET /stream` (SSE) + `POST /labs` | `ai-core` plan → compose | `LabCanvas` + `createScene` |
| 3 | remaining routes | `persistence` memory adapter | stores + hooks + knob panel |
| 4 | validation, rate limits, errors | coach, quiz, grading | remaining archetypes, quiz UI |

---

## 7. Conventions

**Naming.** `kebab-case.ts` files. `PascalCase` types. `camelCase` values. Zod schemas are
`PascalCaseSchema` with the inferred type as the bare `PascalCase` name.

**Errors.** Fallible operations crossing a package boundary return `Result<T, E>` from
`@instinct/shared`. Programmer errors (a stub, an invariant violation) throw. Do not use
exceptions for control flow across a boundary.

**IDs.** Always from `@instinct/shared/id`. `sessionId` = `ses_` + 22 base58 chars. Never
`Math.random()` inline, never `Date.now()` as an id.

**Units.** Simulation time `t` is in **seconds** (float). Frame delta `dt` is in seconds, clamped
to `[0, 0.05]`. All canvas coordinates are **spec space** (0–100 on both axes, origin top-left);
the renderer applies the viewport transform. Never write pixel coordinates into a spec.

**Randomness.** Seeded `mulberry32` from `@instinct/shared` only. `Math.random()` on a simulation
path silently breaks prediction replay and quiz grading.

**Comments.** Explain the *why*, especially non-obvious performance choices. Do not narrate the
code, and do not leave comment blocks describing what you plan to do later.

**Imports.** Workspace aliases (`@instinct/lab-schema`), never deep relative paths across
packages.

---

## 8. Performance budgets (acceptance criteria, not aspirations)

| Metric | Budget | Owner |
|---|---|---|
| First visual on canvas after submit | ≤ 2.5s | BACKEND, API |
| Full LabSpec streamed and interactive | ≤ 12s | BACKEND, API |
| Sim step, 500 entities | ≤ 4ms | BACKEND |
| Full frame draw, 500 entities | ≤ 8ms | FRONTEND |
| React re-renders per simulation second | ≤ 12 | FRONTEND |
| Knob drag → visible response | ≤ 1 frame (16ms) | FRONTEND |
| `POST /events` response | ≤ 50ms | API |
| Coach reply latency | ≤ 2s | BACKEND |
| LabSpec payload | ≤ 128 KB | API, BACKEND |

A knob that lags is a product failure, not a polish item. The entire premise is that the
learner's hand and the picture feel connected.

---

## 9. Product voice (BACKEND and FRONTEND especially)

- **Minimal passive reading.** Any single block of prose over ~40 words is a design bug. If the
  coach needs three sentences, the lab is doing too little.
- The coach speaks **after the learner acts**, not before. Reacting beats lecturing.
- Never reveal the answer to a prediction before the learner commits. Freeze, ask, then resolve.
- The quiz is built from **what this learner actually did** — which knob they pushed to an
  extreme, which prediction they missed. A generic quiz defeats the whole product.
- Failure is content. A learner who breaks the simulation should be shown *why*, not handed a
  reset button and a shrug.

---

## 10. Definition of done

See [`07-definition-of-done.md`](07-definition-of-done.md). Summary: the repo typechecks, your P1
is real, your stubs throw `NotImplemented`, your handoff notes are written, you touched nothing
outside your OWNS list, and you committed.
