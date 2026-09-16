import type { LabPlan, LabSpec, SpecIssue } from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

/**
 * Two-tier repair, tried in order — mechanical before conversational.
 *
 * Constrained decoding already guarantees the shape, so what survives to here is *semantic*:
 * a dangling id, an out-of-scope expression identifier, an archetype/config mismatch, or a
 * pedagogical warning like "no feedback loop".
 */
export interface RepairInput {
  spec: unknown;
  issues: SpecIssue[];
  attempt: number;
}

/**
 * Tier 1 — API's `repairLabSpec`. Deterministic, no model call, no pedagogy invented.
 * Tier 2 — hand the issues back to the composer and ask for a corrected spec. Only the failing
 *          sections are re-asked, not the whole document.
 *
 * After MAX_REPAIR_ATTEMPTS, stop and degrade (below). Looping a third time costs the learner
 * more than a shallower lab does.
 */
export async function repair(_input: RepairInput): Promise<Result<LabSpec, SpecIssue[]>> {
  // TODO(BACKEND): P3. tier 1 → re-validate → tier 2 (model) → re-validate
  throw new NotImplemented("ai-core/repair");
}

/**
 * The floor. Builds a minimal valid spec from the plan alone via `fallbackSpecFromPlan`.
 *
 * We never show a generation error to a learner who typed a real question (doc 02 §failure
 * policy). A one-knob function-plot lab is a worse lab and a far better product than an error
 * page — and `function-plot` is FRONTEND's P1 precisely so this path always renders.
 */
export function degradeToFallback(_plan: LabPlan, _reason: string): LabSpec {
  // TODO(BACKEND): P3
  throw new NotImplemented("ai-core/degradeToFallback");
}
