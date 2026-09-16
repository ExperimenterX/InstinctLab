# 02 — Architecture

## The one decision everything else follows from

**The AI emits data, not code.** It authors a declarative `LabSpec`; the client compiles that spec
against a fixed library of renderer archetypes and a sandboxed expression VM.

The rejected alternative was letting the model write React/canvas code per topic. That gets you
prettier one-off labs and an unshippable product: arbitrary code execution, unpredictable
performance, no hit-testing, no time-travel, no way to record interactions for the quiz, and a
30-second cold start. See `docs/adr/0001-declarative-lab-spec.md`.

Consequence: **generality lives in the AI's choice of spec, not in the codebase.** The codebase
knows nothing about TCP or mitosis. It knows about nodes, edges, cells, particles, curves, queues,
and transitions.

## System diagram

Two deployables: a Vite SPA and a Fastify service. The split is deliberate — see
[`adr/0002-frontend-stack.md`](adr/0002-frontend-stack.md).

```
┌───────────────── apps/web — Vite + React SPA ────────────────────────┐
│                                                        FRONTEND owns │
│  UI shell (React)                                                    │
│      prompt → phase rail → knob panel → coach dock → quiz            │
│        │ subscribes at network-rate + input-rate only                │
│        ▼                                                             │
│  lab-client  SessionStore ◄──── SSE ──────────────────┐              │
│              LabStore (knob display values, phase)    │              │
│        │ poke(slot, value)          ▲ sampled ≤10Hz   │              │
│        ▼                            │                 │              │
│  lab-sim     SimCore ── Float64Array slab ──┤ rAF clock│  BACKEND    │
│              expr-vm · kernels · snapshots  │ (or Worker)   owns     │
│        │ renderer reads slab directly, zero copy      │              │
│        ▼                                              │              │
│  lab-renderers  archetype ── canvas2d ── hit-test     │              │
│        │ pointer events                               │              │
│        ▼                                              │              │
│  lab-client  LabBus ── ring buffer ── batched POST /events ──┘       │
└──────────────────────────────────────────────────────────────────────┘
                                   │ HTTP + SSE (one origin via dev proxy)
┌───────────────── apps/api — Fastify service ─────────────────────────┐
│                                                             API owns │
│  routes  /labs · /stream · /events · /predict · /coach · /assessment │
│        │ validates every payload with lab-schema Zod schemas         │
│        ├──────────────► ai-core                         BACKEND owns │
│        │                    plan → compose → validate → repair       │
│        │                    coach · quiz-builder · grader · remix    │
│        │                         │ Anthropic API                     │
│        ├──────────────► lab-sim (headless, grades `tune` items)      │
│        └──────────────► persistence                     BACKEND owns │
│                             SessionRepo + memory/sqlite/redis        │
└──────────────────────────────────────────────────────────────────────┘
```

`lab-sim` appears in both halves. That is the point: the same engine drives the canvas at 60fps
and re-runs simulations server-side to grade quiz answers, so a grade is computed by the same code
the learner was watching.

## Package graph (no cycles — enforced by review)

```
shared         ← everyone
lab-schema     ← everyone
lab-sim        ← lab-client, lab-renderers, apps/api, apps/web
lab-client     ← apps/web
lab-renderers  ← apps/web
ai-core        ← apps/api only
persistence    ← apps/api only
```

Four rules this encodes:

- `lab-sim` imports nothing browser-specific — its tsconfig omits the DOM lib, so a violation
  fails to compile rather than failing in production.
- `lab-sim` must not import `lab-client` or `lab-renderers`. The dependency runs one way only.
- `lab-renderers` must not import React.
- `ai-core` and `persistence` are reachable only from `apps/api`. Because the SPA is a separate
  build, it cannot import them even by mistake — the API-key boundary is structural rather than a
  rule someone has to remember.

## Request lifecycle: prompt → playable lab

Optimising for **first visual in 2.5s** forces a two-stage generation. Everything is streamed.

```
 t=0.0  POST /api/labs { concept }
        API: validate, rate-limit, mint sessionId, persist status=planning
        API: return 202 { sessionId, streamUrl } immediately  ← no blocking
 t=0.1  Client opens GET /api/labs/:id/stream (SSE)
 t=0.1  BACKEND PLAN (fast model, small output, ~600 tokens)
          → { archetype, conceptTitle, teachingAngle, variables[], observables[] }
 t=1.2  emit `lab.plan`  → FRONTEND renders the shell + skeleton canvas. LEARNER SEES SOMETHING.
 t=1.2  BACKEND COMPOSE-CORE (strong model, structured, streamed)
          emit `lab.model`    → lab-sim allocates the slab, compiles the ParamTable
          emit `lab.stage`    → FRONTEND mounts the archetype. CANVAS IS LIVE.
 t=5.0  BACKEND COMPOSE-PEDAGOGY (same cached system prompt → cheap and fast)
          emit `lab.controls` → FRONTEND renders knobs
          emit `lab.beats`    → FRONTEND unlocks the phase rail
 t=8.0  BACKEND validate → repair (≤2 attempts) → persist
        emit `lab.ready`     → phase advances to SEE, clock starts
```

Compose is **two calls, not one**, because structured output arrives as a single constrained JSON
document — emitting sections incrementally from one call would mean partial-JSON parsing. Splitting
it is simpler, and the second call is cheap: the system prompt is byte-identical, so it's a
prompt-cache hit. The split is also pedagogically free — the SEE beat needs no controls, so the
learner is already watching the simulation while the pedagogy is still generating. See
`docs/09-claude-api-notes.md`.

If COMPOSE fails validation twice, BACKEND degrades: emit `lab.fallback` with a minimal but valid spec
derived from the plan (the plan alone is enough to build a one-knob `function-plot`). **We never
show the learner an error page for a generation failure** — a shallow lab beats no lab.

## Interaction lifecycle (the hot path)

```
pointer/knob → LabStore.setParam(id, v)
                 ├─ SimCore.poke(slot, v)     ← synchronous slab write, same tick
                 └─ LabBus.emit(param.change) ← ring buffer, no network

rAF tick     → SimCore.step(dt)               ← mutates slab in place
             → Renderer.draw(slab, t)         ← reads slab, no allocation

every 2s     → LabBus.flush() → POST /events  ← fire-and-forget, keepalive
or 64 events

server       → BACKEND appends to transcript
             → BACKEND rule-check for a coach trigger (no model call unless triggered)
             → if triggered, push `coach.say` down the open SSE stream
```

The learner's hand never waits on the network. The coach arrives asynchronously.

## Coach trigger policy (BACKEND)

A model call per interaction would be slow and noisy. Triggers are **rule-detected locally, then
model-explained**:

| Trigger | Detected by | Coach behaviour |
|---|---|---|
| `clamp-no-effect` | param at bound, observable Δ < ε | name the new bottleneck |
| `regime-change` | observable crosses a spec-declared threshold | name the regime |
| `notable-reached` | state matches a `notable` predicate from the spec | confirm the discovery |
| `idle` | no event for 20s in INTERACT/EXPERIMENT | one nudge, then silence |
| `thrash` | same param reversed >6× in 10s | suggest a preset |
| `prediction-resolved` | PREDICT resolves | explain the delta (always fires) |

Debounce: at most one coach message per 8 seconds, except `prediction-resolved`.

## Failure policy

| Failure | Behaviour |
|---|---|
| Plan fails | 503 + retry affordance. Only hard failure the learner sees. |
| Compose fails validation ×2 | `lab.fallback` minimal spec from the plan |
| Stream drops | client reconnects with `Last-Event-ID`; API replays from the persisted spec |
| Coach call fails/times out | silently drop the message; never block the sim |
| Quiz generation fails | fall back to a template quiz over the spec's declared variables |
| Renderer throws mid-frame | catch at the frame boundary, freeze last good frame, emit `render.error` |
| Sim NaN / divergence | `SimCore` detects non-finite, reverts to last snapshot, emits `sim.diverged` |

**Nothing in this table stops the learner from playing with the lab.**

## Client/server boundary

`ai-core`, `persistence`, and anything reading `ANTHROPIC_API_KEY` live only in `apps/api`.

Because the SPA is a **separate build with its own dependency tree**, this is not a convention
that someone has to remember — `apps/web` has no path to those packages at all. It imports
`lab-schema`, `lab-sim`, `lab-client`, and `lab-renderers`, and reaches everything else over HTTP.

In development, Vite proxies `/api` to the Fastify service so the browser sees a single origin and
CORS stays trivial. In production the SPA is static assets and the API allows one explicit origin —
never `*` with credentials.

## Rendering substrate

**Canvas 2D** for v1. Reasons: one draw call path, trivial ring-buffer redraw, fast text, no
shader compilation stall, and hit-testing we control. SVG was rejected (DOM node churn at 500
entities); WebGL was deferred (build complexity, no need under 2000 entities). FRONTEND must keep
`draw/` free of canvas-2D-specific assumptions where cheap, so a WebGL backend stays possible.

## Persistence model

A session is one document, versioned by `rev`, appended to rather than rewritten:

```
Session { id, createdAt, status, concept, plan, spec, phase, transcript[], predictions[],
          assessment?, recallCard?, rev }
```

Writes are `appendEvent`, `setPhase`, `setSpec`, `setAssessment` — never a blind whole-document
overwrite, because events arrive concurrently with phase changes. BACKEND owns compare-and-set on `rev`.
