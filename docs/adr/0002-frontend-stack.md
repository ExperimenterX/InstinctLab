# ADR 0002 — Vite SPA + Fastify API, not a meta-framework

**Status:** accepted · **Date:** 2026-09-16 · **Supersedes:** the Next.js app in the first draft

## Context

Instinct Lab is a canvas simulation with a knob panel, fed by a streaming AI generation pipeline,
built by three people split backend / API / frontend. The first draft put everything in one
Next.js app: UI, API routes, and AI orchestration in one build.

## First, correcting the premise

The stated reason to move off Next.js was that it is "slow for state management" and might not
"do well in canvas." That is not what was happening, and the distinction matters for what we
replace it with.

**React was never in the frame loop.** The three-ring model (doc 04) exists precisely so it is
not: the simulation is a `Float64Array` mutated in place, the canvas component mounts once and
reads that array directly in its own `requestAnimationFrame` loop, and React re-renders only at
pointer rate (a knob label) and network rate (a coach message). Observables are sampled down to
10Hz before they ever reach a component.

So a framework swap changes **zero frames** of canvas performance. If canvas were stuttering, the
cause would be one of: an allocation inside `step()` or `draw()` (GC sawtooth), a per-frame value
pushed into React state, a param slot re-resolved on every render, or per-cell `fillRect` on a
large grid. All four are addressed in doc 04 and `OWNER-FRONTEND.md`, and all four would stutter
identically under Vite, Svelte, or vanilla JS.

Getting this right is not pedantry — it determines where the frontend owner looks when something
*is* slow. Blaming the framework would send them to rewrite the shell instead of profiling the
draw loop.

## So why move anyway

Four reasons, none about state management:

**1. Server rendering buys nothing here.** There is no meaningful first paint before the spec
arrives and the simulation compiles. The useful early frame is a skeleton canvas, which is client
work. RSC/hydration is pure overhead on a screen whose content does not exist until an AI call
returns.

**2. HMR fights the product.** A hot update that remounts the canvas resets a running simulation —
and this app's entire value is in the middle of an experiment. Vite's HMR is easier to contain
behind a module-scope runtime cache, and the dev loop is simpler to reason about when there is no
server/client component boundary to think about.

**3. `SharedArrayBuffer` needs COOP/COEP.** The Worker simulation path for heavy labs requires
those headers. In Vite that is four lines in `server.headers`. In a meta-framework it is a fight
with the dev server, the asset pipeline, and every cross-origin resource.

**4. The team seam.** Three owners, and one Next app couples the UI owner and the API owner into
one build, one deploy, and one dependency tree. Splitting them means the frontend cannot even
*import* `ai-core` or `persistence` — the API key boundary becomes structural rather than a rule
someone has to remember. With separate builds, the contract between owners is HTTP plus
`lab-schema`, which is exactly the seam we want them negotiating.

## Decision

- **`apps/web`** — Vite + React 19 SPA. No SSR, no file-system router. Three screens, so a
  `useState` on `location.pathname` is sufficient; a routing library is not worth its weight.
- **`apps/api`** — Fastify on Node 22. Chosen over a meta-framework's route handlers because this
  service does two unusual things — holds a long-lived SSE connection per session, and streams
  model output into it — and both want direct access to the raw response stream, headers, and
  backpressure. A framework that abstracts the response away fights you on both.
- Dev: Vite proxies `/api` to the API service, so the browser sees one origin and CORS stays
  trivial. Production: static assets on any host, one explicit CORS origin.

**React is kept**, because the shell (knob panel, phase rail, coach dock, quiz) is ordinary UI
that React is good at, and it never touches the frame loop. A finer-grained framework would win
nothing here for the cost of retraining the team.

## Consequences

**Good**
- The API-key boundary is enforced by the build graph, not by discipline.
- Two owners deploy independently; a UI change cannot break the generation pipeline.
- COOP/COEP, worker bundling, and canvas dev ergonomics all get simpler.
- Faster dev server start and HMR on a large dependency tree.

**Bad**
- Two services to run locally (`pnpm dev` runs both in parallel) and two things to deploy.
- CORS and the dev proxy are now our problem, where a single-origin app had neither.
- No SSR means no meaningful SEO on lab pages. Acceptable: labs are session-scoped and expire.
- We hand-roll routing and data fetching. Small at three screens; revisit if that grows.

## Revisit when

The app grows past ~6 screens or needs SEO-indexable content. Neither is on the roadmap, and
neither would change the canvas architecture — only the shell around it.
