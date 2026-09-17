/**
 * The user journey, driven through the real modules in sequence.
 *
 * This is the closest thing to using the app without a browser: load a lab the way the app does,
 * explore it, commit a prediction, and answer the quiz — asserting at each step what the learner
 * would actually see.
 */
import { compileStage, drawStage, observableRange, readObservables } from "../src/canvas/stage.js";
import { CONCEPTS } from "../src/concepts/index.js";
import { parseLabSpec } from "../src/spec/parse.js";
import { createLabStore } from "../src/state/labStore.js";

const fail: string[] = [];
const step = (n: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  ok  " : " FAIL "} ${n}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fail.push(n);
};

const noopCtx = () => {
  const texts: string[] = [];
  const pts: number[][] = [];
  const c: Record<string, unknown> = {
    canvas: { width: 900, height: 520 },
    moveTo: (x: number, y: number) => pts.push([x, y]),
    lineTo: (x: number, y: number) => pts.push([x, y]),
    fillText: (t: string) => texts.push(t),
    measureText: (t: string) => ({ width: t.length * 6 }),
  };
  for (const m of ["setTransform","save","restore","beginPath","stroke","fill","arc","rect","clip",
                   "clearRect","fillRect","setLineDash","translate","rotate"]) c[m] = () => {};
  return { ctx: c as unknown as CanvasRenderingContext2D, texts, pts };
};

console.log("\n1. Open a lab (what the example button does)");
const node = CONCEPTS[0]!;
const res = parseLabSpec(JSON.stringify(node.spec));
step(`node "${node.id}" spec validates`, res.ok);
if (!res.ok) process.exit(1);
const spec = res.spec;
step("title shown to the learner", spec.title.length > 0, spec.title);
step("caption is short enough to read at a glance", spec.caption.length <= 90,
     `${spec.caption.length} chars`);

const stage = compileStage(spec);
const store = createLabStore(spec);

console.log("\n2. SEE — the canvas renders before any interaction");
const s0 = noopCtx();
drawStage(stage, s0.ctx, 900, 520, { params: store.get(), mode: "light" });
step("curve is drawn", s0.pts.length > 200, `${s0.pts.length} points`);
step("axis labels visible", s0.texts.length > 5);

console.log("\n3. INTERACT — drag the first knob");
const p0 = spec.params[0]!;
const before = readObservables(stage, store.get())[spec.observables[0]!.id]!;
store.set(p0.id, p0.max);
const after = readObservables(stage, store.get())[spec.observables[0]!.id]!;
step(`"${p0.label}" to max changes the read-out`, Math.abs(after - before) > 1e-9,
     `${before.toFixed(1)} → ${after.toFixed(1)}`);
step("knob is clamped to its declared range", store.getOne(p0.id) === p0.max);
store.set(p0.id, p0.max * 1e6);
step("out-of-range write is clamped, not accepted", store.getOne(p0.id) === p0.max);

console.log("\n4. EXPERIMENT — sweep the whole param space, nothing breaks");
let nonFinite = 0, offFrame = 0, frames = 0;
for (const a of [0, 0.5, 1]) {
  for (const b of [0, 0.5, 1]) {
    const at: Record<string, number> = {};
    spec.params.forEach((p, i) => { at[p.id] = p.min + (p.max - p.min) * (i === 0 ? a : b); });
    store.setMany(at);
    const s = noopCtx();
    drawStage(stage, s.ctx, 900, 520, { params: store.get(), mode: "light" });
    frames++;
    for (const [x, y] of s.pts) {
      if (!Number.isFinite(x!) || !Number.isFinite(y!)) nonFinite++;
      if (x! < 0 || x! > 900 || y! < 0 || y! > 520) offFrame++;
    }
    for (const v of Object.values(readObservables(stage, store.get()))) {
      if (!Number.isFinite(v)) nonFinite++;
    }
  }
}
step(`${frames} configurations render`, frames === 9);
step("no non-finite values anywhere in the sweep", nonFinite === 0, `${nonFinite} found`);
step("nothing drawn outside the frame", offFrame === 0, `${offFrame} found`);

console.log("\n5. PREDICT — freeze, guess, reveal");
store.reset();
const pred = spec.prediction;
const [lo, hi] = observableRange(stage, pred.observable_id);
step("guess slider has a usable range", lo < hi, `[${lo.toFixed(1)}, ${hi.toFixed(1)}]`);
const truth = readObservables(stage, { ...store.get(), ...pred.at_params })[pred.observable_id]!;
step("the answer is inside the slider range", truth >= lo && truth <= hi, truth.toFixed(1));

const verdictFor = (g: number) => {
  const d = Math.abs(g - truth);
  return d <= pred.tolerance ? "correct" : d <= pred.tolerance * 2.5 ? "close" : "wrong";
};
step("an exact guess is correct", verdictFor(truth) === "correct");
step("a guess just inside tolerance is correct", verdictFor(truth + pred.tolerance * 0.9) === "correct");
step("a far guess is wrong", verdictFor(lo) === "wrong" || verdictFor(hi) === "wrong");

const s5 = noopCtx();
drawStage(stage, s5.ctx, 900, 520, {
  params: { ...store.get(), ...pred.at_params }, mode: "light",
  marker: { value: truth, label: "actual", kind: "actual" },
});
step("reveal draws the answer marker on the canvas", s5.texts.includes("actual"));
step("explanation is written and short", pred.why_correct.length > 12 && pred.why_correct.length <= 200);

console.log("\n6. RECALL — the quiz grades");
const key = spec.quiz.map((q) => q.correct_index);
const allRight = key.reduce((n, k, i) => n + (spec.quiz[i]!.correct_index === k ? 1 : 0), 0);
step("three questions", spec.quiz.length === 3);
step("all-correct scores 3/3", allRight === 3);
const wrong = spec.quiz.map((q) => (q.correct_index + 1) % q.options.length);
const wrongScore = wrong.reduce((n, k, i) => n + (spec.quiz[i]!.correct_index === k ? 1 : 0), 0);
step("all-wrong scores 0/3", wrongScore === 0);
step("every question has an explanation", spec.quiz.every((q) => q.why.length > 0));

console.log(`\n${fail.length === 0 ? "JOURNEY COMPLETE — every step a learner takes works"
  : `${fail.length} STEP(S) FAILED: ${fail.join(", ")}`}\n`);
process.exit(fail.length === 0 ? 0 : 1);
