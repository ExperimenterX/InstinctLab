import { clearSurface } from "../../primitives.js";
import {
  frameOf, type CanvasRenderer, type CompiledStage, type Frame, type Hit,
  type NodeAnalysis, type RenderCtx,
} from "../../types.js";
import { DepthLadderConfigSchema, type DepthLadderConfig } from "./schema.js";
import { bookFor, type Book } from "./book.js";
import { DEPTH_LADDER_FIXTURE } from "./fixture.js";

/**
 * An order book, and a marketable order walked down it.
 *
 * Asks above the mid, bids below, bar length is resting size, and the amber overlay is what
 * your order consumed. The gap between the QUOTE line and the YOUR FILL line is the entire
 * lesson, so those two marks get the strongest treatment on the canvas.
 *
 * Clicking an ask level buys everything down to it. That is more direct than the slider and it
 * teaches the mechanism better: you choose a depth, and the price follows from it.
 */

const SWEEP_SECONDS = 0.6;

interface DLCompiled extends CompiledStage {
  readonly renderer: "depth-ladder";
  cfg: DepthLadderConfig;
  /** Written by draw, read by hitTest. */
  view: { top: number; rowH: number; askRows: number } | null;
}

export const depthLadderRenderer: CanvasRenderer<DepthLadderConfig> = {
  id: "depth-ladder",
  label: "Depth ladder",
  bestFor:
    "a finite resource queued at sorted prices or priorities, consumed from the best end — order books, auctions, bandwidth allocation; where taking more means taking worse",

  configSchema: DepthLadderConfigSchema,

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

    need(cfg.size_param, "size_param", true);
    need(cfg.depth_param, "depth_param", false);
    need(cfg.slices_param, "slices_param", false);

    if (cfg.slices_param && cfg.refill === 0) {
      warnings.push(
        "slices_param with refill 0: splitting the order changes nothing if the book never heals between pieces.",
      );
    }

    return { errors, warnings, referencedParams };
  },

  compile(cfg): DLCompiled {
    return { renderer: "depth-ladder", cfg, view: null };
  },

  /**
   * Facts about the matched order. Computed by the same walk the canvas draws — an analytic
   * slippage estimate would disagree with the highlighted levels beside it.
   */
  derivedNames() {
    return ["avg_fill", "slippage_bps", "levels_used", "fill_rate", "best_ask", "cost_paid"];
  },

  derive(cfg, params): Record<string, number> {
    const b = bookFor(cfg, params);
    return {
      avg_fill: b.avgFill,
      slippage_bps: b.slippageBps,
      levels_used: b.levelsUsed,
      fill_rate: b.fillRate,
      best_ask: b.bestAsk,
      cost_paid: (b.avgFill - b.bestAsk) * b.filled,
    };
  },

  draw(compiled, rc) {
    const c = compiled as DLCompiled;
    const { cfg } = c;
    const f = frameOf(rc.cssW, rc.cssH);
    const b = bookFor(cfg, rc.params);

    clearSurface(rc);

    const rows = b.n * 2;
    const rowH = f.h / rows;
    const sweep = Math.max(0, Math.min(1, rc.t / SWEEP_SECONDS));
    c.view = { top: f.top, rowH, askRows: b.n };

    if (cfg.note) {
      rc.ctx.fillStyle = rc.theme.muted;
      rc.ctx.font = `11px ${rc.theme.font}`;
      rc.ctx.textAlign = "left";
      rc.ctx.textBaseline = "top";
      rc.ctx.fillText(cfg.note, f.left, f.top - 12);
    }

    rc.ctx.save();
    if (rc.dimmed) rc.ctx.globalAlpha = 0.35;

    drawLevels(rc, f, b, rowH, sweep);
    drawMarkers(rc, f, b, rowH, cfg, sweep);

    rc.ctx.restore();

    legend(rc, f);
  },

  /** Clicking an ask level buys everything down to it. */
  hitTest(compiled, _rc, _x, y): Hit | null {
    const c = compiled as DLCompiled;
    const v = c.view;
    if (!v) return null;

    const row = Math.floor((y - v.top) / v.rowH);
    if (row < 0 || row >= v.askRows) return null;          // bids are not buyable here

    // Rows run best-ask-at-the-bottom of the ask block, so invert.
    const k = v.askRows - 1 - row;
    const b = bookFor(c.cfg, _rc.params);
    let cum = 0;
    for (let j = 0; j <= k && j < b.n; j++) cum += b.base[j]!;

    return { param: c.cfg.size_param, value: Math.round(cum / 10) * 10 };
  },

  fixtureJson: DEPTH_LADDER_FIXTURE,
};

// ── marks ─────────────────────────────────────────────────────────────────────────────────────

const yAsk = (f: Frame, n: number, k: number, rowH: number) => f.top + (n - 1 - k) * rowH;
const yBid = (f: Frame, n: number, k: number, rowH: number) => f.top + (n + k) * rowH;

function drawLevels(rc: RenderCtx, f: Frame, b: Book, rowH: number, sweep: number): void {
  const { ctx, theme } = rc;
  const barH = Math.max(1, rowH - 1.5);
  const wOf = (q: number) => Math.max(0, (q / b.maxQty) * f.w);
  const showPrices = rowH > 9;

  ctx.font = `9.5px ${theme.mono}`;
  ctx.textBaseline = "middle";

  for (let k = 0; k < b.n; k++) {
    const y = yAsk(f, b.n, k, rowH);

    ctx.fillStyle = theme.critical;
    ctx.globalAlpha *= 0.28;
    ctx.beginPath();
    ctx.rect(f.left, y, wOf(b.base[k]!), barH);
    ctx.fill();
    ctx.globalAlpha /= 0.28;

    if (b.eaten[k]! > 1e-6) {
      ctx.fillStyle = theme.warning;
      ctx.beginPath();
      ctx.rect(f.left, y, wOf(b.eaten[k]!) * sweep, barH);
      ctx.fill();
    }
    if (showPrices) {
      ctx.fillStyle = b.eaten[k]! > 1e-6 ? theme.warning : theme.muted;
      ctx.textAlign = "right";
      ctx.fillText(b.px[k]!.toFixed(2), f.left - 7, y + barH / 2);
    }
  }

  // Bids are untouched by a buy. They are drawn so the spread is visible as a gap, not stated.
  for (let k = 0; k < b.n; k++) {
    const y = yBid(f, b.n, k, rowH);
    ctx.fillStyle = theme.good;
    ctx.globalAlpha *= 0.24;
    ctx.beginPath();
    ctx.rect(f.left, y, wOf(b.base[k]!), barH);
    ctx.fill();
    ctx.globalAlpha /= 0.24;

    if (showPrices) {
      ctx.fillStyle = theme.muted;
      ctx.textAlign = "right";
      ctx.fillText(b.bidPx[k]!.toFixed(2), f.left - 7, y + barH / 2);
    }
  }
}

function drawMarkers(
  rc: RenderCtx, f: Frame, b: Book, rowH: number,
  cfg: DepthLadderConfig, sweep: number,
): void {
  const { ctx, theme } = rc;

  const line = (y: number, stroke: string, label: string, dashed: boolean) => {
    const r = Math.round(y) + 0.5;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    if (dashed) ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(f.left, r);
    ctx.lineTo(f.left + f.w, r);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = `600 10px ${theme.mono}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = theme.surface;
    ctx.fillRect(f.left + f.w - tw - 11, r - 14, tw + 8, 13);
    ctx.fillStyle = stroke;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, f.left + f.w - tw - 7, r - 13);
    ctx.restore();
  };

  line(yAsk(f, b.n, 0, rowH) + rowH / 2, theme.muted, `QUOTE  ${b.bestAsk.toFixed(2)}`, false);

  if (b.filled > 0 && sweep > 0.35) {
    const k = Math.max(0, Math.min(b.n - 1, (b.avgFill - b.bestAsk) / cfg.tick));
    line(
      f.top + (b.n - 1 - k) * rowH + rowH / 2,
      theme.series[0],
      `YOUR FILL  ${b.avgFill.toFixed(3)}`,
      true,
    );
  }

  // The mid, so the two sides read as one book rather than two charts.
  ctx.strokeStyle = theme.axis;
  ctx.lineWidth = 1;
  const ym = Math.round(f.top + b.n * rowH) + 0.5;
  ctx.beginPath();
  ctx.moveTo(f.left, ym);
  ctx.lineTo(f.left + f.w, ym);
  ctx.stroke();
}

function legend(rc: RenderCtx, f: Frame): void {
  const { ctx, theme } = rc;
  ctx.font = `10px ${theme.font}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = theme.critical;
  ctx.fillText("ASKS — you buy here", f.left + 6, f.top + 3);
  ctx.fillStyle = theme.good;
  ctx.fillText("BIDS", f.left + 6, f.top + f.h / 2 + 3);
  ctx.fillStyle = theme.muted;
  ctx.textAlign = "center";
  ctx.fillText("resting size →   click an ask level to buy down to it", f.left + f.w / 2, f.top + f.h + 8);
  ctx.textAlign = "left";
  ctx.font = `10px ${theme.mono}`;
  ctx.fillText("simulated — not market data", f.left, f.top + f.h + 22);
}
