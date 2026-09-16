import { NotImplemented } from "@instinct/shared";

/**
 * API service entry point. Fastify, Node 22+, no framework magic.
 *
 * Why Fastify over a meta-framework: this service does exactly two unusual things — it holds a
 * long-lived SSE connection per session, and it streams model output into that connection. Both
 * want direct access to the raw response stream and full control over headers and backpressure.
 * A framework that abstracts the response away fights you on both.
 *
 * Owner: API. Contract: docs/05-api-contract.md.
 */
export interface ServerOptions {
  port: number;
  host: string;
  /** Allowed origin for the SPA. One origin, explicitly — never `*` with credentials. */
  corsOrigin: string;
}

export async function buildServer(_opts: ServerOptions): Promise<unknown> {
  // TODO(API): P1.
  //   fastify({ logger })
  //   → register @fastify/cors with the single SPA origin
  //   → decorate the instance with the ServerContext (repo, manifest, limiters)
  //   → register route plugins from ./routes
  //   → set a global error handler that emits the doc 05 error envelope and never a stack trace
  //
  // Do NOT add a body-size limit above what doc 05 needs, and do not enable a global
  // request timeout — the SSE route is intentionally long-lived and a global timeout kills it.
  throw new NotImplemented("api/buildServer");
}

export async function start(): Promise<void> {
  // TODO(API): P1. Read env, buildServer, listen, and handle SIGTERM by closing open SSE
  // streams before exiting — a dropped stream mid-generation loses a learner's lab.
  throw new NotImplemented("api/start");
}
