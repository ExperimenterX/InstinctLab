# OWNER — Backend (simulation + AI)

> Read [`00-START-HERE.md`](00-START-HERE.md) first, then
> **[`09-claude-api-notes.md`](09-claude-api-notes.md) — the API surface changed and several
> familiar parameters are now hard 400s** — then [`03-lab-spec-dsl.md`](03-lab-spec-dsl.md) §3–4.

**OWNS**
```
packages/lab-sim        SimCore, expression VM, kernels, snapshots, headless runner
packages/ai-core        Claude orchestration: plan → compose → repair → coach → quiz → grade
packages/persistence    SessionRepo + adapters, transcript digest
```

**READS** `packages/lab-schema`, `packages/shared`, `docs/**`

**YOU BLOCK API** (it imports all three of your packages) **and partly FRONTEND** (it imports
`lab-sim`).

---

## Your job

Two halves that belong together because the second grades the first.

**The engine (`lab-sim`).** A flat `Float64Array` mutated in place, an expression VM that safely
executes model-authored arithmetic, and a fixed set of numerical kernels. Pure TypeScript — no
DOM, no React, no timers. The package tsconfig omits the DOM lib on purpose: if you reach for
`window`, it will not compile.

That environment-freedom is a **correctness requirement, not tidiness**. The same engine runs in
the browser at 60fps *and* headless in Node, because the API grades `tune` quiz items by
re-running the simulation with the learner's parameters rather than trusting a number the client
reported. Break the isolation and you break grading.

**The intelligence (`ai-core`).** You are the part of the product that understands the learner.
Everything else is machinery.

Your hardest single output is `meta.teachingAngle` and the dynamics that encode it. A lab whose
knobs do not test the teaching angle is a failed lab regardless of how well it renders — and the
failure is quiet: it looks fine and teaches nothing.

**Never hardcode a topic.** The word "sorting" or "TCP" in a prompt string is a bug. Your prompts
describe the DSL and the bar; the model maps the topic onto it.

---

## Priority order

### P1 — The simulation spine
`layoutSlab` → `parseExpr` → `ExprVm.eval` → `SimCore.compile/step/poke/view`.

Acceptance: compile the schema's `example-spec` fixture, step it 600 times, `poke()` a param, and
assert the outcome changes. Plus a test asserting **zero allocation** in `step()` — take a heap
sample before and after 1000 steps and compare. That is the most valuable test in your half of
the codebase.

### P2 — `plan()` against the real API
Planner model, structured output, returns a valid `LabPlan` (or a `clarify` / `decline`).

Acceptance: run the ten concepts in [`08-example-labs.md`](08-example-labs.md) through it.
Archetype choice should match the table **≥7/10**, and every `teachingAngle` must state a
mechanism rather than restate the topic. Write the score in your handoff notes — the archetype
choice is the highest-leverage decision in the pipeline, and that number is the single best
predictor of whether this product works.

### P3 — `composeCore` + `composePedagogy` + `generateLab`
The streaming orchestration that gets a canvas live. Plus `delimitLearnerText` and
`preflightConcept`.

The single hardest requirement on composition: **the dynamics must contain a feedback loop.** At
least one step expression must read a param, transitively. Without that you have generated a
diagram, not a lab. API's validator reports it as a warning — feed it back in repair and re-ask.

### P4 — `persistence` memory adapter + `foldDigest`
Acceptance: create → append 100 events across 4 batches → read back in order → `setPhase` with a
stale `rev` returns `CONFLICT`, with the current `rev` returns `rev + 1`.

`foldDigest` is what the quiz builder lives on. A wrong `regimesUnvisited` does not throw — it
just produces a generic quiz, which is the exact failure the product exists to avoid. Test it
against a handmade event array.

### P5 — `runHeadless`, coach, prediction resolution, quiz builder, grader
`runHeadless` unblocks grading, so it comes first in this group.

### P6 — Kernels, remaining adapters, remix, budget guards
Kernel order: `verlet`, `spring-damper`, `logistic-growth`, `random-walk` first (cheapest, widest
coverage), then `diffusion-2d`, `cellular-automaton`, `sir-epidemic`, then the rest.

---

## Engine rules you cannot bend

1. **`step()` allocates nothing.** No array/object literals, no closures, no `.map`, no spread, no
   string concat, no `try/catch` inside the loop. Scratch space is pre-allocated on the instance.
   An allocation here is a GC sawtooth, and a sawtooth is a stuttering knob.
2. **No `window`, no `document`, no React, no timers in `lab-sim`.** See above — this is what
   makes grading possible.
3. **Strings die at compile time.** Bytecode addresses integer slots. `slotOf` is compile-time
   only. No `Map.get` and no property access on the hot path.
4. **`expr-vm` is the only executor of model-authored expressions.** No `eval`, no `new
   Function`, no dynamic `import`. Reject aggressively at parse time: unknown identifiers,
   property access, calls outside the fixed table, over-depth, over-nodes. Rejecting is always
   correct; guessing never is.
5. **NaN never reaches a renderer.** `checkFinite` every tick, restore the last good snapshot,
   report divergence.
6. **Seeded PRNG only.** `Math.random()` on a simulation path breaks prediction replay and makes
   grades non-reproducible.
7. **Clamp entity counts at compile time**, against `opts.maxEntities`. Never at draw time.
8. **`runHeadless` is deterministic.** Two grading runs of the same submission must produce
   identical numbers, or the grade is not defensible.

### Things that will bite you

- **Simultaneous assignment.** Doc 03 §3 promises the AI that all right-hand sides read the
  previous tick. Implement it with a double-buffered scalar region and swap pointers — do not
  copy the whole slab, and do not evaluate in declaration order and call it close enough.
- **`prev(x)` and the double buffer are the same mechanism.** Build them together.
- **Aggregates (`sum(nodes.load)`)** need a column scan inside expression evaluation. Cache per
  tick, or a derived value referencing three aggregates scans three times.
- **Snapshot memory.** 300 snapshots at 2000 entities is ~29MB. Use `ringOptionsFor`. Budget it,
  do not hope.

---

## The Claude API facts that will cost you the most time

Full detail in doc 09. The four worst:

1. **`temperature` / `top_p` / `top_k` are 400s.** There is no variety knob any more — vary the
   prompt instead.
2. **`thinking.budget_tokens` is a 400.** Use `output_config.effort`. Thinking is **on by
   default** on Opus 5, and `max_tokens` caps thinking *plus* output — budget generously or your
   spec truncates mid-document.
3. **A trailing assistant-turn prefill is a 400.** Use `output_config.format`. This is better
   anyway: API's Zod schemas become the output format directly via `zodOutputFormat`, which
   deletes most of what would have been a parse-and-repair loop.
4. **Structured output does NOT enforce `.min()`/`.max()`.** The SDK strips numeric and length
   constraints and validates them client-side. Constrained decoding guarantees the *shape*, never
   the *limits*, so `validateLabSpec` stays mandatory.

### Prompt caching is a correctness concern here

Caching is a prefix match; one changed byte invalidates everything after it. Your system prompt
(DSL rules + archetype manifest + worked example) is large, stable, and shared by plan, both
compose calls, and the coach — so a cache hit is most of your cost and a chunk of your latency.

Keep the concept, the session id, and any timestamp **out of the system prompt**. Put them in the
user turn, after the `cache_control` breakpoint. Then verify:
`usage.cache_read_input_tokens` must be non-zero on the second call of a session. If it is zero,
something volatile leaked into the prefix and the whole product is silently paying full price.

Note `usage.input_tokens` is only the *uncached remainder* — total prompt size is
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. Summing the wrong field
under-reports by most of the prompt.

### Prompt style — write for the current models

These models follow the system prompt closely, which inverts several habits:

- **No `CRITICAL:` / `YOU MUST` / `NEVER`.** Emphasis written to overcome an older model's
  reluctance now overtriggers. Say it once, plainly, with the reason.
- **State the target; do not enumerate failures.** A prohibition list anchors toward the
  behaviour it names. The `COMPOSER_BAR` constant is the intended register — match it.
- **One complete worked example beats three partial ones.** Models match example structure
  closely, so doc 03 §10 is load-bearing: include it whole.
- **Do not add "double-check your work."** These models self-verify, and instructing it causes
  over-verification. This inverts the usual advice; it is correct here.
- **Add a conciseness instruction** where length matters. Lowering `effort` does *not* reliably
  shorten visible output; prompting does.

---

## Never

- `eval` / `new Function` / dynamic `import` of model output.
- Trust `parsed_output` without a null check — it is nullable when parsing fails.
- Read `content[0]` before checking `stop_reason`. A refusal is an HTTP **200** with empty or
  partial content, and for this product it is usually a false positive on a legitimate dual-use
  mechanism. Handle it as content: decline the *lab*, offer the underlying concept (doc 08).
- Return an error page for a generation failure. `degradeToFallback` exists so the learner always
  gets something to play with.
- Send the answer key to the client. It lives in `Session.assessmentKey`, server-side, full stop.
- Read-modify-write a whole session document. Events, phase changes, and generation progress all
  write concurrently; a whole-document overwrite loses transcript events under load, which
  silently degrades the quiz.

---

## Handoff notes (fill in before you stop)

```md
**Works:**
**Archetype-choice score on doc 08 (x/10):**
**Cache read tokens observed on 2nd call:**
**Throws NotImplemented:**
**Assumed of others:**
**Deviations from docs 03 / 09:**
**Next session starts with:**
```
