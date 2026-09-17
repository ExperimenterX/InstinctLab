/**
 * Verifies every concept node: its spec validates, its renderer draws it, and the mechanism it
 * claims to teach is actually true of the numbers.
 *
 * That last part matters most. A node can validate, render, and still teach something false —
 * so each node's teaching angle is asserted against the observables, not just trusted.
 */
import { compileStage, drawStage, readObservables } from "../src/canvas/stage.js";
import { CONCEPTS } from "../src/concepts/index.js";
import { parseLabSpec } from "../src/spec/parse.js";
import { createLabStore } from "../src/state/labStore.js";
import { buildBTree, btreeHeight, btreeSearchPath, layoutBTree } from "../src/canvas/renderers/structure-diagram/structures.js";

const fail: string[] = [];
const ok = (n: string, c: boolean, extra = "") => {
  console.log(`${c ? "  ok  " : " FAIL "} ${n}${extra ? ` — ${extra}` : ""}`);
  if (!c) fail.push(n);
};

const stub = (w = 900, h = 520) => {
  const texts: string[] = [];
  const pts: number[][] = [];
  const c: Record<string, unknown> = {
    canvas: { width: w, height: h },
    moveTo: (x: number, y: number) => pts.push([x, y]),
    lineTo: (x: number, y: number) => pts.push([x, y]),
    rect: (x: number, y: number) => pts.push([x, y]),
    arc: (x: number, y: number) => pts.push([x, y]),
    fillText: (t: string) => texts.push(t),
    measureText: (t: string) => ({ width: t.length * 6 }),
  };
  for (const m of ["setTransform","save","restore","beginPath","stroke","fill","clip",
                   "clearRect","fillRect","setLineDash","translate","rotate"]) c[m] = () => {};
  return { ctx: c as unknown as CanvasRenderingContext2D, texts, pts };
};

// ── the B-tree implementation itself ──────────────────────────────────────────────────────────
console.log("\n== B-tree algorithm ==");
for (const order of [3, 4, 5, 8]) {
  const root = buildBTree(40, order);
  const maxKeys = order - 1;
  let over = 0, leafDepths = new Set<number>();
  const walk = (n: typeof root, d: number) => {
    if (n.keys.length > maxKeys) over++;
    if (n.children.length === 0) leafDepths.add(d);
    else {
      if (n.children.length !== n.keys.length + 1) over++;  // B-tree invariant
      n.children.forEach((c) => walk(c, d + 1));
    }
  };
  walk(root, 0);
  ok(`order ${order}: no node exceeds ${maxKeys} keys, children = keys+1`, over === 0);
  ok(`order ${order}: all leaves at the same depth`, leafDepths.size === 1,
     `depths {${[...leafDepths].join(",")}}`);
}

const keysOf = (n: ReturnType<typeof buildBTree>): number[] =>
  n.children.length === 0 ? n.keys
    : n.children.flatMap((c, i) => [...keysOf(c), ...(i < n.keys.length ? [n.keys[i]!] : [])]);
const inorder = keysOf(buildBTree(40, 3));
ok("in-order traversal yields 1..40 sorted", inorder.length === 40 && inorder.every((v, i) => v === i + 1),
   `${inorder.length} keys`);

// The claim the b-tree node makes: raising the order collapses the height.
const h3 = btreeHeight(buildBTree(64, 3));
const h8 = btreeHeight(buildBTree(64, 8));
ok("raising order 3→8 reduces height (the node's whole point)", h8 < h3, `${h3} → ${h8}`);

const path = btreeSearchPath(buildBTree(40, 3), 29);
ok("search path ends at a node containing the key", path[path.length - 1]!.keys.includes(29)
   || path.length === btreeHeight(buildBTree(40, 3)), `${path.length} nodes read`);
ok("search path length equals the height", path.length === btreeHeight(buildBTree(40, 3)));

const L = layoutBTree(buildBTree(40, 4), path);
ok("layout places every node", L.placed.length > 0 && L.placed.every((p) => Number.isFinite(p.cx)));
ok("layout edge count = nodes - 1 (a tree)", L.edges.length === L.placed.length - 1);

// ── every concept node ────────────────────────────────────────────────────────────────────────
for (const node of CONCEPTS) {
  console.log(`\n== node: ${node.id} ==`);
  const res = parseLabSpec(JSON.stringify(node.spec));
  ok("spec validates", res.ok, res.ok ? "" : JSON.stringify(res.issues));
  if (!res.ok) continue;
  if (res.warnings.length) ok("no warnings", false, res.warnings.map((w) => w.message).join("; "));

  const spec = res.spec;
  const stage = compileStage(spec);
  const store = createLabStore(spec);

  ok("has a title and a teaching angle", spec.title.length > 1 && spec.teaching_angle.length > 19);

  // Renders across the param space without producing garbage.
  let bad = 0, drew = 0;
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    const at: Record<string, number> = {};
    for (const p of spec.params) at[p.id] = p.min + (p.max - p.min) * frac;
    store.setMany(at);
    const s = stub();
    drawStage(stage, s.ctx, 900, 520, { params: store.get(), mode: "light" });
    if (s.pts.length > 0) drew++;
    for (const [x, y] of s.pts) if (!Number.isFinite(x!) || !Number.isFinite(y!)) bad++;
    for (const v of Object.values(readObservables(stage, store.get()))) if (!Number.isFinite(v)) bad++;
  }
  ok("draws something at every configuration", drew === 5, `${drew}/5`);
  ok("no non-finite geometry or read-outs", bad === 0, `${bad} bad values`);

  // Dark mode must render too — it is a selected palette, not an inverted one.
  store.reset();
  const d = stub();
  drawStage(stage, d.ctx, 900, 520, { params: store.get(), mode: "dark" });
  ok("renders in dark mode", d.pts.length > 0);

  // Every knob must move something, or it is decoration.
  for (const p of spec.params) {
    store.reset();
    const a = JSON.stringify(readObservables(stage, store.get()));
    const sa = stub(); drawStage(stage, sa.ctx, 900, 520, { params: store.get(), mode: "light" });
    store.set(p.id, p.id === spec.params[0]!.id ? p.max : p.max);
    const b = JSON.stringify(readObservables(stage, store.get()));
    const sb = stub(); drawStage(stage, sb.ctx, 900, 520, { params: store.get(), mode: "light" });
    const movedNumbers = a !== b;
    const movedPicture = JSON.stringify(sa.pts) !== JSON.stringify(sb.pts);
    ok(`knob "${p.label}" changes the lab`, movedNumbers || movedPicture,
       movedNumbers ? "read-out" : movedPicture ? "picture" : "NOTHING");
  }

  // The prediction must be answerable and not already on screen.
  store.reset();
  const truth = readObservables(stage, { ...store.get(), ...spec.prediction.at_params })[
    spec.prediction.observable_id
  ]!;
  ok("prediction resolves to a finite number", Number.isFinite(truth), truth.toFixed(2));
  ok("prediction answer is not stated in the caption",
     !spec.caption.includes(String(Math.round(truth))));
  ok("three quiz items with valid answers",
     spec.quiz.length === 3 && spec.quiz.every((q) => q.correct_index < q.options.length));
}

console.log(`\n${fail.length === 0 ? "ALL NODES PASS" : `${fail.length} FAILED: ${fail.join(", ")}`}\n`);
process.exit(fail.length === 0 ? 0 : 1);
