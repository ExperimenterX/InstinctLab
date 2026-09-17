/**
 * Verifies the canvas math and the component tree against real fixture data.
 *
 * There is no browser in this environment, so `drawPlot` runs against a recording stub of the 2D
 * context. That is not a cosmetic check: it catches NaN coordinates, curves sampled outside the
 * frame, and a missing direct label — the failures that would show up as an empty or wrong plot.
 */
import { renderToString } from "react-dom/server";
import { compileStage, drawStage, observableRange, readObservables } from "../src/canvas/stage.js";
import { FUNCTION_PLOT_FIXTURE } from "../src/canvas/archetypes/function-plot/fixture.js";
import { parseLabSpec } from "../src/spec/parse.js";

const _p = parseLabSpec(JSON.stringify(FUNCTION_PLOT_FIXTURE));
if (!_p.ok) { console.error("fixture does not validate", _p.issues); process.exit(1); }
const EXAMPLE_SPEC = _p.spec;
const CFG = EXAMPLE_SPEC.stage.config as { series: { label: string }[]; x_label: string; y_label: string };
import { createLabStore } from "../src/state/labStore.js";
import { KnobPanel } from "../src/components/KnobPanel.js";
import { Readouts } from "../src/components/Readouts.js";
import { QuizPanel } from "../src/components/QuizPanel.js";
import { LabCanvas } from "../src/components/LabCanvas.js";

const fail: string[] = [];
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fail.push(name);
};

// ── recording 2D context ──────────────────────────────────────────────────────────────────────

interface Call { op: string; args: number[] }

function stubCtx(w: number, h: number) {
  const calls: Call[] = [];
  const texts: string[] = [];
  const rec = (op: string, ...args: unknown[]) =>
    calls.push({ op, args: args.filter((a): a is number => typeof a === "number") });

  const ctx = {
    canvas: { width: w, height: h },
    setTransform: () => {},
    save: () => {}, restore: () => {},
    beginPath: () => rec("beginPath"),
    moveTo: (x: number, y: number) => rec("moveTo", x, y),
    lineTo: (x: number, y: number) => rec("lineTo", x, y),
    stroke: () => rec("stroke"),
    fill: () => rec("fill"),
    arc: (x: number, y: number, r: number) => rec("arc", x, y, r),
    rect: () => rec("rect"),
    clip: () => {},
    clearRect: () => {}, fillRect: () => rec("fillRect"),
    fillText: (t: string, x: number, y: number) => { texts.push(t); rec("fillText", x, y); },
    measureText: (t: string) => ({ width: t.length * 6 }),
    setLineDash: () => {},
    translate: () => {}, rotate: () => {},
    globalAlpha: 1, lineWidth: 1, strokeStyle: "", fillStyle: "",
    font: "", textAlign: "", textBaseline: "", lineJoin: "", lineCap: "",
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, texts };
}

// ── canvas math ───────────────────────────────────────────────────────────────────────────────

console.log("\n== canvas: compile + draw ==");
const W = 900, H = 520;
const plot = compileStage(EXAMPLE_SPEC);
ok("compiles every series", (plot.compiled as any).series.length === CFG.series.length);
ok("compiles every observable", plot.observables.length === EXAMPLE_SPEC.observables.length);

const store = createLabStore(EXAMPLE_SPEC);
const a = stubCtx(W, H);
drawStage(plot, a.ctx, W, H, { params: store.get(), mode: "light" });

const pathPts = a.calls.filter((c) => c.op === "moveTo" || c.op === "lineTo");
ok("draws a path", pathPts.length > 200, `${pathPts.length} points`);
ok("no NaN coordinates", pathPts.every((c) => c.args.every(Number.isFinite)));
ok("all points inside the frame",
   pathPts.every((c) => c.args[0]! >= 0 && c.args[0]! <= W && c.args[1]! >= 0 && c.args[1]! <= H));

// The relief rule from the palette validation: every series must be directly labelled.
for (const s of CFG.series) {
  const labelled = a.texts.some((t) => s.label.startsWith(t.replace(/…$/, "")));
  ok(`direct label present: "${s.label}"`, labelled);
}
ok("axis labels drawn",
   a.texts.includes(CFG.x_label) && a.texts.includes(CFG.y_label));

// Dragging a knob must change the geometry — this is the whole product in one assertion.
store.set("capacity", 900);
const b = stubCtx(W, H);
drawStage(plot, b.ctx, W, H, { params: store.get(), mode: "light" });
const before = a.calls.filter((c) => c.op === "lineTo").map((c) => c.args[1]);
const after = b.calls.filter((c) => c.op === "lineTo").map((c) => c.args[1]);
ok("moving a knob changes the curve",
   before.some((y, i) => Math.abs((y ?? 0) - (after[i] ?? 0)) > 1));

// y-axis must NOT rescale — a rescaling axis hides the effect the learner should see.
const yTicksA = a.texts.join("|");
const yTicksB = b.texts.join("|");
ok("y-axis stays locked across knob changes",
   yTicksA.split("|").filter((t) => /^\d/.test(t)).join() ===
   yTicksB.split("|").filter((t) => /^\d/.test(t)).join());

console.log("\n== observables ==");
store.reset();
const obs = readObservables(plot, store.get());
const pop = obs["pop_at_24h"]!;
ok("observable computes a finite value", Number.isFinite(pop), `${pop.toFixed(1)}`);
ok("observable is bounded by capacity", pop > 0 && pop <= 500 * 1.001, `${pop.toFixed(1)} <= 500`);

// The lesson of this fixture: a higher rate arrives at the ceiling sooner, it does not raise it.
store.setMany({ growth_rate: 0.6, capacity: 500 });
const fast = readObservables(plot, store.get())["pop_at_24h"]!;
ok("max growth rate saturates at capacity", Math.abs(fast - 500) < 5, `${fast.toFixed(1)}`);

console.log("\n== component tree renders ==");
const tryRender = (name: string, el: React.ReactElement) => {
  try {
    const html = renderToString(el);
    ok(`${name} renders`, html.length > 0);
    return html;
  } catch (e) {
    ok(`${name} renders`, false, String(e));
    return "";
  }
};

const knobHtml = tryRender("KnobPanel", <KnobPanel spec={EXAMPLE_SPEC} store={store} />);
ok("every knob has a slider",
   (knobHtml.match(/type="range"/g) ?? []).length === EXAMPLE_SPEC.params.length);
ok("knob explainers rendered",
   EXAMPLE_SPEC.params.every((p) => knobHtml.includes(p.explain)));

const readHtml = tryRender("Readouts", <Readouts plot={plot} store={store} />);
ok("readout label rendered", readHtml.includes(EXAMPLE_SPEC.observables[0]!.label));

const quizHtml = tryRender("QuizPanel", <QuizPanel spec={EXAMPLE_SPEC} />);
ok("all three questions rendered",
   EXAMPLE_SPEC.quiz.every((q) => quizHtml.includes(q.prompt.slice(0, 20))));
ok("answers are not in the markup before submitting",
   !quizHtml.includes("correct_index"));

const canvasHtml = tryRender("LabCanvas",
  <LabCanvas plot={plot} store={store} mode="light" />);
ok("canvas element present", canvasHtml.includes("<canvas"));

// The prediction slider must not hand over the answer.
console.log("\n== prediction range does not leak the answer ==");
store.reset();
const [rlo, rhi] = observableRange(plot, EXAMPLE_SPEC.prediction.observable_id);
const truth = (() => {
  const at = { ...store.get(), ...EXAMPLE_SPEC.prediction.at_params };
  return readObservables(plot, at)[EXAMPLE_SPEC.prediction.observable_id]!;
})();
ok("range is finite and ordered", Number.isFinite(rlo) && Number.isFinite(rhi) && rlo < rhi,
   `[${rlo.toFixed(1)}, ${rhi.toFixed(1)}]`);
ok("range contains the answer", truth >= rlo && truth <= rhi, `truth ${truth.toFixed(1)}`);
ok("answer is not the range midpoint (would be a giveaway)",
   Math.abs(truth - (rlo + rhi) / 2) > (rhi - rlo) * 0.02);

console.log(`\n${fail.length === 0 ? "ALL PASS" : `${fail.length} FAILED: ${fail.join(", ")}`}\n`);
process.exit(fail.length === 0 ? 0 : 1);
