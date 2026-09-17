import type { ConceptNode } from "../types.js";

/**
 * Concept node: stop-loss placement.
 *
 * The teaching angle is the thing almost everyone gets wrong about stops. People pick a stop
 * distance in money ("I'll risk 1%") and treat it as a risk setting. It is not. It is a bet
 * about noise: a stop inside one bar's typical range gets tagged by the market's ordinary
 * jitter, long before any edge has time to compound.
 *
 * So the lab puts the market and the equity curve on top of each other and lets the learner
 * drag the stop line itself. The market is held fixed by a seeded noise tape, so moving the
 * stop changes one thing and only one thing. Watching a rising market produce a falling equity
 * curve is the whole lesson, and it is a picture rather than a claim.
 */
export const stopLossNode: ConceptNode = {
  id: "stop-loss",
  title: "Stops and Noise",
  domain: "finance",
  summary:
    "Why a genuinely profitable edge can still lose money when the stop is set too close.",

  notes: `
Collected from the standard barrier-crossing result plus the failure mode retail traders
actually hit.

Key facts the lab encodes:
  - For a stop/target bracket on a near-driftless path, P(target first) ~= stop / (stop + target).
    Expectancy before costs is therefore ~0 regardless of the risk-reward ratio.
  - Expected bars to touch either barrier ~= (stop * target) / sigma^2. Halving the stop roughly
    quarters the holding time, so the trade count — and the cost — explodes.
  - Costs are paid per round trip, so churn converts a fair game into a reliably negative one.
  - Widening the stop gives drift time to accumulate inside the bracket, which is what flips the
    sign. At the shipped defaults: -22.6% at 0.5 ATR, -3.6% at 1 ATR, +39.3% at 4 ATR, in the
    same market.

Deliberately left out: position sizing, trailing stops, and multiple simultaneous positions. All
three are real and all three would blur the single mechanism. Sizing in particular deserves its
own node — it is the natural sequel, since "stop distance" and "risk per trade" are independent
choices that people routinely conflate.

Renderer: market-tape. The stop line is draggable, so the learner sets the distance by eye
against the size of the bars. That is the judgement being taught; the slider teaches less.

Honesty: every number is simulated from a seeded generator. This is a lab about a mechanism, not
a backtest, and nothing here is advice. The canvas carries a permanent "simulated" chip.
`.trim(),

  spec: {
    title: "Stops and Noise",
    caption: "The market rises. Drag the stop and watch your equity.",
    teaching_angle:
      "A stop inside one bar of volatility is a bet against noise — the path taps it long before the edge has time to pay.",
    params: [
      {
        id: "stop_atr",
        label: "Stop distance",
        unit: "ATR",
        min: 0.25,
        max: 5,
        step: 0.25,
        default: 1,
        explain: "How far below entry the stop sits, in average bar ranges",
      },
      {
        id: "vol",
        label: "Volatility",
        unit: "%/bar",
        min: 0.25,
        max: 5,
        step: 0.25,
        default: 1.5,
        explain: "Typical size of one bar's move",
      },
      {
        id: "drift",
        label: "Your edge",
        unit: "bps",
        min: -5,
        max: 15,
        step: 1,
        default: 3,
        explain: "Expected drift per bar, before costs",
      },
    ],
    observables: [
      {
        id: "net_pnl",
        label: "Net P&L",
        // From the renderer: there is no closed form for "how often did this path tag a stop
        // 0.75% away", and a plausible formula would contradict the picture beside it.
        expr: "net_pnl",
        format: "percent",
        precision: 1,
      },
      {
        id: "round_trips",
        label: "Round trips",
        // The mechanism in one number. 112 trades at 0.5 ATR against 7 at 4 ATR is the cost.
        expr: "round_trips",
        format: "number",
        precision: 0,
      },
    ],
    stage: {
      renderer: "market-tape",
      config: {
        bars: 240,
        seed: 4404,
        stop_param: "stop_atr",
        vol_param: "vol",
        drift_param: "drift",
        target_r: 2,
        cost_bps: 5,
        note: "red dashes = your stop · triangles = entries and exits",
      },
    },
    prediction: {
      question:
        "Edge +3 bps a bar, and the market ends 45% higher. Stop at 0.5 ATR — what is your net P&L?",
      observable_id: "net_pnl",
      at_params: { stop_atr: 0.5, vol: 1.5, drift: 3 },
      tolerance: 0.06,
      why_correct:
        "About -23%, in a market that rose. The stop sits inside one bar of noise, so it fires on jitter and pays the spread twice on each of 112 round trips.",
    },
    quiz: [
      {
        prompt:
          "Your edge is real and positive, yet the equity curve falls. What is doing the damage?",
        options: [
          "The stop is inside the noise, so it exits at random and pays costs each time",
          "The edge is too small to matter at any stop distance",
          "Volatility makes the edge negative",
          "The target is set too far away to ever be reached",
        ],
        correct_index: 0,
        why: "Same market, same edge — only the stop distance changed, and the sign of the result changed with it.",
      },
      {
        prompt:
          "You double the volatility knob but leave the stop at 1 ATR. What happens to how often you are stopped out?",
        options: [
          "Roughly unchanged, because the stop is measured in volatility",
          "It doubles, because the market moves twice as much",
          "It halves, because the stop is further away in dollars",
          "It goes to zero",
        ],
        correct_index: 0,
        why: "That is what ATR buys you. A stop quoted in dollars would be swamped; a stop quoted in volatility rescales with the market.",
      },
      {
        prompt:
          "Drag the stop from 0.5 to 4 ATR and watch the round-trip count. Why does the P&L flip positive?",
        options: [
          "Far fewer trades, so far less cost, and drift has time to accumulate",
          "The win rate rises above 50%",
          "A wider stop reduces the risk on each trade",
          "The market becomes less volatile",
        ],
        correct_index: 0,
        why: "112 round trips become 7. The bracket was always near a fair game; the costs were the whole loss.",
      },
    ],
  },
};
