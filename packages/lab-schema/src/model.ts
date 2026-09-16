import { z } from "zod";
import { LIMITS } from "./limits.js";
import { AssignmentSchema, ExprSchema, ReduceSchema } from "./expr.js";
import {
  DerivedIdSchema, EntitySetIdSchema, ObservableIdSchema, ParamIdSchema, VarIdSchema,
} from "./ids.js";

export const ParamSchema = z.object({
  id: ParamIdSchema,
  label: z.string().min(1).max(24),
  unit: z.string().max(8).optional(),
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().positive().finite(),
  default: z.number().finite(),
  scale: z.enum(["linear", "log"]).default("linear"),
  /** Observable ids this knob moves. Drives the clamp-no-effect coach trigger (doc 02). */
  affects: z.array(ObservableIdSchema).min(1),
  explain: z.string().min(4).max(80),
}).refine((p) => p.min < p.max, { message: "min must be < max" })
  .refine((p) => p.default >= p.min && p.default <= p.max, { message: "default out of range" });
export type Param = z.infer<typeof ParamSchema>;

export const VarSchema = z.object({
  id: VarIdSchema,
  init: ExprSchema,
  clamp: z.tuple([z.number(), z.number()]).optional(),
  /** Ring-buffer length for plotting this var over time. */
  history: z.number().int().min(0).max(LIMITS.maxHistory).optional(),
});
export type Var = z.infer<typeof VarSchema>;

export const TopologySchema = z.enum(["ring", "grid", "random", "star", "chain", "mesh", "explicit"]);
export type Topology = z.infer<typeof TopologySchema>;

export const LinkSpecSchema = z.object({
  to: EntitySetIdSchema.optional(),
  /** Per-pair predicate, evaluated with `i`, `j`, and both entities' attrs in scope. */
  when: ExprSchema.optional(),
  weight: ExprSchema.optional(),
  directed: z.boolean().default(false),
  explicit: z.array(z.tuple([z.number().int(), z.number().int()])).max(LIMITS.maxLinks).optional(),
});
export type LinkSpec = z.infer<typeof LinkSpecSchema>;

/**
 * A homogeneous population with per-entity numeric attributes. Stored column-wise
 * (struct-of-arrays) by SimCore so the renderer can iterate one attribute in cache (doc 04).
 *
 * `attrs` exprs are evaluated per-entity with `i` (index) and `n` (count) bound — this is how the
 * AI says "lay 40 nodes on a circle" without writing code.
 */
export const EntitySetSchema = z.object({
  id: EntitySetIdSchema,
  count: ExprSchema,
  attrs: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,23}$/), ExprSchema),
  topology: TopologySchema.optional(),
  links: LinkSpecSchema.optional(),
});
export type EntitySet = z.infer<typeof EntitySetSchema>;

export const DerivedSchema = z.object({
  id: DerivedIdSchema,
  expr: ExprSchema,
  /** With `over`, aggregates across an entity set: { over: "nodes", reduce: "sum", expr: "load" }. */
  reduce: ReduceSchema.optional(),
  over: EntitySetIdSchema.optional(),
});
export type Derived = z.infer<typeof DerivedSchema>;

/** Named numerical integrators in lab-sim/sim/kernels. Closed set — the AI configures, never adds. */
export const KernelIdSchema = z.enum([
  "verlet", "spring-damper", "nbody-gravity", "diffusion-2d", "cellular-automaton",
  "queue-network", "logistic-growth", "random-walk", "sir-epidemic", "gradient-descent",
]);
export type KernelId = z.infer<typeof KernelIdSchema>;

export const RuleSchema = z.object({
  when: ExprSchema,
  then: z.array(AssignmentSchema).min(1).max(8),
  once: z.boolean().default(false),
  label: z.string().max(40).optional(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const DynamicsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("expr"),
    step: z.array(AssignmentSchema).max(LIMITS.maxVars),
    entityStep: z.record(z.string(), z.array(AssignmentSchema).max(12)).optional(),
  }),
  z.object({
    kind: z.literal("kernel"),
    kernel: KernelIdSchema,
    config: z.record(z.string(), ExprSchema),
  }),
  z.object({
    kind: z.literal("rules"),
    rules: z.array(RuleSchema).min(1).max(24),
  }),
]);
export type Dynamics = z.infer<typeof DynamicsSchema>;

export const ObservableSchema = z.object({
  id: ObservableIdSchema,
  label: z.string().min(1).max(24),
  source: z.union([DerivedIdSchema, VarIdSchema]),
  format: z.enum(["number", "percent", "currency", "bytes", "duration", "integer"]).default("number"),
  precision: z.number().int().min(0).max(6).default(2),
  /** Crossing one fires the regime-change coach trigger. */
  thresholds: z.array(z.object({ at: z.number(), regime: z.string().max(24) })).max(4).optional(),
  goodDirection: z.enum(["up", "down", "none"]).default("none"),
});
export type Observable = z.infer<typeof ObservableSchema>;

/**
 * Interesting states worth congratulating. Polled at ≤4Hz, not every tick.
 * The quiz builder prefers UNDISCOVERED notables — they're the regimes the learner never saw.
 */
export const NotableSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
  when: ExprSchema,
  label: z.string().min(2).max(40),
  insight: z.string().min(8).max(100),
});
export type Notable = z.infer<typeof NotableSchema>;

export const InvariantSchema = z.object({
  expr: ExprSchema,
  message: z.string().max(80),
});
export type Invariant = z.infer<typeof InvariantSchema>;

export const ModelSchema = z.object({
  params: z.array(ParamSchema).min(1).max(LIMITS.maxParams),
  vars: z.array(VarSchema).max(LIMITS.maxVars),
  entities: z.array(EntitySetSchema).max(LIMITS.maxEntitySets).optional(),
  derived: z.array(DerivedSchema).max(LIMITS.maxDerived),
  dynamics: DynamicsSchema,
  observables: z.array(ObservableSchema).min(1).max(LIMITS.maxObservables),
  notables: z.array(NotableSchema).max(LIMITS.maxNotables).optional(),
  invariants: z.array(InvariantSchema).max(8).optional(),
  tickRate: z.number().int().min(LIMITS.minTickRate).max(LIMITS.maxTickRate).default(60),
  timeScale: z.number().min(0.05).max(20).default(1),
});
export type Model = z.infer<typeof ModelSchema>;

// TODO(API): cross-field refinements, applied in spec.ts where the whole spec is in scope:
//   - every id unique across params ∪ vars ∪ derived
//   - every Observable.source resolves
//   - every Param.affects entry resolves
//   - every Expr's identifiers are in scope (checkExprScope)
//   - Derived.over set exists when reduce is present
//   - dynamics.kind === "expr" ⇒ every step.target is a declared var
//   - WARNING (not error): dynamics contain no feedback loop — i.e. no step expr reads a param,
//     transitively. A lab where the learner's input doesn't feed back is a diagram, not a lab.
