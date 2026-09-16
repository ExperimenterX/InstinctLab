import type { LabSpec } from "../spec/schema.js";
import { compileExpr, type Compiled, type Scope } from "../expr/compile.js";
import { getTheme, seriesColor, type Mode, type Theme } from "./theme.js";

/**
 * The function-plot renderer.
 *
 * Two rules govern everything in this file, and both come from the product rather than from
 * taste:
 *
 * 1. `compile` happens once per spec; `draw` runs every frame and allocates nothing. All the
 *    buffers are sized up front. An allocation per sample per frame is a GC sawtooth you can feel
 *    while dragging a slider, which is the one thing this product cannot afford.
 *
 * 2. The y-axis is LOCKED to `spec.y_domain` and never auto-scales. This looks like a limitation
 *    and is actually the most important line here: an axis that rescales as the learner drags
 *    makes a growing curve look static, which hides the exact effect they are supposed to notice.
 */

const SAMPLES = 260;
const PAD = { top: 18, right: 96, bottom: 34, left: 56 } as const;

export interface CompiledPlot {
  spec: LabSpec;
  series: {
    label: string;
    color: string;
    dashed: boolean;
    fn: Compiled;
    xs: Float64Array;
    ys: Float64Array;
  }[];
  observables: { id: string; fn: Compiled }[];
  /** Reused every frame so `draw` never allocates a scope object. */
  scope: Scope;
}

export function compilePlot(spec: LabSpec): CompiledPlot {
  const paramIds = spec.params.map((p) => p.id);
  const scope: Scope = { x: 0 };
  for (const p of spec.params) scope[p.id] = p.default;

  return {
    spec,
    scope,
    series: spec.series.map((s) => ({
      label: s.label,
      color: s.color,
      dashed: s.style === "dashed",
      fn: compileExpr(s.expr, { variables: ["x", ...paramIds] }).fn,
      xs: new Float64Array(SAMPLES),
      ys: new Float64Array(SAMPLES),
    })),
    observables: spec.observables.map((o) => ({
      id: o.id,
      fn: compileExpr(o.expr, { variables: paramIds }).fn,
    })),
  };
}

/** Current value of every observable. Called at ~10Hz for the read-outs, not per frame. */
export function readObservables(plot: CompiledPlot, params: Record<string, number>): Record<string, number> {
  for (const [k, v] of Object.entries(params)) plot.scope[k] = v;
  const out: Record<string, number> = {};
  for (const o of plot.observables) {
    const v = o.fn(plot.scope);
    out[o.id] = Number.isFinite(v) ? v : NaN;
  }
  return out;
}

export interface DrawOptions {
  params: Record<string, number>;
  mode: Mode;
  /** Optional horizontal marker — used to show a committed prediction against the truth. */
  marker?: { y: number; label: string; kind: "guess" | "actual" } | undefined;
  /** Dim the plot while frozen for a prediction. */
  dimmed?: boolean;
}

export function drawPlot(
  ctx: CanvasRenderingContext2D,
  plot: CompiledPlot,
  cssW: number,
  cssH: number,
  opts: DrawOptions,
): void {
  const theme = getTheme(opts.mode);
  const { spec, scope } = plot;
  const [x0, x1] = spec.x_domain;
  const [y0, y1] = spec.y_domain;

  const left = PAD.left;
  const top = PAD.top;
  const w = Math.max(10, cssW - PAD.left - PAD.right);
  const h = Math.max(10, cssH - PAD.top - PAD.bottom);

  const sx = (xv: number) => left + ((xv - x0) / (x1 - x0)) * w;
  const sy = (yv: number) => top + h - ((yv - y0) / (y1 - y0)) * h;

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = theme.surface;
  ctx.fillRect(0, 0, cssW, cssH);

  drawGrid(ctx, theme, { left, top, w, h, x0, x1, y0, y1, sx, sy });
  drawAxisLabels(ctx, theme, spec, { left, top, w, h });

  // Sample every series. Params are written into the shared scope once, then only `x` changes.
  for (const [k, v] of Object.entries(opts.params)) scope[k] = v;

  ctx.save();
  if (opts.dimmed) ctx.globalAlpha = 0.35;

  for (const s of plot.series) {
    for (let i = 0; i < SAMPLES; i++) {
      const xv = x0 + ((x1 - x0) * i) / (SAMPLES - 1);
      scope["x"] = xv;
      const yv = s.fn(scope);
      s.xs[i] = sx(xv);
      s.ys[i] = sy(Number.isFinite(yv) ? yv : NaN);
    }
    strokeSeries(ctx, theme, s, { top, h });
  }

  ctx.restore();

  // Direct labels last so they sit above the curves. Not decoration: they are the secondary
  // encoding that lets a low-contrast series stay identifiable (see theme.ts).
  for (const s of plot.series) drawSeriesLabel(ctx, theme, s, { left, top, w, h });

  if (opts.marker) drawMarker(ctx, theme, opts.marker, { left, w, sy });
}

// ── internals ─────────────────────────────────────────────────────────────────────────────────

interface Frame {
  left: number; top: number; w: number; h: number;
  x0: number; x1: number; y0: number; y1: number;
  sx: (v: number) => number; sy: (v: number) => number;
}

function niceTicks(lo: number, hi: number, target: number): number[] {
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

function fmtTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1000) return `${(v / 1000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return v.toFixed(1);
  if (a === 0) return "0";
  return v.toFixed(2);
}

function drawGrid(ctx: CanvasRenderingContext2D, theme: Theme, f: Frame): void {
  ctx.lineWidth = 1;
  ctx.font = `11px ${theme.font}`;
  ctx.strokeStyle = theme.grid;

  // Recessive gridlines; labels in muted ink, never in a series colour.
  for (const t of niceTicks(f.y0, f.y1, 5)) {
    const y = Math.round(f.sy(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(f.left, y);
    ctx.lineTo(f.left + f.w, y);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(fmtTick(t), f.left - 8, y);
  }

  for (const t of niceTicks(f.x0, f.x1, 6)) {
    const x = Math.round(f.sx(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, f.top);
    ctx.lineTo(x, f.top + f.h);
    ctx.strokeStyle = theme.grid;
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(fmtTick(t), x, f.top + f.h + 8);
  }

  ctx.strokeStyle = theme.axis;
  ctx.beginPath();
  ctx.moveTo(f.left, f.top);
  ctx.lineTo(f.left, f.top + f.h);
  ctx.lineTo(f.left + f.w, f.top + f.h);
  ctx.stroke();
}

function drawAxisLabels(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: LabSpec,
  b: { left: number; top: number; w: number; h: number },
): void {
  ctx.fillStyle = theme.textSecondary;
  ctx.font = `12px ${theme.font}`;

  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(spec.x_label, b.left + b.w / 2, b.top + b.h + 32);

  ctx.save();
  ctx.translate(14, b.top + b.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(spec.y_label, 0, 0);
  ctx.restore();
}

function strokeSeries(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  s: CompiledPlot["series"][number],
  b: { top: number; h: number },
): void {
  ctx.strokeStyle = seriesColor(theme, s.color);
  ctx.lineWidth = 2; // thin marks
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (s.dashed) ctx.setLineDash([6, 5]);

  // Clip so a curve that exceeds y_domain stops at the frame instead of painting over the axes.
  // Running off the top is often the lesson, so we show it leaving — we just don't let it escape.
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.top === 0 ? 0 : 0, b.top, ctx.canvas.width, b.h);
  ctx.clip();

  ctx.beginPath();
  let open = false;
  for (let i = 0; i < s.xs.length; i++) {
    const y = s.ys[i]!;
    if (!Number.isFinite(y)) { open = false; continue; }   // NaN breaks the path, never draws
    if (!open) { ctx.moveTo(s.xs[i]!, y); open = true; }
    else ctx.lineTo(s.xs[i]!, y);
  }
  ctx.stroke();
  ctx.restore();
  ctx.setLineDash([]);
}

function drawSeriesLabel(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  s: CompiledPlot["series"][number],
  b: { left: number; top: number; w: number; h: number },
): void {
  // Anchor to the last finite sample so the label follows the curve.
  let idx = -1;
  for (let i = s.ys.length - 1; i >= 0; i--) {
    const y = s.ys[i]!;
    if (Number.isFinite(y) && y >= b.top - 2 && y <= b.top + b.h + 2) { idx = i; break; }
  }
  if (idx === -1) return;

  const x = b.left + b.w + 8;
  const y = Math.min(Math.max(s.ys[idx]!, b.top + 6), b.top + b.h - 6);
  const color = seriesColor(theme, s.color);

  ctx.beginPath();
  ctx.arc(x - 3, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Text stays in ink, never in the series colour; the dot beside it carries identity.
  ctx.fillStyle = theme.textSecondary;
  ctx.font = `11px ${theme.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const max = PAD.right - 18;
  let label = s.label;
  while (label.length > 4 && ctx.measureText(label).width > max) label = label.slice(0, -2);
  if (label !== s.label) label = `${label}…`;
  ctx.fillText(label, x + 4, y);
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  m: NonNullable<DrawOptions["marker"]>,
  b: { left: number; w: number; sy: (v: number) => number },
): void {
  const y = Math.round(b.sy(m.y)) + 0.5;
  const color = m.kind === "actual" ? theme.good : theme.critical;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (m.kind === "guess") ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(b.left, y);
  ctx.lineTo(b.left + b.w, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `600 11px ${theme.font}`;
  const text = m.label;
  const tw = ctx.measureText(text).width;
  const bx = b.left + 6;
  const by = y - 16;
  ctx.fillStyle = theme.surface;
  ctx.fillRect(bx - 3, by - 2, tw + 6, 14);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, bx, by);
  ctx.restore();
}
