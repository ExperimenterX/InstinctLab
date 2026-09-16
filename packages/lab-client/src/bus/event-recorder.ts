import type { LabEvent, SessionId } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { LabBus } from "./lab-bus.js";

/**
 * Ships the transcript to POST /events.
 *
 * Flush policy (doc 04):
 *  - every 2000ms, or at 64 buffered events
 *  - IMMEDIATELY for prediction.commit / beat.complete / quiz.answer — these gate server-side
 *    progress, so a 2s delay makes the UI feel broken
 *  - navigator.sendBeacon on pagehide
 *
 * Fire-and-forget: retry once, then drop. A dropped event must NEVER block the sim or the UI.
 */
export interface EventRecorder {
  start(): void;
  stop(): void;
  /** Manual flush, e.g. just before navigating to the quiz. */
  flushNow(): Promise<void>;
  readonly droppedCount: number;
}

export interface EventRecorderOptions {
  sessionId: SessionId;
  endpoint: string;
  intervalMs?: number;
  batchMax?: number;
  /** Kinds that bypass the interval and flush immediately. */
  urgentKinds?: readonly LabEvent["kind"][];
  onCoachPending?: () => void;
}

export function createEventRecorder(_bus: LabBus, _opts: EventRecorderOptions): EventRecorder {
  // TODO(FRONTEND): interval timer + urgent-kind subscription + sendBeacon on pagehide.
  // Use `keepalive: true` on the fetch so a flush survives navigation.
  throw new NotImplemented("lab-client/createEventRecorder");
}
