# 09 — Claude API notes

Owner: **BACKEND**. Anyone touching a model call reads this first.

The API surface moved. Several patterns that are still common in tutorials and in model training
data are now **hard 400 errors** on the models we use. This page is the short version; the
authoritative source is the `claude-api` skill — invoke it before writing a model call.

## Models

| Role | Model | Why |
|---|---|---|
| Composer | `claude-opus-5` | Authoring a correct, coupled simulation is the hardest call we make |
| Planner | `claude-sonnet-5` | One structured decision, gates first-visual latency |
| Coach | `claude-sonnet-5` | Called many times per session, ≤2s budget |
| Grader | `claude-sonnet-5` | Mostly deterministic; the model only handles `explain` items |

Exact IDs, no date suffixes. Overridable via `.env`.

## Forbidden request fields (each is a 400, not a warning)

```ts
temperature, top_p, top_k          // removed on these models — steer with the prompt
thinking: { budget_tokens: N }     // removed — use output_config.effort
messages: [..., { role: "assistant", content: "{" }]   // trailing prefill removed
```

There is **no temperature knob any more.** If a stage needs output variety, vary the prompt.

`thinking: { type: "disabled" }` is legal only at `effort: "high"` or below — pairing it with
`xhigh`/`max` is a 400, and it's validated per request, so a later call that raises effort while
thinking is still disabled fails even though earlier ones passed.

## Thinking and effort

```ts
thinking: { type: "adaptive" }                    // on by default on Opus 5
output_config: { effort: "xhigh" }                // inside output_config, NOT top-level
```

`effort` is `low | medium | high | xhigh | max`, default `high`. Our per-stage settings live in
`ai-core/src/models.ts` with the reasoning attached.

**`max_tokens` caps thinking *plus* response text.** Thinking being on by default means a budget
sized around the visible answer will truncate mid-document. Budget generously: 32k for the
composer, and stream anything above ~16k (`.stream()` + `.finalMessage()`, never a hand-rolled
promise around `.on()`).

Raw reasoning is never returned. `thinking.display` defaults to `"omitted"` — thinking blocks
arrive with empty text, which looks like a long pause to a streaming UI. We don't surface
reasoning to learners, so the default is right; don't set `"summarized"` without a reason.

## Structured output — the schema IS the contract

This is the single biggest simplification available to us. API's Zod schemas become the model's
output format directly:

```ts
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const res = await client.messages.parse({
  model: MODELS.composer,
  max_tokens: MAX_TOKENS.composer,
  thinking: { type: "adaptive" },
  output_config: { effort: "xhigh", format: zodOutputFormat(ComposeCoreSchema) },
  system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: userTurn }],
});
if (res.stop_reason === "refusal") { /* handle as content, not as an error */ }
const core = res.parsed_output;   // NULLABLE — guard it
```

One definition now validates the model, the API boundary, and the client. Most of what would have
been a parse-and-repair loop is gone.

**Three limits to internalise:**

1. **`.min()` / `.max()` / length constraints are NOT enforced by the decode.** The SDK strips
   them from the schema it sends and validates client-side. Constrained decoding guarantees the
   *shape*, never the *limits* — so `validateLabSpec` and `LIMITS` remain mandatory (N3).
2. **No recursive schemas.** `LabSpec` isn't recursive. Keep it that way.
3. **Incompatible with citations and with a prefill.** Neither is something we want.

`additionalProperties: false` is required on every object; `zodOutputFormat` handles it.

## Prompt caching

Render order is `tools` → `system` → `messages`, and caching is a **prefix match**: one changed
byte invalidates everything after it.

```
[stable]   DSL rules · archetype manifest · worked example · limits   ← cache_control here
[volatile] the learner's concept · session hints                      ← user turn, after the break
```

Minimum cacheable prefix on Opus 5 is **512 tokens** (down from 1024 on 4.8), so our system
prompt comfortably qualifies. Cache reads cost ~0.1× and writes ~1.25×, so break-even is the
second call — and a single session makes at least four.

**Never interpolate a timestamp, session id, or the concept into the system prompt.** That gives
every request a unique prefix and silently disables caching product-wide.

Verify, don't assume: `usage.cache_read_input_tokens` must be non-zero on the second call of a
session. Note `usage.input_tokens` is only the *uncached remainder* — total prompt size is
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, which matters for
`guards/budget.ts`.

## Refusals are content, not exceptions

A declined request returns **HTTP 200** with `stop_reason: "refusal"` and empty or partial
`content`. Code that reads `content[0]` unconditionally breaks on one.

```ts
if (res.stop_reason === "refusal") { /* offer the underlying concept — doc 08 */ }
```

For this product a refusal is usually a false positive on a legitimate dual-use mechanism, and
the product answer is in doc 08's adversarial table: decline the *lab*, offer the concept.

Opting into server-side `fallbacks` is available if refusals show up in practice; don't add it
speculatively.

## Prompt style for these models

They follow the system prompt closely, which inverts several older habits:

| Don't | Do |
|---|---|
| `CRITICAL: You MUST author a feedback loop` | `The learner's input must feed back into the dynamics.` |
| A wall of `NEVER` / `avoid` lines | State the target and give the reason |
| Three partial examples | One complete worked example (doc 03 §10) |
| "Double-check your work before responding" | Nothing — these models self-verify; instructing it causes over-verification |
| Lower `effort` to shorten output | Add a conciseness instruction; effort doesn't reliably shorten visible text |

The `COMPOSER_BAR`, `PLANNER_BAR`, `COACH_VOICE`, and `QUIZ_BAR` constants in `ai-core/prompts`
are written in the intended register. Match them.

## Streaming

`client.messages.stream()` + `await stream.finalMessage()`. Use `stream.on("text", …)` for
deltas. Don't wrap `.on()` events in a promise — the SDK handles completion, error, and abort.

## Where the API key lives

`ai-core` only, via the zero-arg `new Anthropic()` constructor (which resolves
`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or an `ant auth login` profile). No other package
reads it, and it never reaches a client bundle. API owns keeping that boundary intact.
