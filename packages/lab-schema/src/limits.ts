/**
 * Hard bounds on AI-authored numbers (doc 03 §9).
 *
 * These are Zod bounds, not lint. Model output is untrusted input (N3) — an unclamped entity
 * count is a frozen tab, and an unclamped expression depth is a hung parser.
 *
 * `maxParams: 8` is the one pedagogical limit in the list: nine knobs is not a lab, it's a
 * cockpit. Do not raise it for a "just this once" spec.
 */
export const LIMITS = {
  maxEntities: 2000,
  maxEntitySets: 4,
  maxLinks: 6000,
  maxParams: 8,
  maxVars: 24,
  maxDerived: 24,
  maxObservables: 8,
  maxNotables: 6,
  maxLayers: 12,
  maxAnnotations: 12,
  maxBeats: 12,
  maxPresetsPerBeat: 4,
  maxPredictions: 3,
  maxQuizItems: 5,
  minQuizItems: 3,
  maxExprNodes: 512,
  maxExprDepth: 24,
  maxExprChars: 400,
  maxVmSteps: 2000,
  maxTickRate: 120,
  minTickRate: 1,
  maxSpecBytes: 131072,
  maxHistory: 2048,
  maxDrawOps: 200,
  maxEventsPerBatch: 256,
  maxConceptChars: 280,
  minConceptChars: 3,
  maxCoachWords: 40,
  maxCaptionChars: 90,
} as const;

export type Limits = typeof LIMITS;

/** Client capability ceilings shrink the above per-device (doc 05 POST /labs). */
export interface EffectiveLimits extends Limits {
  maxEntities: number;
  maxTickRate: number;
}
