import type { DepthLadderConfig } from "./schema.js";

/**
 * The matching engine behind the ladder. No canvas, no DOM.
 *
 * Deterministic: no randomness anywhere, which is the point of pairing this renderer with
 * `market-tape`. One is a path through time, the other a structure at an instant, and the same
 * compile-once / draw-many machinery has to serve both.
 *
 * Depth decays away from the touch, so each extra lot fills at a worse price AND the levels it
 * reaches are thinner. Cost therefore grows faster than size — that is a property of the shape,
 * not a number anyone typed in.
 */

export interface Book {
  n: number;
  /** Ask price at each level, ascending from the touch. */
  px: Float64Array;
  /** Bid price at each level, descending from the touch. */
  bidPx: Float64Array;
  /** Resting size before the order. */
  base: Float64Array;
  /** How much of each level the order consumed. */
  eaten: Float64Array;
  maxQty: number;
  bestAsk: number;
  bestBid: number;
  filled: number;
  notional: number;
  avgFill: number;
  slippageBps: number;
  levelsUsed: number;
  fillRate: number;
}

export function buildBook(
  cfg: DepthLadderConfig,
  params: Readonly<Record<string, number>>,
): Book {
  const n = cfg.levels;
  const num = (name: string | undefined, fallback: number) => {
    if (!name) return fallback;
    const v = params[name];
    return Number.isFinite(v) ? (v as number) : fallback;
  };

  const depth = Math.max(0.01, num(cfg.depth_param, 1));
  const size = Math.max(0, num(cfg.size_param, 0));
  const slices = Math.max(1, Math.round(num(cfg.slices_param, 1)));

  const bestAsk = cfg.mid + (cfg.spread_ticks / 2) * cfg.tick;
  const bestBid = cfg.mid - (cfg.spread_ticks / 2) * cfg.tick;

  const px = new Float64Array(n);
  const bidPx = new Float64Array(n);
  const base = new Float64Array(n);
  const rest = new Float64Array(n);
  const eaten = new Float64Array(n);

  let maxQty = 1;
  for (let k = 0; k < n; k++) {
    const q = cfg.base_qty * depth * Math.exp(-k / (16 * cfg.shape));
    base[k] = q;
    rest[k] = q;
    px[k] = bestAsk + k * cfg.tick;
    bidPx[k] = bestBid - k * cfg.tick;
    if (q > maxQty) maxQty = q;
  }

  const per = size / slices;
  let filled = 0, notional = 0;

  for (let s = 0; s < slices; s++) {
    let want = per;
    for (let k = 0; k < n && want > 1e-9; k++) {
      const take = Math.min(want, rest[k]!);
      if (take <= 0) continue;
      rest[k] = rest[k]! - take;
      eaten[k] = eaten[k]! + take;
      filled += take;
      notional += take * px[k]!;
      want -= take;
    }
    // The book heals between slices. This is why patience buys liquidity.
    if (s < slices - 1) {
      for (let k = 0; k < n; k++) {
        rest[k] = rest[k]! + (base[k]! - rest[k]!) * cfg.refill;
        eaten[k] = base[k]! - rest[k]!;
      }
    }
  }

  let levelsUsed = 0;
  for (let k = 0; k < n; k++) if (eaten[k]! > 1e-6) levelsUsed++;

  const avgFill = filled > 0 ? notional / filled : bestAsk;

  return {
    n, px, bidPx, base, eaten, maxQty, bestAsk, bestBid,
    filled, notional, avgFill,
    slippageBps: ((avgFill - bestAsk) / bestAsk) * 10000,
    levelsUsed,
    fillRate: size > 0 ? Math.min(1, filled / size) : 1,
  };
}

/**
 * One-entry memo, for the same reason as the tape: `derive` runs at ~10Hz and `draw` at 60Hz
 * against identical knob values.
 */
let memoKey = "";
let memoBook: Book | null = null;

export function bookFor(
  cfg: DepthLadderConfig,
  params: Readonly<Record<string, number>>,
): Book {
  const key = [
    cfg.levels, cfg.tick, cfg.mid, cfg.base_qty, cfg.spread_ticks, cfg.refill, cfg.shape,
    params[cfg.size_param],
    cfg.depth_param ? params[cfg.depth_param] : 0,
    cfg.slices_param ? params[cfg.slices_param] : 0,
  ].join("|");

  if (key !== memoKey || !memoBook) {
    memoBook = buildBook(cfg, params);
    memoKey = key;
  }
  return memoBook;
}
