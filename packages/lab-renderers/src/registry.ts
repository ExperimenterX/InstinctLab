import type { ArchetypeId } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor } from "./types.js";

/**
 * The only lookup from spec → renderer. FRONTEND calls `getArchetype(spec.stage.archetype)` and knows
 * nothing else about rendering.
 */
export const ARCHETYPES: Readonly<Record<ArchetypeId, ArchetypeDescriptor>> = {
  // TODO(FRONTEND): register each archetype here as you implement it.
  // Order of work (P1 first): function-plot, sequence-array, graph-network, grid-automaton,
  // particle-field, pipeline-flow, compounding-ledger, state-machine, layered-stack, free-canvas.
  // function-plot is P1 because it's the fallback spec's archetype — if it works, no generation
  // failure can leave the learner with a blank canvas.
} as Readonly<Record<ArchetypeId, ArchetypeDescriptor>>;

export function getArchetype(_id: ArchetypeId): ArchetypeDescriptor {
  // TODO(FRONTEND): lookup + a clear throw listing the registered ids
  throw new NotImplemented("lab-renderers/getArchetype");
}

export function isArchetypeImplemented(id: ArchetypeId): boolean {
  return Object.prototype.hasOwnProperty.call(ARCHETYPES, id);
}
