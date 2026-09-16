> ⚠️ **Not the current scope.** We are building the MVP first — see [`MVP.md`](MVP.md),
> which overrides this document wherever they disagree. The product thinking here still stands;
> the scope and stack details do not.

# 06 — Ownership & working agreement

Three owners, three disjoint slices, one shared contract. Nobody edits anybody else's folder.

## Ownership table

| Owner | OWNS (write) | READS (never write) | Blocks |
|---|---|---|---|
| **API** | `packages/lab-schema`, `packages/shared`, `apps/api`, `docs/CONTRACT-REQUESTS.md` | everything | both |
| **BACKEND** | `packages/lab-sim`, `packages/ai-core`, `packages/persistence` | `lab-schema`, `shared` | API, partly FRONTEND |
| **FRONTEND** | `packages/lab-client`, `packages/lab-renderers`, `apps/web` | `lab-schema`, `lab-sim`, `shared` | — |

Full briefs: [`OWNER-API.md`](OWNER-API.md) · [`OWNER-BACKEND.md`](OWNER-BACKEND.md) ·
[`OWNER-FRONTEND.md`](OWNER-FRONTEND.md)

## Dependency graph (no cycles — enforced by review)

```
shared         ← everyone
lab-schema     ← everyone
lab-sim        ← lab-client, apps/api (headless grading), apps/web
lab-client     ← apps/web
lab-renderers  ← apps/web
ai-core        ← apps/api only
persistence    ← apps/api only
```

Four rules this encodes:

- `lab-sim` imports nothing browser-specific — it must run headless in Node for grading.
- `lab-renderers` imports no React.
- `ai-core` and `persistence` are reachable only from `apps/api`. `apps/web` is a separate build
  and cannot import them even by accident, which is what makes the API-key boundary structural.
- `lab-client` may import `lab-sim`; never the reverse.

## Why API owns the contract

Someone has to arbitrate the shapes crossing boundaries, and API sits between the other two. They
define both the HTTP contract and the LabSpec, so they are the integration hub and the tie-breaker
when shapes disagree.

The cost is that API is on the critical path at the start. Hence: **schema exports first, ship
fast, refine later.**

## Build order

```
API ──┬──► BACKEND ──┐
      │              ├──► integration
      └──► FRONTEND ─┘
```

Nobody waits past the first schema push. Code against exported signatures that throw
`NotImplemented`. A red *runtime* is the expected state for a while; a red *typecheck* is not.

| Order | API | BACKEND | FRONTEND |
|---|---|---|---|
| 1 | schema exports + `shared` | `lab-sim` compile/step/poke | theme + primitives + `function-plot` |
| 2 | `GET /stream` (SSE) + `POST /labs` | `plan()` against the real API | `LabCanvas` + `createScene` + runtime cache |
| 3 | remaining routes | compose + orchestrator | stores + hooks + knob panel |
| 4 | refinements, rate limits, errors | persistence + digest + grading | remaining archetypes, quiz UI |

## Cross-cutting invariants

Any owner violating these fails review:

1. `lab-schema` and `shared` are edited by API only. Everyone else files a contract request.
2. No `any`, no non-null `!` on external data, no type assertion to silence the compiler.
3. Stubs throw `NotImplemented`. Never return fake data.
4. No new runtime dependency without noting it in handoff notes. Pre-approved: `zod` (API),
   `fastify` + `@fastify/cors` (API), `@anthropic-ai/sdk` (BACKEND), `react`/`react-dom`/`vite`
   (FRONTEND). Nothing else.
5. `ai-core` and `persistence` never appear in the web build's import graph.
6. Nothing in this system knows what topic it is teaching. Grep your diff for domain nouns.
7. Commit at the end of every session. This repo has already lost work to an untracked-file
   `git mv`.

## Contract requests

`docs/CONTRACT-REQUESTS.md`. Append a request, code against the field as if it exists with a
`TODO(API): CR-###` marker, and let the typecheck fail loudly. API sweeps the file and either
exports it or writes down why not.

A failing typecheck at an agreed boundary is how three people discover a disagreement in seconds
instead of at integration.

## Handoff notes

Every owner keeps a `## Handoff notes` block at the bottom of their `OWNER-*.md`, rewritten at the
end of each session:

```md
**Works:** SimCore.compile/step/poke, expr-vm for arithmetic + ternary.
**Throws NotImplemented:** WorkerClock, kernels/{diffusion-2d,queue-network}, scrubTo.
**Assumed of others:** API exports `Assignment { target, expr }` (filed CR-004).
**Deviations:** snapshot ring is 150 not 300 — memory budget at 2000 entities.
**Next session starts with:** worker clock, then remaining kernels.
```

Honest and specific. The other two owners read this instead of your source.
