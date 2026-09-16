/**
 * @instinct/lab-sim — the simulation engine. Pure TypeScript, no DOM, no React, no browser.
 *
 * It runs in three places, which is why it has no environment dependencies at all:
 *   - the browser, driven by lab-client's Clock (60fps)
 *   - a Web Worker, over a SharedArrayBuffer, for heavy labs
 *   - Node, headless, so the API can grade `tune` quiz items by re-running the simulation
 *     instead of trusting a number the client reported
 *
 * That third one is a correctness requirement, not a nicety. Note the `lib` in this package's
 * tsconfig excludes DOM deliberately — if you reach for `window` or `performance`, it won't
 * compile, and that is the point.
 *
 * Owner: BACKEND. Spec: docs/03-lab-spec-dsl.md §3–4.
 */
export * from "./sim-core.js";
export * from "./param-table.js";
export * from "./snapshot.js";
export * from "./expr-parser.js";
export * from "./expr-vm.js";
export * from "./kernels/index.js";
export * from "./headless.js";
