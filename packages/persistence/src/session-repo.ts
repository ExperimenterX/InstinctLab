import type {
  Assessment, BeatId, GradeResult, LabEvent, LabPlan, LabSpec, Phase, PredictionAnswer,
  PredictionId, RecallCard, Session, SessionId, SessionStatus, TranscriptDigest,
} from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

/**
 * The storage contract. Deliberately NOT a generic `save(session)`.
 *
 * Every method is a narrow operation because events, phase changes, and generation progress all
 * write concurrently to the same document. A read-modify-write of the whole session loses
 * transcript events under any real load — which would silently degrade the quiz, since the
 * transcript IS the quiz material.
 */
export interface SessionRepo {
  create(input: {
    id: SessionId;
    concept: string;
    seed: number;
    ttlSeconds: number;
    parentSessionId?: SessionId;
  }): Promise<Result<Session, Error>>;

  get(id: SessionId): Promise<Result<Session | null, Error>>;

  setStatus(id: SessionId, status: SessionStatus): Promise<Result<number, Error>>;
  setPlan(id: SessionId, plan: LabPlan): Promise<Result<number, Error>>;
  setSpec(id: SessionId, spec: LabSpec): Promise<Result<number, Error>>;

  /**
   * Compare-and-set on `rev`. Returns CONFLICT on a stale write so API can 409 and the client
   * refetches. Phase may only move forward, or back to an already-completed beat — enforced
   * here, not in the client, because a client that jumps to `recall` would see the answers.
   */
  setPhase(
    id: SessionId,
    expectedRev: number,
    patch: { phase?: Phase; beatId?: BeatId; completedBeat?: BeatId },
  ): Promise<Result<{ rev: number }, "CONFLICT" | Error>>;

  /** Append-only, never read-modify-write. The hot write path — keep it cheap. */
  appendEvents(id: SessionId, events: readonly LabEvent[]): Promise<Result<number, Error>>;

  /** Derived, not stored raw. See digest.ts. */
  transcriptDigest(id: SessionId): Promise<Result<TranscriptDigest, Error>>;

  commitPrediction(
    id: SessionId,
    predictionId: PredictionId,
    answer: PredictionAnswer,
    verdict: "correct" | "close" | "wrong",
    actualValue: number | null,
  ): Promise<Result<number, Error>>;

  /** `key` is the answer key. It lives here and is never serialised to a client. */
  setAssessment(id: SessionId, assessment: Assessment, key: unknown): Promise<Result<number, Error>>;
  getAssessmentKey(id: SessionId): Promise<Result<unknown, Error>>;

  setGrade(id: SessionId, grade: GradeResult): Promise<Result<number, Error>>;
  setRecallCard(id: SessionId, card: RecallCard): Promise<Result<number, Error>>;

  touchTtl(id: SessionId, ttlSeconds: number): Promise<Result<void, Error>>;
  health(): Promise<{ status: "up" | "down"; adapter: "memory" | "sqlite" | "redis" }>;
}

/** Picks the adapter from INSTINCT_PERSISTENCE. Memory is the dev default. */
export function createSessionRepo(): SessionRepo {
  // TODO(BACKEND): switch on process.env.INSTINCT_PERSISTENCE
  throw new NotImplemented("persistence/createSessionRepo");
}
