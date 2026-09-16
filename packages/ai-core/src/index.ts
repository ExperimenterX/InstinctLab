/**
 * @instinct/ai-core — Claude orchestration. SERVER ONLY.
 *
 * Never import this from a client component: it reads ANTHROPIC_API_KEY and it is the only
 * package in the repo that does.
 *
 * Pipeline: plan → composeCore → composePedagogy → validate → repair → persist,
 * streamed to the client so the canvas goes live before generation finishes (doc 02).
 */
export * from "./client.js";
export * from "./models.js";
export * from "./pipeline/plan.js";
export * from "./pipeline/compose.js";
export * from "./pipeline/repair.js";
export * from "./pipeline/orchestrator.js";
export * from "./pedagogy/coach.js";
export * from "./pedagogy/prediction.js";
export * from "./pedagogy/quiz-builder.js";
export * from "./pedagogy/grader.js";
export * from "./pedagogy/remix.js";
export * from "./guards/budget.js";
export * from "./guards/prompt-guard.js";
