import { z } from "zod";
import { LIMITS } from "./limits.js";
import { ExprSchema } from "./expr.js";
import { ArchetypeIdSchema } from "./meta.js";
import { DerivedIdSchema, EntitySetIdSchema, LayerIdSchema, ObservableIdSchema, VarIdSchema } from "./ids.js";

/**
 * Colour is a MEANING, never a hex code. The palette lives in lab-renderers/draw/theme.ts and is
 * contrast-checked for light and dark. The AI picks semantics; FRONTEND picks pixels.
 */
export const PaletteTokenSchema = z.enum([
  "accent", "accent-soft", "ok", "warn", "danger", "muted", "fg", "bg", "grid",
  "series-0", "series-1", "series-2", "series-3", "series-4", "series-5",
]);
export type PaletteToken = z.infer<typeof PaletteTokenSchema>;

export const ColorScaleSchema = z.object({
  scale: z.enum(["sequential", "diverging", "categorical"]),
  by: ExprSchema,
  domain: z.tuple([z.number(), z.number()]),
});

export const ColorExprSchema = z.union([PaletteTokenSchema, ColorScaleSchema]);
export type ColorExpr = z.infer<typeof ColorExprSchema>;

export const MarkSchema = z.enum([
  "circle", "rect", "line", "path", "arrow", "text", "cell", "curve", "area", "token",
]);
export type Mark = z.infer<typeof MarkSchema>;

/**
 * Channels are expression-bound: each visual property is an Expr evaluated per-entity (or per
 * sample for a series). All coordinates are SPEC SPACE, 0–100 on both axes, origin top-left.
 * Never write pixels into a spec — the renderer owns the viewport transform.
 */
export const ChannelsSchema = z.object({
  x: ExprSchema.optional(),
  y: ExprSchema.optional(),
  w: ExprSchema.optional(),
  h: ExprSchema.optional(),
  r: ExprSchema.optional(),
  fill: ColorExprSchema.optional(),
  stroke: ColorExprSchema.optional(),
  alpha: ExprSchema.optional(),
  label: z.union([ExprSchema, z.string().max(24)]).optional(),
  rotation: ExprSchema.optional(),
  thickness: ExprSchema.optional(),
});
export type Channels = z.infer<typeof ChannelsSchema>;

export const LayerSchema = z.object({
  id: LayerIdSchema,
  mark: MarkSchema,
  from: z.union([
    EntitySetIdSchema,
    z.literal("self"),
    z.object({ series: z.union([VarIdSchema, DerivedIdSchema]) }),
  ]),
  channels: ChannelsSchema,
  interactive: z.object({
    drag: z.enum(["x", "y", "xy"]).optional(),
    /** Var to assign on click/hover; FRONTEND resolves and pokes it. */
    click: z.string().max(40).optional(),
    hover: z.string().max(40).optional(),
  }).optional(),
});
export type Layer = z.infer<typeof LayerSchema>;

export const AnnotationSchema = z.object({
  kind: z.enum(["label", "arrow", "bracket", "region", "ruler"]),
  text: z.string().max(48).optional(),
  at: z.object({ x: ExprSchema, y: ExprSchema }),
  to: z.object({ x: ExprSchema, y: ExprSchema }).optional(),
  color: ColorExprSchema.optional(),
  /** Annotation shows only while this is truthy — lets beats reveal guidance progressively. */
  when: ExprSchema.optional(),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

export const LegendItemSchema = z.object({
  label: z.string().max(24),
  color: PaletteTokenSchema,
  mark: MarkSchema.optional(),
});

// ── Per-archetype config ──────────────────────────────────────────────────────────────────────
// API owns these shapes; FRONTEND owns the renderers that consume them. Keep them PARAMETRIC — a field
// that only makes sense for one topic is a design error (doc 00 §3).

export const GraphNetworkConfigSchema = z.object({
  layout: z.enum(["force", "circular", "layered", "grid", "tree", "fixed"]).default("force"),
  directed: z.boolean().default(false),
  edgeWeightBy: ExprSchema.optional(),
  packetFlow: z.object({ rate: ExprSchema, speed: ExprSchema, along: z.literal("links") }).optional(),
  nodeLabels: z.boolean().default(false),
});

export const GridAutomatonConfigSchema = z.object({
  cols: z.number().int().min(2).max(200),
  rows: z.number().int().min(2).max(200),
  stateAttr: z.string().max(24).default("state"),
  stateColors: z.array(PaletteTokenSchema).min(2).max(8),
  neighborhood: z.enum(["moore", "von-neumann", "hex"]).default("moore"),
  wrap: z.boolean().default(true),
  paintable: z.boolean().default(true),
});

export const ParticleFieldConfigSchema = z.object({
  bounds: z.enum(["wrap", "wrap-x", "wrap-y", "bounce", "open"]).default("bounce"),
  trails: z.union([z.boolean(), z.number().int().min(2).max(120)]).default(false),
  forceField: ExprSchema.optional(),
  collide: z.boolean().default(false),
  draggable: z.boolean().default(true),
});

export const FunctionPlotConfigSchema = z.object({
  xDomain: z.tuple([z.number(), z.number()]),
  yDomain: z.union([z.tuple([z.number(), z.number()]), z.literal("auto")]).default("auto"),
  xLabel: z.string().max(24),
  yLabel: z.string().max(24),
  series: z.array(z.object({
    label: z.string().max(24),
    /** Evaluated with `x` in scope for a curve, or read from a var's history ring for a trace. */
    expr: ExprSchema.optional(),
    trace: VarIdSchema.optional(),
    color: PaletteTokenSchema,
    style: z.enum(["line", "area", "dots", "steps"]).default("line"),
  })).min(1).max(6),
  markers: z.array(z.object({ at: ExprSchema, axis: z.enum(["x", "y"]), label: z.string().max(16) })).max(6).optional(),
  scrubbable: z.boolean().default(true),
});

export const SequenceArrayConfigSchema = z.object({
  setId: EntitySetIdSchema,
  valueAttr: z.string().max(24).default("value"),
  cursors: z.array(z.object({ label: z.string().max(12), at: ExprSchema, color: PaletteTokenSchema })).max(4),
  compareHighlight: z.tuple([ExprSchema, ExprSchema]).optional(),
  swapAnimMs: z.number().int().min(0).max(600).default(180),
  showIndices: z.boolean().default(true),
  orientation: z.enum(["row", "grid"]).default("row"),
});

export const PipelineFlowConfigSchema = z.object({
  stages: z.array(z.object({
    id: z.string().max(24),
    label: z.string().max(24),
    serviceRate: ExprSchema,
    capacity: ExprSchema.optional(),
  })).min(2).max(8),
  arrivalRate: ExprSchema,
  tokenSpeed: ExprSchema.optional(),
  showQueueDepth: z.boolean().default(true),
  dropPolicy: z.enum(["tail", "head", "none"]).default("tail"),
});

export const StateMachineConfigSchema = z.object({
  states: z.array(z.object({
    id: z.string().max(24),
    label: z.string().max(24),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    terminal: z.boolean().default(false),
  })).min(2).max(12),
  transitions: z.array(z.object({
    from: z.string().max(24),
    to: z.string().max(24),
    label: z.string().max(24),
    when: ExprSchema.optional(),
    probability: ExprSchema.optional(),
  })).min(1).max(32),
  activeStateVar: VarIdSchema,
  showHistory: z.boolean().default(true),
  fireableEvents: z.array(z.object({ label: z.string().max(20), sets: z.string().max(40) })).max(6).optional(),
});

export const CompoundingLedgerConfigSchema = z.object({
  periods: ExprSchema,
  periodLabel: z.string().max(12).default("year"),
  series: z.array(z.object({
    label: z.string().max(24),
    trace: VarIdSchema,
    color: PaletteTokenSchema,
    stack: z.boolean().default(false),
  })).min(1).max(4),
  bars: z.boolean().default(true),
  cumulative: z.boolean().default(true),
  contributionAt: ExprSchema.optional(),
});

export const LayeredStackConfigSchema = z.object({
  layers: z.array(z.object({
    id: z.string().max(24),
    label: z.string().max(24),
    detail: z.string().max(60).optional(),
    color: PaletteTokenSchema,
  })).min(2).max(10),
  traversal: z.enum(["down", "up", "down-then-up", "none"]).default("down-then-up"),
  encapsulation: z.boolean().default(true),
  payloadVar: VarIdSchema.optional(),
  openable: z.boolean().default(true),
});

/**
 * Escape hatch. NOT a code channel — a validated list of primitive ops with expression-bound
 * arguments. BACKEND must justify choosing this over the nine real archetypes.
 */
export const DrawOpSchema = z.object({
  op: z.enum(["circle", "rect", "line", "text", "arc", "polygon", "arrow"]),
  args: z.array(ExprSchema).max(8),
  color: ColorExprSchema.optional(),
  fill: z.boolean().default(false),
  text: z.string().max(40).optional(),
  repeat: z.object({ over: EntitySetIdSchema }).optional(),
});
export type DrawOp = z.infer<typeof DrawOpSchema>;

export const FreeCanvasConfigSchema = z.object({
  draw: z.array(DrawOpSchema).min(1).max(LIMITS.maxDrawOps),
  justification: z.string().min(20).max(160),
});

export const ArchetypeConfigSchema = z.union([
  GraphNetworkConfigSchema, GridAutomatonConfigSchema, ParticleFieldConfigSchema,
  FunctionPlotConfigSchema, SequenceArrayConfigSchema, PipelineFlowConfigSchema,
  StateMachineConfigSchema, CompoundingLedgerConfigSchema, LayeredStackConfigSchema,
  FreeCanvasConfigSchema,
]);
export type ArchetypeConfig = z.infer<typeof ArchetypeConfigSchema>;

export const StageSchema = z.object({
  archetype: ArchetypeIdSchema,
  /** Always 100×100 spec space. The renderer applies the viewport transform. */
  viewport: z.object({ w: z.literal(100), h: z.literal(100) }).default({ w: 100, h: 100 }),
  background: z.enum(["grid", "plain", "axes", "dark-grid"]).default("plain"),
  layers: z.array(LayerSchema).min(1).max(LIMITS.maxLayers),
  annotations: z.array(AnnotationSchema).max(LIMITS.maxAnnotations).optional(),
  legend: z.array(LegendItemSchema).max(8).optional(),
  camera: z.object({ follow: ExprSchema.optional(), zoom: ExprSchema.optional() }).optional(),
  config: ArchetypeConfigSchema,
});
export type Stage = z.infer<typeof StageSchema>;

// TODO(API): refine — `config` must match `archetype`. Zod's union won't enforce the pairing, so
// add a superRefine that switches on archetype and re-parses config with the matching schema.
// Without this, a graph-network spec carrying a grid config reaches FRONTEND and throws mid-frame.

export const ObservableRefSchema = ObservableIdSchema;
