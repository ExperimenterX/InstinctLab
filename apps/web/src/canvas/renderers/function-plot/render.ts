import { compileExpr, tryCompile, type Compiled as ExprFn, type Scope } from "../../../expr/compile.js";
import {
  clearSurface, drawAxes, polyline, seriesLabel, themeDim, valueMarker, withFrameClip,
} from "../../primitives.js";
import { seriesColor } from "../../theme.js";
import { frameOf, type CanvasRenderer, type CompileCtx, type CompiledStage, type NodeAnalysis, type RenderCtx } from "../../types.js";
import { FunctionPlotConfigSchema, type FunctionPlotConfig } from "./schema.js";
import { FUNCTION_PLOT_FIXTURE } from "./fixture.js";

/**
 * Curves over an x/y axis pair. The reference node — copy this structure.
 *
 * Two things here are worth imitating in every other node:
 *
 *   `compile` does all the work that can be done once: parses expressions to closures and
 *   allocates the sample buffers. `draw` then only does arithmetic and canvas calls, so it
 *   allocates nothing and can run at 60fps while a slider is being dragged.
 *
 *   The scope object is created once and mutated. Building a fresh `{x, ...params}` per sample
 *   would be ~780 objects per frame, which is a GC sawtooth you can feel in your fingertips.
 */

const SAMPLES = 260;

interface FPCompiled extends CompiledStage {
  readonly renderer: "function-plot";
  cfg: FunctionPlotConfig;
  series: {
    label: string;
    color: string;
    dashed: boolean;
    fn: ExprFn;
    xs: Float64Array;
    ys: Float64Array;
  }[];
  scope: Scope;
}

export const functionPlotRenderer: CanvasRenderer<FunctionPlotConfig> = {
  id: "function-plot",
  label: "Function plot",
  bestFor:
    "a quantity that depends continuously on another — trade-offs, response curves, anything with a knee, threshold or asymptote",

  configSchema: FunctionPlotConfigSchema,

  analyze(cfg, ctx): NodeAnalysis {
    const errors: string[] = [];
    const warnings: string[] = [];
    const referencedParams = new Set<string>();

    if (cfg.x_domain[0] >= cfg.x_domain[1]) errors.push("x_domain must be increasing.");
    if (cfg.y_domain[0] >= cfg.y_domain[1]) errors.push("y_domain must be increasing.");

    const vars = ["x", ...ctx.paramIds];
    for (const [i, s] of cfg.series.entries()) {
      const r = tryCompile(s.expr, vars);
      if (!r.ok) {
        errors.push(`series.${i}.expr — ${r.error}`);
        continue;
      }
      for (const name of r.result.referenced) {
        if (name !== "x") referencedParams.add(name);
      }
      if (!r.result.referenced.has("x")) {
        warnings.push(`series.${i} ("${s.label}") ignores x — it will draw a flat line.`);
      }
    }

    return { errors, warnings, referencedParams };
  },

  compile(cfg: FunctionPlotConfig, ctx: CompileCtx): FPCompiled {
    const scope: Scope = { x: 0 };
    for (const id of ctx.paramIds) scope[id] = 0;

    return {
      renderer: "function-plot",
      cfg,
      scope,
      series: cfg.series.map((s) => ({
        label: s.label,
        color: s.color,
        dashed: s.style === "dashed",
        fn: compileExpr(s.expr, { variables: ["x", ...ctx.paramIds] }).fn,
        xs: new Float64Array(SAMPLES),
        ys: new Float64Array(SAMPLES),
      })),
    };
  },

  draw(compiledStage, rc: RenderCtx): void {
    const c = compiledStage as FPCompiled;
    const { cfg, scope } = c;
    const f = frameOf(rc.cssW, rc.cssH);
    const [x0, x1] = cfg.x_domain;
    const [y0, y1] = cfg.y_domain;

    const sy = (v: number) => f.top + f.h - ((v - y0) / (y1 - y0)) * f.h;

    clearSurface(rc);
    drawAxes(rc, f, {
      xDomain: cfg.x_domain,
      yDomain: cfg.y_domain,
      xLabel: cfg.x_label,
      yLabel: cfg.y_label,
    });

    // Params into the shared scope once; only `x` varies per sample.
    for (const k in rc.params) scope[k] = rc.params[k]!;

    themeDim(rc, () => {
      withFrameClip(rc, f, () => {
        for (const s of c.series) {
          for (let i = 0; i < SAMPLES; i++) {
            const xv = x0 + ((x1 - x0) * i) / (SAMPLES - 1);
            scope["x"] = xv;
            const yv = s.fn(scope);
            s.xs[i] = f.left + ((xv - x0) / (x1 - x0)) * f.w;
            // NaN is preserved deliberately — `polyline` breaks the path on it rather than
            // drawing a wild segment or poisoning the rest of the stroke.
            s.ys[i] = sy(Number.isFinite(yv) ? yv : NaN);
          }
          polyline(rc, s.xs, s.ys, SAMPLES, seriesColor(rc.theme, s.color), s.dashed);
        }
      });
    });

    // Labels outside the clip and after the curves, so they sit on top and can overhang the
    // frame. Mandatory: this is the contrast relief for light-mode series-3 (see theme.ts).
    for (const s of c.series) {
      let idx = -1;
      for (let i = SAMPLES - 1; i >= 0; i--) {
        const y = s.ys[i]!;
        if (Number.isFinite(y) && y >= f.top - 2 && y <= f.top + f.h + 2) { idx = i; break; }
      }
      if (idx !== -1) seriesLabel(rc, f, s.ys[idx]!, s.label, seriesColor(rc.theme, s.color));
    }

    if (rc.marker) valueMarker(rc, f, sy(rc.marker.value), rc.marker.label, rc.marker.kind);
  },

  fixtureJson: FUNCTION_PLOT_FIXTURE,
};
