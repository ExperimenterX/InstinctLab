import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev-only AI endpoint.
 *
 * The API key is read here, in the Node side of Vite, and never reaches the bundle. That is the
 * whole reason this middleware exists instead of calling Anthropic from the browser — a key in
 * client code is a key on someone else's machine.
 *
 * This is a prototype stand-in for the real backend service. When the Python API lands, delete
 * this plugin and point the client's base URL at it; nothing else in `src/` changes, because the
 * client only ever talks to `POST /api/generate`.
 */
function aiDevEndpoint(apiKeyAtBoot: string): Plugin {
  /**
   * Re-read the key per request if it was empty at boot.
   *
   * `loadEnv` runs once when the config is evaluated, so a key pasted into .env afterwards would
   * otherwise need a server restart — and the failure mode is a confusing "no key" response from
   * a server that is looking at a file which now has one. Reading lazily means paste-and-refresh
   * works. Once a key is found it is cached, so the normal path touches no disk.
   */
  let cached = apiKeyAtBoot;
  const resolveKey = (root: string): string => {
    if (cached) return cached;
    for (const file of [".env.local", ".env"]) {
      try {
        const text = readFileSync(resolve(root, file), "utf8");
        const m = /^\s*ANTHROPIC_API_KEY\s*=\s*(.+)$/m.exec(text);
        const v = m?.[1]?.trim().replace(/^["']|["']$/g, "");
        if (v) { cached = v; return cached; }
      } catch { /* file absent — try the next one */ }
    }
    return process.env["ANTHROPIC_API_KEY"] ?? "";
  };

  return {
    name: "instinct-ai-dev-endpoint",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/generate", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "POST only" }));
          return;
        }

        const key = resolveKey(server.config.root);
        if (!key) {
          res.statusCode = 503;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              error: "no_api_key",
              message:
                "ANTHROPIC_API_KEY is empty. Paste your key into apps/web/.env after " +
                "ANTHROPIC_API_KEY= and reload this page — no restart needed. " +
                "Meanwhile the nodes below all work without a key.",
            }),
          );
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const { concept } = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            concept?: string;
          };

          if (!concept || concept.trim().length < 3) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "bad_concept" }));
            return;
          }

          // Imported lazily so a missing dependency doesn't break the whole dev server.
          const [{ default: Anthropic }, { SYSTEM_PROMPT, userTurn }] = await Promise.all([
            import("@anthropic-ai/sdk"),
            import("./src/ai/prompt.js"),
          ]);

          const client = new Anthropic({ apiKey: key });

          const message = await client.messages.create({
            model: "claude-opus-5",
            max_tokens: 8000,
            // On these models: no temperature/top_p (400), no thinking.budget_tokens (400).
            // Depth is controlled by output_config.effort.
            thinking: { type: "adaptive" },
            output_config: { effort: "high" },
            system: [
              {
                type: "text",
                text: SYSTEM_PROMPT,
                // Stable prefix — the concept goes in the user turn, after this breakpoint, so
                // repeat generations read the cache instead of re-paying for the prompt.
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [{ role: "user", content: userTurn(concept) }],
          });

          // A refusal is a 200 with empty/partial content, not an exception.
          if (message.stop_reason === "refusal") {
            res.statusCode = 422;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "refused" }));
            return;
          }

          // Thinking blocks also arrive in `content`; keep only the text ones.
          const text = message.content
            .flatMap((b) => (b.type === "text" ? [b.text] : []))
            .join("");

          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          // Raw model text — the client parses and validates it. Deliberate: the parsing layer
          // has to survive real model output, so we don't hide it behind a server-side parse.
          res.end(JSON.stringify({ raw: text, usage: message.usage }));
        } catch (e) {
          server.config.logger.error(`[ai] ${String(e)}`);
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "upstream", message: String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  /**
   * Read .env on the NODE side.
   *
   * Vite only injects `VITE_`-prefixed vars, and only into the client bundle — so
   * `process.env.ANTHROPIC_API_KEY` is undefined in this file even with a .env present. That is
   * why the key needs `loadEnv`, and why it is passed to the plugin explicitly rather than read
   * from `process.env` inside it. The third argument "" disables the prefix filter; the key
   * stays on this side and is never exposed to the browser.
   */
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env["ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? "";

  return {
  plugins: [react(), aiDevEndpoint(apiKey)],
  server: { port: 5173 },
  build: { target: "es2022", sourcemap: true },
  };
});
