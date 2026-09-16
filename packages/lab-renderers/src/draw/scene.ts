import type { Highlight, LabSpec } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { SimCore } from "@instinct/lab-sim";
import type { CompiledStage, HitResult, PointerInfo, RenderContext, Viewport } from "../types.js";

/**
 * The canvas host. FRONTEND calls `attach()` ONCE per spec and then never touches rendering again —
 * the component takes zero animated props (doc 04, rule 3).
 *
 * Scene owns the draw loop, the viewport transform, DPR handling, resize, and the frame-boundary
 * error guard.
 */
export interface Scene {
  /** Draw one frame. Called from the clock's onTick, not from React. */
  draw(t: number, frame: number): void;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  hitTest(clientX: number, clientY: number): HitResult | null;
  /** Pointer down/move/up → archetype.onDrag → slab pokes. */
  handlePointer(kind: "down" | "move" | "up", clientX: number, clientY: number, buttons: number): void;
  setHighlight(h: Highlight | null): void;
  setTheme(mode: "light" | "dark"): void;
  setReducedMotion(v: boolean): void;
  /** Canvas → data URL for the recall card. ≤200KB, so downscale before encoding. */
  capture(maxBytes?: number): string | null;
  /** Frozen frame after a render error — the learner keeps a picture instead of a blank box. */
  readonly lastError: Error | null;
  dispose(): void;
}

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  spec: LabSpec;
  sim: SimCore;
  themeMode: "light" | "dark";
  reducedMotion: boolean;
  /** Applied via SimCore.poke when an interactive layer is dragged. */
  onPoke: (slot: number, value: number) => void;
  onEntityClick?: (layerId: string, entityIndex: number) => void;
  onRenderError?: (e: Error) => void;
}

/**
 * A render error is caught at the FRAME BOUNDARY: freeze the last good frame, report once, keep
 * the session alive (doc 02 §failure policy). A throwing draw loop must not take down the lab —
 * the learner can still read the knobs and the coach.
 */
export function createScene(_opts: SceneOptions): Scene {
  // TODO(FRONTEND): P1. compile the archetype, set up the transform, rAF-free draw (the clock drives),
  // ResizeObserver, try/catch around archetype.draw at the frame boundary (NOT inside it).
  throw new NotImplemented("lab-renderers/createScene");
}

/** Uniform scale + letterbox, so 100×100 spec space looks identical at any aspect ratio. */
export function computeViewport(_cssW: number, _cssH: number, _dpr: number): Viewport {
  throw new NotImplemented("lab-renderers/computeViewport");
}

export function toSpecSpace(_vp: Viewport, _clientX: number, _clientY: number, _rect: DOMRect): PointerInfo {
  throw new NotImplemented("lab-renderers/toSpecSpace");
}

/** Shared layer walk — resolves channel programs against the slab and emits primitive calls. */
export function drawLayers(_compiled: CompiledStage, _rc: RenderContext): void {
  throw new NotImplemented("lab-renderers/drawLayers");
}
