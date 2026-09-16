import { useMemo, useState } from "react";
import type { CompiledPlot } from "../canvas/plot.js";
import { readObservables } from "../canvas/plot.js";
import type { LabStore } from "../state/labStore.js";
import { formatValue } from "./Readouts.js";

export interface PredictionOutcome {
  guess: number;
  actual: number;
  verdict: "correct" | "close" | "wrong";
}

/**
 * The PREDICT step — the reason this is a lab and not a chart.
 *
 * Three rules, all load-bearing:
 *  1. The outcome is not shown until the learner commits. No live preview, no hover hint.
 *  2. Committing is irreversible, and the UI says so beforehand.
 *  3. A wrong answer is framed as informative, not as a failure — being wrong here is worth more
 *     than being right, and the copy has to make guessing feel safe.
 */
export function PredictPanel({
  plot,
  store,
  onResolved,
  outcome,
}: {
  plot: CompiledPlot;
  store: LabStore;
  onResolved: (o: PredictionOutcome) => void;
  outcome: PredictionOutcome | null;
}) {
  const spec = plot.spec;
  const pred = spec.prediction;
  const observable = spec.observables.find((o) => o.id === pred.observable_id)!;

  const [lo, hi] = spec.y_domain;
  const [guess, setGuess] = useState(() => (lo + hi) / 2);

  // Computed once, at the configuration the question names — not from the learner's current knobs.
  const actual = useMemo(() => {
    const at = { ...store.get(), ...pred.at_params };
    return readObservables(plot, at)[pred.observable_id] ?? NaN;
  }, [plot, store, pred]);

  if (outcome) {
    const wasClose = outcome.verdict !== "wrong";
    return (
      <div className="panel predict-result">
        <h3 className={wasClose ? "verdict verdict-good" : "verdict verdict-off"}>
          {outcome.verdict === "correct"
            ? "You had it."
            : outcome.verdict === "close"
              ? "Close."
              : "Not what happened."}
        </h3>
        <p className="predict-numbers">
          You said <strong>{formatValue(outcome.guess, observable)}</strong>. It was{" "}
          <strong>{formatValue(outcome.actual, observable)}</strong>.
        </p>
        <p className="predict-why">{pred.why_correct}</p>
        {!wasClose ? (
          <p className="predict-nudge">
            Being wrong here is the useful part — that gap is the thing worth remembering.
          </p>
        ) : null}
      </div>
    );
  }

  const step = Math.max((hi - lo) / 200, 1e-6);

  return (
    <div className="panel predict">
      <h3>Before you look</h3>
      <p className="predict-question">{pred.question}</p>

      <div className="predict-input">
        <input
          type="range"
          min={lo}
          max={hi}
          step={step}
          value={guess}
          onChange={(e) => setGuess(e.currentTarget.valueAsNumber)}
          aria-label="Your prediction"
        />
        <output className="predict-guess">{formatValue(guess, observable)}</output>
      </div>

      <button
        className="btn-primary"
        onClick={() => {
          // Jump the knobs to the configuration the question described, so the reveal is visibly
          // the same lab rather than a separate claim.
          store.setMany(pred.at_params);
          const delta = Math.abs(guess - actual);
          const verdict: PredictionOutcome["verdict"] =
            delta <= pred.tolerance ? "correct" : delta <= pred.tolerance * 2.5 ? "close" : "wrong";
          onResolved({ guess, actual, verdict });
        }}
      >
        Lock it in
      </button>
      <p className="predict-fineprint">You only get one guess.</p>
    </div>
  );
}
