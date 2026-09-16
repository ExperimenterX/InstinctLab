import type { KernelId } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { VmContext } from "../expr-vm.js";
import type { ParamTable } from "../param-table.js";

/**
 * Named numerical integrators, for dynamics an expression list models badly (doc 03 §3).
 *
 * CLOSED SET. The AI picks one and configures it; it cannot add one. A kernel is a generic
 * numerical method — `verlet`, `diffusion-2d` — never a topic. A file named `tcp-window.ts` in
 * this folder is a bug.
 */
export interface KernelContext extends VmContext {
  table: ParamTable;
  /** Kernel config with each Expr already evaluated to a number for this tick. */
  config: Readonly<Record<string, number>>;
}

/** Same contract as SimCore.step: mutates the slab in place, allocates nothing. */
export type Kernel = (ctx: KernelContext, dt: number) => void;

export interface KernelDescriptor {
  id: KernelId;
  summary: string;
  /** Config keys with defaults. Feeds GET /archetypes, so the AI prompt stays in sync. */
  configKeys: ReadonlyArray<{ key: string; summary: string; default: number }>;
  /** Entity attrs the kernel requires, so the schema can verify the spec provides them. */
  requiredAttrs: readonly string[];
  kernel: Kernel;
}

export const KERNELS: Readonly<Record<KernelId, KernelDescriptor>> = {
  // TODO(BACKEND): register each as you implement it. Order of work:
  //   1. verlet, spring-damper, logistic-growth, random-walk  (cheapest, widest coverage)
  //   2. diffusion-2d, cellular-automaton, sir-epidemic
  //   3. nbody-gravity, queue-network, gradient-descent
} as Readonly<Record<KernelId, KernelDescriptor>>;

export function getKernel(_id: KernelId): KernelDescriptor {
  // TODO(BACKEND): lookup + a throw that lists the registered ids
  throw new NotImplemented("lab-sim/getKernel");
}

/** Manifest fragment for GET /archetypes. Include only implemented kernels. */
export function kernelManifest(): ReadonlyArray<{ id: string; summary: string; configSchema: unknown }> {
  throw new NotImplemented("lab-sim/kernelManifest");
}
