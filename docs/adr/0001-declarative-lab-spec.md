# ADR 0001 — The AI emits a declarative LabSpec, not code

**Status:** accepted · **Date:** 2026-09-16 · **Affects:** every agent

## Context

Instinct Lab must turn an arbitrary concept into an interactive simulation. The AI has to decide
both *what* to teach and *how* it should behave when poked. Something must carry that decision from
the model to the browser.

## Options considered

**1. Model writes React/canvas code, client executes it.**
Maximum expressiveness, minimum everything else: arbitrary code execution from a model in the
user's browser; unbounded performance (a model-authored `while` loop ends the session); no
hit-testing, time-travel, or snapshots without the model reimplementing them per topic; nothing
structured to build a quiz from; 20–40s cold start for a full component; and no way to validate
correctness before running it. Rejected.

**2. Model picks from a fixed library of hand-built labs.**
Fast, safe, and dead on arrival — it only covers topics we anticipated. The product promise is
"anything". Rejected.

**3. Model emits a declarative LabSpec; client compiles it. ← chosen**
The model chooses the pedagogy (archetype, variables, dynamics, beats, questions); the codebase
owns the primitives (renderers, expression VM, sim loop, state rings).

## Decision

Option 3. The LabSpec (doc 03) is the single artifact crossing the AI/client boundary. Dynamics are
expressed as whitelisted arithmetic expressions evaluated by a sandboxed VM, or as one of a fixed
set of named kernels. Visuals are expression-bound channels over ten generic archetypes.

## Consequences

**Good**
- Validatable: a spec is Zod-checkable, so a bad generation is caught *before* the learner sees it,
  and repairable by feeding the issues back to the model.
- Bounded: every count, rate, and loop has a hard limit. Performance is a property of the engine,
  not of the model's mood.
- Streamable: `meta` → `model` → `stage` → `controls` → `beats` each validate independently, so the
  canvas goes live while the rest is still generating. This is what makes the 2.5s budget possible.
- Introspectable: because state is named and typed, the runtime can detect a clamp with no effect,
  a regime change, an undiscovered notable — and the quiz builder can reason over what the learner
  actually did. **This is the feature that makes retention work, and option 1 cannot have it.**
- Cheap: a spec is ~6–16k tokens versus 40k+ for a component, and the repair loop is targeted.
- Testable: the sim runs headless in Node, which is what lets the server grade `tune` items by
  re-running the simulation instead of trusting the client.

**Bad**
- The DSL is a ceiling. Concepts that fit no archetype get a weaker lab. Mitigated by
  `free-canvas`, monitored by tracking archetype distribution and `free-canvas` frequency.
- Ten renderers are real work up front, and the DSL needs versioning discipline.
- The model must learn the DSL. Mitigated by generating the prompt's capability list from
  `GET /archetypes` (doc 05) rather than hand-maintaining it — prompt and renderers cannot drift.

## Revisit when

`free-canvas` exceeds ~15% of generated specs, or archetype-choice accuracy drops below 70% on the
doc 08 set. Either signal means the grammar is wrong, not that the approach is.
