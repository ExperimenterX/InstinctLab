import { NotImplemented } from "@instinct/shared";
import type { ResolvedTheme } from "../types.js";

/**
 * The AI picks colour MEANINGS; we pick pixels (doc 03 §5). Raw hex in a spec is rejected by
 * API's schema, so this is the only place colour is decided.
 *
 * Requirements:
 *  - every token legible on both light and dark backgrounds
 *  - the categorical series distinguishable under the common colour-vision deficiencies
 *  - `warn`/`danger` never the only signal for a state — pair with a shape or label change
 *
 * FRONTEND: run the `dataviz` skill before choosing these values. It carries a validated palette and a
 * contrast checker; do not eyeball it.
 */
export const PALETTE_TOKENS = [
  "accent", "accent-soft", "ok", "warn", "danger", "muted", "fg", "bg", "grid",
  "series-0", "series-1", "series-2", "series-3", "series-4", "series-5",
] as const;

export type ThemeMode = "light" | "dark";

export function resolveTheme(_mode: ThemeMode): ResolvedTheme {
  // TODO(FRONTEND): P1. Token→hex map per mode, plus the three scale functions.
  // Pre-resolve scales into a lookup table (e.g. 64 steps) — interpolating per entity per frame
  // is a measurable cost at 2000 entities.
  throw new NotImplemented("lab-renderers/resolveTheme");
}

/** Sequential/diverging ramps, quantised to a fixed number of steps for cheap per-entity lookup. */
export function buildScaleLut(
  _kind: "sequential" | "diverging" | "categorical",
  _mode: ThemeMode,
  _steps?: number,
): readonly string[] {
  throw new NotImplemented("lab-renderers/buildScaleLut");
}
