import { NotImplemented } from "./errors.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Child logger with bound fields, e.g. `log.child({ sessionId })`. */
  child(fields: Record<string, unknown>): Logger;
}

/**
 * Structured JSON lines. Never log learner prompt text at info level — it is user content;
 * log its length and a digest instead.
 */
export function createLogger(_level: LogLevel = "info"): Logger {
  // TODO(API): JSON-line logger honouring LOG_LEVEL, with child field merging
  throw new NotImplemented("shared/createLogger");
}

/** Convenience singleton for skeleton code. Prefer an injected child logger. */
export const log: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return log;
  },
};
