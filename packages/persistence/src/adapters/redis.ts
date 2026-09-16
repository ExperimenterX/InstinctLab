import { NotImplemented } from "@instinct/shared";
import type { SessionRepo } from "../session-repo.js";

/**
 * Multi-instance option. P4 — only needed once the app runs on more than one node.
 *
 * Mapping:
 *   session doc  → HASH at KEYS.session(id), fields as JSON strings
 *   transcript   → LIST at KEYS.events(id), RPUSH per batch (append-only, matches the contract)
 *   rev CAS      → a small Lua script, so the compare and the write are one round trip
 *   TTL          → EXPIRE on every write path; recall card gets the longer TTL
 *
 * Adding a redis client is a new runtime dependency — note it in Handoff notes (doc 06 §4).
 */
export function createRedisRepo(_url: string): SessionRepo {
  // TODO(BACKEND): P4
  throw new NotImplemented("persistence/createRedisRepo");
}
