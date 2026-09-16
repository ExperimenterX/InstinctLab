> ⚠️ **Not the current scope.** We are building the MVP first — see [`MVP.md`](MVP.md),
> which overrides this document wherever they disagree. The product thinking here still stands;
> the scope and stack details do not.

# 07 — Definition of done

## Per-session gate (every owner, every working session)

- [ ] `pnpm typecheck` passes for the whole repo — not just your packages.
- [ ] Every file you own exports its documented names.
- [ ] Unimplemented functions throw `NotImplemented("<pkg>/<fn>")`. Zero fake returns.
- [ ] Zero `any`. Zero `@ts-ignore`. Zero assertions used to silence the compiler.
- [ ] You edited nothing outside your OWNS list. Run `git diff --name-only` and read it.
- [ ] Contract gaps filed in `CONTRACT-REQUESTS.md`, not patched locally.
- [ ] `## Handoff notes` rewritten at the bottom of your `OWNER-*.md`.
- [ ] **Committed.** `owner(area): what changed`. This repo has already lost work to an
      untracked-file `git mv`.
- [ ] No topic-specific code or prompt text anywhere in your diff.

## First milestone — the thing that must actually work

Each owner has one deliverable that everything else integrates against. Ship it completely before
starting anything else; a working first milestone is worth more than three half-finished ones.

| Owner | Milestone |
|---|---|
| **API** | `LabSpecSchema.safeParse(exampleSpec)` succeeds and fails correctly on 9 params; the server listens; `GET /health` and `GET /archetypes` return |
| **BACKEND** | `SimCore` compiles the example spec, `step()` advances it, `poke()` changes the outcome, and a test proves `step()` allocates nothing |
| **FRONTEND** | `function-plot` renders real expression-bound data to a canvas at 60fps with the sim running |

## Second milestone — the vertical slice

| Owner | Deliverable |
|---|---|
| **API** | `POST /labs` → 202, `GET /labs/:id/stream` → SSE emitting at least `lab.plan` |
| **BACKEND** | `plan()` returns a valid `LabPlan` from a real concept string via the Anthropic SDK |
| **FRONTEND** | Prompt screen → lab route, canvas mounts, one knob pokes `SimCore` with zero canvas re-renders |

## Integration gate (all three landed)

The full loop, with **no topic-specific code anywhere in the repo**:

1. Type *"how does a spring-mass system oscillate"* → lab appears within 12s.
2. Canvas animates. Knob drag moves the picture within one frame.
3. React DevTools: ≤ 12 re-renders per simulation second.
4. PREDICT freezes the sim; commit resolves with an explanation citing the learner's number.
5. Quiz generates 3–5 items, at least one derived from a real session event.
6. Grading returns a score and a recall card.
7. Reload mid-lab: SSE replay restores the identical lab state.
8. Then type *"how does DNS resolution work"* and get a **different archetype**
   (`graph-network` or `pipeline-flow`) with no code change. ← the real test of generality

## Performance gate

Chrome DevTools, mid-tier laptop, 500 entities. Budgets from doc 00 §8.

- [ ] `step()` ≤ 4ms, `draw()` ≤ 8ms, sustained 60fps
- [ ] Knob → visible change ≤ 1 frame
- [ ] First visual ≤ 2.5s; interactive lab ≤ 12s
- [ ] `POST /events` responds in ≤ 50ms
- [ ] No GC sawtooth in a 30s Performance profile (proves the zero-allocation rule holds)
- [ ] Snapshot ring memory ≤ 32MB at 2000 entities

## Security gate

- [ ] No `eval` / `new Function` / dynamic `import()` of model output. Grep the whole repo.
- [ ] Every model output passes Zod before reaching any consumer.
- [ ] Every AI-authored number clamped against `limits.ts` before reaching a renderer or the slab.
- [ ] `ANTHROPIC_API_KEY` appears in exactly one package (`ai-core`), reachable only from
      `apps/api`. Verify `apps/web`'s build graph cannot reach `ai-core` or `persistence`.
- [ ] `expr-vm` rejects unknown identifiers, property access, calls outside the table,
      over-deep expressions, and over-budget programs. With a test for each.
- [ ] Rate limiting live on `POST /labs` and `/remix`.
- [ ] Phase monotonicity enforced server-side — a client cannot skip to `recall`.
- [ ] `tune` quiz items graded by a server-side sim re-run, never from client-reported values.
- [ ] No learner text interpolated into a prompt without delimiting.
- [ ] No raw `Session` returned to a client — the assessment answer key rides on it.

## Product gate (the one that actually matters)

Give the built product to someone who does not know the concept. Watch them; don't help them.

- [ ] They touch a knob **before** they read anything.
- [ ] They change knobs at least 8 times unprompted.
- [ ] They are surprised at least once.
- [ ] They can state the `bigIdea` in their own words afterwards.
- [ ] Ask them the next day: they still remember it.

If they read the caption first and then hunt for the point, the lab failed — no matter how green
every checkbox above is.
