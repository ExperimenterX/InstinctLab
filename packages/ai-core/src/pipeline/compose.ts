import type {
  AssessmentPlan, Beat, CoachConfig, Control, EffectiveLimits, LabPlan, Model, Stage,
} from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

/**
 * Stage 2, split in two so the canvas goes live before the pedagogy exists.
 *
 * Why split rather than stream one big object: structured output arrives as one constrained JSON
 * document, so incremental section-by-section emission would mean partial-JSON parsing. Two calls
 * are simpler and the second is cheap — the system prompt (DSL rules + archetype manifest) is
 * identical across both, so it's a prompt-cache hit.
 *
 * The ordering is also pedagogically free: the SEE beat needs no controls, so the learner is
 * already watching the simulation while `composePedagogy` is still running.
 */

export interface ComposeCoreInput {
  plan: LabPlan;
  concept: string;
  limits: EffectiveLimits;
}

/** model + stage = a live, interactive canvas. This is the latency-critical half. */
export interface ComposeCoreOutput {
  model: Model;
  stage: Stage;
}

export async function composeCore(
  _input: ComposeCoreInput,
): Promise<Result<ComposeCoreOutput, Error>> {
  // TODO(BACKEND): P2. composer model, effort xhigh, streamed, structured against
  // z.object({ model: ModelSchema, stage: StageSchema }).
  //
  // The single hardest requirement on this call: THE DYNAMICS MUST CONTAIN A FEEDBACK LOOP.
  // A step expression that never reads a param produces a diagram, not a lab (doc 03 §10).
  // API's validator emits that as a warning — feed it back in repair and re-ask.
  throw new NotImplemented("ai-core/composeCore");
}

export interface ComposePedagogyInput {
  plan: LabPlan;
  concept: string;
  /** Param/observable/notable ids the pedagogy may reference. Derived, not re-sent verbatim. */
  core: ComposeCoreOutput;
}

export interface ComposePedagogyOutput {
  controls: Control[];
  beats: Beat[];
  assessment: AssessmentPlan;
  coach: CoachConfig;
}

export async function composePedagogy(
  _input: ComposePedagogyInput,
): Promise<Result<ComposePedagogyOutput, Error>> {
  // TODO(BACKEND): P2. Same system prompt (cache hit), different user turn.
  // Enforce in the prompt AND check after: `see` unlocks nothing, the first `interact` beat
  // unlocks exactly one param, and the prediction question is not answerable from any caption.
  throw new NotImplemented("ai-core/composePedagogy");
}
