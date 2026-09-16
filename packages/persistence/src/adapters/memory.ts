import { NotImplemented } from "@instinct/shared";
import type { SessionRepo } from "../session-repo.js";

/**
 * BACKEND's P1 and the dev default. Every other agent integrates against this, so it has to be
 * correct before the other two adapters are interesting.
 *
 * A Map plus an events array — but the `rev` compare-and-set semantics must match the redis
 * adapter exactly, or API gets a 409 in production that never appears in dev.
 */
export function createMemoryRepo(): SessionRepo {
  // TODO(BACKEND): P1. Map<SessionId, Session> + Map<SessionId, LabEvent[]>.
  // Include a bounded sweep for expired sessions so a long dev run doesn't grow forever.
  throw new NotImplemented("persistence/createMemoryRepo");
}
