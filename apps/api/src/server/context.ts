import type { ArchetypeManifest } from "@instinct/lab-schema";
import type { SessionRepo } from "@instinct/persistence";
import { NotImplemented, type Logger, type RateLimiter } from "@instinct/shared";

/**
 * Built ONCE per process, not per request. The manifest in particular is derived from the
 * renderer registry and never changes at runtime.
 *
 * This is also the only place in the deployed system that touches `ai-core` and `persistence`.
 * The frontend is a separate build and physically cannot import either — that separation is the
 * main structural benefit of splitting the API out of the SPA.
 */
export interface ServerContext {
  repo: SessionRepo;
  manifest: ArchetypeManifest;
  log: Logger;
  limiter: { labs: RateLimiter; coach: RateLimiter };
  requestId: string;
}

export function createServerContext(): Omit<ServerContext, "requestId"> {
  // TODO(API): createSessionRepo() + buildArchetypeManifest() + createLogger(), memoised at
  // module scope. Only `requestId` and the child logger are per-request.
  throw new NotImplemented("api/createServerContext");
}

/**
 * In-process fan-out for SSE. One stream per session; the coach is pushed onto it.
 *
 * Single-instance only. Multi-instance needs redis pub/sub, because the publisher and the open
 * stream can land on different nodes — and the symptom is a coach that silently never speaks,
 * which is very hard to notice in testing.
 */
export interface StreamHub {
  register(sessionId: string, push: (event: unknown) => void): () => void;
  publish(sessionId: string, event: unknown): void;
  has(sessionId: string): boolean;
}

export function createStreamHub(): StreamHub {
  // TODO(API): module-scope Map<sessionId, Set<push>>
  throw new NotImplemented("api/createStreamHub");
}
