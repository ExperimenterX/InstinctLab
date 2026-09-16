> ⚠️ **Not the current scope.** We are building the MVP first — see [`MVP.md`](MVP.md),
> which overrides this document wherever they disagree. The product thinking here still stands;
> the scope and stack details do not.

# 10 — API spec (FastAPI)

Owner: **T3**. Consumers: **T1** (client), **T2** (called from route handlers).

Base: `/api/v1`. JSON in, JSON out. Auth via bearer JWT except where noted.
FastAPI publishes the live schema at `/openapi.json` — **T1 generates TypeScript from it rather
than hand-writing response types.**

---

## Conventions

**Handler order.** Every route, in this order. Auth-before-parse and rate-limit-after-the-model-call
are both real bugs, so put this in a shared dependency rather than repeating it per route.

```
1. authenticate                     → 401
2. validate body (Pydantic)         → 422
3. load resource, check ownership    → 404 (not 403 — don't leak existence)
4. rate limit                        → 429
5. do the work                       → 5xx
6. respond via a response_model
```

**Ownership checks are not optional.** Every `/labs/{id}` route must confirm the session belongs
to the caller. Returning **404** rather than 403 for someone else's session avoids confirming that
the id exists.

**Error envelope** — the only error shape that leaves the service:
```json
{ "error": { "code": "SPEC_INVALID", "message": "human readable",
             "details": {}, "request_id": "req_..." } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | missing or invalid token |
| `VALIDATION_FAILED` | 422 | Pydantic rejected the body |
| `NOT_FOUND` | 404 | unknown, or not yours |
| `CONFLICT` | 409 | stale `rev` on a concurrent update |
| `RATE_LIMITED` | 429 | includes `Retry-After` |
| `GENERATION_FAILED` | 503 | planning failed; retryable |
| `SPEC_INVALID` | 422 | the model produced an unrepairable spec |
| `MODEL_TIMEOUT` | 504 | upstream model exceeded its budget |
| `INTERNAL` | 500 | anything else — log the detail, never return a traceback |

**Always set `X-Request-ID`** on the response and include it in the error body. It is the only
thing that makes a user-reported bug traceable.

---

## Endpoint map

| Method | Path | Auth | Duty | Budget |
|---|---|---|---|---|
| `POST` | `/auth/register` | — | create user | < 300ms |
| `POST` | `/auth/login` | — | issue access + refresh token | < 300ms |
| `POST` | `/auth/refresh` | refresh | rotate access token | < 100ms |
| `GET` | `/auth/me` | ✓ | current user | < 50ms |
| `POST` | `/labs` | ✓ | create session, start generation | < 200ms |
| `GET` | `/labs/{id}` | ✓ | full session snapshot | < 100ms |
| `GET` | `/labs/{id}/stream` | ✓ | SSE: spec sections + coach | streaming |
| `PATCH` | `/labs/{id}/progress` | ✓ | advance phase / beat | < 80ms |
| `POST` | `/labs/{id}/events` | ✓ | batched interaction events | **< 50ms** |
| `POST` | `/labs/{id}/predict` | ✓ | commit a prediction, get a verdict | < 1.5s |
| `POST` | `/labs/{id}/coach` | ✓ | ask a question / request a hint | < 2s |
| `POST` | `/labs/{id}/remix` | ✓ | regenerate a variant | < 200ms |
| `POST` | `/labs/{id}/quiz` | ✓ | build the quiz from the transcript | < 4s |
| `POST` | `/labs/{id}/quiz/grade` | ✓ | grade answers, return mastery | < 3s |
| `GET` | `/labs/{id}/recap` | ✓ | retention artifact | < 100ms |
| `GET` | `/me/labs` | ✓ | the user's lab history (paginated) | < 150ms |
| `GET` | `/archetypes` | — | renderer capability manifest | cached |
| `GET` | `/health` | — | liveness + db + model reachability | < 20ms |

---

## Auth

```
POST /auth/register   { email, password, display_name? }
                   →  201 { user: User, access_token, refresh_token }

POST /auth/login      { email, password }
                   →  200 { user: User, access_token, refresh_token }

POST /auth/refresh    { refresh_token }  →  200 { access_token }
GET  /auth/me                            →  200 { user: User }
```

- Password: minimum 10 characters. Hash with **argon2** (or bcrypt). Never store, log, or return
  a plaintext password.
- Access token ~30 min, refresh ~30 days. Refresh tokens are stored hashed so a database leak
  cannot be replayed.
- **Login and register must fail identically for a wrong password and an unknown email** — same
  status, same message, same rough timing. Otherwise the endpoint is a user-enumeration oracle.
- Rate-limit `/auth/login` per IP *and* per email. Credential stuffing targets one account across
  many IPs, so per-IP alone does not stop it.

---

## `POST /labs`

Returns immediately. Generation runs behind the stream (see below) so the learner sees a shell
inside ~1s rather than waiting on the full model call.

```jsonc
// request
{ "concept": "why does adding lanes to a highway not fix traffic",
  "hints": { "domain": "systems", "difficulty": 3 },        // optional
  "client_capabilities": { "max_entities": 2000, "reduced_motion": false } }

// 202
{ "session_id": "ses_...", "stream_url": "/api/v1/labs/ses_.../stream",
  "status": "planning", "created_at": "..." }
```

`client_capabilities` becomes a **hard ceiling** on what the composer may produce, applied to the
schema bounds — not a sentence in the prompt. Models ignore suggestions; they cannot exceed a
bound you enforce.

---

## `GET /labs/{id}/stream` — SSE

The spine of the experience. FastAPI: `StreamingResponse` with
`media_type="text/event-stream"`.

| `event:` | `data:` | Client action |
|---|---|---|
| `lab.plan` | `LabPlan` | render shell + skeleton canvas |
| `lab.model` | `Model` | allocate simulation state |
| `lab.stage` | `Stage` | mount the renderer — **canvas goes live** |
| `lab.controls` | `Control[]` | render knobs |
| `lab.beats` | `Beat[]` | render the phase rail |
| `lab.ready` | `{ spec_id, rev }` | start the clock |
| `lab.fallback` | `{ spec, reason }` | replace with a degraded but valid spec |
| `coach.say` | `CoachMessage` | append to the coach dock |
| `quiz.ready` | `Assessment` | render the quiz |
| `error` | error envelope | inline banner — **never** a full-page error |

**Headers that are not optional:**
```
content-type: text/event-stream
cache-control: no-cache, no-transform
x-accel-buffering: no
```
Without the last one a reverse proxy buffers the stream and the learner sees nothing until
generation finishes — which looks exactly like a slow model and defeats the whole design.

Send a comment line (`: ping`) every 15s or idle connections get dropped.

**Generation starts when the stream opens, not in `POST /labs`.** Starting it on POST races the
client's connection, and SSE has no replay buffer — anything emitted before the client attaches is
lost.

**On reconnect**, replay `lab.model` → `lab.stage` → `lab.controls` → `lab.beats` → `lab.ready`
from the persisted spec, then resume live events. Those events must be idempotent so a duplicate
is harmless; replaying too little is far worse than replaying too much.

> If SSE is taking too long to get right, ship `POST /labs` **synchronously** returning the full
> spec, and add streaming after. You lose the progressive reveal, not the product.

---

## `POST /labs/{id}/events`

The transcript feed — high frequency, low value per item, and **it must never be slow.** The
learner's hand is on a knob while this runs.

```jsonc
{ "events": [ { "kind": "param.change", "param": "lanes", "from": 2, "to": 6,
                "samples": 180, "duration_ms": 1400, "at": 12.4, "frame": 744 } ],
  "frame": 744 }
→ 200 { "accepted": 1, "coach_pending": true }
```

- **Never await a model call here.** Run the trigger check synchronously; if it fires, generate the
  coach message in a background task and push it down the open SSE stream.
- Append-only insert. Never read-modify-write the transcript.
- Unknown event kinds are dropped, not rejected — a newer client must not 422 against an older
  server.
- A slider drag arrives pre-coalesced as one event with `samples`. This matters: the transcript is
  what the quiz is built from, so it must be complete without being flooded.

---

## `POST /labs/{id}/predict`

```jsonc
{ "prediction_id": "p1",
  "answer": { "kind": "numeric", "value": 0.72 },
  "observed_at_freeze": { "avg_speed": 0.81 } }

→ 200
{ "verdict": "wrong",              // correct | close | wrong
  "actual": { "observable": "avg_speed", "value": 0.46 },
  "delta": -0.26,
  "explanation": "You said 0.72 — it settled at 0.46. The extra lanes filled with new trips.",
  "misconception": { "pattern": "high", "because": "you held demand fixed" },
  "annotate": { "observable": "avg_speed" } }
```

**Persist the commit before computing the verdict.** Otherwise a learner can retry until they're
right, and the PREDICT phase only teaches anything if the commitment is real.

`actual` comes from T2's `run_headless` — the same engine the learner was watching, run forward
from the frozen state with the same seed.

---

## `POST /labs/{id}/quiz` and `/quiz/grade`

```jsonc
POST /quiz  → 200 { "assessment": { "id": "...", "items": [...],
                    "generated_from": { "missed_predictions": [...], "extreme_params": [...],
                                        "unvisited_regimes": [...] } } }
```

**Correct answers are never in this response.** They live in a column the response model cannot
reach.

`generated_from` is returned so T1 can label items honestly — "you predicted this one wrong" beats
an unlabelled review question, measurably.

```jsonc
POST /quiz/grade
{ "assessment_id": "...",
  "answers": [ { "item_id": "q1", "value": 3 },
               { "item_id": "q3", "params": { "lanes": 4 } } ] }   // a "tune" item

→ 200 { "score": 0.75, "passed": true, "per_item": [...],
        "mastery": { "teaching_angle": "shaky", "notes": "..." },
        "recall_card": { ... } }
```

**`tune` items are graded by re-running the simulation server-side** with the submitted params.
A client-reported result is a cross-check, never the grade.

---

## `GET /health`

```jsonc
{ "ok": true, "version": "0.1.0",
  "db": "up", "model_reachable": true, "uptime_seconds": 1234 }
```

Must not call a model. Check reachability from a cached background probe, or you have built a
health check that costs money and times out.

---

## Client rules (T1)

1. One SSE connection per session. Reconnect with exponential backoff (1s → 16s) and
   `Last-Event-ID`. Show a small chip, never a modal — the simulation is local, so a dropped
   stream costs the coach, not the lab.
2. `POST /events` is fire-and-forget. Never `await` it in an input handler.
3. Don't poll `GET /labs/{id}` while the stream is open. Use it for cold load and after a 409.
4. `AbortController` on every request, aborted on unmount.
5. Optimistic UI for phase advance only. Never for a prediction verdict or a grade.
6. Store the access token in memory; the refresh token in an httpOnly cookie if you can. Avoid
   `localStorage` for the refresh token — any XSS then becomes a persistent account takeover.
