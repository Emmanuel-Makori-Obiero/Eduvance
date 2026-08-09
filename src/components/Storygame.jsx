import { useEffect, useState } from "react";
import { generateStory } from "../api/story";
import Spinner from "./Spinner";

// A branching "choose your path" scenario: the student is dropped into a
// realistic situation about the topic, makes a decision, faces a
// follow-up decision, then lands on one of four endings that shows the
// consequence of the exact path they took. Every node/edge comes from
// the AI-generated { start, nodes } tree (see src/api/story.js).
const OUTCOME_STYLE = {
  good: {
    label: "Good outcome",
    border: "border-correct",
    text: "text-correct",
    bg: "bg-correct/10",
  },
  mixed: {
    label: "Mixed outcome",
    border: "border-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  poor: {
    label: "Poor outcome",
    border: "border-incorrect",
    text: "text-incorrect",
    bg: "bg-incorrect/10",
  },
};

export default function StoryGame({ career, topic, notes = "", onClose }) {
  const [storyData, setStoryData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [currentId, setCurrentId] = useState("root");
  const [path, setPath] = useState([]); // [{ label, nodeId }]

  const newScenario = () => setRetryKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    setStoryData(null);
    setError(null);
    setCurrentId("root");
    setPath([]);
    generateStory(career, topic, notes).then((data) => {
      if (cancelled) return;
      if (!data || !data.nodes || !data.nodes.root) {
        setError(
          "The AI didn't return a playable scenario. Try generating again.",
        );
        return;
      }
      setStoryData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [career, topic, notes, retryKey]);

  function choose(choice) {
    setPath((p) => [...p, { label: choice.label, nodeId: choice.next }]);
    setCurrentId(choice.next);
  }

  function restartSamePath() {
    setCurrentId("root");
    setPath([]);
  }

  const node = storyData?.nodes?.[currentId];
  const isEnding = node && !node.choices;
  const outcomeStyle = isEnding ? OUTCOME_STYLE[node.outcome] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onClose}
          className="text-sm text-muted dark:text-muted-dark underline underline-offset-2"
        >
          ← Back to lesson
        </button>
        <button
          onClick={newScenario}
          className="text-sm text-muted dark:text-muted-dark underline underline-offset-2"
        >
          🔁 New scenario
        </button>
      </div>

      {error && (
        <div>
          <p style={{ color: "#c0392b" }}>{error}</p>
          <button
            onClick={newScenario}
            className="mt-2 px-3 py-1.5 bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark rounded text-sm"
          >
            Try again
          </button>
        </div>
      )}
      {!storyData && !error && <Spinner />}

      {storyData && node && (
        <div className="max-w-xl">
          <p className="font-mono text-[10px] tracking-widest text-muted dark:text-muted-dark uppercase mb-1">
            Story mode
          </p>
          <h2 className="font-display font-semibold text-xl text-ink dark:text-ink-dark mb-4">
            {storyData.title}
          </h2>

          {/* Path so far, so the student can see the journey they're on */}
          {path.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {path.map((step, i) => (
                <span
                  key={i}
                  className="font-mono text-[10px] tracking-wide text-muted dark:text-muted-dark border border-line dark:border-line-dark rounded-full px-2 py-1"
                >
                  {i + 1}. {step.label}
                </span>
              ))}
            </div>
          )}

          <div
            className={`bg-surface dark:bg-surface-dark border rounded-lg p-5 mb-5 ${
              isEnding
                ? outcomeStyle.border
                : "border-line dark:border-line-dark"
            }`}
          >
            {isEnding && (
              <span
                className={`inline-block font-mono text-[10px] tracking-widest uppercase rounded px-2 py-1 mb-3 ${outcomeStyle.bg} ${outcomeStyle.text}`}
              >
                {outcomeStyle.label}
              </span>
            )}
            <p className="whitespace-pre-line leading-relaxed text-ink dark:text-ink-dark">
              {node.text}
            </p>
            {isEnding && (
              <p className="text-sm text-muted dark:text-muted-dark mt-4 pt-4 border-t border-line dark:border-line-dark">
                <span className="font-mono text-[10px] tracking-widest uppercase text-muted dark:text-muted-dark mr-1">
                  Lesson
                </span>
                <br />
                {node.lesson}
              </p>
            )}
          </div>

          {!isEnding && (
            <div className="flex flex-col gap-2">
              {node.choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => choose(choice)}
                  className="text-left border border-line dark:border-line-dark rounded-lg px-4 py-3 hover:-translate-y-0.5 transition-transform text-ink dark:text-ink-dark"
                >
                  <span
                    className="hl"
                    style={{
                      "--hl-color":
                        i === 0
                          ? "var(--color-marker-1)"
                          : "var(--color-marker-3)",
                    }}
                  >
                    {choice.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {isEnding && (
            <div className="flex items-center gap-4">
              <button
                onClick={restartSamePath}
                className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
              >
                Try a different choice
              </button>
              <button
                onClick={newScenario}
                className="font-mono text-xs uppercase tracking-wide text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
              >
                Generate a new scenario
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
