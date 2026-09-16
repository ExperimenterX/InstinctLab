import type { z } from "zod";
import { NotImplemented } from "@instinct/shared";
import type { ServerContext } from "./context.js";

/**
 * The handler wrapper every route uses, so the order in doc 05 §Conventions is enforced in one
 * place instead of thirteen:
 *
 *   1. validate body with the lab-schema Zod schema   → 400
 *   2. resolve session                                → 404
 *   3. rate limit                                    → 429
 *   4. do the work                                   → 5xx
 *   5. respond against the lab-schema response type
 *
 * Auth-before-parse and rate-limit-after-the-model-call are both real bugs. This wrapper makes
 * them impossible to write by accident.
 */
export interface HandlerDeps<TBody> {
  body: TBody;
  ctx: ServerContext;
  params: Record<string, string>;
  /** Set when `requireSession` is true, so handlers never re-fetch it. */
  session: unknown;
}

export interface RouteOptions<TBody> {
  schema?: z.ZodType<TBody>;
  requireSession?: boolean;
  rateLimit?: "labs" | "coach" | null;
  /** Honour `Idempotency-Key`. Needed on POST /labs and /assessment. */
  idempotent?: boolean;
}

/** Returns a Fastify handler. Typed loosely here so the route files stay framework-thin. */
export function handler<TBody, TResult>(
  _opts: RouteOptions<TBody>,
  _fn: (deps: HandlerDeps<TBody>) => Promise<TResult>,
): unknown {
  // TODO(API): P1
  throw new NotImplemented("api/handler");
}
