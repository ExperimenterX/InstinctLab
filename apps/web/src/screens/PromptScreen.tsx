import { NotImplemented } from "@instinct/shared";

/**
 * The entire entry point: one input box.
 *
 * Nothing else earns its place here. No topic picker, no example gallery, no difficulty selector
 * — every one of those is a decision the learner has to make before they get to learn anything,
 * and the AI makes a better version of all of them from the concept string alone.
 */
export function PromptScreen(): JSX.Element {
  // TODO(FRONTEND): input -> collect capabilities -> POST /labs -> navigate to /lab/:id
  throw new NotImplemented("web/PromptScreen");
}
