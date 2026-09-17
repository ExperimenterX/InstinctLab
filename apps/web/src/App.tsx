import { useEffect, useMemo, useRef, useState } from "react";
import { compileStage } from "./canvas/stage.js";
import { getTheme, prefersDark, type Mode } from "./canvas/theme.js";
import { generateLab } from "./ai/generate.js";
import { formatIssues, parseLabSpec } from "./spec/parse.js";
import { CONCEPTS, getConcept } from "./concepts/index.js";
import { LabSpecSchema, type LabSpec } from "./spec/schema.js";
import { clearSession, createLabStore, loadSession, saveSession } from "./state/labStore.js";
import { LabCanvas } from "./components/LabCanvas.js";
import { KnobPanel } from "./components/KnobPanel.js";
import { Readouts } from "./components/Readouts.js";
import { PredictPanel, type PredictionOutcome } from "./components/PredictPanel.js";
import { QuizPanel } from "./components/QuizPanel.js";

type Stage = "explore" | "predict" | "quiz";

export function App() {
  const [mode, setMode] = useState<Mode>(() => (prefersDark() ? "dark" : "light"));
  const [spec, setSpec] = useState<LabSpec | null>(null);
  const [concept, setConcept] = useState("");
  const [stage, setStage] = useState<Stage>("explore");
  const [outcome, setOutcome] = useState<PredictionOutcome | null>(null);

  /**
   * Node gallery. `/node/<id>` mounts that node's own fixture as a complete lab.
   *
   * This is how a node gets "spun up" standalone: whoever is building `grid-automaton` opens
   * /node/grid-automaton and sees their canvas with real knobs, a prediction, and a quiz — with
   * no API key, no generator, and none of the other nodes finished.
   */
  useEffect(() => {
    const m = /^\/node\/([a-z0-9-]+)$/.exec(window.location.pathname);
    if (!m) return;
    const node = getConcept(m[1]!);
    if (!node) return;
    // Hand-authored node specs go through the same parser as model output — no exceptions.
    const res = parseLabSpec(JSON.stringify(node.spec));
    if (res.ok) {
      setSpec(res.spec);
      setConcept(node.title);
    } else {
      console.error(`[node:${node.id}] spec does not validate`, res.issues);
    }
  }, []);

  // Restore a previous session. Re-validated on the way in — a stored spec is untrusted too, and
  // a stale shape should look like "no session" rather than crash the app.
  useEffect(() => {
    if (window.location.pathname.startsWith("/node/")) return;
    const saved = loadSession();
    if (!saved) return;
    const check = LabSpecSchema.safeParse(saved.spec);
    if (check.success) {
      setSpec(check.data);
      setConcept(saved.concept);
    } else {
      clearSession();
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset["theme"] = mode;
  }, [mode]);

  const startLab = (next: LabSpec, forConcept: string) => {
    setSpec(next);
    setConcept(forConcept);
    setStage("explore");
    setOutcome(null);
    saveSession(forConcept, next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => { setSpec(null); clearSession(); }}
          title="New lab"
        >
          Instinct&nbsp;Lab
        </button>
        <div className="topbar-right">
          {spec ? <span className="topbar-concept">{concept}</span> : null}
          <button
            className="btn-ghost"
            onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
            aria-label="Toggle colour scheme"
          >
            {mode === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {!spec ? (
        <ConceptScreen onStart={startLab} />
      ) : (
        <LabScreen
          spec={spec}
          mode={mode}
          stage={stage}
          outcome={outcome}
          onStage={setStage}
          onOutcome={setOutcome}
        />
      )}
    </div>
  );
}

// ── Screen 1: the only input in the product ───────────────────────────────────────────────────

function ConceptScreen({ onStart }: { onStart: (spec: LabSpec, concept: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ title: string; detail: string; raw?: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const submit = async () => {
    const concept = text.trim();
    if (concept.length < 3 || busy) return;

    setBusy(true);
    setProblem(null);
    abort.current?.abort();
    abort.current = new AbortController();

    const res = await generateLab(concept, abort.current.signal);
    setBusy(false);

    switch (res.status) {
      case "ok":
        if (res.parsed.repairs.length) console.info("[spec] repaired:", res.parsed.repairs);
        if (res.parsed.warnings.length) console.warn("[spec] warnings:", res.parsed.warnings);
        onStart(res.parsed.spec, concept);
        return;
      case "invalid":
        // Surface it rather than silently retrying — during a prototype the failure mode of the
        // parsing layer is information you want, not noise to hide.
        setProblem({
          title: "The model returned a lab that didn't validate.",
          detail: formatIssues(res.parsed.issues),
          raw: res.raw,
        });
        return;
      case "no_key":
        setProblem({
          title: "No API key configured.",
          detail: "Copy .env.example to .env and add ANTHROPIC_API_KEY, then restart the dev server. You can explore the example lab in the meantime.",
        });
        return;
      case "refused":
        setProblem({
          title: "That topic was declined.",
          detail: "Try the underlying mechanism instead — the concept behind it usually makes a better lab anyway.",
        });
        return;
      case "error":
        setProblem({ title: "Generation failed.", detail: res.message });
        return;
    }
  };

  return (
    <main className="concept">
      <h1>What do you want to understand?</h1>
      <p className="tagline">
        Not an explanation — a thing you can drag until it makes sense.
      </p>

      <div className="concept-input">
        <input
          autoFocus
          value={text}
          placeholder="why does adding lanes to a highway not fix traffic"
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          disabled={busy}
          maxLength={280}
        />
        <button className="btn-primary" onClick={() => void submit()} disabled={busy || text.trim().length < 3}>
          {busy ? "Building…" : "Build it"}
        </button>
      </div>

      {busy ? (
        <p className="hint">Designing the simulation. This takes a few seconds.</p>
      ) : (
        <button className="btn-ghost example-link" onClick={() => openExample(onStart, setProblem)}>
          or open a node below →
        </button>
      )}

      {CONCEPTS.length > 0 ? (
        <nav className="node-gallery" aria-label="Concept nodes">
          <span>nodes:</span>
          {CONCEPTS.map((n) => (
            <a key={n.id} href={`/node/${n.id}`} title={n.summary}>
              {n.title}
            </a>
          ))}
        </nav>
      ) : null}

      {problem ? (
        <div className="problem">
          <strong>{problem.title}</strong>
          <pre>{problem.detail}</pre>
          {problem.raw ? (
            <details>
              <summary>Raw model output</summary>
              <pre className="raw">{problem.raw}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

/**
 * Opens a node fixture as a real lab. It goes through `parseLabSpec` exactly like model output,
 * so the example path validates the same code the generator does — a fixture that drifts out of
 * schema fails here rather than rendering something subtly wrong.
 */
function openExample(
  onStart: (spec: LabSpec, concept: string) => void,
  setProblem: (p: { title: string; detail: string }) => void,
): void {
  const first = CONCEPTS[0]!;
  const res = parseLabSpec(JSON.stringify(first.spec));
  if (res.ok) onStart(res.spec, first.title);
  else setProblem({ title: "The bundled node is out of schema.", detail: formatIssues(res.issues) });
}

// ── Screen 2: the lab ─────────────────────────────────────────────────────────────────────────

function LabScreen({
  spec,
  mode,
  stage,
  outcome,
  onStage,
  onOutcome,
}: {
  spec: LabSpec;
  mode: Mode;
  stage: Stage;
  outcome: PredictionOutcome | null;
  onStage: (s: Stage) => void;
  onOutcome: (o: PredictionOutcome | null) => void;
}) {
  // Built once per spec. Rebuilding would reset the lab mid-experiment, so the dependency list
  // here is deliberately just the spec identity.
  const plot = useMemo(() => compileStage(spec), [spec]);
  const store = useMemo(() => createLabStore(spec), [spec]);

  const observable = spec.observables.find((o) => o.id === spec.prediction.observable_id);
  const frozen = stage === "predict" && !outcome;

  const marker = outcome
    ? ({ value: outcome.actual, label: "actual", kind: "actual" } as const)
    : undefined;

  return (
    <main className="lab">
      <section className="stage">
        <div className="stage-head">
          <h2>{spec.title}</h2>
          <p className="caption">{spec.caption}</p>
        </div>

        <LabCanvas plot={plot} store={store} mode={mode} marker={marker} dimmed={frozen} />

        <div className="phases">
          {(["explore", "predict", "quiz"] as const).map((s) => (
            <button
              key={s}
              className={stage === s ? "phase phase-on" : "phase"}
              onClick={() => onStage(s)}
              // Gate the quiz until a prediction is committed: the quiz is built around the
              // surprise, so skipping the surprise makes it meaningless.
              disabled={s === "quiz" && !outcome}
              title={s === "quiz" && !outcome ? "Make a prediction first" : undefined}
            >
              {s === "explore" ? "Explore" : s === "predict" ? "Predict" : "Recall"}
            </button>
          ))}
        </div>
      </section>

      <aside className="side">
        <Readouts plot={plot} store={store} />

        {stage === "explore" ? (
          <>
            <KnobPanel spec={spec} store={store} />
            <button className="btn-primary" onClick={() => onStage("predict")}>
              I think I see it →
            </button>
          </>
        ) : null}

        {stage === "predict" ? (
          <>
            <PredictPanel
              plot={plot}
              store={store}
              outcome={outcome}
              onResolved={(o) => onOutcome(o)}
            />
            {outcome ? (
              <>
                <KnobPanel spec={spec} store={store} />
                <button className="btn-primary" onClick={() => onStage("quiz")}>
                  Test it →
                </button>
              </>
            ) : null}
          </>
        ) : null}

        {stage === "quiz" ? (
          <>
            <QuizPanel spec={spec} />
            <button className="btn-ghost" onClick={() => onStage("explore")}>
              ← Back to the lab
            </button>
          </>
        ) : null}

        {observable && outcome ? (
          <p className="side-note" style={{ color: getTheme(mode).muted }}>
            Green line marks the real value of {observable.label.toLowerCase()}.
          </p>
        ) : null}
      </aside>
    </main>
  );
}
