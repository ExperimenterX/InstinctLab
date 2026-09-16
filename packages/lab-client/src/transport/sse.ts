import type { SessionId, StreamEvent } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";

/**
 * The SSE client. One connection per session, for the whole session.
 *
 * Reconnect rules (doc 05 §Client transport rules):
 *  - exponential backoff 1s → 16s, with jitter
 *  - send `Last-Event-ID` so the server can replay
 *  - show a subtle reconnecting chip, NEVER a modal — the learner can keep playing with the
 *    lab while the stream is down; the simulation is local and does not need the network
 *  - spec events are idempotent by contract, so applying a replayed one twice is a no-op
 */
export interface SseClient {
  connect(): void;
  close(): void;
  readonly state: "connecting" | "open" | "reconnecting" | "closed";
}

export interface SseClientOptions {
  sessionId: SessionId;
  baseUrl: string;
  onEvent: (event: StreamEvent) => void;
  onStateChange: (state: SseClient["state"]) => void;
}

export function createSseClient(_opts: SseClientOptions): SseClient {
  // TODO(FRONTEND): native EventSource does not support custom headers but does support
  // Last-Event-ID automatically — prefer it over a fetch-based reader unless you need headers.
  throw new NotImplemented("lab-client/createSseClient");
}
