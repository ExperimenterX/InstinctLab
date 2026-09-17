import type { z } from "zod";
import type { Theme } from "./theme.js";

/**
 * THE SEAM.
 *
 * Every canvas archetype is a "node": a self-contained folder implementing this interface. Nodes
 * do not import each other and never touch shared files, so three people can build three nodes
 * in parallel with no coordination beyond this file.
 *
 * A node owns four things:
 *   NODE.md      what it draws, what it teaches, what its config means
 *   schema.ts    its config shape (Zod) — the only part the AI must learn
 *   render.ts    compile + draw + optional hit-testing
 *   fixture.ts   a complete example lab, so the node runs standalone at /node/<id>
 *
 * The fixture is not a test convenience. It is how a node gets "spun up" on its own, before the
 * generator knows the archetype exists and without waiting on anyone else's work.
 */

/** Passed to `draw` every frame. Nothing here is allocated per frame by the caller. */
export interface RenderCtx {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels. DPR is already applied to the context transform — ignore devicePixelRatio. */
  cssW: number;
  cssH: number;
  theme: Theme;
  /** Current knob values, keyed by param id. */
  params: Readonly<Record<string, number>>;
  /** Seconds since the lab mounted. Only needed by nodes that animate. */
  t: number;
  /** True while frozen for a prediction — draw recessively. */
  dimmed: boolean;
  /** Optional value marker, drawn by the node in its own coordinate space. */
  marker?: { value: number; label: string; kind: "guess" | "actual" } | undefined;
}

/** Opaque per-node compile output. Each node casts this to its own private type. */
export interface CompiledStage {
  readonly archetype: string;
}

export interface Hit {
  /** Param the node wants written, if this hit is draggable. */
  param?: string;
  value?: number;
}

export interface ArchetypeNode<Cfg = unknown> {
  id: string;
  /** Shown in the node gallery. */
  label: string;
  /** One line for the AI's archetype menu — what kind of concept this grammar fits. */
  bestFor: string;

  /**
   * Config schema. The AI only ever needs to learn this, plus the shared spec fields.
   * Loosely typed because a schema using `.default()` has a different input type from its
   * output type, which `ZodType<Cfg>` cannot express; `compile`/`analyze` carry the real type.
   */
  configSchema: z.ZodTypeAny;

  /**
   * Once per spec. Parse expressions, resolve geometry, allocate buffers here — `draw` must
   * allocate nothing, because it runs up to 60 times a second.
   */
  compile(cfg: Cfg, ctx: CompileCtx): CompiledStage;

  /** Every frame. No allocation. Reads `rc.params`; never mutates anything. */
  draw(compiled: CompiledStage, rc: RenderCtx): void;

  /** Optional direct manipulation. Return the param write the pointer implies. */
  hitTest?(compiled: CompiledStage, rc: RenderCtx, x: number, y: number): Hit | null;

  /**
   * Static check, run by the spec parser before anything is drawn.
   *
   * This hook is why the parser needs no knowledge of any node: it asks the node whether its own
   * config is coherent, and which params the config actually depends on. The parser then enforces
   * the one universal rule — that at least one param is referenced, or the knobs do nothing and
   * there is no lab.
   */
  analyze(cfg: Cfg, ctx: CompileCtx): NodeAnalysis;

  /** A complete lab using this node, so it can run standalone at /node/<id>. */
  fixtureJson: unknown;
}

export interface NodeAnalysis {
  /** Hard problems: a bad expression, a dangling reference, an impossible domain. */
  errors: string[];
  /** Things that will render but probably teach badly. */
  warnings: string[];
  /** Declared params this config actually reads. Drives the "is any knob live" check. */
  referencedParams: Set<string>;
}

/** What a node is given at compile time, besides its own config. */
export interface CompileCtx {
  /** Declared param ids — the variables a node's expressions may reference. */
  paramIds: readonly string[];
}

/** Shared frame geometry, so every node insets its plot area identically. */
export interface Frame {
  left: number;
  top: number;
  w: number;
  h: number;
}

export const FRAME_PAD = { top: 18, right: 96, bottom: 34, left: 56 } as const;

export function frameOf(cssW: number, cssH: number): Frame {
  return {
    left: FRAME_PAD.left,
    top: FRAME_PAD.top,
    w: Math.max(10, cssW - FRAME_PAD.left - FRAME_PAD.right),
    h: Math.max(10, cssH - FRAME_PAD.top - FRAME_PAD.bottom),
  };
}
