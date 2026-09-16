> ⚠️ **Not the current scope.** We are building the MVP first — see [`MVP.md`](MVP.md),
> which overrides this document wherever they disagree. The product thinking here still stands;
> the scope and stack details do not.

# 12 — Postgres schema

Owner: **T3**. Alembic migrations in `services/api/migrations/`.

---

## Shape of the problem

Seven tables. The design pressure comes from two places:

- **The transcript is append-only and high-volume.** It is the raw material for the personalised
  quiz, so it must be complete — but it is also written while the learner's hand is on a knob, so
  the write path has to be cheap.
- **Specs are large JSON documents** (up to ~128KB) that are read whole and never queried by their
  internals. That makes `jsonb` right for them, and a normalised spec schema badly wrong.

## Tables

```sql
users
  id              uuid primary key default gen_random_uuid()
  email           citext unique not null
  password_hash   text not null            -- argon2. never plaintext, never logged.
  display_name    text
  created_at      timestamptz not null default now()
  last_login_at   timestamptz

refresh_tokens
  id              uuid primary key default gen_random_uuid()
  user_id         uuid not null references users(id) on delete cascade
  token_hash      text not null            -- hashed, so a db leak can't be replayed
  expires_at      timestamptz not null
  revoked_at      timestamptz
  created_at      timestamptz not null default now()
  -- index (user_id), index (token_hash)

lab_sessions
  id              uuid primary key default gen_random_uuid()
  user_id         uuid not null references users(id) on delete cascade
  concept         text not null            -- the learner's raw input, verbatim
  status          text not null            -- planning|composing|ready|assessing|complete|failed
  archetype       text                     -- denormalised from the spec, for analytics
  seed            bigint not null          -- makes the lab reproducible; prediction replay needs it
  plan            jsonb
  spec            jsonb                    -- the LabSpec
  phase           text not null default 'see'
  beat_id         text
  completed_beats text[] not null default '{}'
  rev             integer not null default 0   -- optimistic concurrency
  parent_session_id uuid references lab_sessions(id)  -- set on a remix
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
  -- index (user_id, created_at desc)      -- powers GET /me/labs
  -- index (status) where status <> 'complete'

lab_events                                 -- the transcript. append-only, never updated.
  id              bigserial primary key
  session_id      uuid not null references lab_sessions(id) on delete cascade
  seq             integer not null         -- per-session ordering
  kind            text not null            -- param.change, clamp.hit, notable.reached, ...
  payload         jsonb not null
  at_sim_time     double precision
  frame           integer
  created_at      timestamptz not null default now()
  -- unique (session_id, seq)
  -- index (session_id, seq)

predictions
  id              uuid primary key default gen_random_uuid()
  session_id      uuid not null references lab_sessions(id) on delete cascade
  prediction_id   text not null            -- the id from the spec
  answer          jsonb not null
  verdict         text not null            -- correct|close|wrong
  actual_value    double precision
  delta           double precision
  committed_at    timestamptz not null default now()
  -- unique (session_id, prediction_id)    -- one commit per prediction. enforces irreversibility.

assessments
  id              uuid primary key default gen_random_uuid()
  session_id      uuid not null references lab_sessions(id) on delete cascade
  items           jsonb not null           -- returned to the client
  answer_key      jsonb not null           -- NEVER returned. see the note below.
  generated_from  jsonb not null
  score           double precision
  passed          boolean
  mastery         jsonb
  graded_at       timestamptz
  created_at      timestamptz not null default now()

recall_cards
  id              uuid primary key default gen_random_uuid()
  session_id      uuid not null references lab_sessions(id) on delete cascade
  title           text not null
  big_idea        text not null
  key_knob        jsonb not null
  image_url       text                     -- canvas snapshot; object storage, not a bytea column
  retention_question jsonb not null
  created_at      timestamptz not null default now()
```

## The five things that matter

**1. `answer_key` must be unreachable from a response model.**
It sits on the same row as `items`, so a careless `model_config = ConfigDict(from_attributes=True)`
over the whole ORM object leaks the answers. Two defences, use both: an explicit response model
that lists its fields, and a repository read that does not select the column unless grading.
Worth a test that asserts the string never appears in a `/quiz` response body.

**2. `rev` is optimistic concurrency, and it needs the right SQL.**
```sql
UPDATE lab_sessions SET phase = :phase, rev = rev + 1, updated_at = now()
WHERE id = :id AND rev = :expected_rev
```
Zero rows updated means someone else wrote first → return **409** and let the client refetch.
Read-then-write in Python without this clause silently loses one of two concurrent updates.

**3. `lab_events` is insert-only and gets big.**
`executemany` the batch; never read the existing rows to append. Generate `seq` server-side from a
per-session counter — a client-supplied `seq` will collide on retry. If a session can run long,
plan to partition by month or archive completed sessions; the table grows fastest of the seven and
is the one nobody notices until it is large.

**4. Use `citext` for email, and add the extension in the first migration.**
Otherwise `Alice@x.com` and `alice@x.com` become two accounts, which surfaces as a login bug that
is confusing to debug and embarrassing to explain. Requires
`CREATE EXTENSION IF NOT EXISTS citext;` (and `pgcrypto` for `gen_random_uuid()`).

**5. `ON DELETE CASCADE` everywhere off `users` and `lab_sessions`.**
Deleting a user must actually remove their data in one statement — both because it is correct and
because you will be asked for it.

## Retention

Sessions are working artifacts; recall cards are the point of the product.

- Purge `lab_events` for sessions older than ~30 days. The digest has already been folded into
  `assessments.generated_from`, so nothing of value is lost.
- Keep `lab_sessions` and `recall_cards` for the life of the account — the recap URL is what
  someone opens tomorrow, and tomorrow is the whole product.

## Sequencing for T3

1. `users` + `refresh_tokens` — unblocks auth
2. `lab_sessions` — unblocks everything else
3. `lab_events`
4. `predictions`, `assessments`, `recall_cards`

One migration per step, so a mistake is one `alembic downgrade` rather than a rebuild.
