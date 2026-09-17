import { z } from "zod";

/**
 * Config for the `market-tape` renderer.
 *
 * Same split as `structure-diagram`: the spec does not describe the picture. It names the knobs
 * that parameterise a price path and an execution rule, and the renderer runs the real
 * simulation. The expression language is arithmetic and cannot integrate a stochastic path, so
 * the renderer owns the maths and the spec owns the parameters.
 *
 * Everything that is not a knob is fixed here rather than left to the drawing code, so a second
 * concept node can reuse this renderer with a different trading rule without touching render.ts.
 */

export const MarketTapeConfigSchema = z.object({
  /** How many bars to simulate and reveal. Capped by the renderer. */
  bars: z.number().int().min(20).max(1024).default(240),

  /**
   * Seeds the noise tape. Fixed in the spec, never derived from the knobs — that is what keeps
   * the market identical while a knob moves.
   */
  seed: z.number().int().default(4404),

  /** Param driving stop distance, measured in average bar ranges (ATR). */
  stop_param: z.string().min(1),

  /** Param driving per-bar volatility, in percent. */
  vol_param: z.string().min(1),

  /** Param driving per-bar drift — the edge — in basis points. */
  drift_param: z.string().min(1).optional(),

  /** Profit target as a multiple of the risked distance. Fixed, not a knob. */
  target_r: z.number().min(0.25).max(10).default(2),

  /** Spread and commission paid on entry and again on exit, in basis points. */
  cost_bps: z.number().min(0).max(100).default(5),

  /** Shown above the chart. Short — it is a legend, not an explanation. */
  note: z.string().max(80).optional(),
});
export type MarketTapeConfig = z.infer<typeof MarketTapeConfigSchema>;
