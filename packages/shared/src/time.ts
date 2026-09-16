/** Frame delta is clamped so a background tab or a breakpoint can't teleport the sim (doc 00 §6). */
export const MAX_DT_SECONDS = 0.05;

export function clampDt(dtSeconds: number): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) return 0;
  return dtSeconds > MAX_DT_SECONDS ? MAX_DT_SECONDS : dtSeconds;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Seeded PRNG (mulberry32). The sim's only randomness source, so a lab is reproducible and a
 * prediction can be replayed from an identical state (doc 03 §4, doc 04 §snapshots).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
