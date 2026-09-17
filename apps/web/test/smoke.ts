import { compileExpr, tryCompile } from "../src/expr/compile.js";
import { parseLabSpec, extractJson } from "../src/spec/parse.js";
import { FUNCTION_PLOT_FIXTURE } from "../src/canvas/archetypes/function-plot/fixture.js";

const EXAMPLE_SPEC = structuredClone(FUNCTION_PLOT_FIXTURE) as any;

const fail: string[] = [];
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fail.push(name);
};

console.log("\n== expression compiler ==");
const ev = (src: string, scope: Record<string, number> = {}) =>
  compileExpr(src, { variables: Object.keys(scope) }).fn(scope);

ok("arithmetic + precedence", ev("2 + 3 * 4") === 14);
ok("right-assoc exponent", ev("2 ^ 3 ^ 2") === 512);
ok("unary minus", ev("0 - 5 + 2") === -3);
ok("parens", ev("(2 + 3) * 4") === 20);
ok("ternary", ev("1 < 2 ? 10 : 20") === 10);
ok("clamp()", ev("clamp(15, 0, 10)") === 10);
ok("min() variadic", ev("min(5, 2, 8, 1)") === 1);
ok("mod is euclidean", ev("mod(0 - 1, 3)") === 2);
ok("variables", ev("a * b", { a: 3, b: 4 }) === 12);
ok("constants", Math.abs(ev("PI") - Math.PI) < 1e-12);
ok("smoothstep midpoint", ev("smoothstep(0, 1, 0.5)") === 0.5);

console.log("\n== compiler rejects hostile input ==");
const rejects = (src: string, why: string) => {
  const r = tryCompile(src, ["x"]);
  ok(`rejects ${why}`, !r.ok, r.ok ? "COMPILED — should not have" : "");
};
rejects("constructor", "prototype-chain identifier");
rejects("__proto__", "__proto__");
rejects("valueOf(1)", "prototype-chain function");
rejects("hasOwnProperty(1)", "inherited method as function");
rejects("x.toString", "property access");
rejects("process.exit(0)", "property access on global");
rejects("alert(1)", "non-whitelisted call");
rejects("x = 5", "assignment");
rejects("(() => 1)()", "arrow function");
rejects("x[0]", "indexing");
rejects("2 +", "syntax error");
ok("rejects undeclared var", !tryCompile("y + 1", ["x"]).ok);

console.log("\n== JSON extraction from model output ==");
ok("bare object", extractJson('{"a":1}') === '{"a":1}');
ok("fenced", extractJson('```json\n{"a":1}\n```') === '{"a":1}');
ok("prose preamble", extractJson('Here is the lab:\n{"a":1}') === '{"a":1}');
ok("nested braces", extractJson('{"a":{"b":2}}') === '{"a":{"b":2}}');
ok("brace inside string", extractJson('{"a":"}{"}') === '{"a":"}{"}');
ok("no json", extractJson("sorry, I can't") === null);

console.log("\n== spec parsing ==");
const good = parseLabSpec(JSON.stringify(EXAMPLE_SPEC));
ok("fixture validates", good.ok, good.ok ? "" : JSON.stringify(good.issues));
if (good.ok) {
  ok("no warnings on fixture", good.warnings.length === 0, good.warnings.map(w => w.path).join(","));
  ok("no repairs needed", good.repairs.length === 0, good.repairs.join(";"));
}

// The rule that makes it a lab: something must depend on a param.
const inert = structuredClone(EXAMPLE_SPEC);
inert.stage.config.series = [{ label: "flat", color: "series-1", style: "line", expr: "x * 2" }];
inert.observables = [{ id: "z", label: "Z", expr: "42", format: "number", precision: 0 }];
inert.prediction.observable_id = "z";
const inertRes = parseLabSpec(JSON.stringify(inert));
ok("rejects spec where no knob matters", !inertRes.ok,
   inertRes.ok ? "ACCEPTED — the core rule is not enforced" : "");

// Mechanical repair, not invention.
const needsRepair = structuredClone(EXAMPLE_SPEC);
needsRepair.params[0].default = 999;
const rep = parseLabSpec(JSON.stringify(needsRepair));
ok("clamps an out-of-range default", rep.ok && rep.repairs.length === 1,
   rep.ok ? rep.repairs.join(";") : "rejected outright");

// Dangling reference must be caught.
const dangling = structuredClone(EXAMPLE_SPEC);
dangling.prediction.observable_id = "nope";
ok("rejects dangling observable_id", !parseLabSpec(JSON.stringify(dangling)).ok);

// Bad expression must be caught, not deferred to render time.
const badExpr = structuredClone(EXAMPLE_SPEC);
badExpr.stage.config.series[0].expr = "capacity / (1 + nonsense)";
ok("rejects unknown name in expression", !parseLabSpec(JSON.stringify(badExpr)).ok);

// Node-model guarantees: the parser rejects an unknown archetype, and routes config
// validation to the node rather than knowing about series itself.
console.log("\n== node model ==");
const unknownNode = structuredClone(EXAMPLE_SPEC) as any;
unknownNode.stage.archetype = "does-not-exist";
ok("rejects an unregistered archetype", !parseLabSpec(JSON.stringify(unknownNode)).ok);

const badCfg = structuredClone(EXAMPLE_SPEC) as any;
badCfg.stage.config.y_domain = [100, 0];
ok("node rejects a reversed domain", !parseLabSpec(JSON.stringify(badCfg)).ok);

const noSeries = structuredClone(EXAMPLE_SPEC) as any;
noSeries.stage.config.series = [];
ok("node config bounds enforced (0 series)", !parseLabSpec(JSON.stringify(noSeries)).ok);

console.log(`\n${fail.length === 0 ? "ALL PASS" : `${fail.length} FAILED: ${fail.join(", ")}`}\n`);
process.exit(fail.length === 0 ? 0 : 1);
