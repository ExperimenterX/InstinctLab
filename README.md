# Instinct Lab

> Don't just explain it to me. Give me something I can play with until I understand it.

Instinct Lab turns any concept a learner types — *"how does TCP congestion control work"*, *"why
does a gyroscope resist tilting"*, *"what is compound interest really doing"* — into an
**interactive visual lab** instead of a wall of text.

The AI does not write an essay. It writes a **LabSpec**: a declarative description of a
simulation, its visual stage, its knobs, and its teaching script. The client compiles that spec
into a live canvas the learner can poke, break, and re-run.

## The learning loop

```
SEE  ──►  INTERACT  ──►  EXPERIMENT  ──►  PREDICT  ──►  UNDERSTAND  ──►  RECALL
 │           │              │              │              │              │
 canvas    knobs         free play     freeze &        coach          quiz from
 renders   respond       + presets     commit a        explains       what YOU
 concept   instantly                  guess           the delta      actually did
```

Every phase is a **beat** in the spec. The AI authors the beats, the runtime drives them, and the
learner's real interactions become the quiz material.

## Status

**Skeleton stage.** Every folder is scaffolded with typed stubs that throw `NotImplemented`. No
business logic is implemented yet. Three owners build it in parallel.

## Read this in order

| # | Doc | Who |
|---|-----|-----|
| 0 | [`docs/00-START-HERE.md`](docs/00-START-HERE.md) | **All three owners. Mandatory.** |
| — | [`docs/OWNER-API.md`](docs/OWNER-API.md) · [`OWNER-BACKEND.md`](docs/OWNER-BACKEND.md) · [`OWNER-FRONTEND.md`](docs/OWNER-FRONTEND.md) | your own brief only |
| 1 | [`docs/01-product-spec.md`](docs/01-product-spec.md) | everyone |
| 2 | [`docs/02-architecture.md`](docs/02-architecture.md) | everyone |
| 3 | [`docs/03-lab-spec-dsl.md`](docs/03-lab-spec-dsl.md) | everyone — the DSL is the contract |
| 4 | [`docs/04-state-management.md`](docs/04-state-management.md) | FRONTEND (it is your spec), BACKEND |
| 5 | [`docs/05-api-contract.md`](docs/05-api-contract.md) | API, FRONTEND, BACKEND |
| 6 | [`docs/06-ownership.md`](docs/06-ownership.md) | everyone |
| 7 | [`docs/07-definition-of-done.md`](docs/07-definition-of-done.md) | everyone |
| 8 | [`docs/08-example-labs.md`](docs/08-example-labs.md) | BACKEND, FRONTEND |
| 9 | [`docs/09-claude-api-notes.md`](docs/09-claude-api-notes.md) | **BACKEND, mandatory** |

Decisions worth reading once so nobody re-litigates them:
[`adr/0001-declarative-lab-spec.md`](docs/adr/0001-declarative-lab-spec.md) (why the AI emits
data, not code) and [`adr/0002-frontend-stack.md`](docs/adr/0002-frontend-stack.md) (why Vite +
Fastify rather than a meta-framework — and what that choice does *not* fix).

## Who owns what

| Owner | Slice | Packages |
|---|---|---|
| **API** | the contract + the HTTP service | `lab-schema`, `shared`, `apps/api` |
| **BACKEND** | the simulation engine + the AI | `lab-sim`, `ai-core`, `persistence` |
| **FRONTEND** | canvas, state, UI | `lab-client`, `lab-renderers`, `apps/web` |

Every package has an `OWNER.md` pointing at the right brief.

## Layout

```
apps/api                 Fastify service — routes, SSE, validation. Only process with the API key.
apps/web                 Vite + React SPA — three screens, canvas-first.

packages/lab-schema      The contract. Zod schemas for LabSpec, events, API.        (API)
packages/shared          ids, Result, NotImplemented, logger, rate limiting         (API)
packages/lab-sim         SimCore, expression VM, kernels. Runs in browser AND Node. (BACKEND)
packages/ai-core         Claude orchestration: plan → compose → repair → coach → quiz (BACKEND)
packages/persistence     SessionRepo + adapters, transcript digest                  (BACKEND)
packages/lab-client      Frame clock, 3-ring state model, event bus, React hooks    (FRONTEND)
packages/lab-renderers   Ten canvas archetypes, primitives, theme, hit-testing      (FRONTEND)

docs                     Specs, owner briefs, ADRs
```

`lab-sim` is intentionally environment-free: the same engine drives the canvas at 60fps and
re-runs simulations server-side to grade quiz answers.

## Quickstart

```bash
pnpm install
cp .env.example .env          # add ANTHROPIC_API_KEY (API service only)

pnpm dev                      # both services
pnpm dev:api                  # Fastify on :8787
pnpm dev:web                  # Vite on :5173, proxies /api

pnpm typecheck                # must pass before any handoff
```
