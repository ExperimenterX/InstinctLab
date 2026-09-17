# market-tape

**What it draws.** Two stacked panes over one bar index: a price path on a log scale, and the
equity of a rule acting on that path underneath. Candles carry a synthetic intrabar range,
triangles mark entries and exits, and a dashed horizontal line marks the stop — which the learner
can drag.

**What it teaches.** Path dependence. The outcome of a rule applied to a random walk is not a
function of where the walk ended up; it depends on the order in which it got there. Any concept
where "the average is fine but the path kills you" fits this grammar.

## Config

| field | meaning |
|---|---|
| `bars` | how many steps to simulate and reveal (20–1024) |
| `seed` | seeds the noise tape — **fixed in the spec, never derived from a knob** |
| `stop_param` | knob giving stop distance, in average bar ranges |
| `vol_param` | knob giving per-bar volatility, in percent |
| `drift_param` | optional knob giving per-bar drift, in basis points |
| `target_r` | profit target as a multiple of the stop distance (fixed) |
| `cost_bps` | cost paid on entry and again on exit (fixed) |
| `note` | one short legend line above the chart |

## Derived names

`net_pnl`, `stop_rate`, `round_trips`, `drawdown`, `final_price`, `gross_edge`.

These come from the same integration the canvas draws. There is no closed form for "how often did
*this* path tag a stop 0.75% away", and a plausible approximation would put a number on screen
that contradicts the picture beside it.

## The noise tape

Every random draw is made once, from `seed`, into an array the knobs never touch. A path is a pure
function of `(tape, params)`, so turning volatility up scales the same wiggles rather than rolling
new ones.

This is not an optimisation. Without it, moving a knob hands the learner a different market and
they cannot separate their own intervention from luck, which is the difference between a lab and a
slot machine. If you add a knob here, make sure it feeds the integration and not the tape.

## Honesty

Everything is simulated. The canvas carries a permanent "simulated — not market data" line, and it
is not dismissible: a picture shaped like a price chart will be read as one. Nodes using this
renderer must describe mechanisms, never recommend actions.
