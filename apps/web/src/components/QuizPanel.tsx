import { useState } from "react";
import type { LabSpec } from "../spec/schema.js";

/**
 * Three questions, then a score.
 *
 * Grading is local in the MVP — there is no backend to hide the key behind, so a determined
 * learner can read the answers out of the bundle. That is an accepted prototype trade, and the
 * fix is not obfuscation: when the real API exists, the key stays server-side and this component
 * posts answers instead of comparing them.
 */
export function QuizPanel({ spec, onDone }: { spec: LabSpec; onDone?: (score: number) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => spec.quiz.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  const answered = answers.filter((a) => a !== null).length;
  const correct = spec.quiz.reduce(
    (n, q, i) => n + (answers[i] === q.correct_index ? 1 : 0),
    0,
  );

  return (
    <div className="panel quiz">
      <h3>Did it stick?</h3>

      {spec.quiz.map((q, qi) => {
        const chosen = answers[qi];
        return (
          <fieldset className="quiz-item" key={qi}>
            <legend>{q.prompt}</legend>
            {q.options.map((opt, oi) => {
              const isChosen = chosen === oi;
              const isRight = oi === q.correct_index;
              const cls = !submitted
                ? isChosen ? "opt opt-chosen" : "opt"
                : isRight ? "opt opt-right"
                  : isChosen ? "opt opt-wrong" : "opt opt-dim";
              return (
                <label className={cls} key={oi}>
                  <input
                    type="radio"
                    name={`q${qi}`}
                    checked={isChosen}
                    disabled={submitted}
                    onChange={() =>
                      setAnswers((prev) => prev.map((v, i) => (i === qi ? oi : v)))
                    }
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
            {submitted && q.why ? <p className="quiz-why">{q.why}</p> : null}
          </fieldset>
        );
      })}

      {!submitted ? (
        <button
          className="btn-primary"
          disabled={answered < spec.quiz.length}
          onClick={() => {
            setSubmitted(true);
            onDone?.(correct / spec.quiz.length);
          }}
        >
          {answered < spec.quiz.length ? `${answered} of ${spec.quiz.length} answered` : "Check"}
        </button>
      ) : (
        <div className="quiz-score">
          <strong>
            {correct} / {spec.quiz.length}
          </strong>
          <span>{spec.teaching_angle}</span>
        </div>
      )}
    </div>
  );
}
