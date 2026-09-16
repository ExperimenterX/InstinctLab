import type { SessionId, StreamEvent } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { ServerContext } from "./context.js";

/**
 * SSE framing. Owned here rather than in a plugin because the header set and the teardown are
 * both easy to get subtly wrong and expensive to debug.
 */
export interface SseWriter {
  send(event: StreamEvent, id?: string): void;
  /** Comment line every 15s. Proxies and load balancers drop idle connections. */
  heartbeat(): void;
  close(): void;
  readonly closed: boolean;
}

/**
 * Required headers:
 *   content-type: text/event-stream
 *   cache-control: no-cache, no-transform
 *   connection: keep-alive
 *   x-accel-buffering: no      ← without this a proxy buffers the stream and the learner sees
 *                                nothing until generation finishes, defeating progressive mount
 */
export function createSseWriter(_reply: unknown, _ctx: ServerContext): SseWriter {
  // TODO(API): hijack the reply, write headers, return a writer. On close: unregister from the
  // hub AND clear the heartbeat interval — a leaked interval per dropped connection is a slow
  // leak that only shows up under real load.
  throw new NotImplemented("api/createSseWriter");
}

/**
 * Replay on reconnect. Re-emits lab.model → lab.stage → lab.controls → lab.beats → lab.ready
 * from the persisted spec, then resumes live events.
 *
 * Spec events are idempotent by contract, so replaying more than strictly necessary is safe and
 * replaying too little is not. Err toward replaying everything.
 */
export async function replayFromPersisted(
  _sessionId: SessionId,
  _lastEventId: string | null,
  _writer: SseWriter,
  _ctx: ServerContext,
): Promise<void> {
  // TODO(API)
  throw new NotImplemented("api/replayFromPersisted");
}
