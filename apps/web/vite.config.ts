import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite + React SPA. No SSR, no file-system router, no server framework.
 *
 * Why not a meta-framework (doc adr/0002): a lab is a client-side canvas application. Server
 * rendering buys nothing — there is no meaningful first paint before the simulation compiles —
 * and it costs a hydration pass, a heavier dev loop, and an awkward seam with the API service.
 *
 * NOTE for the frontend owner: HMR is a hazard here, not just a convenience. A hot update that
 * remounts the canvas resets a running simulation mid-experiment. Keep the runtime bundle
 * (SimCore, Clock, stores) behind a module-scope singleton keyed by sessionId so an HMR cycle
 * re-renders the shell without rebuilding the sim.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /**
     * COOP/COEP enable SharedArrayBuffer, which lets the sim run in a Worker for heavy labs
     * (doc 04). Without them `createClock` silently falls back to the rAF backend — correct,
     * just capped lower. This is one line here and a genuine fight in a meta-framework.
     */
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      /** Proxy to the API service in dev so the browser sees one origin and CORS stays simple. */
      "/api": {
        target: process.env["INSTINCT_API_URL"] ?? "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  worker: { format: "es" },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
