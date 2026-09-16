import { NotImplemented } from "@instinct/shared";

/**
 * The most performance-critical component in the app, and the rule is simple:
 *
 *   IT MOUNTS ONCE PER SPEC AND TAKES ZERO ANIMATED PROPS.
 *
 * It owns a <canvas>, hands it to createScene, and never re-renders for simulation reasons. The
 * renderer reads the Float64Array slab directly; React is not in the frame loop at all.
 *
 * If you find yourself adding a prop that changes during play, that value belongs in the sim or
 * behind an imperative call on the scene handle, not in this signature (doc 04, rule 3).
 *
 * No useState in this component. None.
 */
export function LabCanvas(_props: {
  /** Changing this is the ONLY legitimate reason to remount. */
  specId: string;
}): JSX.Element {
  // TODO(FRONTEND): canvas ref -> createScene({ canvas, spec, sim, onPoke })
  // -> clock.onTick(draw) -> ResizeObserver -> pointer handlers -> dispose on unmount
  throw new NotImplemented("web/LabCanvas");
}
