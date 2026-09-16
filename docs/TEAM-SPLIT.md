> ⚠️ **Not the current scope.** We are building the MVP first — see [`MVP.md`](MVP.md),
> which overrides this document wherever they disagree. The product thinking here still stands;
> the scope and stack details do not.

# Team split — three people, three lanes

> **This supersedes `OWNER-API.md` / `OWNER-BACKEND.md` / `OWNER-FRONTEND.md`**, which describe an
> earlier Node/Fastify design. Those files are kept for the product thinking in them (the state
> model, the renderer rules, the prompt guidance) — all of that still applies. The *stack* and the
> *ownership boundaries* below are current.

**Stack:** React + Vite frontend · Python (FastAPI) backend · Postgres · Anthropic Python SDK.

---

## The lanes

| | **T1 — Canvas & Frontend** | **T2 — Lab Engine (AI + Sim)** | **T3 — API & Data** |
|---|---|---|---|
| **Owns** | `apps/web/**` | `services/api/app/ai/**`, `services/api/app/sim/**` | `services/api/app/{api,models,db,schemas,core}/**`, `migrations/**` |
| **Language** | TypeScript / React | Python | Python / SQL |
| **One-line job** | Make the concept visible and touchable | Turn a concept into a LabSpec, and grade answers | Serve it, store it, authenticate it |
| **Reads** | `docs/11-canvas-design.md`, `docs/10-api-spec.md` | `docs/03-lab-spec-dsl.md`, `docs/09-claude-api-notes.md` | `docs/10-api-spec.md`, `docs/12-db-schema.md` |

Nobody edits another lane's folders. The two boundaries that matter:

- **T3 owns `app/schemas/**` — the Pydantic models.** That is the contract. T1 and T2 both code
  against it. If you need a field that isn't there, ask T3; don't add it locally.
- **T2 owns the AI and the simulator, and nothing HTTP.** T2 writes plain Python functions
  (`generate_spec(concept) -> LabSpec`, `run_headless(spec, params) -> observables`). T3 calls
  them from route handlers. This keeps T2 out of FastAPI entirely and means they can iterate in a
  REPL instead of through curl.

---

## T1 — Canvas & Frontend

**Folders**
```
apps/web/src/canvas/archetypes/     one file per visual grammar
apps/web/src/canvas/draw/           primitives, theme, layout, viewport transform
apps/web/src/canvas/interaction/    hit-testing, drag, pointer → param writes
apps/web/src/state/                 the three state rings (see docs/04)
apps/web/src/api/                   typed client, generated from the OpenAPI schema
apps/web/src/features/{prompt,lab,predict,quiz,auth}/
```

**Your deliverable:** a learner types a concept, a canvas appears, and dragging a knob changes the
picture inside one frame.

**The rule that defines your lane:** React is never in the frame loop. The canvas mounts once,
holds a ref to a numeric array of simulation state, and redraws in its own `requestAnimationFrame`
loop. Knob input writes to that array synchronously. React re-renders only for network-rate things
(a coach message) and input-rate things (a knob's label). Details in
[`04-state-management.md`](04-state-management.md) and [`11-canvas-design.md`](11-canvas-design.md).

**Don't wait for T3.** Hand-write one `LabSpec` JSON fixture from
[`03-lab-spec-dsl.md`](03-lab-spec-dsl.md) §10 and build the whole canvas against it. Swap in the
real endpoint at the end. This is the single biggest thing that keeps three people from blocking
each other.

**Type safety across the boundary:** FastAPI generates an OpenAPI schema at `/openapi.json`. Run
`openapi-typescript` against it to generate `src/api/types.ts`. Do not hand-write the response
types — they will drift, silently, and you will find out during a demo.

---

## T2 — Lab Engine (AI + Sim)

**Folders**
```
services/api/app/ai/client.py       the Anthropic client, one instance
services/api/app/ai/planner.py      concept → which archetype, what is the teaching angle
services/api/app/ai/composer.py     plan → full LabSpec
services/api/app/ai/prompts/        system prompts, the bar, the worked example
services/api/app/ai/grader.py       grade a prediction and the quiz
services/api/app/sim/expr.py        safe evaluator for spec-authored expressions
services/api/app/sim/runner.py      headless simulation run, for grading
```

**Your deliverable:** `generate_spec("why does adding lanes not fix traffic")` returns a LabSpec
that validates, and whose knob actually changes the outcome.

**Two things carry the product, and they're both yours:**

1. **`teachingAngle` must be a mechanism, not a restatement.** "Compound interest grows money" is
   a failure. "Time dominates rate, and the knee is later than anyone guesses" is the bar.
2. **The dynamics must contain a feedback loop.** At least one expression must read the learner's
   parameter. Without that you have generated a diagram, and the knob is decoration.

**Read [`09-claude-api-notes.md`](09-claude-api-notes.md) before your first model call.** Three
things there will otherwise cost you an hour: `temperature` is a 400 on these models,
`thinking.budget_tokens` is a 400 (use `output_config.effort`), and structured output does *not*
enforce your min/max bounds — so you still validate after.

Use the Python SDK's structured output against T3's Pydantic models. That makes the schema do the
parsing, which deletes most of what would otherwise be a repair loop.

**`sim/expr.py` is a security boundary, not a utility.** It evaluates strings the model wrote.
No `eval`, no `exec`, no `compile`. Parse to an AST, whitelist the node types, whitelist the
function names, cap the depth. Rejecting a weird expression is always correct; guessing never is.

---

## T3 — API & Data

**Folders**
```
services/api/app/main.py            FastAPI app, CORS, router mount
services/api/app/config.py          settings from env
services/api/app/schemas/           Pydantic — the contract. You own this.
services/api/app/models/            SQLAlchemy tables
services/api/app/db/                engine, session, repositories
services/api/app/api/routes/        one module per resource
services/api/app/core/              auth, errors, logging
services/api/migrations/            Alembic
```

**Your deliverable:** the endpoints in [`10-api-spec.md`](10-api-spec.md) exist, validate their
input, persist to Postgres, and return the documented shapes.

**Start with the schemas, not the routes.** `app/schemas/lab_spec.py` unblocks both other lanes —
T1 generates TypeScript from it and T2 generates specs against it. Ship it first even if every
route still returns a stub.

**Unblock T1 in the first few minutes:** make `POST /api/v1/labs` return a hardcoded LabSpec
fixture before T2's generator exists. T1 then builds against a real endpoint all day, and T2 swaps
the constant for the real call when ready.

**The security items that are yours alone:**
- `ANTHROPIC_API_KEY` lives in this service and nowhere else. It must never be sent to the browser.
- Never return the quiz answer key. Store it in a column the response model cannot reach.
- Enforce phase progression server-side. A client that jumps straight to the answers must be
  rejected here, not trusted.
- Grade "tune" quiz items by calling T2's `run_headless` yourself. A score the client reports is
  not a score.
- Password hashing: `argon2` or `bcrypt`. Never store or log a plaintext password.

---

## How the three of you avoid blocking each other

| Lane | Works against, until the real thing exists |
|---|---|
| T1 | a hand-written LabSpec JSON fixture, then T3's hardcoded endpoint |
| T2 | a Python REPL. No HTTP needed to iterate on prompts. |
| T3 | its own stub responses; swap in T2's functions when they land |

Integration is one moment, not a continuous negotiation: T3 wires T2's `generate_spec` into the
route, T1 points at the real base URL. If that moment is late, each lane still demos on its own.

---

## Definition of done (all three)

The loop works end to end with **no topic-specific code anywhere**:

1. Register, log in.
2. Type *"how does a spring-mass system oscillate"* → a canvas appears.
3. Drag a knob → the picture changes within one frame.
4. Commit a prediction → get an explanation that cites your own number.
5. Finish a short quiz built from what you actually did.
6. Reload → your session is still there.
7. Then type *"how does DNS resolution work"* and get a **different kind of visual** with no code
   change. That last step is the real test — if it needs new code, the generality is fake.
