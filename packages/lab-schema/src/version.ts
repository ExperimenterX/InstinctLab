import { z } from "zod";

/** Bump only for breaking DSL changes. Unknown versions are rejected outright. */
export const SPEC_VERSION = "1.0" as const;

export const SpecVersionSchema = z.literal(SPEC_VERSION);
export type SpecVersion = z.infer<typeof SpecVersionSchema>;
