import type { ArchetypeId, Highlight, LabSpec, Mark, Stage } from "@instinct/lab-schema";
import type { SimCore } from "@instinct/lab-sim";

/** Viewport transform: spec space (0–100, origin top-left) → device pixels. */
export interface Viewport {
  width: number;
  height: number;
  dpr: number;
  /** Uniform scale + letterbox offsets, so a lab looks the same at any aspect ratio. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  sim: SimCore;
  spec: LabSpec;
  /** Sim time and frame — passed in rather than read, so a scrubbed frame draws correctly. */
  t: number;
  frame: number;
  theme: ResolvedTheme;
  /** Set by a coach highlight or a beat's `focus`. Pulse it; don't redesign the frame around it. */
  highlight: Highlight | null;
  /** From prefers-reduced-motion: skip trails, tween-free transitions. */
  reducedMotion: boolean;
}

export interface ResolvedTheme {
  mode: "light" | "dark";
  color(token: string): string;
  /** Sequential / diverging / categorical scales, pre-resolved to avoid per-entity work. */
  scale(kind: "sequential" | "diverging" | "categorical", tNorm: number): string;
  font: { body: string; mono: string; label: string };
  strokeWidth: { hair: number; base: number; bold: number };
}

/**
 * The compiled, draw-ready form of a Stage. Built ONCE per spec: every channel Expr is already
 * parsed to bytecode and every constant is resolved, so `draw()` does arithmetic and nothing else.
 */
export interface CompiledStage {
  archetype: ArchetypeId;
  layerCount: number;
  /** Opaque per-archetype payload — pre-allocated scratch, parsed programs, layout caches. */
  readonly internal: unknown;
}

export interface PointerInfo {
  /** Spec-space coordinates, already inverse-transformed. */
  x: number;
  y: number;
  buttons: number;
  shift: boolean;
}

export interface HitResult {
  layerId: string;
  entityIndex: number;
  /** Distance in spec units — the caller picks the nearest hit across layers. */
  distance: number;
}

/**
 * One archetype. `compile` runs once; `draw` runs every frame and must ALLOCATE NOTHING —
 * same rule as SimCore.step, same reason (doc 04).
 */
export interface ArchetypeRenderer {
  id: ArchetypeId;
  compile(stage: Stage, spec: LabSpec, sim: SimCore): CompiledStage;
  draw(compiled: CompiledStage, rc: RenderContext): void;
  hitTest(compiled: CompiledStage, rc: RenderContext, p: PointerInfo): HitResult | null;
  /** Called on drag of an interactive layer. Returns slab writes for the caller to apply. */
  onDrag?(
    compiled: CompiledStage,
    rc: RenderContext,
    hit: HitResult,
    p: PointerInfo,
  ): ReadonlyArray<{ slot: number; value: number }>;
  dispose?(compiled: CompiledStage): void;
}

/** Feeds GET /archetypes, which feeds BACKEND's composer prompt. Keep it truthful and current. */
export interface ArchetypeDescriptor {
  id: ArchetypeId;
  summary: string;
  /** Kinds of concept this grammar fits — phrased structurally, never as topic names. */
  bestFor: readonly string[];
  supportedMarks: readonly Mark[];
  interactions: readonly string[];
  maxEntities: number;
  /** Illustrative only. These strings live HERE, in a manifest, and nowhere in renderer logic. */
  examples: readonly string[];
  renderer: ArchetypeRenderer;
}
