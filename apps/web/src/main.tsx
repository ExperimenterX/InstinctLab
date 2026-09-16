import { NotImplemented } from "@instinct/shared";

/**
 * SPA entry point.
 *
 * Two routes only — the prompt screen and the lab — plus a recap view. Use a minimal router
 * (a `useState` on `location.pathname` with `history.pushState` is genuinely enough here); a
 * routing library is not worth its weight for three screens.
 *
 *   /                 prompt screen
 *   /lab/:sessionId   the lab
 *   /recap/:sessionId the recall card + summary
 *
 * StrictMode double-invokes effects in development. That is a real hazard for this app: an effect
 * that builds the runtime or opens the SSE stream must be idempotent, or dev mode runs two
 * simulations and two streams against one session. Key the runtime on sessionId at module scope.
 */
export function mount(): void {
  // TODO(FRONTEND): createRoot(#root).render(<App />)
  throw new NotImplemented("web/mount");
}
