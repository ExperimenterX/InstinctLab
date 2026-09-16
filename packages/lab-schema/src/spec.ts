import { z } from "zod";
import { NotImplemented, type Result } from "@instinct/shared";
import { SpecVersionSchema } from "./version.js";
import { LabIdSchema } from "./ids.js";
import { MetaSchema } from "./meta.js";
import { ModelSchema } from "./model.js";
import { StageSchema } from "./stage.js";
import { ControlSchema } from "./controls.js";
import { BeatsSchema } from "./beats.js";
import { AssessmentPlanSchema } from "./assessment.js";
import { CoachConfigSchema } from "./coach.js";
import { LIMITS } from "./limits.js";

/**
 * The artifact the AI authors and the client executes.
 *
 * Key ordering is the STREAMING order (doc 02): meta → model → stage → controls → beats. Each
 * section validates independently so the canvas goes live while the rest is still generating.
 */
export const LabSpecSchema = z.object({
  specVersion: SpecVersionSchema,
  id: LabIdSchema,
  meta: MetaSchema,
  model: ModelSchema,
  stage: StageSchema,
  controls: z.array(ControlSchema).min(1).max(LIMITS.maxParams),
  beats: BeatsSchema,
  assessment: AssessmentPlanSchema,
  coach: CoachConfigSchema,
});
export type LabSpec = z.infer<typeof LabSpecSchema>;

/** Partial spec during streaming. FRONTEND must tolerate any prefix of this. */
export const PartialLabSpecSchema = LabSpecSchema.partial({
  model: true, stage: true, controls: true, beats: true, assessment: true, coach: true,
});
export type PartialLabSpec = z.infer<typeof PartialLabSpecSchema>;

// ── Validation & repair ───────────────────────────────────────────────────────────────────────

export interface SpecIssue {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface SpecValidation {
  valid: boolean;
  issues: SpecIssue[];
  spec: LabSpec | null;
}

/**
 * Schema parse + cross-field refinements + pedagogical lint.
 *
 * ERRORS are schema/reference failures — a dangling observable id, an out-of-scope identifier,
 * a config that doesn't match its archetype.
 *
 * WARNINGS are pedagogical (doc 05 /specs/validate). BACKEND feeds these back to the model in the
 * repair loop. The highest-value one: "dynamics contain no feedback loop" — a lab where the
 * learner's input never feeds back is a diagram, not a lab.
 */
export function validateLabSpec(_input: unknown): SpecValidation {
  // TODO(API): LabSpecSchema.safeParse, then referential integrity, then lint rules
  throw new NotImplemented("lab-schema/validateLabSpec");
}

/**
 * Deterministic, mechanical repairs only — clamp an out-of-range default, drop a dangling
 * annotation, coerce a tickRate over the limit. NEVER invent pedagogy here: a missing prediction
 * or an empty teachingAngle goes back to the model, because guessing it would silently ship a
 * bad lab that looks fine.
 */
export function repairLabSpec(_input: unknown): Result<{ spec: LabSpec; notes: string[] }, SpecIssue[]> {
  // TODO(API): mechanical fixes, then re-validate; return the issues if still invalid
  throw new NotImplemented("lab-schema/repairLabSpec");
}

/** Byte-size guard, checked before persisting or streaming (LIMITS.maxSpecBytes). */
export function specSizeOk(spec: LabSpec): boolean {
  return JSON.stringify(spec).length <= LIMITS.maxSpecBytes;
}

/** Minimal valid spec from a plan alone — the `lab.fallback` path when COMPOSE fails twice. */
export function fallbackSpecFromPlan(_plan: unknown): LabSpec {
  // TODO(API): one param, one derived, one function-plot layer, 6 beats, 1 prediction.
  // A shallow lab beats an error page (doc 02 §failure policy).
  throw new NotImplemented("lab-schema/fallbackSpecFromPlan");
}
