import type { SessionId } from "@instinct/lab-schema";

/** Key layout, shared by the redis and sqlite adapters so they stay swappable. */
export const KEYS = {
  session: (id: SessionId) => `ses:${id}`,
  events: (id: SessionId) => `ses:${id}:events`,
  digest: (id: SessionId) => `ses:${id}:digest`,
  /** Answer key, separate so it can never be included in a session read by accident. */
  assessmentKey: (id: SessionId) => `ses:${id}:key`,
  idempotency: (key: string) => `idem:${key}`,
  rateLimit: (bucket: string) => `rl:${bucket}`,
} as const;

export const DEFAULT_TTL_SECONDS = Number(process.env["INSTINCT_SESSION_TTL_SECONDS"] ?? 86_400);

/** Recap URLs outlive the lab, so the card gets a longer life than the transcript. */
export const RECALL_CARD_TTL_SECONDS = DEFAULT_TTL_SECONDS * 30;
