import { NotImplemented } from "@instinct/shared";

/**
 * GET /labs/:id/stream — SSE. The single most important route in the service.
 *
 * Fastify specifics that will cost you an afternoon if missed:
 *  - take over the raw stream (`reply.raw`) and `reply.hijack()`; do not return a value
 *  - headers: `content-type: text/event-stream`, `cache-control: no-cache, no-transform`,
 *    `connection: keep-alive`, and **`x-accel-buffering: no`** — without the last one a proxy
 *    buffers the stream and the learner sees nothing until generation finishes, which defeats
 *    the entire progressive-mount design
 *  - no global request timeout may apply to this route
 *  - on `request.raw.on("close")`: unregister from the hub AND clear the heartbeat interval.
 *    A leaked interval per dropped connection is a slow leak that only appears under real load.
 *
 * Two entry paths:
 *  - fresh session, no spec yet → start generation, stream sections as they land
 *  - spec already persisted (reconnect) → replay lab.model → … → lab.ready, then go live
 *
 * Generation starts HERE, not in POST /labs, so it cannot race the client's stream open. SSE has
 * no replay buffer: any event emitted before the stream attaches is simply lost.
 */
export async function streamRoutes(_app: unknown): Promise<void> {
  // TODO(API): P1
  throw new NotImplemented("api/streamRoutes");
}
