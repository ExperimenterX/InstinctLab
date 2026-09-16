import { LabSpecSchema, type LabSpec } from "./schema.js";
import { tryCompile } from "../expr/compile.js";

/**
 * AI response → validated LabSpec.
 *
 * Three layers, in order, because each catches a different class of failure:
 *
 *   1. EXTRACT   pull JSON out of whatever the model actually returned (fences, preamble)
 *   2. SCHEMA    Zod — shape and bounds
 *   3. SEMANTIC  the things Zod cannot know: do expressions compile, do ids resolve, and does
 *                the learner's knob actually change anything
 *
 * Layer 3 is the one that matters most and the one a naive implementation skips. A spec can be
 * perfectly well-formed and still be a dead lab — if no expression reads a param, the knob is
 * decoration and there is nothing to discover. We reject that.
 *
 * Mechanical repairs are applied where the fix is unambiguous (clamp a default into its own
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
 * object rather than regexing for `{.*}` — a nested brace inside a string breaks the naive
 * version, and it fails at parse time with a useless message.
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
    else if (c === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

// ── Layers 2 and 3 ────────────────────────────────────────────────────────────────────────────

export function parseLabSpec(raw: string): ParseResult {
  const json = extractJson(raw);
  if (!json) {
    return {
      ok: false,
      raw,
      issues: [{ path: "$", message: "No JSON object found in the response.", severity: "error" }],
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return {
      ok: false,
      raw,
      issues: [{ path: "$", message: `Malformed JSON: ${String(e)}`, severity: "error" }],
    };
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

  // — domains —
  if (spec.x_domain[0] >= spec.x_domain[1]) {
    errors.push({ path: "x_domain", message: "x_domain must be increasing.", severity: "error" });
  }
  if (spec.y_domain[0] >= spec.y_domain[1]) {
    errors.push({ path: "y_domain", message: "y_domain must be increasing.", severity: "error" });
  }

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

  // — expressions —
  // Series may read `x`; observables may not (they resolve to a single number).
  const seriesVars = ["x", ...paramIds];
  const referencedParams = new Set<string>();

  for (const [i, s] of spec.series.entries()) {
    const r = tryCompile(s.expr, seriesVars);
    if (!r.ok) {
      errors.push({ path: `series.${i}.expr`, message: r.error, severity: "error" });
    } else {
      for (const name of r.result.referenced) {
        if (name !== "x") referencedParams.add(name);
      }
      if (!r.result.referenced.has("x")) {
        warnings.push({
          path: `series.${i}.expr`,
          message: `"${s.label}" does not use x — it will draw a flat line.`,
          severity: "warning",
        });
      }
    }
  }

  for (const [i, o] of spec.observables.entries()) {
    const r = tryCompile(o.expr, paramIds);
    if (!r.ok) {
      errors.push({ path: `observables.${i}.expr`, message: r.error, severity: "error" });
    } else {
      for (const name of r.result.referenced) referencedParams.add(name);
    }
  }

  // — THE RULE THAT MAKES IT A LAB —
  // If nothing reads a param, the knob does nothing and there is no lab to play with.
  if (referencedParams.size === 0) {
    errors.push({
      path: "series/observables",
      message:
        "No expression references any param, so the knobs would do nothing. At least one series " +
        "or observable must depend on a param.",
      severity: "error",
    });
  }
  for (const p of spec.params) {
    if (!referencedParams.has(p.id)) {
      warnings.push({
        path: `params.${p.id}`,
        message: `"${p.label}" is never used by any expression — that knob is inert.`,
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

/** Human-readable summary, for the retry panel. */
export function formatIssues(issues: ParseIssue[]): string {
  return issues.map((i) => `${i.path}: ${i.message}`).join("\n");
}
