import { z } from "zod";

/**
 * Branded id types. Branding is deliberate: passing a ParamId where an ObservableId belongs is
 * the most likely cross-agent mistake in this codebase, and the compiler should catch it.
 */
const brand = <B extends string>(b: B, re: RegExp) =>
  z.string().regex(re).brand<B>();

/** snake_case identifiers the AI authors and expressions reference. */
const SNAKE = /^[a-z][a-z0-9_]{0,39}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const ParamIdSchema = brand("ParamId", SNAKE);
export const VarIdSchema = brand("VarId", SNAKE);
export const DerivedIdSchema = brand("DerivedId", SNAKE);
export const ObservableIdSchema = brand("ObservableId", SNAKE);
export const EntitySetIdSchema = brand("EntitySetId", SNAKE);
export const BeatIdSchema = brand("BeatId", SLUG);
export const PredictionIdSchema = brand("PredictionId", SLUG);
export const LayerIdSchema = brand("LayerId", SLUG);

export type ParamId = z.infer<typeof ParamIdSchema>;
export type VarId = z.infer<typeof VarIdSchema>;
export type DerivedId = z.infer<typeof DerivedIdSchema>;
export type ObservableId = z.infer<typeof ObservableIdSchema>;
export type EntitySetId = z.infer<typeof EntitySetIdSchema>;
export type BeatId = z.infer<typeof BeatIdSchema>;
export type PredictionId = z.infer<typeof PredictionIdSchema>;
export type LayerId = z.infer<typeof LayerIdSchema>;

/** Server-minted ids (prefix_ + 22 base58), from @instinct/shared/id. */
export const SessionIdSchema = z.string().regex(/^ses_[1-9A-HJ-NP-Za-km-z]{22}$/).brand<"SessionId">();
export const LabIdSchema = z.string().regex(/^lab_[1-9A-HJ-NP-Za-km-z]{22}$/).brand<"LabId">();
export const AssessmentIdSchema = z.string().regex(/^asm_[1-9A-HJ-NP-Za-km-z]{22}$/).brand<"AssessmentId">();

export type SessionId = z.infer<typeof SessionIdSchema>;
export type LabId = z.infer<typeof LabIdSchema>;
export type AssessmentId = z.infer<typeof AssessmentIdSchema>;

/** Anything a var/derived/param can name — the addressable scalar namespace. */
export const ScalarRefSchema = z.union([ParamIdSchema, VarIdSchema, DerivedIdSchema]);
export type ScalarRef = z.infer<typeof ScalarRefSchema>;
