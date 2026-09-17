import type { ConceptNode } from "../types.js";

/**
 * Concept node: market impact.
 *
 * The teaching angle is the gap between the price you see and the price you get. People read a
 * quote as "the price", but a quote is only the top of a queue, and it comes with a quantity.
 * Your order walks down the queue and you pay the average of everything you consumed — so the
 * price is partly a function of your own size.
 *
 * The lab makes that a gesture: click an ask level to buy everything down to it, and watch the
 * fill line detach from the quote line. The distance between those two lines is the cost.
 */
export const orderBookNode: ConceptNode = {
  id: "order-book",
  title: "Walking the Book",
  domain: "finance",
  summary:
    "Why a large order fills at a worse price than the one that was quoted.",

  notes: `
Collected from standard microstructure, kept to the part a learner can feel.

Key facts the lab encodes:
  - A quote is a price AND a quantity. Beyond that quantity there is a different, worse price.
  - Executing size S against depth that thins with distance costs roughly O(S^2) in total, so
    slippage in basis points grows roughly linearly with size. At the shipped defaults: 100 lots
    costs ~2 bps, 800 lots costs ~40 bps. Eight times the size, twenty times the cost.
  - Splitting an order lets the book replenish between pieces, which is why execution algorithms
    exist at all. Ten slices at the default refill rate cuts the cost by roughly an order of
    magnitude.
  - In a thin book your own order is most of the volume, so it is most of the price.

Deliberately left out: adverse selection, queue position, hidden and iceberg orders, and the fact
that other participants react to your slices. The last one is the biggest simplification — a real
book fights back. It is also a whole second node, and mixing it in here would make it impossible
to see the pure size effect.

Renderer: depth-ladder. Deliberately the least like the market-tape node: no time axis, no
randomness, discrete levels, a structure at an instant. Two finance nodes that both turned out to
be line charts would prove nothing about the renderer layer.

Honesty: a synthetic book, not a venue feed. Nothing here is advice or an execution recommendation.
`.trim(),

  spec: {
    title: "Walking the Book",
    caption: "The quote is the top of a queue. Buy more and see what you pay.",
    teaching_angle:
      "Your size walks down the ladder and you pay the average of everything you consumed, so price is partly a function of your own order.",
    params: [
      {
        id: "size",
        label: "Order size",
        unit: "lots",
        min: 10,
        max: 1000,
        step: 10,
        default: 100,
        explain: "How much you are trying to buy right now",
      },
      {
        id: "liquidity",
        label: "Liquidity",
        unit: "x",
        min: 0.2,
        max: 3,
        step: 0.1,
        default: 1,
        explain: "How much size is resting at each price level",
      },
      {
        id: "slices",
        label: "Slices",
        min: 1,
        max: 20,
        step: 1,
        default: 1,
        explain: "Split the order into pieces so the book can refill between them",
      },
    ],
    observables: [
      {
        id: "slippage",
        label: "Slippage (bps)",
        // From the renderer: it is the same walk the canvas draws, so the number and the
        // highlighted levels can never disagree.
        expr: "slippage_bps",
        format: "number",
        precision: 1,
      },
      {
        id: "avg_fill",
        label: "Avg fill",
        expr: "avg_fill",
        format: "currency",
        precision: 3,
      },
    ],
    stage: {
      renderer: "depth-ladder",
      config: {
        levels: 24,
        tick: 0.05,
        mid: 100,
        base_qty: 60,
        size_param: "size",
        depth_param: "liquidity",
        slices_param: "slices",
        spread_ticks: 2,
        refill: 0.3,
        shape: 1,
        note: "amber = the size your order consumed",
      },
    },
    prediction: {
      question:
        "At 100 lots you paid about 2 bps. One single order for 800 lots — how many bps?",
      observable_id: "slippage",
      at_params: { size: 800, liquidity: 1, slices: 1 },
      tolerance: 12,
      why_correct:
        "About 40, not 16. Each extra lot fills a level deeper and the deeper levels are thinner, so the cost grows roughly with the square of size.",
    },
    quiz: [
      {
        prompt: "You double your order size. What happens to slippage in basis points?",
        options: [
          "It roughly doubles, because you walk twice as far down a thinning book",
          "It stays the same, because the book is the same",
          "It halves, because you get a volume discount",
          "It is unpredictable",
        ],
        correct_index: 0,
        why: "Total cost grows with the square of size, so cost per lot — the bps number — grows roughly linearly with it.",
      },
      {
        prompt: "Why does splitting one order into ten slices reduce the cost so much?",
        options: [
          "The book refills between slices, so each piece buys near the touch",
          "Smaller orders get better prices by rule",
          "It avoids the spread entirely",
          "Exchanges charge less for small orders",
        ],
        correct_index: 0,
        why: "Each slice faces a replenished book instead of the hole the previous one dug.",
      },
      {
        prompt: "Set liquidity to 0.2 and keep the size. What does the fill line do, and why?",
        options: [
          "It drops much further from the quote — your order is now most of the volume",
          "Nothing, because liquidity only affects the bids",
          "It moves closer to the quote, because there is less competition",
          "It disappears, because the order cannot fill",
        ],
        correct_index: 0,
        why: "Same order against a thinner book means more levels consumed, so a worse average.",
      },
    ],
  },
};
