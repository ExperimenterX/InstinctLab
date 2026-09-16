import type { ArchetypeManifest, EffectiveLimits, SessionId, StreamEvent } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { PlanInput } from "./plan.js";

/**
 * Drives plan → composeCore → composePedagogy → validate → repair, emitting SSE events as each
 * section lands. API wires the emitter to the response stream; BACKEND persists on `lab.ready`.
 *
 * This function owns the whole latency budget (doc 00 §7). Emit as early as possible, always.
 */
export interface GenerateDeps {
  emit: (event: StreamEvent) => void;
  persist: {
    setPlan(p: unknown): Promise<void>;
    setSpec(s: unknown): Promise<number>;
    setStatus(s: string): Promise<void>;
  };
  manifest: ArchetypeManifest;
  limits: EffectiveLimits;
  signal: AbortSignal;
}

export async function generateLab(
  _sessionId: SessionId,
  _input: PlanInput,
  _deps: GenerateDeps,
): Promise<void> {
  // TODO(BACKEND): P2. Sequence and emit:
  //   plan()        → emit lab.plan            (shell + skeleton canvas; ~1.2s)
  //   composeCore() → emit lab.model, lab.stage (CANVAS LIVE — the moment that matters)
  //   composePedagogy() → emit lab.controls, lab.beats
  //   validate → repair ≤2 → persist → emit lab.ready
  //   on unrecoverable failure → degradeToFallback → emit lab.fallback
  //
  // Never throw out of here. A thrown error kills the stream and the learner sees a dead page;
  // emit `error` (inline banner) or `lab.fallback` instead.
  throw new NotImplemented("ai-core/generateLab");
}

/**
 * Cap the composer's limits by what the device can actually render. Applied as a hard ceiling
 * on the schema we constrain against — NOT as a sentence in the prompt. Models ignore
 * suggestions; they cannot ignore a bound (doc 05 POST /labs).
 */
export function effectiveLimitsFor(_caps: {
  sharedArrayBuffer: boolean;
  reducedMotion: boolean;
  maxEntities?: number;
}): EffectiveLimits {
  // TODO(BACKEND): clamp maxEntities and maxTickRate; reducedMotion ⇒ tickRate ≤ 30
  throw new NotImplemented("ai-core/effectiveLimitsFor");
}
