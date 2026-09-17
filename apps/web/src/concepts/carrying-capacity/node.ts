import type { ConceptNode } from "../types.js";
import { FUNCTION_PLOT_FIXTURE } from "../../canvas/renderers/function-plot/fixture.js";

/**
 * Concept node: carrying capacity.
 *
 * The reference node — it was built alongside the canvas and is the one every other node was
 * developed against. Its spec doubles as the `function-plot` renderer's fixture, so the renderer
 * and the concept are verified by the same data.
 */
export const carryingCapacityNode: ConceptNode = {
  id: "carrying-capacity",
  title: "Carrying Capacity",
  domain: "biology",
  summary: "Growth rate sets how fast the ceiling arrives, not how high it is.",
  notes: `
Logistic growth against a fixed environmental ceiling, with unbounded exponential growth drawn
alongside as the intuition being corrected.

The prediction is the whole node: pushing growth rate to maximum barely moves the 24-hour
population, because the colony has already saturated. People reliably expect the opposite.
`.trim(),
  spec: FUNCTION_PLOT_FIXTURE,
};
