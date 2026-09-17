import { z } from "zod";

/**
 * Config for the `function-plot` node.
 *
 * This is the only part of the spec the generator must learn in order to target this node. Every
 * numeric is bounded — config is model-authored, so an unbounded domain or series count is a
 * frozen tab rather than a bad chart.
 */

export const SERIES_COLORS = ["series-1", "series-2", "series-3"] as const;

export const SeriesSchema = z.object({
  label: z.string().min(1).max(24),
  /** Arithmetic in `x` and any declared param id. Evaluated by the sandboxed compiler. */
  expr: z.string().min(1).max(400),
  color: z.enum(SERIES_COLORS),
  style: z.enum(["line", "dashed"]).default("line"),
});
export type Series = z.infer<typeof SeriesSchema>;

export const FunctionPlotConfigSchema = z.object({
  x_label: z.string().min(1).max(24),
  y_label: z.string().min(1).max(24),
  x_domain: z.tuple([z.number().finite(), z.number().finite()]),
  /**
   * Fixed for the life of the lab. The node never auto-scales: an axis that rescales while the
   * learner drags makes a growing curve look static, which hides the effect they should notice.
   * So the generator has to pick a domain that fits the whole knob range.
   */
  y_domain: z.tuple([z.number().finite(), z.number().finite()]),
  series: z.array(SeriesSchema).min(1).max(3),
});
export type FunctionPlotConfig = z.infer<typeof FunctionPlotConfigSchema>;
