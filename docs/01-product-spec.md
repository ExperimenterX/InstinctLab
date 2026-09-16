# 01 — Product spec

## The problem

AI explanations are ephemeral. The learner reads a good explanation, feels the click of
understanding, closes the tab, and has nothing a day later. The understanding was real but it was
*borrowed* — it lived in the text, not in the learner.

Intuition is built by **manipulating** a system and being **surprised** by it. Reading cannot
produce surprise, because reading has no consequences.

## The product

One input box. The learner types a concept. Instinct Lab returns a **playable lab**: a canvas
simulation of that concept, with knobs wired to the parts that matter, a coach that reacts to what
the learner does, and a short challenge at the end built from their own session.

## The six phases

Each phase is a `beat` in the LabSpec (doc 03 §6). The runtime advances through them; the AI
authors them; the learner can always scrub back.

### 1. SEE — *"oh, that's what it looks like"*
The canvas renders and moves before any text appears. One short caption, ≤ 12 words. The learner's
first impression of the concept is a picture, not a paragraph.
**Success:** the learner can describe what's on screen without reading anything.

### 2. INTERACT — *"I did that"*
Exactly one knob unlocks. The coach names it and nothing else. The learner moves it and the picture
responds within a frame. This single moment establishes the contract: *this thing obeys me.*
**Success:** the learner moves the knob more than once, unprompted.

### 3. EXPERIMENT — *"what if I…"*
All knobs unlock. Presets appear as named starting points (`"turn off damping"`, `"drop packet
loss to zero"`), never as answers. The coach goes quiet unless something notable happens — a
regime change, a clamp hit, a degenerate configuration. Time controls (play/pause/step/scrub)
are available.
**Success:** the learner reaches at least one state the AI flagged as `notable`.

### 4. PREDICT — *"I think it'll…"*
The sim **freezes**. A specific, falsifiable question appears with a concrete answer surface — a
slider to place a guess, a point on the canvas to click, a multiple choice, an ordering. The
learner commits. Only then does the sim resume and resolve.
**Success:** the learner commits a prediction. A wrong prediction is worth more than a right one.

### 5. UNDERSTAND — *"ohh, because…"*
The coach explains the **delta between the prediction and the outcome**, using the learner's own
numbers, on the canvas — highlighting the entity, annotating the curve. It does not restate the
concept from scratch. This is the only phase where prose is allowed to be the point, and it still
caps at ~40 words.
**Success:** the explanation references the learner's specific guess.

### 6. RECALL — *"I can do that again"*
3–5 items, generated from the session transcript: the knob they pushed to an extreme, the
prediction they missed, the regime they never visited. Item types are interactive where possible —
*"set the knobs to produce this outcome"* beats *"which of these is true"*. Ends with a **recall
card**: one image + one sentence + the one knob that mattered, saved for later review.
**Success:** ≥ 70% correct, and the recall card is saved.

## Non-goals (v1)

- Courses, curricula, learning paths. One concept, one lab.
- Accounts and social features. Sessions are shareable by URL and expire.
- Numerically authoritative simulation. Labs are **pedagogically honest, not physically exact.**
  A lab that gets the intuition right and the third decimal wrong is a success. The coach must
  never claim precision the sim doesn't have.
- Arbitrary model-authored code execution. See N3 in doc 00.

## Primary user journeys

**J1 — Cold start.** Types *"how does a Bloom filter avoid false negatives"* → sees a bit array
with hash arrows within 2.5s → toggles array size → watches false-positive rate climb → predicts
the rate at 4 hash functions → gets it wrong → coach annotates the collision → quiz asks them to
*tune* for 1% FPR.

**J2 — Stuck on a knob.** Pushes a knob to its limit, nothing changes. The runtime detects a clamp
with no observable delta and the coach volunteers: *"That knob is saturated — the bottleneck moved
to X."* Dead ends become lessons.

**J3 — Remix.** *"this is too easy"* → `POST /remix` with `intent: "harder"` → same concept, same
archetype, tighter constraints and a second coupled variable. Session history carries over.

**J4 — Return.** Opens the recap URL a day later → recall card → one-question retention check →
option to re-enter the same lab at the EXPERIMENT phase.

## Product metrics

| Metric | Definition | Target |
|---|---|---|
| Interaction depth | distinct knob changes per session | ≥ 8 |
| Prediction commit rate | sessions reaching PREDICT that commit | ≥ 80% |
| Productive surprise | committed predictions that were wrong | 30–60% |
| Quiz pass | sessions scoring ≥ 70% | ≥ 65% |
| Next-day retention | returns passing the retention check | ≥ 50% |
| Spec validity | specs passing Zod on first model attempt | ≥ 90% |

"Productive surprise" is deliberately a *band*. Near 0% means the lab is trivial; near 100% means
it's unfair or the question is ambiguous.
