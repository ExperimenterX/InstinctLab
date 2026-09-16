import type {
  Assessment, Beat, Control, LabPlan, LabSpec, Model, PartialLabSpec, RecallCard, SessionId,
  SessionStatus, Stage, StreamEvent,
} from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";
import type { Store } from "./create-store.js";

/**
 * Ring 2 — network-rate state. Immutable snapshots, ordinary React rendering. The only ring where
 * returning a fresh object from useSyncExternalStore is fine.
 */
export interface SessionState {
  sessionId: SessionId | null;
  status: SessionStatus;
  plan: LabPlan | null;
  /** Grows as SSE sections arrive; becomes a full LabSpec at `lab.ready`. */
  partialSpec: PartialLabSpec | null;
  spec: LabSpec | null;
  streamPhase: "idle" | "planning" | "composing" | "ready" | "failed";
  assessment: Assessment | null;
  recallCard: RecallCard | null;
  connection: "open" | "reconnecting" | "closed";
  lastEventId: string | null;
  rev: number;
  error: { code: string; message: string } | null;
}

export interface SessionStore extends Store<SessionState> {
  /**
   * Merge one SSE event. Spec events are IDEMPOTENT — on reconnect the server replays
   * lab.model → lab.stage → lab.controls → lab.beats → lab.ready, so receiving any of them twice
   * must be harmless (doc 05).
   */
  applyStreamEvent(event: StreamEvent): void;

  setPlan(plan: LabPlan): void;
  setModel(model: Model): void;
  setStage(stage: Stage): void;
  setControls(controls: readonly Control[]): void;
  setBeats(beats: readonly Beat[]): void;
  markReady(spec: LabSpec, rev: number): void;
  setConnection(state: SessionState["connection"]): void;
  setAssessment(a: Assessment): void;
  setRecallCard(c: RecallCard): void;
  fail(code: string, message: string): void;
  reset(): void;
}

export function createSessionStore(_sessionId?: SessionId): SessionStore {
  // TODO(FRONTEND): applyStreamEvent switch + the setters
  throw new NotImplemented("lab-client/createSessionStore");
}

/**
 * Compose accumulated sections into a full LabSpec, or report what is still missing. The UI uses
 * the missing list to decide what to render as a skeleton.
 */
export function assembleSpec(_partial: PartialLabSpec): { spec: LabSpec | null; missing: string[] } {
  throw new NotImplemented("lab-client/assembleSpec");
}
