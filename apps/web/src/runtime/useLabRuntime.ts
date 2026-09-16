import { NotImplemented } from "@instinct/shared";

/**
 * Builds the LabRuntime bundle (SimCore, Clock, stores, bus, recorder) ONCE per sessionId and
 * provides it to the React tree via LabRuntimeContext.
 *
 * Two dev-only hazards this must survive, both capable of eating an afternoon:
 *  - React StrictMode double-invokes effects, so a naive useEffect builds two simulations and
 *    opens two SSE streams against one session
 *  - Vite HMR re-executes the module, so a runtime held in a useRef is rebuilt on every edit,
 *    resetting a simulation the developer was mid-experiment on
 *
 * Both are solved the same way: a module-scope Map<sessionId, LabRuntime> that outlives both.
 */
export function useLabRuntimeFor(_sessionId: string): unknown {
  // TODO(FRONTEND): module-scope cache; dispose on real unmount only, never on an HMR cycle
  throw new NotImplemented("web/useLabRuntimeFor");
}
