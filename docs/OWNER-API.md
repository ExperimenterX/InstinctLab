# OWNER — API & Contracts

> Read [`00-START-HERE.md`](00-START-HERE.md) first, then [`05-api-contract.md`](05-api-contract.md)
> and [`03-lab-spec-dsl.md`](03-lab-spec-dsl.md).

**OWNS**
```
packages/lab-schema     the contract — every shape crossing a boundary
packages/shared         ids, Result, NotImplemented, logger, rate limiting
apps/api                Fastify service: routes, SSE, validation, errors
docs/CONTRACT-REQUESTS.md
```

**READS** everything. You are the only owner who legitimately reads all three slices, because you
wire them together.

**YOU BLOCK BOTH OTHER OWNERS.** They typecheck against your schema right now.

---

## Your job

Two jobs that happen to belong together.

**The contract.** You are the only person who may change a shared type. The other two code
against what you export, so your real output is not "a nice schema" — it is *two unblocked
teammates*.

**The service.** One Fastify app that validates everything, holds a long-lived SSE stream per
session, and is the only process that touches `ai-core` and `persistence`. The frontend is a
separate build and physically cannot import either. That separation is the main structural reason
we split the API out of the UI.

**Ship correct exported names and signatures before anything else**, even if every refinement is
a `TODO`. Spending your first day perfecting a schema nobody can import is the worst available
outcome on this project.

---

## Priority order

### P1 — Make the schema parse, and stand up the server
- `LabSpecSchema.safeParse(<doc 03 §10 example>)` → `success: true`
- The same spec with 9 params → `success: false`
- Both as vitest tests. Export the doc 03 example from `src/fixtures/example-spec.ts` — it is
  also BACKEND's and FRONTEND's test fixture, so it must live in the schema package.
- `buildServer()` listens, `GET /health` returns, `GET /archetypes` returns the manifest.

### P2 — `GET /labs/:id/stream` and `POST /labs`
The SSE route first. It is the only endpoint FRONTEND cannot fake, so it unblocks them soonest —
and it is the route most likely to eat a day if left until late (see the gotchas below).

### P3 — `shared` for real
`newId`, `isId`, `digest`, `createLogger`, `createRateLimiter`. Small, dependency-free, used by
everyone. `digest` must be deterministic across client and server, since the client computes a
prediction digest that you compare against your record. FNV-1a hex is fine — it proves "same
state", not identity, so it need not be cryptographic.

### P4 — Cross-field refinements in the schema
The `TODO(API)` comments in `model.ts`, `stage.ts`, `controls.ts`, and `beats.ts` list them.
Highest value first:
1. `stage.config` matches `stage.archetype` — a mismatched config throws inside FRONTEND's draw
   loop, which is a runtime crash the schema should have caught.
2. Referential integrity: every id reference resolves.
3. `checkExprScope` — identifiers in scope, functions in the fixed table.
4. The pedagogical rules in `beats.ts` (`see` unlocks nothing; the first `interact` beat unlocks
   exactly one param).

### P5 — The remaining routes, then `validateLabSpec` / `repairLabSpec` / `fallbackSpecFromPlan`
Repair does **mechanical** fixes only: clamp an out-of-range default, drop a dangling annotation,
coerce an over-limit tick rate. Never invent pedagogy — a missing `teachingAngle` goes back to
the model, because guessing it ships a bad lab that looks fine.

`fallbackSpecFromPlan` is the floor: one param, one derived value, a `function-plot` layer, six
beats, one prediction. It is what a learner gets when composition fails twice, and a shallow lab
beats an error page.

---

## Schema design rules

- **Bound every AI-authored number.** Model output is untrusted input. An unbounded entity count
  is a frozen tab; an unbounded expression depth is a hung parser. Every numeric gets a
  `.min()`/`.max()` from `limits.ts`.
- **Brand ids.** Passing a `ParamId` where an `ObservableId` belongs is the likeliest cross-owner
  mistake on this project. Let the compiler catch it.
- **Export types, not just schemas.** Every `XSchema` gets
  `export type X = z.infer<typeof XSchema>`.
- **Use `.default()` generously.** Every default is a field the model can omit: fewer tokens,
  fewer validation failures, faster generation.
- **Warnings are a first-class output**, not lint. BACKEND's repair loop reads them. The
  highest-value warning in the system: *dynamics contain no feedback loop* — a lab where the
  learner's input never feeds back is a diagram, not a lab.
- **Keep the schema non-recursive.** BACKEND feeds it to `zodOutputFormat` for constrained
  decoding, and recursive schemas are unsupported there.

Do not add a topic-specific type. No `TcpConfig`, no `SortingConfig`. Do not accept `z.any()` on
an AI-authored path. Do not widen a type to make someone else's code compile — make them file a
contract request.

---

## Fastify gotchas that will cost you a day

**SSE (`routes/stream.ts`) is where the time goes.**
- Take over the raw stream (`reply.raw`) and `reply.hijack()`. Do not return a value.
- Headers: `content-type: text/event-stream`, `cache-control: no-cache, no-transform`,
  `connection: keep-alive`, and **`x-accel-buffering: no`**. Without that last one a proxy
  buffers the stream and the learner sees nothing until generation finishes — which defeats the
  entire progressive-mount design and looks exactly like a slow model.
- No global request timeout may apply to this route.
- On `request.raw.on("close")`: unregister from the hub **and** clear the heartbeat interval. A
  leaked interval per dropped connection is a slow leak that only appears under real load.
- Heartbeat with a comment line every 15s or load balancers will drop idle connections.

**Generation starts on stream-open, not on `POST /labs`.** Starting it on POST races the client's
stream open, and SSE has no replay buffer — anything emitted before the stream attaches is lost.

**`POST /events` has a 50ms budget.** Never await a model call in it. Run the rule check
synchronously, generate the coach message asynchronously, and push it onto the open stream.
`coachPending: true` just lets the UI show a typing indicator.

**Multi-instance breaks the StreamHub.** It is an in-process Map. The publisher and the open
stream can land on different nodes, and the symptom is a coach that silently never speaks — very
hard to spot in testing. If you deploy more than one node, this needs redis pub/sub.

---

## Handler order is not negotiable

```
1. validate body with the Zod schema   → 400
2. resolve session                     → 404
3. rate limit                          → 429
4. do the work                         → 5xx
5. respond against the schema response type
```

Auth-before-parse and rate-limit-after-the-model-call are both real bugs. That is why
`server/handler.ts` exists — so the order is written once instead of thirteen times.

---

## Security boundary — yours to hold

- `ANTHROPIC_API_KEY` is read in `ai-core` only, and `ai-core` is imported only by `apps/api`.
  Nothing in `apps/web` may transitively reach either. This is the one mistake on this project
  that shipping a later fix does not undo.
- **Never return a raw `Session`.** Use `PublicSessionSchema`. The assessment answer key lives on
  the session object and a careless spread leaks it.
- Enforce phase monotonicity server-side. A client that jumps to `recall` to read the answers
  must be rejected by you, not trusted.
- Quiz answers are graded server-side by re-running the simulation. A client-reported
  `tuneResult` is a cross-check, never the grade.
- CORS: one explicit origin for the SPA. Never `*` with credentials.

---

## Sweep `CONTRACT-REQUESTS.md` regularly

Both other owners will file requests. Each one is an integration failure caught early. Accept,
reject, or supersede with a note — and if you accept, export it immediately, because someone is
blocked.

---

## Handoff notes (fill in before you stop)

```md
**Works:**
**Throws NotImplemented:**
**Contract requests resolved / open:**
**Assumed of others:**
**Deviations from doc 05:**
**Next session starts with:**
```
