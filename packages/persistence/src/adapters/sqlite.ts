import { NotImplemented } from "@instinct/shared";
import type { SessionRepo } from "../session-repo.js";

/**
 * Single-machine durable option. P3 — `node:sqlite` (Node 22+) so it adds no dependency.
 *
 * Schema sketch:
 *   sessions(id TEXT PK, rev INTEGER, status TEXT, concept TEXT, seed INTEGER,
 *            plan JSON, spec JSON, progress JSON, predictions JSON,
 *            assessment JSON, assessment_key JSON, grade JSON, recall_card JSON,
 *            created_at TEXT, updated_at TEXT, expires_at TEXT)
 *   events(session_id TEXT, seq INTEGER, payload JSON, PRIMARY KEY (session_id, seq))
 *
 * `setPhase` is `UPDATE … WHERE id = ? AND rev = ?` — zero rows changed means CONFLICT.
 */
export function createSqliteRepo(_path: string): SessionRepo {
  // TODO(BACKEND): P3
  throw new NotImplemented("persistence/createSqliteRepo");
}
