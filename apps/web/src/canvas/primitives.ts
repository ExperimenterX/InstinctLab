import type { Frame, RenderCtx } from "./types.js";
import type { Theme } from "./theme.js";
import { FRAME_PAD } from "./types.js";

/**
 * Shared draw primitives. Every node uses these rather than rolling its own, so two nodes never
 * end up with subtly different gridlines or tick formatting.
 *
 * None of these allocate beyond a few numbers, so they are safe to call from `draw`.
 *
 * If you need something that isn't here, add it. A private second polyline routine in one node is
 * how the canvas starts looking inconsistent.
 */

/** Axis ticks at human-readable intervals (1/2/5 × 10^n). */
export function niceTicks(lo: number, hi: number, target: number): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const stepN = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = stepN * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

export function fmtTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1000) return `${(v / 1000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return v.toFixed(1);
  if (a === 0) return "0";
  return v.toFixed(2);
}

export function clearSurface(rc: RenderCtx): void {
  rc.ctx.clearRect(0, 0, rc.cssW, rc.cssH);
  rc.ctx.fillStyle = rc.theme.surface;
  rc.ctx.fillRect(0, 0, rc.cssW, rc.cssH);
}

export interface AxesOptions {
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  xLabel: string;
  yLabel: string;
  /** Set false for a node whose x axis is categorical (stages, states, indices). */
  xTicks?: boolean;
}

/**
 * Grid, ticks, axis lines, axis titles. Recessive by design — the data must dominate, so
 * gridlines are hairlines and tick labels are muted ink, never a series colour.
 */
export function drawAxes(rc: RenderCtx, f: Frame, o: AxesOptions): void {
  const { ctx, theme } = rc;
  const [x0, x1] = o.xDomain;
  const [y0, y1] = o.yDomain;

  ctx.lineWidth = 1;
  ctx.font = `11px ${theme.font}`;

  for (const t of niceTicks(y0, y1, 5)) {
    const y = Math.round(f.top + f.h - ((t - y0) / (y1 - y0)) * f.h) + 0.5;
    ctx.strokeStyle = theme.grid;
    ctx.beginPath();
    ctx.moveTo(f.left, y);
    ctx.lineTo(f.left + f.w, y);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(fmtTick(t), f.left - 8, y);
  }

  if (o.xTicks !== false) {
    for (const t of niceTicks(x0, x1, 6)) {
      const x = Math.round(f.left + ((t - x0) / (x1 - x0)) * f.w) + 0.5;
      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      ctx.moveTo(x, f.top);
      ctx.lineTo(x, f.top + f.h);
      ctx.stroke();
      ctx.fillStyle = theme.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(fmtTick(t), x, f.top + f.h + 8);
    }
  }

  ctx.strokeStyle = theme.axis;
  ctx.beginPath();
  ctx.moveTo(f.left, f.top);
  ctx.lineTo(f.left, f.top + f.h);
  ctx.lineTo(f.left + f.w, f.top + f.h);
  ctx.stroke();

  ctx.fillStyle = theme.textSecondary;
  ctx.font = `12px ${theme.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(o.xLabel, f.left + f.w / 2, f.top + f.h + 32);

  ctx.save();
  ctx.translate(14, f.top + f.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(o.yLabel, 0, 0);
  ctx.restore();
}

/**
 * Stroke a prepared polyline. `ys` may contain NaN: the path breaks there and resumes, which is
 * how a divergent or out-of-domain expression renders as a gap instead of poisoning the path.
 */
export function polyline(
  rc: RenderCtx,
  xs: Float64Array,
  ys: Float64Array,
  n: number,
  color: string,
  dashed = false,
): void {
  const { ctx } = rc;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2; // thin marks
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (dashed) ctx.setLineDash([6, 5]);

  ctx.beginPath();
  let open = false;
  for (let i = 0; i < n; i++) {
    const y = ys[i]!;
    if (!Number.isFinite(y)) { open = false; continue; }
    if (!open) { ctx.moveTo(xs[i]!, y); open = true; }
    else ctx.lineTo(xs[i]!, y);
  }
  ctx.stroke();
  if (dashed) ctx.setLineDash([]);
}

/**
 * A direct label at the right edge, anchored to a y position.
 *
 * Required whenever a node draws more than one series. The palette's light-mode `series-3` sits
 * below 3:1 contrast, and this label is the documented relief — identity must never rest on
 * colour alone. Text stays in ink; the dot carries the colour.
 */
export function seriesLabel(
  rc: RenderCtx,
  f: Frame,
  y: number,
  text: string,
  color: string,
): void {
  const { ctx, theme } = rc;
  const cy = Math.min(Math.max(y, f.top + 6), f.top + f.h - 6);
  const x = f.left + f.w + 8;

  ctx.beginPath();
  ctx.arc(x - 3, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = theme.textSecondary;
  ctx.font = `11px ${theme.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const max = FRAME_PAD.right - 18;
  let label = text;
  while (label.length > 4 && ctx.measureText(label).width > max) label = label.slice(0, -2);
  ctx.fillText(label === text ? label : `${label}…`, x + 4, cy);
}

/** A horizontal value marker — used to show a committed guess against the truth. */
export function valueMarker(
  rc: RenderCtx,
  f: Frame,
  y: number,
  label: string,
  kind: "guess" | "actual",
): void {
  const { ctx, theme } = rc;
  const yy = Math.round(y) + 0.5;
  const color = kind === "actual" ? theme.good : theme.critical;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (kind === "guess") ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(f.left, yy);
  ctx.lineTo(f.left + f.w, yy);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `600 11px ${theme.font}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = theme.surface;
  ctx.fillRect(f.left + 3, yy - 18, tw + 6, 14);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, f.left + 6, yy - 16);
  ctx.restore();
}

/** Clip to the plot frame, so a curve leaving the domain stops at the edge. */
export function withFrameClip(rc: RenderCtx, f: Frame, fn: () => void): void {
  const { ctx } = rc;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.left, f.top, f.w, f.h);
  ctx.clip();
  fn();
  ctx.restore();
}

export function themeDim(rc: RenderCtx, fn: () => void): void {
  const { ctx } = rc;
  ctx.save();
  if (rc.dimmed) ctx.globalAlpha = 0.35;
  fn();
  ctx.restore();
}

export type { Theme };
