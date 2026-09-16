/**
 * @instinct/lab-client — the browser harness around the simulation engine.
 *
 * lab-sim is the engine; this is everything that makes it feel alive in a browser: the frame
 * clock, the three state rings, the event bus that records what the learner did, and the React
 * bindings the UI consumes.
 *
 * The split matters: lab-sim can never import this (it must stay runnable in Node for grading),
 * and this must never leak per-frame data into React.
 *
 * Owner: FRONTEND. Spec: docs/04-state-management.md — that document is this package, literally.
 */
export * from "./clock.js";
export * from "./state/create-store.js";
export * from "./state/lab-store.js";
export * from "./state/session-store.js";
export * from "./state/selectors.js";
export * from "./bus/lab-bus.js";
export * from "./bus/event-recorder.js";
export * from "./bus/triggers.js";
export * from "./transport/sse.js";
export * from "./transport/api-client.js";
