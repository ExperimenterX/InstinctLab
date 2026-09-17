import { z } from "zod";

/**
 * Config for the `depth-ladder` renderer.
 *
 * A two-sided quantity distribution over a sorted price axis, with an order walked down it.
 * The spec names the knobs; the renderer runs the matching. As with the other structural
 * renderers, there is no geometry to author.
 */

export const DepthLadderConfigSchema = z.object({
  /** Levels per side. Capped by the renderer. */
  levels: z.number().int().min(4).max(40).default(24),

  /** Price increment between levels. */
  tick: z.number().positive().max(10).default(0.05),

  /** Reference price the book is built around. */
  mid: z.number().positive().default(100),

  /** Resting quantity at the touch, before the liquidity multiplier. */
  base_qty: z.number().positive().max(10000).default(60),

  /** Param driving how much the order tries to buy. */
  size_param: z.string().min(1),

  /** Param driving resting size at each level — the liquidity multiplier. */
  depth_param: z.string().min(1).optional(),

  /** Param driving how many pieces the order is split into, spaced over time. */
  slices_param: z.string().min(1).optional(),

  /** Distance between best bid and best ask, in ticks. Fixed, not a knob. */
  spread_ticks: z.number().min(1).max(40).default(2),

  /** Fraction of consumed size that returns between slices. */
  refill: z.number().min(0).max(1).default(0.3),

  /** How fast depth thins away from the touch. Higher spreads it out. */
  shape: z.number().min(0.2).max(5).default(1),

  /** Shown above the ladder. Short — it is a legend, not an explanation. */
  note: z.string().max(80).optional(),
});
export type DepthLadderConfig = z.infer<typeof DepthLadderConfigSchema>;
