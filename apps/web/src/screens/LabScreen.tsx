import { NotImplemented } from "@instinct/shared";

/**
 * The product. Layout, roughly:
 *
 *   +----------------------------------------------+--------------+
 *   |  caption (<=90 chars, often absent)          |  observable  |
 *   |                                              |  read-outs   |
 *   |              LabCanvas                       |  (10Hz)      |
 *   |              (mounts once, never re-renders) |              |
 *   |                                              +--------------+
 *   +----------------------------------------------+  knob panel  |
 *   |  phase rail / time controls / presets        |              |
 *   +----------------------------------------------+--------------+
 *                     coach dock (bottom, transient)
 *
 * The canvas dominates. The learner should be able to describe what is on screen without reading
 * anything (doc 01, SEE phase), which makes text peripheral chrome here rather than a column of
 * its own.
 */
export function LabScreen(_props: { sessionId: string }): JSX.Element {
  // TODO(FRONTEND): build the runtime once per sessionId, open the SSE stream, render
  // progressively as sections arrive: skeleton canvas -> live canvas -> knobs -> phase rail
  throw new NotImplemented("web/LabScreen");
}
