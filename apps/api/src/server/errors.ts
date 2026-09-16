import { AppError, HTTP_STATUS_FOR_CODE, type ErrorCode, type ErrorEnvelope } from "@instinct/shared";
import { NotImplemented } from "@instinct/shared";

/** The only error shape that leaves this service (doc 05 §Conventions). */
export function errorBody(
  _code: ErrorCode,
  _message: string,
  _requestId: string,
  _details?: Record<string, unknown>,
): ErrorEnvelope {
  // TODO(API)
  throw new NotImplemented("api/errorBody");
}

/**
 * Global error handler. Unknown errors become INTERNAL with a generic message — log the detail
 * server-side, never ship a stack trace to a learner.
 *
 * Map `NotImplemented` to INTERNAL but log it as a stub hit rather than a crash: during the build
 * phase it is the expected state, and drowning the log in fake crashes hides real ones.
 */
export function toErrorResponse(_e: unknown, _requestId: string): {
  status: number;
  body: ErrorEnvelope;
} {
  // TODO(API): AppError → its code; ZodError → BAD_REQUEST with issues; 429 sets retry-after
  throw new NotImplemented("api/toErrorResponse");
}

export { AppError, HTTP_STATUS_FOR_CODE };
export type { ErrorEnvelope };
