# 05 — API contract

Owner: **API** (route handlers). Consumers: **FRONTEND** (client), **BACKEND** (AI), **BACKEND** (persistence).
Request/response schemas are Zod, defined by **API** in `packages/lab-schema/src/api.ts`.

Base: `/api`. All bodies JSON. All responses carry `x-request-id`.

---

## Conventions

**Every handler, in this order.** API must not reorder these — auth-before-parse and
rate-limit-after-model-call are both real bugs.

```
1. parse + validate body with the API Zod schema   → 400 on failure
2. resolve session (if :id) from BACKEND               → 404 on miss
3. rate limit                                     → 429
4. do the work (BACKEND / BACKEND)                          → 5xx on failure
5. respond with the API response schema
```

**Error envelope — the only error shape:**
```json
{ "error": { "code": "SPEC_INVALID", "message": "human readable",
              "details": { "issues": [] }, "requestId": "req_..." } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | body failed validation |
| `NOT_FOUND` | 404 | unknown session |
| `RATE_LIMITED` | 429 | includes `retry-after` |
| `GENERATION_FAILED` | 503 | plan stage failed; retryable |
| `SPEC_INVALID` | 422 | compose produced an unrepairable spec |
| `MODEL_TIMEOUT` | 504 | upstream model exceeded budget |
| `INTERNAL` | 500 | anything else |

**Idempotency.** `POST /labs` and `POST /assessment` accept `Idempotency-Key`; a repeat returns the
original result rather than generating twice. Cheap insurance against React double-invoke and
impatient clicking.

---

## Endpoint map

| Method | Path | Duty | Latency |
|---|---|---|---|
| `POST` | `/labs` | mint session, kick off generation, return immediately | < 150ms |
| `GET` | `/labs/:id/stream` | SSE: spec deltas + coach + assessment pushes | streaming |
| `GET` | `/labs/:id` | full session snapshot (reconnect / cold load) | < 100ms |
| `PATCH` | `/labs/:id` | advance phase / set beat | < 80ms |
| `POST` | `/labs/:id/events` | batched interaction events, fire-and-forget | < 50ms |
| `POST` | `/labs/:id/predict` | commit a prediction, get a verdict | < 1.5s |
| `POST` | `/labs/:id/coach` | learner-initiated question or hint request | < 2s |
| `POST` | `/labs/:id/remix` | regenerate a variant of this lab | streaming |
| `POST` | `/labs/:id/assessment` | build the quiz from the transcript | < 4s |
| `POST` | `/labs/:id/assessment/grade` | grade answers, emit mastery + recall card | < 3s |
| `GET` | `/labs/:id/recap` | retention artifact | < 100ms |
| `POST` | `/specs/validate` | validate + auto-repair a LabSpec (dev + internal) | < 2s |
| `GET` | `/archetypes` | renderer capability manifest | cached |
| `GET` | `/health` | liveness + adapter/model status | < 20ms |

---

## `POST /api/labs`

Creates the session and returns **before** generation finishes. This is what buys the 2.5s
first-visual budget.

```ts
// request
{ concept: string;                    // 3..280 chars, the learner's raw text
  hints?: { domain?: Domain; difficulty?: 1|2|3|4|5; priorKnowledge?: string };
  clientCapabilities?: { sharedArrayBuffer: boolean; reducedMotion: boolean; maxEntities?: number } }

// 202 Accepted
{ sessionId: SessionId; streamUrl: string; status: "planning"; createdAt: string }
```

`clientCapabilities` flows into generation: a device without `SharedArrayBuffer` or with
`reducedMotion` gets a spec with lower `tickRate` and fewer entities. BACKEND applies this as a **ceiling
on the composer's limits**, not as a prompt suggestion — models ignore suggestions.

---

## `GET /api/labs/:id/stream` (SSE)

The spine of the experience. `text/event-stream`, `x-accel-buffering: no`, heartbeat comment every
15s, `Last-Event-ID` supported for replay.

| `event:` | `data:` | Client action (FRONTEND/FRONTEND) |
|---|---|---|
| `lab.plan` | `LabPlan` | render shell, skeleton canvas, title |
| `lab.model` | `Model` | `SimCore.compile()`, allocate slab |
| `lab.stage` | `Stage` | mount archetype renderer — **canvas goes live** |
| `lab.controls` | `Control[]` | render knob panel (locked) |
| `lab.beats` | `Beat[]` | render phase rail |
| `lab.ready` | `{ specId, rev }` | start clock, enter `see` |
| `lab.fallback` | `{ spec: LabSpec, reason }` | replace with the degraded spec |
| `coach.say` | `CoachMessage` | append to coach dock |
| `coach.highlight` | `{ layer?, entity?, observable? }` | pulse that element on canvas |
| `assessment.ready` | `Assessment` | render quiz |
| `session.status` | `{ status }` | status chip |
| `error` | `ErrorEnvelope` | inline banner; **never** a full-page error |

**Replay on reconnect:** API re-emits `lab.model` → `lab.stage` → `lab.controls` → `lab.beats` →
`lab.ready` from the persisted spec, then resumes live coach messages. Spec events are therefore
**idempotent and replay-safe** — FRONTEND/FRONTEND must tolerate receiving them twice.

---

## `GET /api/labs/:id`

```ts
{ session: { id, status, concept, createdAt, rev },
  plan: LabPlan | null, spec: LabSpec | null,
  progress: { phase: Phase; beatId: BeatId | null; completedBeats: BeatId[];
              discoveredNotables: string[]; predictionsCommitted: PredictionId[] },
  assessment: Assessment | null, recallCard: RecallCard | null }
```

Never returns the transcript — it can be thousands of events. Use `/recap` for the digest.

---

## `PATCH /api/labs/:id`

```ts
{ phase?: Phase; beatId?: BeatId; completedBeat?: BeatId }   // → { rev, progress }
```
BACKEND applies this as a compare-and-set on `rev`; **409 `CONFLICT`** on a stale write, and FRONTEND refetches.
Phase can only move forward, or back to an already-completed beat. The server enforces this — a
client that skips to `recall` to see the answers must be rejected.

---

## `POST /api/labs/:id/events`

The transcript feed. High frequency, low value per item, **must never be slow**.

```ts
{ events: LabEvent[];          // ≤ 256 per batch
  clientTime: number; frame: number }

// 200 — deliberately tiny
{ accepted: number; coachPending: boolean }
```

API: append via BACKEND, then run BACKEND's **rule-based** trigger check (doc 02 §coach). If a trigger fires,
generate the coach message **asynchronously** and push it on the SSE stream. Do not await the model
in this handler — `coachPending: true` just lets FRONTEND show a typing indicator.

Accepts `keepalive`/`sendBeacon`. Unknown event kinds are dropped, not rejected: a new client must
not 400 against an older server.

---

## `POST /api/labs/:id/predict`

```ts
{ predictionId: PredictionId;
  answer: { kind: "numeric"; value: number }
        | { kind: "direction"; value: "up"|"down"|"flat" }
        | { kind: "choice"; index: number }
        | { kind: "point"; x: number; y: number }
        | { kind: "ordering"; order: number[] };
  simSnapshotDigest: string;   // proves which state was frozen
  observedAtFreeze: Record<ObservableId, number> }

// 200
{ verdict: "correct" | "close" | "wrong";
  actual: { observable: ObservableId; value: number } | { index: number } | null;
  delta: number | null;
  explanation: string;                  // ≤ 40 words, references the learner's number
  misconception: { pattern: string; because: string } | null;
  annotate: { layer?: string; entity?: number; observable?: ObservableId } | null,
  rev: number }
```

**Order of operations matters.** The commit is persisted *before* the verdict is computed, so a
learner cannot retry a prediction and have the second attempt count. `simSnapshotDigest` is checked
against the server's record of the frozen state; a mismatch downgrades the verdict to advisory and
flags it in the transcript rather than 400-ing — we do not punish a learner for a reconnect.

---

## `POST /api/labs/:id/coach`

```ts
{ question?: string;            // ≤ 240 chars; absent means "give me a hint"
  currentState: { params: Record<ParamId, number>; observables: Record<ObservableId, number>;
                  phase: Phase; beatId: BeatId } }

// 200
{ message: CoachMessage;        // ≤ 40 words
  highlight: { layer?: string; entity?: number; observable?: ObservableId } | null;
  suggestedAction: { kind: "set-param"; param: ParamId; value: number }
                 | { kind: "apply-preset"; presetId: string }
                 | { kind: "advance-beat" } | null }
```

`currentState` is sent by the client because the server does not track the slab. This is
deliberate — mirroring 60fps state server-side would be absurd. The coach gets a state *sample*.

`suggestedAction` is the coach's hands: it can offer *"try dropping loss to zero"* as a button the
learner presses. The coach never changes state itself. **The learner always does the acting.**

---

## `POST /api/labs/:id/remix`

```ts
{ intent: "harder" | "simpler" | "different-angle" | "different-archetype";
  note?: string }              // ≤ 200 chars, e.g. "focus on the queueing part"

// 202 — new session, history linked
{ sessionId: SessionId; streamUrl: string; parentSessionId: SessionId }
```

A new session, not a mutation. The parent's transcript is passed to the composer as context, so
`"harder"` means harder *than what this learner already demonstrated*, not harder in the abstract.

---

## `POST /api/labs/:id/assessment`

Builds the quiz at RECALL time from the blueprint **plus the transcript** — that personalisation is
the product's retention mechanism (doc 01 §6).

```ts
{ regenerate?: boolean }

// 200
{ assessment: {
    id: AssessmentId;
    items: QuizItem[];         // 3..5
    generatedFrom: { missedPredictions: PredictionId[]; extremeParams: ParamId[];
                     unvisitedRegimes: string[]; undiscoveredNotables: string[] } } }
```

```ts
type QuizItem =
  | { id; kind: "choice"; prompt; options: string[]; }
  | { id; kind: "numeric"; prompt; unit?: string; }
  | { id; kind: "tune"; prompt; target: { observable: ObservableId; op: "gt"|"lt"|"between";
      value: number | [number, number] }; allowedParams: ParamId[]; }   // ← interactive, preferred
  | { id; kind: "order"; prompt; items: string[] }
  | { id; kind: "explain"; prompt; maxWords: number };
```

Correct answers are **never** in the response. They live server-side until grading.
`kind: "tune"` is the flagship item type: the learner drives the lab to hit a target, which
demonstrates transferable intuition rather than recognition. BACKEND should prefer it when
`allowInteractive` is true.

`generatedFrom` is returned so FRONTEND can label items honestly (*"you predicted this one wrong"*) —
that framing measurably improves retention over unlabelled review.

---

## `POST /api/labs/:id/assessment/grade`

```ts
{ assessmentId: AssessmentId;
  answers: Array<{ itemId: string; value: number | string | number[];
                   tuneResult?: { params: Record<ParamId, number>;
                                  observables: Record<ObservableId, number> } }> }

// 200
{ score: number;                       // 0..1
  passed: boolean;                     // score >= masteryThreshold
  perItem: Array<{ itemId: string; correct: boolean; expected: string;
                   feedback: string;   // ≤ 30 words
                   replayHint?: { params: Record<ParamId, number> } }>;
  mastery: { teachingAngle: "solid" | "shaky" | "missing"; notes: string };
  recallCard: RecallCard;
  suggestedRemix: { intent: "harder" | "different-angle" } | null }
```

`kind: "tune"` items are graded by **re-running the sim server-side** with the submitted params and
checking the target — `tuneResult` from the client is a cross-check, not the grade. Client-reported
success is not trustworthy. This means BACKEND needs a headless `SimCore` run, which is exactly why FRONTEND's
`SimCore` must not touch the DOM (doc 04).

`replayHint` lets FRONTEND offer *"see it again"* — jumping the lab straight back to the configuration
the learner got wrong.

```ts
interface RecallCard { sessionId; title; bigIdea: string;       // ≤ 90 chars
  keyKnob: { param: ParamId; label: string; why: string };
  imageDataUrl?: string;                                        // canvas snapshot, ≤ 200KB
  retentionQuestion: { prompt: string; kind: "choice"|"numeric"; options?: string[] };
  createdAt: string }
```

---

## `GET /api/labs/:id/recap`

```ts
{ recallCard: RecallCard | null;
  summary: { conceptTitle; teachingAngle; minutesActive: number;
             knobChanges: number; notablesFound: string[]; notablesMissed: string[];
             predictions: Array<{ question; yourAnswer; actual; correct: boolean }>;
             quizScore: number | null };
  replayUrl: string;                    // re-enters the lab at EXPERIMENT
  nextConcepts: string[] }              // ≤ 3 adjacent concepts, from the plan
```

---

## `POST /api/specs/validate`

The repair loop, exposed. Used internally by BACKEND and by FRONTEND/BACKEND for authoring by hand.

```ts
{ spec: unknown; repair?: boolean }

// 200
{ valid: boolean;
  issues: Array<{ path: string; code: string; message: string;
                  severity: "error" | "warning" }>;
  repaired?: LabSpec; repairNotes?: string[] }
```

Warnings are **pedagogical** lint, not schema failures, and BACKEND should act on them:
more than 8 params, a param whose `affects` is empty, a beat with no goal, an observable no layer
renders, a `free-canvas` choice when an archetype fits, a prediction whose answer is inferable from
the caption, dynamics with no feedback loop (a lab where nothing the learner does feeds back is a
diagram, not a lab).

---

## `GET /api/archetypes`

The capability manifest. BACKEND injects this into the composer prompt so the model's options are
**generated from the code that exists**, not from a hand-maintained list in a prompt. When FRONTEND adds
a config field, the prompt learns about it automatically — this is the main defence against prompt
and renderer drifting apart.

```ts
{ archetypes: Array<{ id: ArchetypeId; summary: string; bestFor: string[];
    configSchema: JsonSchema; supportedMarks: string[];
    interactions: string[]; maxEntities: number; examples: string[] }>,
  kernels: Array<{ id: KernelId; summary: string; configSchema: JsonSchema }>,
  exprFunctions: string[], limits: Record<string, number>, specVersion: "1.0" }
```

---

## `GET /api/health`

```ts
{ ok: boolean; version: string; specVersion: "1.0";
  adapters: { persistence: "memory"|"sqlite"|"redis"; status: "up"|"down" };
  models: { composer: string; planner: string; reachable: boolean };
  uptimeSeconds: number }
```

---

## Client transport rules (FRONTEND)

1. One SSE connection per session. Reconnect with exponential backoff (1s → 16s) and
   `Last-Event-ID`; show a subtle reconnecting chip, never a modal.
2. `POST /events` is fire-and-forget; never `await` it in an input handler.
3. Never poll `GET /labs/:id` while the stream is open. Use it only for cold load and after a 409.
4. All mutating calls carry the last known `rev`; on 409, refetch and reapply.
5. `AbortController` on every fetch, aborted on unmount.
6. Optimistic UI for phase advance only. Never for a prediction verdict or a grade.
