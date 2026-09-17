# Node: function-plot

**Status:** working, verified by `npm test`. This is the reference node — read it before writing
yours, and copy its `compile`/`draw` split.

## What it draws

One to three curves over a shared x/y axis pair, with a recessive grid, human-readable ticks, and
a direct label at the right end of each curve. Each curve is an arithmetic expression in `x` and
the lab's knobs, sampled 260 times across the x domain every frame.

## What class of concepts it fits

Anything where one quantity depends continuously on another: trade-offs, response curves,
saturation, diminishing returns, anything with a knee, threshold, or asymptote. It is also the
right choice for "here is what you expect vs here is what actually happens" — two series, one of
which is the intuition that fails.

It is the **fallback node**: when generation degrades or an archetype is unavailable, a lab can
always be expressed as a curve. That is why it was built first.

## Config

| Field | Type | Bounds | Meaning |
|---|---|---|---|
| `x_label` | string | 1–24 chars | x axis title |
| `y_label` | string | 1–24 chars | y axis title |
| `x_domain` | `[number, number]` | increasing, finite | sampling range |
| `y_domain` | `[number, number]` | increasing, finite | **fixed for the lab's life** |
| `series` | array | 1–3 | the curves |
| `series[].label` | string | 1–24 chars | shown as the direct label |
| `series[].expr` | string | ≤ 400 chars | arithmetic in `x` + param ids |
| `series[].color` | enum | `series-1..3` | assigned in order, never cycled |
| `series[].style` | enum | `line` \| `dashed` | dashed reads as "hypothetical" |

## Interactions

None directly on the canvas yet — all interaction is through the knob panel. A future addition
worth making: scrub along x with a crosshair read-out, and drag a control point to write a param.

## What makes a good lab in this grammar

- **Two series beat one.** The strongest pattern is "what people expect" (dashed) against "what
  happens" (solid). The gap between them *is* the lesson, and it is visible without reading.
- **The y domain has to fit the whole knob range**, not just the default. Because the axis never
  rescales, a domain chosen for one configuration puts the curve off-screen for others. This is
  the single most common way to generate a broken-looking lab.
- **Let a curve leave the top of the frame if that is the point.** The fixture's exponential does
  exactly that, and it teaches more than a clamped version would. `withFrameClip` stops it
  painting over the axes.
- **Degenerate configurations to avoid:** an expression that ignores `x` (draws a flat line —
  `analyze` warns), a knob no expression reads (inert — the parser warns), and a y domain more
  than ~50× the visible variation (the curve becomes a flat line near an edge).

## Performance notes

260 samples × 3 series = 780 expression evaluations per frame, which is comfortable. The two
things that would break it, both avoided here:

- Building a scope object per sample instead of mutating one (780 allocations/frame → GC sawtooth).
- Re-parsing expressions in `draw` instead of `compile`.

Above roughly 2000 samples per series, switch to decimating the sample count to the pixel width —
there is no point evaluating more samples than there are columns of pixels.

## Accessibility

Every series carries a visible direct label. This is **required**, not cosmetic: the validated
palette puts light-mode `series-3` at 2.74:1 against the surface, below the 3:1 bar, and the
direct label is the documented relief so identity never rests on colour alone.

## Worked example

`fixture.ts` — bacterial growth against a carrying capacity. It teaches that growth *rate* and
growth *ceiling* are different things: pushing the rate knob to maximum barely moves the 24-hour
population, because the colony has already saturated. The dashed unbounded curve is the intuition
being corrected.
