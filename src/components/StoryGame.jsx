import { useEffect, useState } from "react";
import { generateStory } from "../api/Story";
import { generateSceneImage } from "../api/sceneImage";
import Spinner from "./Spinner";
import storyGoodImg from "../assets/story-good.webp";
import storyGoodImg2 from "../assets/story-good-2.webp";
import storyMixedImg from "../assets/story-mixed.webp";
import storyMixedImg2 from "../assets/story-mixed-2.webp";
import storyPoorImg from "../assets/story-poor.webp";
import storyPoorImg2 from "../assets/story-poor-2.webp";

// Each outcome maps to a pool of illustrations, so replaying the game
// doesn't always show the same picture for the same outcome type.
const OUTCOME_IMAGES = {
  good: [storyGoodImg, storyGoodImg2],
  mixed: [storyMixedImg, storyMixedImg2],
  poor: [storyPoorImg, storyPoorImg2],
};

// Deterministic pick so the same ending node always shows the same image
// during a session (no flicker on re-render), but different playthroughs
// / nodes get variety.
function pickImage(pool, seedKey) {
  if (!pool || pool.length === 0) return null;
  let hash = 0;
  const str = String(seedKey);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

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
  // Real, scene-specific illustrations generated on demand, keyed by node
  // id. Falls back to the static outcome pool while loading or on failure.
  const [nodeImages, setNodeImages] = useState({});
  const [imageLoading, setImageLoading] = useState(false);

  const newScenario = () => setRetryKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    setStoryData(null);
    setError(null);
    setCurrentId("root");
    setPath([]);
    setNodeImages({});
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

  // Generate a real illustration for this exact ending's text once it's
  // showing and we don't already have one cached for it.
  useEffect(() => {
    if (!storyData || !node || !isEnding) return;
    if (nodeImages[currentId] !== undefined) return; // already have it (or already tried)

    let cancelled = false;
    setImageLoading(true);
    const scenePrompt = `${outcomeStyle.label.toLowerCase()} scene: ${node.text.slice(0, 260)}`;

    generateSceneImage(scenePrompt).then((imageUrl) => {
      if (cancelled) return;
      setImageLoading(false);
      setNodeImages((prev) => ({ ...prev, [currentId]: imageUrl }));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyData, currentId, isEnding]);

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
              <>
                {(() => {
                  const aiImage = nodeImages[currentId];
                  if (aiImage) {
                    return (
                      <img
                        src={aiImage}
                        alt={outcomeStyle.label}
                        className="w-full h-40 object-cover rounded-md mb-3"
                      />
                    );
                  }
                  if (imageLoading) {
                    return (
                      <div className="w-full h-40 rounded-md mb-3 bg-paper dark:bg-paper-dark border border-line dark:border-line-dark flex items-center justify-center">
                        <Spinner />
                      </div>
                    );
                  }
                  const fallback = pickImage(
                    OUTCOME_IMAGES[node.outcome],
                    `${storyData.title}-${currentId}`,
                  );
                  return fallback ? (
                    <img
                      src={fallback}
                      alt={outcomeStyle.label}
                      className="w-full h-40 object-cover rounded-md mb-3"
                    />
                  ) : null;
                })()}
                <span
                  className={`inline-block font-mono text-[10px] tracking-widest uppercase rounded px-2 py-1 mb-3 ${outcomeStyle.bg} ${outcomeStyle.text}`}
                >
                  {outcomeStyle.label}
                </span>
              </>
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
