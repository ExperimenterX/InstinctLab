import { parseLabSpec, type ParseResult } from "../spec/parse.js";

/**
 * Calls the dev endpoint and runs the response through the parsing layer.
 *
 * The endpoint returns the model's **raw text** rather than a pre-parsed object, deliberately:
 * the parsing and validation layer has to survive real model output, so we exercise it on every
 * request instead of hiding it behind a server-side parse. When the Python API replaces this, the
 * only change here is the URL.
 */
export type GenerateResult =
  | { status: "ok"; parsed: Extract<ParseResult, { ok: true }>; raw: string }
  | { status: "invalid"; parsed: Extract<ParseResult, { ok: false }>; raw: string }
  | { status: "no_key" }
  | { status: "refused" }
  | { status: "error"; message: string };

export async function generateLab(concept: string, signal?: AbortSignal): Promise<GenerateResult> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ concept }),
      ...(signal ? { signal } : {}),
    });
  } catch (e) {
    return { status: "error", message: `Could not reach the generator: ${String(e)}` };
  }

  if (res.status === 503) return { status: "no_key" };
  if (res.status === 422) return { status: "refused" };

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch { /* keep the status code */ }
    return { status: "error", message: detail };
  }

  const { raw } = (await res.json()) as { raw: string };
  const parsed = parseLabSpec(raw);
  return parsed.ok
    ? { status: "ok", parsed, raw }
    : { status: "invalid", parsed, raw };
}
