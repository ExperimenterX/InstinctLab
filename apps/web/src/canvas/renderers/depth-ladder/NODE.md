# depth-ladder

**What it draws.** A two-sided ladder of resting quantity over a sorted price axis: asks above the
mid, bids below, bar length is size. An amber overlay shows what an incoming order consumed, and
two horizontal lines mark the quote and the resulting average fill.

**What it teaches.** That a quoted price comes with a quantity, and that consuming more of a
finite resource means reaching worse levels. The gap between the two lines is the cost, and it is
a picture rather than a number.

Deliberately the least like `market-tape`: no time axis, no randomness, discrete levels, a
structure at an instant. Two finance renderers that both drew line charts would prove nothing.

## Config

| field | meaning |
|---|---|
| `levels` | levels per side (4–40) |
| `tick` | price increment between levels |
| `mid` | reference price the book is built around |
| `base_qty` | resting quantity at the touch, before the liquidity multiplier |
| `size_param` | knob giving how much to buy |
| `depth_param` | optional knob multiplying resting size at every level |
| `slices_param` | optional knob splitting the order into pieces |
| `spread_ticks` | distance between best bid and best ask (fixed) |
| `refill` | fraction of consumed size that returns between slices |
| `shape` | how fast depth thins away from the touch |
| `note` | one short legend line above the ladder |

## Derived names

`avg_fill`, `slippage_bps`, `levels_used`, `fill_rate`, `best_ask`, `cost_paid`.

Computed by the same walk the canvas draws, for the same reason as `market-tape`: an analytic
slippage estimate would disagree with the highlighted levels next to it.

## Interaction

Clicking an ask level sets `size_param` to the cumulative resting quantity down to that level.
Choosing a depth and letting the price follow is closer to the actual mechanism than dragging a
size slider, and it is what makes the superlinear cost land.

## Honesty

A synthetic book, not a venue feed, and the canvas says so. No queue position, no hidden orders,
and no other participant reacting to your slices — that last omission is the significant one and
belongs to a separate node.
