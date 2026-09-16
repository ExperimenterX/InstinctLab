import { z } from "zod";
import { ParamIdSchema } from "./ids.js";

export const ControlKindSchema = z.enum([
  "slider",     // continuous
  "stepper",    // integer, ± buttons
  "toggle",     // 0 | 1
  "select",     // enumerated values
  "dial",       // angular, for cyclic params
  "xy-pad",     // two params at once
  "button",     // one-shot: sets a value then reverts
]);
export type ControlKind = z.infer<typeof ControlKindSchema>;

export const ControlSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/),
  param: ParamIdSchema,
  kind: ControlKindSchema,
  /**
   * `primary` is the knob the lab is about — rendered large, and the one the INTERACT beat
   * unlocks. Exactly one control should be primary.
   */
  prominence: z.enum(["primary", "secondary", "advanced"]).default("secondary"),
  /** For `select`; for `xy-pad` the second param. */
  options: z.array(z.object({ label: z.string().max(20), value: z.number() })).max(8).optional(),
  paramY: ParamIdSchema.optional(),
  /** Show the live numeric value next to the control. Off for qualitative knobs. */
  showValue: z.boolean().default(true),
  icon: z.string().max(20).optional(),
});
export type Control = z.infer<typeof ControlSchema>;

// TODO(API): refine — every `param` resolves to a declared Param; `select` requires options;
// `xy-pad` requires paramY; at most one `primary`; `toggle` requires the param's range to be [0,1].
