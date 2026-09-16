import type { ArchetypeManifest } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";

/**
 * Builds the GET /archetypes payload from the registry + BACKEND's kernel list + API's limits.
 *
 * This is the main defence against BACKEND's prompt and FRONTEND's renderers drifting apart: the model's
 * options are GENERATED FROM THE CODE THAT EXISTS. When FRONTEND adds a config field, the composer
 * prompt learns about it for free. Nobody hand-maintains a capability list in a prompt string.
 */
export function buildArchetypeManifest(): ArchetypeManifest {
  // TODO(FRONTEND): map ARCHETYPES → descriptors, pull kernelManifest() from lab-sim,
  // EXPR_FUNCTIONS + LIMITS from lab-schema. Include ONLY implemented archetypes — offering the
  // model an archetype that throws is worse than offering it fewer choices.
  throw new NotImplemented("lab-renderers/buildArchetypeManifest");
}
