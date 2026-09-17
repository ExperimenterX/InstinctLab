import { LabSpecSchema, type LabSpec } from "./schema.js";
import { tryCompile } from "../expr/compile.js";
import { getNode, nodeIds } from "../canvas/registry.js";

/**
 * AI response → validated LabSpec.
 *
 * Four layers, in order, because each catches a different class of failure:
 *
 *   1. EXTRACT  pull JSON out of whatever the model actually returned (fences, preamble, prose)
 *   2. SCHEMA   Zod on the shared fields — shape and bounds
 *   3. NODE     hand `stage.config` to the node that will render it; the node validates its own
 *               config and reports which params it reads
 *   4. UNIVERSAL the rules that hold for every node: ids resolve, and at least one knob is live
 *
 * Layer 4 is the one a naive implementation skips, and the one that matters most. A spec can be
 * perfectly well-formed and still be a dead lab — if nothing depends on a knob, the learner has a
 * picture rather than something to play with. We reject that outright.
 *
 * Mechanical repairs are applied where the fix is unambiguous (clamping a default into its own
 * range). We never invent content: a missing caption goes back to the model, because guessing it
 * ships a lab that looks fine and teaches nothing.
 */

export interface ParseIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export type ParseResult =
  | { ok: true; spec: LabSpec; repairs: string[]; warnings: ParseIssue[] }
  | { ok: false; issues: ParseIssue[]; raw: string };

// ── Layer 1: extraction ───────────────────────────────────────────────────────────────────────

/**
 * Models wrap JSON in fences, add a sentence before it, or both. Find the outermost balanced
 * object rather than regexing for `{.*}` — a brace inside a string breaks the naive version, and
 * it fails later with a useless message.
 */
export function extractJson(raw: string): string | null {
  const text = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1]?.trim() ?? text;

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i]!;
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return candidate.slice(start, i + 1);
  }
  return null;
}

// ── Layers 2–4 ────────────────────────────────────────────────────────────────────────────────

export function parseLabSpec(raw: string): ParseResult {
  const json = extractJson(raw);
  if (!json) {
    return { ok: false, raw, issues: [{ path: "$", message: "No JSON object found in the response.", severity: "error" }] };
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { ok: false, raw, issues: [{ path: "$", message: `Malformed JSON: ${String(e)}`, severity: "error" }] };
  }

  const parsed = LabSpecSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      raw,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "$",
        message: i.message,
        severity: "error" as const,
      })),
    };
  }

  const spec = parsed.data;
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];
  const repairs: string[] = [];

  // — params —
  const paramIds = spec.params.map((p) => p.id);
  const dupes = paramIds.filter((id, i) => paramIds.indexOf(id) !== i);
  if (dupes.length) {
    errors.push({ path: "params", message: `Duplicate param id: ${dupes.join(", ")}`, severity: "error" });
  }

  for (const [i, p] of spec.params.entries()) {
    if (p.min >= p.max) {
      errors.push({ path: `params.${i}`, message: `${p.id}: min must be < max.`, severity: "error" });
      continue;
    }
    if (p.default < p.min || p.default > p.max) {
      const fixed = Math.min(Math.max(p.default, p.min), p.max);
      repairs.push(`params.${p.id}.default ${p.default} → ${fixed} (was outside its range)`);
      p.default = fixed;
    }
    if (p.step > p.max - p.min) {
      const fixed = (p.max - p.min) / 20;
      repairs.push(`params.${p.id}.step ${p.step} → ${fixed} (was larger than the range)`);
      p.step = fixed;
    }
  }

  const referencedParams = new Set<string>();

  // — observables (shared: param ids only, no x) —
  for (const [i, o] of spec.observables.entries()) {
    const r = tryCompile(o.expr, paramIds);
    if (!r.ok) errors.push({ path: `observables.${i}.expr`, message: r.error, severity: "error" });
    else for (const n of r.result.referenced) referencedParams.add(n);
  }

  // — Layer 3: the node validates its own config —
  const node = getNode(spec.stage.archetype);
  if (!node) {
    errors.push({
      path: "stage.archetype",
      message: `Unknown archetype "${spec.stage.archetype}". Available: ${nodeIds().join(", ")}`,
      severity: "error",
    });
  } else {
    const cfg = node.configSchema.safeParse(spec.stage.config);
    if (!cfg.success) {
      for (const i of cfg.error.issues) {
        errors.push({
          path: `stage.config.${i.path.join(".") || "$"}`,
          message: i.message,
          severity: "error",
        });
      }
    } else {
      spec.stage.config = cfg.data;
      const a = node.analyze(cfg.data as never, { paramIds });
      for (const m of a.errors) errors.push({ path: "stage.config", message: m, severity: "error" });
      for (const m of a.warnings) warnings.push({ path: "stage.config", message: m, severity: "warning" });
      for (const n of a.referencedParams) referencedParams.add(n);
    }
  }

  // — Layer 4: THE RULE THAT MAKES IT A LAB —
  if (referencedParams.size === 0) {
    errors.push({
      path: "stage/observables",
      message:
        "Nothing references any param, so the knobs would do nothing. At least one series or " +
        "observable must depend on a param.",
      severity: "error",
    });
  }
  for (const p of spec.params) {
    if (!referencedParams.has(p.id)) {
      warnings.push({
        path: `params.${p.id}`,
        message: `"${p.label}" is never used — that knob is inert.`,
        severity: "warning",
      });
    }
  }

  // — prediction —
  const observableIds = spec.observables.map((o) => o.id);
  if (!observableIds.includes(spec.prediction.observable_id)) {
    errors.push({
      path: "prediction.observable_id",
      message: `"${spec.prediction.observable_id}" is not a declared observable (have: ${observableIds.join(", ")}).`,
      severity: "error",
    });
  }
  for (const [k, v] of Object.entries(spec.prediction.at_params)) {
    const p = spec.params.find((q) => q.id === k);
    if (!p) {
      delete spec.prediction.at_params[k];
      repairs.push(`prediction.at_params.${k} dropped (not a declared param)`);
      continue;
    }
    if (v < p.min || v > p.max) {
      const fixed = Math.min(Math.max(v, p.min), p.max);
      spec.prediction.at_params[k] = fixed;
      repairs.push(`prediction.at_params.${k} ${v} → ${fixed} (clamped to range)`);
    }
  }

  // — quiz —
  for (const [i, q] of spec.quiz.entries()) {
    if (q.correct_index >= q.options.length) {
      errors.push({
        path: `quiz.${i}.correct_index`,
        message: `correct_index ${q.correct_index} is out of range for ${q.options.length} options.`,
        severity: "error",
      });
    }
  }

  if (errors.length) return { ok: false, issues: errors, raw };
  return { ok: true, spec, repairs, warnings };
}

export function formatIssues(issues: ParseIssue[]): string {
  return issues.map((i) => `${i.path}: ${i.message}`).join("\n");
}
