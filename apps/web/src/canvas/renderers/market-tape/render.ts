import { clearSurface, niceTicks } from "../../primitives.js";
import {
  frameOf, type CanvasRenderer, type CompiledStage, type Frame, type Hit,
  type NodeAnalysis, type RenderCtx,
} from "../../types.js";
import { MarketTapeConfigSchema, type MarketTapeConfig } from "./schema.js";
import { pathFor, type Path } from "./simulate.js";
import { MARKET_TAPE_FIXTURE } from "./fixture.js";

/**
 * Price over bars, with an execution rule drawn on top of it.
 *
 * Two stacked panes share one time axis: the market on a log scale, and what the rule did to
 * your equity underneath. The horizontal stop line is draggable, and that gesture is the lesson
 * — you feel how far the stop has to sit from the noise before the edge survives.
 *
 * It is a grammar, not a chart of stocks. Nothing here knows the word "trade" beyond the
 * bracket the config asked for; a node supplies the knobs and the story.
 *
 * All values are simulated. The chip in the corner says so, permanently, because a picture that
 * looks like a price chart will be read as one.
 */

const PANE_GAP = 12;
const PRICE_FRACTION = 0.62;

interface MTCompiled extends CompiledStage {
  readonly renderer: "market-tape";
  cfg: MarketTapeConfig;
  /** Written by draw, read by hitTest — the mapping needed to invert a pointer y into a stop. */
  view: { top: number; h: number; lo: number; hi: number; ref: number } | null;
}

export const marketTapeRenderer: CanvasRenderer<MarketTapeConfig> = {
  id: "market-tape",
  label: "Market tape",
  bestFor:
    "a quantity evolving step by step under uncertainty, with a rule acting on it — prices, balances, queues; where the outcome depends on the path taken and not just the average",

  configSchema: MarketTapeConfigSchema,

  analyze(cfg, ctx): NodeAnalysis {
    const errors: string[] = [];
    const warnings: string[] = [];
    const referencedParams = new Set<string>();

    const need = (name: string | undefined, what: string, required: boolean) => {
      if (!name) {
        if (required) errors.push(`${what} is required.`);
        return;
      }
      if (!ctx.paramIds.includes(name)) {
        errors.push(`${what} "${name}" is not a declared param (have: ${ctx.paramIds.join(", ")}).`);
      } else {
        referencedParams.add(name);
      }
    };

    need(cfg.stop_param, "stop_param", true);
    need(cfg.vol_param, "vol_param", true);
    need(cfg.drift_param, "drift_param", false);

    if (!cfg.drift_param) {
      warnings.push(
        "No drift_param: with zero edge the lab can only show churn, not the contrast between a real edge and a stop that eats it.",
      );
    }
    if (cfg.cost_bps === 0) {
      warnings.push(
        "cost_bps is 0: a stop/target bracket is close to a fair game before costs, so the lesson will be much weaker.",
      );
    }

    return { errors, warnings, referencedParams };
  },

  compile(cfg): MTCompiled {
    return { renderer: "market-tape", cfg, view: null };
  },

  /**
   * Facts about the simulated path, for read-outs.
   *
   * These come from the same integration the canvas draws, not from a closed-form approximation.
   * There is no formula for "how often did this path tag a stop 0.75% away", and a plausible
   * one would put a number on screen that contradicts the picture beside it.
   */
  derivedNames() {
    return ["net_pnl", "stop_rate", "round_trips", "drawdown", "final_price", "gross_edge"];
  },

  derive(cfg, params): Record<string, number> {
    const p = pathFor(cfg, params);
    const trips = p.stops + p.wins;
    const last = p.n - 1;
    return {
      net_pnl: p.eq[last] ?? 0,
      stop_rate: trips > 0 ? p.stops / trips : 0,
      round_trips: trips,
      drawdown: p.drawdown,
      final_price: p.c[last] ?? 0,
      gross_edge: (p.c[last] ?? 100) / 100 - 1,
    };
  },

  draw(compiled, rc) {
    const c = compiled as MTCompiled;
    const { cfg } = c;
    const f = frameOf(rc.cssW, rc.cssH);
    const path = pathFor(cfg, rc.params);

    clearSurface(rc);

    const priceH = Math.round((f.h - PANE_GAP) * PRICE_FRACTION);
    const eqTop = f.top + priceH + PANE_GAP;
    const eqH = f.h - priceH - PANE_GAP;

    // The whole path, always.
    //
    // A time-based reveal was tried and removed: the canvas host only redraws when a knob moves,
    // so `rc.t` never advances and the reveal froze two bars in. Drawing everything is also the
    // better behaviour — a knob should show its complete effect at once, not leak it out over
    // the next few seconds.
    const shown = path.n;

    if (cfg.note) {
      rc.ctx.fillStyle = rc.theme.muted;
      rc.ctx.font = `11px ${rc.theme.font}`;
      rc.ctx.textAlign = "left";
      rc.ctx.textBaseline = "top";
      rc.ctx.fillText(cfg.note, f.left, f.top - 12);
    }

    const lgLo = Math.log(Math.max(1e-6, path.priceLo));
    const lgHi = Math.log(Math.max(1e-6, path.priceHi));
    const xAt = (i: number) => f.left + (i / (path.n - 1)) * f.w;
    const yPrice = (v: number) =>
      f.top + priceH - ((Math.log(Math.max(1e-6, v)) - lgLo) / (lgHi - lgLo)) * priceH;
    const yEq = (v: number) =>
      eqTop + eqH - ((v - path.eqLo) / (path.eqHi - path.eqLo)) * eqH;

    c.view = { top: f.top, h: priceH, lo: path.priceLo, hi: path.priceHi, ref: path.c[shown - 1] ?? 100 };

    rc.ctx.save();
    if (rc.dimmed) rc.ctx.globalAlpha = 0.35;

    pane(rc, f, f.top, priceH, path.priceLo, path.priceHi, yPrice, "PRICE (log)", (v) => v.toFixed(0));
    pane(rc, f, eqTop, eqH, path.eqLo, path.eqHi, yEq, "EQUITY", (v) => `${(v * 100).toFixed(0)}%`);

    // Zero line on the equity pane: the only number on it that means anything absolute.
    rc.ctx.strokeStyle = rc.theme.axis;
    rc.ctx.lineWidth = 1;
    const zero = Math.round(yEq(0)) + 0.5;
    rc.ctx.beginPath();
    rc.ctx.moveTo(f.left, zero);
    rc.ctx.lineTo(f.left + f.w, zero);
    rc.ctx.stroke();

    drawCandles(rc, path, shown, f, xAt, yPrice);
    drawFills(rc, path, shown, xAt, yPrice);
    drawEquity(rc, path, shown, xAt, yEq);
    drawStop(rc, c, path, shown, f, priceH, yPrice);

    rc.ctx.restore();

    xAxis(rc, f, path.n, xAt, eqTop + eqH);
    chip(rc, f);
  },

  /**
   * Dragging the stop line writes the stop knob.
   *
   * Direct manipulation is the point: the learner sets a distance by eye against the size of
   * the bars, which is exactly the judgement the lab is teaching. The slider does the same
   * thing and teaches less.
   */
  hitTest(compiled, rc, _x, y): Hit | null {
    const c = compiled as MTCompiled;
    const v = c.view;
    if (!v) return null;

    const lgLo = Math.log(Math.max(1e-6, v.lo));
    const lgHi = Math.log(Math.max(1e-6, v.hi));
    const frac = 1 - (y - v.top) / v.h;
    const price = Math.exp(lgLo + frac * (lgHi - lgLo));

    const sigma = Math.max(1e-4, (rc.params[c.cfg.vol_param] ?? 1.5) / 100);
    const atrs = ((v.ref - price) / v.ref) / sigma;
    if (!Number.isFinite(atrs)) return null;

    // Snap to the knob's own granularity so the drag and the slider cannot disagree.
    return { param: c.cfg.stop_param, value: Math.round(atrs / 0.25) * 0.25 };
  },

  fixtureJson: MARKET_TAPE_FIXTURE,
};

// ── pane furniture ────────────────────────────────────────────────────────────────────────────

function pane(
  rc: RenderCtx, f: Frame, top: number, h: number,
  lo: number, hi: number, map: (v: number) => number,
  label: string, fmt: (v: number) => string,
): void {
  const { ctx, theme } = rc;
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.font = `10px ${theme.mono}`;
  ctx.textBaseline = "middle";

  for (const t of niceTicks(lo, hi, Math.max(2, Math.round(h / 34)))) {
    const y = Math.round(map(t)) + 0.5;
    if (y < top - 1 || y > top + h + 1) continue;
    ctx.beginPath();
    ctx.moveTo(f.left, y);
    ctx.lineTo(f.left + f.w, y);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "right";
    ctx.fillText(fmt(t), f.left - 7, y);
  }

  ctx.fillStyle = theme.muted;
  ctx.font = `10px ${theme.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, f.left + 4, top + 3);
}

function xAxis(
  rc: RenderCtx, f: Frame, n: number, xAt: (i: number) => number, bottom: number,
): void {
  const { ctx, theme } = rc;
  ctx.fillStyle = theme.muted;
  ctx.font = `10px ${theme.mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const step = Math.max(1, Math.round(n / 4));
  for (let b = 0; b < n; b += step) ctx.fillText(String(b), xAt(b), bottom + 7);
  ctx.textAlign = "right";
  ctx.fillText("bars", f.left + f.w, bottom + 7);
}

/**
 * Permanent, not dismissible: a picture shaped like a price chart will be read as one.
 * Top right, opposite the note — the bottom-left corner belongs to the x-axis origin label.
 */
function chip(rc: RenderCtx, f: Frame): void {
  const { ctx, theme } = rc;
  ctx.fillStyle = theme.muted;
  ctx.font = `10px ${theme.mono}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("simulated — not market data", f.left + f.w, f.top - 12);
}

// ── marks ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Hollow for up, filled for down — so direction survives a colour-vision deficiency, and so the
 * two passes batch into two fill-style changes per frame instead of one per bar.
 */
function drawCandles(
  rc: RenderCtx, p: Path, shown: number, f: Frame,
  xAt: (i: number) => number, yPrice: (v: number) => number,
): void {
  const { ctx, theme } = rc;
  const bw = Math.max(1, f.w / p.n - 1);
  ctx.lineWidth = 1;

  for (let pass = 0; pass < 2; pass++) {
    const up = pass === 0;
    ctx.strokeStyle = up ? theme.good : theme.critical;
    ctx.fillStyle = up ? theme.surface : theme.critical;

    ctx.beginPath();
    for (let i = 0; i < shown; i++) {
      if ((p.c[i]! >= p.o[i]!) !== up) continue;
      const x = Math.round(xAt(i)) + 0.5;
      ctx.moveTo(x, yPrice(p.h[i]!));
      ctx.lineTo(x, yPrice(p.l[i]!));
    }
    ctx.stroke();

    for (let i = 0; i < shown; i++) {
      if ((p.c[i]! >= p.o[i]!) !== up) continue;
      const a = yPrice(p.o[i]!), b = yPrice(p.c[i]!);
      const x = xAt(i) - bw / 2;
      const top = Math.min(a, b);
      const hgt = Math.max(1, Math.abs(a - b));
      ctx.fillRect(x, top, bw, hgt);
      if (up) {
        ctx.beginPath();
        ctx.rect(x, top, bw, hgt);
        ctx.stroke();
      }
    }
  }
}

function drawFills(
  rc: RenderCtx, p: Path, shown: number,
  xAt: (i: number) => number, yPrice: (v: number) => number,
): void {
  const { ctx, theme } = rc;
  for (let i = 0; i < shown; i++) {
    const f = p.fill[i]!;
    if (!f) continue;
    const x = xAt(i), y = yPrice(p.c[i]!);
    ctx.fillStyle = f === -1 ? theme.critical : f === 2 ? theme.good : theme.series[0];
    ctx.beginPath();
    if (f === 1) {
      ctx.moveTo(x, y + 6); ctx.lineTo(x - 3, y + 11); ctx.lineTo(x + 3, y + 11);
    } else {
      ctx.moveTo(x, y - 6); ctx.lineTo(x - 3, y - 11); ctx.lineTo(x + 3, y - 11);
    }
    ctx.fill();
  }
}

function drawEquity(
  rc: RenderCtx, p: Path, shown: number,
  xAt: (i: number) => number, yEq: (v: number) => number,
): void {
  const { ctx, theme } = rc;
  ctx.strokeStyle = theme.series[0];
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < shown; i++) {
    const x = xAt(i), y = yEq(p.eq[i]!);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawStop(
  rc: RenderCtx, c: MTCompiled, p: Path, shown: number,
  f: Frame, priceH: number, yPrice: (v: number) => number,
): void {
  const { ctx, theme } = rc;
  const sigma = Math.max(1e-4, (rc.params[c.cfg.vol_param] ?? 1.5) / 100);
  const atrs = rc.params[c.cfg.stop_param] ?? 1;
  const ref = p.c[shown - 1] ?? 100;
  const level = ref * (1 - atrs * sigma);
  const y = Math.round(yPrice(level)) + 0.5;
  if (y < f.top || y > f.top + priceH) return;

  ctx.save();
  ctx.strokeStyle = theme.critical;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(f.left, y);
  ctx.lineTo(f.left + f.w, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const label = `STOP  −${(atrs * sigma * 100).toFixed(2)}%   ⇕ drag`;
  ctx.font = `600 10px ${theme.mono}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = theme.surface;
  ctx.fillRect(f.left + 5, y - 15, tw + 8, 13);
  ctx.fillStyle = theme.critical;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, f.left + 9, y - 14);
  ctx.restore();
}
