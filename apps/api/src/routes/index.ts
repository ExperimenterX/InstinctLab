import { NotImplemented } from "@instinct/shared";

/**
 * Route registration. One plugin per resource group; the full endpoint table is in
 * docs/05-api-contract.md and that document is authoritative over these file names.
 *
 *   labs.ts        POST /labs · GET|PATCH /labs/:id · POST /labs/:id/remix
 *   stream.ts      GET  /labs/:id/stream            ← SSE, the spine of the experience
 *   events.ts      POST /labs/:id/events            ← 50ms budget, never awaits a model
 *   predict.ts     POST /labs/:id/predict
 *   coach.ts       POST /labs/:id/coach
 *   assessment.ts  POST /labs/:id/assessment · POST /labs/:id/assessment/grade
 *   recap.ts       GET  /labs/:id/recap
 *   meta.ts        POST /specs/validate · GET /archetypes · GET /health
 */
export async function registerRoutes(_app: unknown): Promise<void> {
  // TODO(API): P1. Register in the order above. `stream` first while iterating — it is the
  // only route the frontend cannot fake, so it unblocks the other owner soonest.
  throw new NotImplemented("api/registerRoutes");
}
