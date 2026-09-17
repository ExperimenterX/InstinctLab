/**
 * Runs every suite. One command so nobody has to remember four esbuild invocations.
 *
 *   smoke    expression compiler + spec parser (incl. hostile input)
 *   render   canvas math against a recording 2D context + component tree
 *   journey  the six phases a learner walks through, in order
 *   nodes    every concept node: validates, renders, and teaches what it claims
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const SUITES = ["smoke.ts", "render.tsx", "journey.tsx", "nodes.tsx"];
mkdirSync("node_modules/.cache", { recursive: true });

let failed = 0;
for (const file of SUITES) {
  const name = file.replace(/\.tsx?$/, "");
  const out = `node_modules/.cache/${name}.mjs`;
  try {
    execFileSync("npx", ["esbuild", `test/${file}`, "--bundle", "--format=esm",
      "--platform=node", "--target=node20", `--outfile=${out}`, "--log-level=error",
      "--external:react", "--external:react-dom"], { stdio: "inherit", shell: true });
    execFileSync("node", [out], { stdio: "inherit" });
  } catch {
    failed++;
  }
}
console.log(failed === 0 ? "\n✓ all suites passed\n" : `\n✗ ${failed} suite(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
