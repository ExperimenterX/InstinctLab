import { NotImplemented } from "@instinct/shared";

/**
 * Freezes the sim and asks for a commitment. The answer surface matches the prediction kind: a\n * slider to place a numeric guess, a click target on the canvas, multiple choice, an ordering.\n *\n * Two load-bearing rules:\n *  - the outcome is NOT revealed until the learner commits. No preview, no hover hint.\n *  - committing is irreversible, and the UI says so before they do it.\n *\n * A wrong prediction is worth more than a right one, so the framing should make guessing feel\n * safe rather than graded.
 */
export function PredictModal(): JSX.Element {
  // TODO(FRONTEND)
  throw new NotImplemented("web/PredictModal");
}
