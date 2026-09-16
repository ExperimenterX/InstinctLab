import type { CreateLabRequest, SessionId } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { ServerContext } from "./context.js";
import type { SseWriter } from "./sse.js";

/**
 * Bridges POST /labs (returns in <150ms) to GET /stream (does the work).
 *
 * Generation starts when the client OPENS THE STREAM, not on POST. Starting it on POST races the
 * client's stream open, and SSE has no replay buffer — any event emitted before the stream
 * attaches is simply lost. Starting on stream-open makes the race impossible.
 */
export async function startGeneration(
  _sessionId: SessionId,
  _input: CreateLabRequest,
  _writer: SseWriter,
  _ctx: ServerContext,
): Promise<void> {
  // TODO(API): effectiveLimitsFor(clientCapabilities) → generateLab(...) with an emit that
  // writes to the SseWriter and a persist that calls the repo.
  // Catch everything — a throw here kills the stream and the learner gets a dead page.
  throw new NotImplemented("api/startGeneration");
}

/**
 * Called from POST /events after the transcript is appended.
 *
 * Runs the rule check and, if a trigger fires, generates the coach message ASYNCHRONOUSLY and
 * pushes it on the open stream. Do not await the model here — /events has a 50ms budget and the
 * learner's hand must never wait on the network (doc 02 §interaction lifecycle).
 */
export function maybeCoach(_sessionId: SessionId, _ctx: ServerContext): { coachPending: boolean } {
  // TODO(API): fire-and-forget; publish via the StreamHub when it resolves. If the stream has
  // closed by then, drop the message silently.
  throw new NotImplemented("api/maybeCoach");
}
