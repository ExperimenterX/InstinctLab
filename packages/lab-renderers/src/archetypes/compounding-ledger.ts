import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/** Balances accumulating over discrete periods — bars and/or cumulative lines. */
export const compoundingLedgerRenderer: ArchetypeRenderer = {
  id: "compounding-ledger",
  compile() {
    // TODO(FRONTEND): bar geometry from the period count; series traces read var history rings
    throw new NotImplemented("compounding-ledger.compile");
  },
  draw() {
    // TODO(FRONTEND): axis → bars (stacked if declared) → cumulative lines → contribution markers →
    // final value callout. Keep the y-axis LOCKED across knob changes: a rescaling axis hides
    // exactly the growth the learner is supposed to feel.
    throw new NotImplemented("compounding-ledger.draw");
  },
  hitTest() {
    // pick a period, for "change the rate mid-timeline"
    throw new NotImplemented("compounding-ledger.hitTest");
  },
};

export const compoundingLedgerDescriptor: ArchetypeDescriptor = {
  id: "compounding-ledger",
  summary: "Quantities accumulating over discrete periods, as bars and cumulative lines.",
  bestFor: [
    "multiplicative growth over repeated periods",
    "contributions and withdrawals against a balance",
    "comparing two accumulation strategies",
    "where the shape of a curve is counter-intuitive over long horizons",
  ],
  supportedMarks: ["rect", "curve", "area", "text"],
  interactions: ["change a rate mid-timeline", "adjust contributions", "extend the horizon"],
  maxEntities: 240,
  examples: ["compound interest", "loan amortisation", "population growth", "depreciation"],
  renderer: compoundingLedgerRenderer,
};
