# MVP — the immediate plan

> **This is the current working scope. It overrides `TEAM-SPLIT.md`, `10-api-spec.md`, and
> `12-db-schema.md` wherever they disagree.** Those describe the full product; this describes what
> we build *now*. Docs `01`, `03`, `04`, `09`, `11` still apply as written — they are product and
> technique, not scope.

**Goal:** a working prototype of the loop — type a concept, get a canvas, drag a knob, predict,
find out you were wrong, answer three questions. Nothing else.

---

## Scope

| In | Out (for now) |
|---|---|
| One archetype: `function-plot` | The other nine |
| 1–3 knobs, live | Direct canvas manipulation (drag nodes, paint cells) |
| One prediction, freeze → commit → reveal | Multiple predictions, misconception matching |
| A 3-item quiz | `tune` items, mastery scoring, recall cards |
| SQLite, 4 tables, no ORM | Postgres, SQLAlchemy, Alembic |
| Anonymous sessions (id in `localStorage`) | **Auth, users, login** |
| Synchronous `POST /labs` | SSE streaming, progressive mount |
| Session survives reload | Transcript, event batching, coach, remix, recap |

**Dropping auth is the biggest accelerant** — it removes roughly half of one lane's work and
blocks nothing we want to demo. A session id minted server-side and kept in `localStorage` is
enough to make a lab resumable.

**Keeping the prediction is non-negotiable.** It's the one step that makes the concept stick, and
a prototype without it is a chart with sliders.

---

## Storage: SQLite, not JSON files

Use Python's stdlib `sqlite3`. One file, `instinct.db`, four tables, plain SQL, no ORM and no
migrations.

Why not JSON files: two concurrent requests writing the same file corrupts it, and you *will* hit
that the moment two browser tabs are open. SQLite gives you real atomicity for the same amount of
work — it's in the standard library, needs no server, and no dependency to install.

```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  concept     TEXT NOT NULL,
  status      TEXT NOT NULL,          -- generating | ready | failed
  spec        TEXT,                   -- the LabSpec, as a JSON string
  phase       TEXT NOT NULL DEFAULT 'see',
  seed        INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE predictions (
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  answer        TEXT NOT NULL,        -- JSON
  verdict       TEXT NOT NULL,
  actual_value  REAL,
  committed_at  TEXT NOT NULL,
  PRIMARY KEY (session_id)            -- one commit per session. makes it irreversible.
);

CREATE TABLE quizzes (
  session_id  TEXT PRIMARY KEY REFERENCES sessions(id),
  items       TEXT NOT NULL,          -- JSON, sent to the client
  answer_key  TEXT NOT NULL,          -- JSON, NEVER sent to the client
  score       REAL
);
```

Two things to get right even at prototype speed, because both are painful to retrofit:

- **`PRAGMA journal_mode=WAL`** on connect, or concurrent reads block writes.
- **`answer_key` is a separate column and must never be selected into a response.** Write the
  response dict field by field; don't `SELECT *` and serialise the row.

The repository functions (`create_session`, `get_session`, `save_spec`, …) are the seam. Swapping
SQLite for Postgres later means rewriting that one module and nothing else.

---

## The frozen contract

Agree this once, then nobody negotiates. Pydantic in `app/schemas/lab_spec.py`, TypeScript
generated from `/openapi.json`.

```python
class Param(BaseModel):
    id: str            # snake_case, referenced by expressions
    label: str         # <= 24 chars
    min: float
    max: float
    step: float
    default: float
    explain: str       # <= 80 chars: what this knob physically means

class Series(BaseModel):
    label: str
    expr: str          # arithmetic in `x` and any param id
    color: Literal["accent", "series-1", "series-2", "warn", "ok"]

class Observable(BaseModel):
    id: str
    label: str
    expr: str          # arithmetic in param ids only (no `x`) — a single number
    format: Literal["number", "percent", "currency"] = "number"
    precision: int = 2

class Prediction(BaseModel):
    question: str          # <= 120 chars. specific and falsifiable.
    observable_id: str     # which read-out they are predicting
    at_params: dict[str, float]   # the configuration to jump to before asking
    tolerance: float
    why_correct: str       # <= 140 chars. shown only after they commit.

class QuizItem(BaseModel):
    prompt: str
    options: list[str]     # 3-4
    # correct index lives in answer_key, never here

class LabSpec(BaseModel):
    title: str             # <= 48 chars
    caption: str           # <= 90 chars. the only prose on screen.
    teaching_angle: str    # <= 140 chars. the ONE mechanism this lab exists to teach.
    x_label: str
    y_label: str
    x_domain: tuple[float, float]
    y_domain: tuple[float, float]
    params: list[Param]        # 1..3
    series: list[Series]       # 1..3
    observables: list[Observable]  # 1..2
    prediction: Prediction
    quiz: list[QuizItem]       # exactly 3
```

**The one hard requirement on generation:** at least one `series.expr` or `observable.expr` must
reference a param id. If nothing does, the knob is decoration and there is no lab — just a picture.
Validate it in code, don't trust the prompt.

---

## API surface — five endpoints

Full detail in `10-api-spec.md`; for the MVP this is the whole surface. No auth headers.

```
POST /api/labs                  { concept }  →  201 { session_id, spec }
GET  /api/labs/{id}                          →  200 { session_id, spec, phase, prediction?, quiz? }
POST /api/labs/{id}/predict     { value }    →  200 { verdict, actual, delta, why_correct }
POST /api/labs/{id}/quiz/grade  { answers }  →  200 { score, per_item }
GET  /api/health                             →  200 { ok, model_reachable }
```

`POST /api/labs` is **synchronous** — it blocks for the model call (5–15s) and returns the finished
spec. The frontend shows a generating state. Streaming is a later optimisation, not a prototype
requirement, and it is the single biggest time sink in the real design.

---

## Lanes

### T1 — Canvas & Frontend · `apps/web/`

1. `canvas/draw/` — viewport transform (spec space 0–100 → pixels, DPR-aware), axes, polyline, text
2. `canvas/archetypes/function-plot.ts` — `compile(spec)` parses expressions once,
   `draw(state, t)` samples each series across `x_domain` and strokes it
3. `state/` — one module holding current param values in a plain object + a `subscribe`; the canvas
   reads it in its own rAF loop
4. `features/prompt/` — input box → `POST /api/labs` → route to the lab
5. `features/lab/` — canvas + knob panel + observable read-outs + caption
6. `features/predict/` — freeze overlay, a slider to place the guess, commit, then reveal
7. `features/quiz/` — three multiple-choice items, submit, show the score

**Start at step 2 with a hand-written spec JSON.** Do not wait for the API. You should have a
curve on screen responding to a slider before anyone else has anything.

**The rule:** knob `onInput` writes the param value and the rAF loop redraws. The curve never
lives in React state. Details and the reasoning in `11-canvas-design.md`.

### T2 — Lab Engine · `services/api/app/ai/`, `app/sim/`

1. `sim/expr.py` — safe evaluator. **Write this first**, T1 needs the same logic in TS and you are
   the reference implementation. Parse with `ast.parse(expr, mode="eval")`, walk the tree, allow
   only: `BinOp` (+ - * / ** %), `UnaryOp`, `Compare`, `IfExp`, `Call` restricted to a whitelist
   (`abs min max sqrt exp log sin cos tan floor ceil round`), `Name` restricted to `x` + declared
   param ids, and `Constant`. Reject everything else. **No `eval`, no `exec`, no `compile`.**
2. `ai/client.py` — one `anthropic.Anthropic()` instance
3. `ai/prompts/composer.py` — the system prompt: the schema, the bar, and **one complete worked
   example**. The example does more work than any amount of instruction.
4. `ai/composer.py` — `generate_spec(concept) -> LabSpec` via structured output against T3's
   Pydantic model, then validate the feedback-loop rule and re-ask once if it fails
5. `sim/runner.py` — `evaluate(spec, params) -> dict[str, float]`, used to resolve predictions

**Model config** (see `09-claude-api-notes.md` — these are 400s if you get them wrong):
```python
client.messages.parse(
    model="claude-opus-5",
    max_tokens=8000,
    thinking={"type": "adaptive"},
    output_config={"effort": "high", "format": <LabSpec schema>},
    system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
    messages=[{"role": "user", "content": f"<concept>{concept}</concept>"}],
)
```
No `temperature`. No `budget_tokens`. Check `stop_reason == "refusal"` before reading content.

**Iterate in a REPL, not through curl.** You need no server to do your job.

### T3 — API & Storage · `services/api/app/`

1. `schemas/lab_spec.py` + `schemas/api.py` — **ship this in the first 15 minutes.** Both other
   lanes are blocked on the shape, nothing else.
2. `main.py` — FastAPI app, CORS allowing `http://localhost:5173`
3. `store.py` — `sqlite3`, the four tables above, WAL on, the repository functions
4. `api/routes/labs.py` — the five endpoints, calling T2's functions
5. `core/errors.py` — one exception handler returning `{ "error": { code, message } }`

**Return a hardcoded spec from `POST /api/labs` until T2's generator lands.** T1 then develops
against a real endpoint from the start, and the swap is one line.

For the MVP you own `migrations/` and `models/` as **empty folders** — no Alembic, no SQLAlchemy.
Leave them for later.

---

## Order of operations

```
0:00   All three: read this doc. Agree the contract. Don't discuss anything else.
0:15   T3 pushes schemas + a hardcoded POST /api/labs.
       ↳ T1 and T2 are now unblocked and independent.
0:45   T1 has a curve responding to a slider.
       T2 has generate_spec working in a REPL.
       T3 has SQLite persistence + the other four endpoints.
1:15   INTEGRATION 1 — T3 wires in T2's generator. T1 points at the real API.
       Type a concept, get a real lab. This is the demo-able moment; stop and check it.
1:45   Predict flow end to end.
2:15   Quiz end to end.
```

If you fall behind, cut in this order: quiz → prediction reveal polish → persistence. **Never cut
the knob.** A canvas that doesn't respond to input is not this product.

---

## Done

Type *"why does adding lanes to a highway not fix traffic"* and:

1. A titled canvas appears with a curve and one or more labelled knobs.
2. Dragging a knob moves the curve immediately — no lag, no stutter.
3. A read-out shows a number that changes with the knob.
4. The prediction freezes the lab, takes a guess, and reveals the answer with an explanation.
5. Three questions, a score.
6. Reload the page — the lab is still there.
7. **Then type *"how does compound interest actually work"* and get a different, correct lab with
   no code change.** That last step is the whole test. If it needs new code, the generality is
   fake and we have built a demo rather than a product.
