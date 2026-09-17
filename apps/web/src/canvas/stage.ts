import type { LabSpec } from "../spec/schema.js";
import { compileExpr, type Compiled as ExprFn, type Scope } from "../expr/compile.js";
import { getRenderer } from "./registry.js";
import type { CanvasRenderer, CompiledStage, RenderCtx } from "./types.js";
import { getTheme, type Mode } from "./theme.js";

/**
 * Node-agnostic stage: looks up the node for a spec, compiles it once, and forwards draws.
 *
 * Everything above this line (the canvas host, the knob panel, the prediction flow) is written
 * against `Stage` and knows nothing about any particular archetype. Everything below it is a
 * node. That is the whole parallelism story.
 */
export interface Stage {
  node: CanvasRenderer<never>;
  compiled: CompiledStage;
  /** Observables are shared across nodes, so they live here rather than in a node. */
  observables: { id: string; fn: ExprFn }[];
  scope: Scope;
  spec: LabSpec;
}

export function compileStage(spec: LabSpec): Stage {
  const node = getRenderer(spec.stage.renderer);
  if (!node) throw new Error(`No canvas renderer registered for "${spec.stage.renderer}"`);

  const paramIds = spec.params.map((p) => p.id);
  const scope: Scope = {};
  for (const p of spec.params) scope[p.id] = p.default;

  return {
    node,
    spec,
    scope,
    compiled: node.compile(spec.stage.config as never, { paramIds }),
    observables: spec.observables.map((o) => ({
      id: o.id,
      fn: compileExpr(o.expr, {
        variables: [...paramIds, ...(node.derivedNames?.(spec.stage.config as never) ?? [])],
      }).fn,
    })),
  };
}

export function drawStage(
  stage: Stage,
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  opts: {
    params: Readonly<Record<string, number>>;
    mode: Mode;
    t?: number;
    dimmed?: boolean;
    marker?: RenderCtx["marker"];
  },
): void {
  stage.node.draw(stage.compiled, {
    ctx,
    cssW,
    cssH,
    theme: getTheme(opts.mode),
    params: opts.params,
    t: opts.t ?? 0,
    dimmed: opts.dimmed ?? false,
    marker: opts.marker,
  });
}

/** Current value of every observable. Called at ~10Hz for the read-outs, never per frame. */
export function readObservables(
  stage: Stage,
  params: Readonly<Record<string, number>>,
): Record<string, number> {
  for (const k in params) stage.scope[k] = params[k]!;
  // Structure-derived values (tree height, nodes read, …) join the scope so a read-out can report
  // what the renderer actually built rather than an approximation of it.
  const d = stage.node.derive?.(stage.spec.stage.config as never, params);
  if (d) for (const k in d) stage.scope[k] = d[k]!;
  const out: Record<string, number> = {};
  for (const o of stage.observables) {
    const v = o.fn(stage.scope);
    out[o.id] = Number.isFinite(v) ? v : NaN;
  }
  return out;
}

/**
 * Plausible range for an observable, for the prediction slider.
 *
 * Derived by sweeping the observable over the corners of the param ranges — NOT from the correct
 * answer. That distinction is the whole point: a slider centred on or bounded by the true value
 * hands the learner the answer, and the prediction stops being a prediction.
 *
 * Params are capped at 3 by the schema, so this is at most 8 evaluations plus the defaults.
 */
export function observableRange(stage: Stage, observableId: string): [number, number] {
  const o = stage.observables.find((q) => q.id === observableId);
  if (!o) return [0, 1];

  const params = stage.spec.params;
  const seen: number[] = [];

  const corners = 1 << params.length;
  for (let mask = 0; mask < corners; mask++) {
    const at: Record<string, number> = {};
    for (const [i, p] of params.entries()) at[p.id] = mask & (1 << i) ? p.max : p.min;
    for (const k in at) stage.scope[k] = at[k]!;
    const v = o.fn(stage.scope);
    if (Number.isFinite(v)) seen.push(v);
  }
  for (const p of params) stage.scope[p.id] = p.default;
  const atDefault = o.fn(stage.scope);
  if (Number.isFinite(atDefault)) seen.push(atDefault);

  if (seen.length === 0) return [0, 1];
  let lo = Math.min(...seen);
  let hi = Math.max(...seen);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}
