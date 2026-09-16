import { NotImplemented } from "@instinct/shared";

/**
 * Slider, stepper, toggle, or dial. onInput calls the useParam setter, which pokes the sim\n * synchronously BEFORE updating the store mirror.\n *\n * Never debounce this. Debouncing is precisely the lag the product exists to avoid.
 */
export function Knob(): JSX.Element {
  // TODO(FRONTEND)
  throw new NotImplemented("web/Knob");
}
