import { useEffect, useState } from "react";
import type { LabSpec, Param } from "../spec/schema.js";
import type { LabStore } from "../state/labStore.js";

/**
 * One knob per param.
 *
 * The critical detail is in `onInput`: it writes straight to the store, which the canvas reads in
 * its own loop. There is **no debounce and no throttle** — debouncing a knob is precisely the lag
 * this product exists to avoid. The only React state here is the displayed number.
 */
export function KnobPanel({
  spec,
  store,
  disabled = false,
}: {
  spec: LabSpec;
  store: LabStore;
  disabled?: boolean;
}) {
  return (
    <div className="knobs">
      {spec.params.map((p, i) => (
        <Knob key={p.id} param={p} store={store} disabled={disabled} primary={i === 0} />
      ))}
      <button className="btn-ghost" onClick={() => store.reset()} disabled={disabled}>
        Reset
      </button>
    </div>
  );
}

function Knob({
  param,
  store,
  disabled,
  primary,
}: {
  param: Param;
  store: LabStore;
  disabled: boolean;
  primary: boolean;
}) {
  const [value, setValue] = useState(() => store.getOne(param.id));

  // Keep the label in sync when something else writes (reset, or the prediction jump).
  useEffect(() => store.subscribe(() => setValue(store.getOne(param.id))), [store, param.id]);

  const decimals = param.step < 0.01 ? 3 : param.step < 1 ? 2 : 0;

  return (
    <label className={primary ? "knob knob-primary" : "knob"}>
      <span className="knob-head">
        <span className="knob-label">{param.label}</span>
        <output className="knob-value">
          {value.toFixed(decimals)}
          {param.unit ? <span className="knob-unit">{param.unit}</span> : null}
        </output>
      </span>

      <input
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.currentTarget.valueAsNumber;
          // Store first — the canvas must never lag the number beside the slider.
          store.set(param.id, v);
          setValue(v);
        }}
        aria-describedby={`${param.id}-explain`}
      />

      <span className="knob-explain" id={`${param.id}-explain`}>
        {param.explain}
      </span>
    </label>
  );
}
