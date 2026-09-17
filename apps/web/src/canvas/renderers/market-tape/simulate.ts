import type { MarketTapeConfig } from "./schema.js";

/**
 * The numbers behind the tape. No canvas, no DOM — so it can be unit-tested and so `derive`
 * and `draw` are guaranteed to be looking at the same path rather than two approximations.
 *
 * THE NOISE TAPE is the load-bearing idea. Every random draw is made once, from the config's
 * fixed seed, into an array that the knobs never touch. A path is then a pure function of
 * (tape, params): turning volatility up scales the same wiggles instead of rolling new ones.
 *
 * Without that, dragging a knob would hand the learner a different market, and they could not
 * tell their own intervention apart from luck — which is the difference between a lab and a
 * slot machine.
 */

export const MAX_BARS = 1024;

export interface Path {
  n: number;
  /** Open, high, low, close. High and low carry a synthetic intrabar range. */
  o: Float64Array;
  h: Float64Array;
  l: Float64Array;
  c: Float64Array;
  /** Cumulative return, marked to market each bar. */
  eq: Float64Array;
  /** -1 stopped out, +1 entered, +2 target hit, 0 nothing. */
  fill: Float64Array;
  priceLo: number;
  priceHi: number;
  eqLo: number;
  eqHi: number;
  stops: number;
  wins: number;
  drawdown: number;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller standard normals, two per bar: one for the close, one for the intrabar range. */
const tapeCache = new Map<string, Float64Array>();
function noiseTape(seed: number, bars: number): Float64Array {
  const key = `${seed}|${bars}`;
  const hit = tapeCache.get(key);
  if (hit) return hit;

  const out = new Float64Array(bars * 2);
  const rnd = mulberry32(seed);
  for (let i = 0; i < out.length; i += 2) {
    let u = rnd();
    if (u < 1e-12) u = 1e-12;
    const r = Math.sqrt(-2 * Math.log(u));
    const th = 2 * Math.PI * rnd();
    out[i] = r * Math.cos(th);
    out[i + 1] = r * Math.sin(th);
  }
  if (tapeCache.size > 8) tapeCache.clear();
  tapeCache.set(key, out);
  return out;
}

export interface PathInputs {
  bars: number;
  seed: number;
  /** Per-bar volatility, as a fraction (0.015 = 1.5%). */
  sigma: number;
  /** Per-bar drift, as a fraction. */
  mu: number;
  /** Stop distance, as a fraction of price. */
  stopDist: number;
  /** Target as a multiple of the stop distance. */
  targetR: number;
  /** Cost per side, as a fraction. */
  cost: number;
}

/**
 * Geometric Brownian motion with a stop/target bracket executed over it.
 *
 * The whole path is computed in one pass rather than stepped in real time. That is what makes a
 * knob show its complete effect immediately, and it is why the prediction can be resolved
 * without waiting for anything.
 */
export function simulate(inp: PathInputs): Path {
  const n = Math.max(1, Math.min(MAX_BARS, Math.round(inp.bars)));
  const tape = noiseTape(inp.seed, n);

  const o = new Float64Array(n), h = new Float64Array(n);
  const l = new Float64Array(n), c = new Float64Array(n);
  const eq = new Float64Array(n), fill = new Float64Array(n);

  let price = 100, realized = 0, peak = 0, worst = 0;
  let pos = 0, entry = 0, stop = 0, targ = 0, stops = 0, wins = 0;
  let priceLo = Infinity, priceHi = -Infinity, eqLo = 0, eqHi = 0;

  for (let i = 0; i < n; i++) {
    const z = tape[i * 2]!;
    const z2 = tape[i * 2 + 1]!;
    const open = price;
    price = price * (1 + inp.mu + inp.sigma * z);

    // A synthetic intrabar range. Without a wick the stop could only trigger on closes, which
    // understates exactly the effect this renderer exists to show.
    const wick = Math.abs(z2) * inp.sigma * price * 0.6;
    const hi = (open > price ? open : price) + wick;
    const lo = (open < price ? open : price) - wick;

    let f = 0;
    if (pos === 0) {
      // Enter at the open; the bracket is live from the next bar.
      pos = 1;
      entry = open;
      stop = entry * (1 - inp.stopDist);
      targ = entry * (1 + inp.stopDist * inp.targetR);
      realized -= inp.cost;
      f = 1;
    } else if (lo <= stop) {
      realized += (stop - entry) / entry - inp.cost;
      pos = 0; stops++; f = -1;
    } else if (hi >= targ) {
      realized += (targ - entry) / entry - inp.cost;
      pos = 0; wins++; f = 2;
    }

    const equity = realized + (pos ? (price - entry) / entry : 0);
    if (equity > peak) peak = equity;
    if (equity - peak < worst) worst = equity - peak;

    o[i] = open; h[i] = hi; l[i] = lo; c[i] = price;
    eq[i] = equity; fill[i] = f;

    if (lo < priceLo) priceLo = lo;
    if (hi > priceHi) priceHi = hi;
    if (equity < eqLo) eqLo = equity;
    if (equity > eqHi) eqHi = equity;
  }

  // Domains are fixed here, over the whole path, never per revealed frame — an axis that
  // rescales while the learner drags hides the change they are dragging to see.
  const padP = (priceHi - priceLo) * 0.06 || 1;
  const padE = Math.max(0.02, (eqHi - eqLo) * 0.12);

  return {
    n, o, h, l, c, eq, fill,
    priceLo: priceLo - padP,
    priceHi: priceHi + padP,
    eqLo: eqLo - padE,
    eqHi: eqHi + padE,
    stops, wins, drawdown: worst,
  };
}

/** Inputs assembled from a config and the current knob positions. */
export function inputsFor(
  cfg: MarketTapeConfig,
  params: Readonly<Record<string, number>>,
): PathInputs {
  const num = (name: string | undefined, fallback: number) => {
    if (!name) return fallback;
    const v = params[name];
    return Number.isFinite(v) ? (v as number) : fallback;
  };
  const sigma = Math.max(1e-4, num(cfg.vol_param, 1.5) / 100);
  return {
    bars: cfg.bars,
    seed: cfg.seed,
    sigma,
    mu: num(cfg.drift_param, 0) / 10000,
    stopDist: Math.max(1e-4, num(cfg.stop_param, 1) * sigma),
    targetR: cfg.target_r,
    cost: cfg.cost_bps / 10000,
  };
}

/**
 * One-entry memo. `derive` runs at ~10Hz and `draw` at 60Hz against the same knob values, so
 * without this the path would be integrated seventy times a second for no reason.
 */
let memoKey = "";
let memoPath: Path | null = null;

export function pathFor(
  cfg: MarketTapeConfig,
  params: Readonly<Record<string, number>>,
): Path {
  const inp = inputsFor(cfg, params);
  const key = `${inp.bars}|${inp.seed}|${inp.sigma}|${inp.mu}|${inp.stopDist}|${inp.targetR}|${inp.cost}`;
  if (key !== memoKey || !memoPath) {
    memoPath = simulate(inp);
    memoKey = key;
  }
  return memoPath;
}
