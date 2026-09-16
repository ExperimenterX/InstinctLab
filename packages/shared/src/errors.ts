/**
 * Every unimplemented skeleton function throws this. See N4 in docs/00-START-HERE.md.
 *
 * The rule exists because a stub that returns `[]` or `{}` looks like real data to the
 * integrating agent, who then spends twenty minutes debugging an empty canvas. A thrown
 * error with a location costs them five seconds.
 */
export class NotImplemented extends Error {
  constructor(where: string, hint?: string) {
    super(`NotImplemented: ${where}${hint ? ` — ${hint}` : ""}`);
    this.name = "NotImplemented";
  }
}

/** Invariant violations — a bug in our code, not bad input. Always throws, never returned. */
export class InvariantError extends Error {
  constructor(message: string) {
    super(`Invariant violated: ${message}`);
    this.name = "InvariantError";
  }
}

export function invariant(cond: unknown, message: string): asserts cond {
  if (!cond) throw new InvariantError(message);
}

/** Error codes from docs/05-api-contract.md. API keeps this in sync with the API schemas. */
export const ERROR_CODES = [
  "BAD_REQUEST",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "GENERATION_FAILED",
  "SPEC_INVALID",
  "MODEL_TIMEOUT",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

/** Thrown by domain code; API maps it to an HTTP status + ErrorEnvelope. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const HTTP_STATUS_FOR_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  GENERATION_FAILED: 503,
  SPEC_INVALID: 422,
  MODEL_TIMEOUT: 504,
  INTERNAL: 500,
};
