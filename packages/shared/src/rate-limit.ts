import { NotImplemented } from "./errors.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

/**
 * Token bucket. Guards POST /labs and /remix (each costs a model call).
 * In-memory is fine for single-instance dev; BACKEND's redis adapter supplies the shared store later.
 */
export function createRateLimiter(_opts: {
  capacity: number;
  refillPerSecond: number;
}): RateLimiter {
  // TODO(API): in-memory token bucket keyed by ip|sessionId, with a bounded LRU of keys
  throw new NotImplemented("shared/createRateLimiter");
}
