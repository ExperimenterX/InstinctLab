import { NotImplemented } from "./errors.js";

/**
 * All ids come from here (doc 00 §6). Never Math.random() inline, never Date.now() as an id.
 * Format: `<prefix>_` + 22 base58 chars from crypto.getRandomValues.
 */
export const ID_PREFIXES = {
  session: "ses",
  lab: "lab",
  assessment: "asm",
  request: "req",
  event: "evt",
  prediction: "prd",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export function newId(_prefix: IdPrefix): string {
  // TODO(API): crypto.getRandomValues(new Uint8Array(16)) → base58, 22 chars
  throw new NotImplemented("shared/newId");
}

export function isId(_prefix: IdPrefix, _value: string): boolean {
  // TODO(API): /^<prefix>_[1-9A-HJ-NP-Za-km-z]{22}$/
  throw new NotImplemented("shared/isId");
}

/**
 * Stable digest for prediction snapshot verification (doc 05 /predict).
 * Must be deterministic across client and server — same input, same string.
 */
export function digest(_input: string | ArrayBufferView): string {
  // TODO(API): FNV-1a 64-bit hex. Non-cryptographic is fine; this proves "same state", not identity.
  throw new NotImplemented("shared/digest");
}
