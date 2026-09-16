import { useEffect, useState } from "react";
import type { CompiledPlot } from "../canvas/plot.js";
import { readObservables } from "../canvas/plot.js";
import type { LabStore } from "../state/labStore.js";
import type { Observable } from "../spec/schema.js";

/**
 * Observable read-outs, sampled at ~10Hz rather than per frame.
 *
 * A number that changes 60 times a second is unreadable anyway, so sampling costs the learner
 * nothing and saves ~50 React renders a second. This is the only place the DOM sees a simulated
 * value.
 */
const SAMPLE_MS = 100;

export function Readouts({ plot, store }: { plot: CompiledPlot; store: LabStore }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    readObservables(plot, store.get()),
  );

  useEffect(() => {
    let lastVersion = -1;
    const id = window.setInterval(() => {
      const v = store.version();
      if (v === lastVersion) return;   // nothing moved; don't re-render
      lastVersion = v;
      setValues(readObservables(plot, store.get()));
    }, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [plot, store]);

  return (
    <div className="readouts">
      {plot.spec.observables.map((o) => (
        <div className="readout" key={o.id}>
          <span className="readout-label">{o.label}</span>
          <span className="readout-value">{formatValue(values[o.id], o)}</span>
        </div>
      ))}
    </div>
  );
}

export function formatValue(v: number | undefined, o: Pick<Observable, "format" | "precision">): string {
  if (v === undefined || !Number.isFinite(v)) return "—";
  switch (o.format) {
    case "percent":
      return `${(v * 100).toFixed(o.precision)}%`;
    case "currency":
      return v.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: o.precision,
      });
    default:
      return v.toLocaleString(undefined, {
        minimumFractionDigits: o.precision,
        maximumFractionDigits: o.precision,
      });
  }
}
