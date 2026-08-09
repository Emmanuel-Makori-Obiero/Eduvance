import { useState, useEffect } from "react";
import { generateLesson, getNextTopic, regenerateQuiz } from "../api/lesson";
import { saveLessonToHistory } from "../api/history";
import { getCurriculum, addToCurriculum } from "../api/curriculum";
import Spinner from "./Spinner";
import Game from "./game";
import Platformer from "./platformer";
import MemoryGame from "./MemoryGame";
import StoryGame from "./StoryGame";
import NotesInput from "./NotesInput";

const PLAY_MODES = [
  {
    key: "game",
    label: "Quiz game",
    desc: "Race the clock, answer fast.",
    marker: "var(--color-marker-1)",
  },
  {
    key: "platformer",
    label: "Platformer",
    desc: "Jump through the topic level by level.",
    marker: "var(--color-marker-3)",
  },
  {
    key: "memory",
    label: "Memory match",
    desc: "Pair terms with their meanings.",
    marker: "var(--color-marker-2)",
  },
  {
    key: "story",
    label: "Story mode",
    desc: "Live out a scenario — your choices shape what happens.",
    marker: "var(--color-marker-1)",
  },
];

export default function Lesson({ career }) {
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showPlatformer, setShowPlatformer] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [regeneratingQuiz, setRegeneratingQuiz] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [curriculum, setCurriculum] = useState([]);

  useEffect(() => {
    setCurriculum(getCurriculum(career));
  }, [career]);

  async function runLesson(t) {
    setLoading(true);
    setLessonData(null);
    setSelectedAnswers({});
    setSubmitted(false);
    const data = await generateLesson(career, t, notes);
    setLessonData(data);
    setTopic(t);
    setLoading(false);
  }

  function handleGenerate() {
    if (!topic.trim()) return;
    runLesson(topic.trim());
  }

  async function handleContinueCurriculum() {
    setLoadingNext(true);
    const previousTopics = curriculum.map((c) => c.topic);
    const next = await getNextTopic(career, previousTopics);
    setLoadingNext(false);
    if (next) runLesson(next);
  }

  async function handleRegenerateQuiz() {
    if (!lessonData) return;
    setRegeneratingQuiz(true);
    setSelectedAnswers({});
    setSubmitted(false);
    const newQuiz = await regenerateQuiz(career, topic, lessonData.lesson);
    if (newQuiz) setLessonData((prev) => ({ ...prev, quiz: newQuiz }));
    setRegeneratingQuiz(false);
  }

  function selectAnswer(questionIndex, option) {
    if (submitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: option }));
  }

  function calculateScore() {
    if (!lessonData) return 0;
    let score = 0;
    lessonData.quiz.forEach((q, i) => {
      if (selectedAnswers[i] === q.correct_answer) score++;
    });
    return score;
  }

  function handleSubmit() {
    setSubmitted(true);
    const score = calculateScore();
    saveLessonToHistory(career, topic, lessonData, score);
    addToCurriculum(
      career,
      topic,
      lessonData.title,
      score,
      lessonData.quiz.length,
    );
    setCurriculum(getCurriculum(career));
  }

  if (showGame) {
    return (
      <Game
        career={career}
        topic={topic.trim() || "the topics covered in your notes"}
        notes={notes}
        onClose={() => setShowGame(false)}
      />
    );
  }

  if (showPlatformer) {
    return (
      <Platformer
        career={career}
        topic={topic.trim() || "the topics covered in your notes"}
        notes={notes}
        onClose={() => setShowPlatformer(false)}
      />
    );
  }

  if (showMemory) {
    return (
      <MemoryGame
        career={career}
        topic={topic.trim() || "the topics covered in your notes"}
        notes={notes}
        onClose={() => setShowMemory(false)}
      />
    );
  }

  if (showStory) {
    return (
      <StoryGame
        career={career}
        topic={topic.trim() || "the topics covered in your notes"}
        notes={notes}
        onClose={() => setShowStory(false)}
      />
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10 lg:items-start">
      <div className="min-w-0">
        {curriculum.length > 0 && (
          <div className="mb-10">
            <p className="font-mono text-xs tracking-widest text-muted dark:text-muted-dark mb-3 uppercase">
              Your curriculum so far
            </p>
            <div className="flex flex-col gap-2">
              {curriculum.map((c, i) => (
                <div
                  key={i}
                  className="flex justify-between items-baseline border-b border-line dark:border-line-dark pb-2"
                >
                  <span className="text-ink dark:text-ink-dark">{c.title}</span>
                  <span className="font-mono text-xs text-muted dark:text-muted-dark">
                    {c.score}/{c.total} · {c.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            placeholder="Enter a topic — e.g. Drug Interactions"
            className="flex-1 bg-transparent border-b border-line dark:border-line-dark px-1 py-2 text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none focus:border-ink dark:focus:border-ink-dark transition-colors"
          />
          <button
            onClick={handleGenerate}
            className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
          >
            Generate
          </button>
        </div>

        <div className="mb-8">
          <NotesInput notes={notes} onChange={setNotes} />
        </div>

        {/* Games move to the sidebar on large screens; shown inline below it on mobile */}
        {(topic.trim() || notes.trim()) && (
          <div className="lg:hidden mb-8">
            <GamePanel
              topic={topic}
              notes={notes}
              onPlay={(key) => {
                if (key === "game") setShowGame(true);
                if (key === "platformer") setShowPlatformer(true);
                if (key === "memory") setShowMemory(true);
                if (key === "story") setShowStory(true);
              }}
            />
          </div>
        )}

        {loading && <Spinner />}

        {lessonData && (
          <div>
            <h2 className="font-display font-semibold text-2xl text-ink dark:text-ink-dark mb-4">
              {lessonData.title}
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-ink dark:text-ink-dark mb-6">
              {lessonData.lesson}
            </p>

            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-xs text-muted dark:text-muted-dark uppercase tracking-widest">
                Quiz
              </p>
              {!regeneratingQuiz && (
                <button
                  onClick={handleRegenerateQuiz}
                  className="font-mono text-xs uppercase tracking-wide text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
                >
                  Regenerate quiz
                </button>
              )}
            </div>

            {regeneratingQuiz && <Spinner />}

            {!regeneratingQuiz &&
              lessonData.quiz.map((q, i) => (
                <div
                  key={i}
                  className="mb-8 pb-8 border-b border-line dark:border-line-dark last:border-0"
                >
                  <p className="text-ink dark:text-ink-dark mb-3">
                    <span className="font-mono text-xs text-muted dark:text-muted-dark mr-1">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {q.question}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt, j) => {
                      const isSelected = selectedAnswers[i] === opt;
                      const isCorrect = opt === q.correct_answer;

                      let borderClass =
                        "border-line dark:border-line-dark text-ink dark:text-ink-dark hover:border-muted dark:hover:border-muted-dark";
                      let hlOn = false;
                      let hlColor = "var(--color-marker-1)";

                      if (submitted) {
                        if (isCorrect) {
                          borderClass = "border-correct text-correct";
                          hlOn = true;
                          hlColor =
                            "color-mix(in srgb, var(--color-correct) 35%, transparent)";
                        } else if (isSelected && !isCorrect) {
                          borderClass = "border-incorrect text-incorrect";
                          hlOn = true;
                          hlColor =
                            "color-mix(in srgb, var(--color-incorrect) 35%, transparent)";
                        } else {
                          borderClass =
                            "border-line dark:border-line-dark text-muted dark:text-muted-dark";
                        }
                      } else if (isSelected) {
                        borderClass =
                          "border-ink dark:border-ink-dark text-ink dark:text-ink-dark";
                        hlOn = true;
                      }

                      return (
                        <button
                          key={j}
                          onClick={() => selectAnswer(i, opt)}
                          className={`text-left px-3 py-2 rounded border transition-colors ${borderClass}`}
                        >
                          <span
                            className={`hl ${hlOn ? "hl-on" : ""}`}
                            style={{ "--hl-color": hlColor }}
                          >
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {submitted && (
                    <p className="text-sm text-muted dark:text-muted-dark mt-2">
                      {q.explanation}
                    </p>
                  )}
                </div>
              ))}

            {!regeneratingQuiz &&
              (!submitted ? (
                <button
                  onClick={handleSubmit}
                  className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
                >
                  Submit answers
                </button>
              ) : (
                <div className="flex items-center gap-5">
                  <div className="stamp shrink-0 w-16 h-16 flex flex-col items-center justify-center text-ink dark:text-ink-dark">
                    <span className="font-display font-semibold text-lg leading-none">
                      {calculateScore()}/{lessonData.quiz.length}
                    </span>
                    <span className="font-mono text-[8px] tracking-widest uppercase mt-0.5">
                      graded
                    </span>
                  </div>
                  {loadingNext ? (
                    <Spinner />
                  ) : (
                    <button
                      onClick={handleContinueCurriculum}
                      className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
                    >
                      Continue curriculum
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Sidebar: generate a game from this lesson's topic */}
      <aside className="hidden lg:block sticky top-8">
        <GamePanel
          topic={topic}
          notes={notes}
          onPlay={(key) => {
            if (key === "game") setShowGame(true);
            if (key === "platformer") setShowPlatformer(true);
            if (key === "memory") setShowMemory(true);
            if (key === "story") setShowStory(true);
          }}
        />
      </aside>
    </div>
  );
}

function GamePanel({ topic, notes, onPlay }) {
  const hasTopic = Boolean(topic.trim());
  const hasNotes = Boolean(notes && notes.trim());
  const canPlay = hasTopic || hasNotes;
  const displayTitle = hasTopic
    ? `"${topic.trim()}"`
    : hasNotes
      ? "Your uploaded notes"
      : "Enter a topic or upload notes";

  return (
    <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg overflow-hidden">
      <div
        className="card-tab"
        style={{ background: "var(--color-marker-1)" }}
      />
      <div className="p-4">
        <p className="font-mono text-[10px] tracking-widest text-muted dark:text-muted-dark uppercase mb-1">
          Generate a game
        </p>
        <p className="font-display font-semibold text-ink dark:text-ink-dark mb-1 leading-snug">
          {displayTitle}
        </p>
        {hasTopic && hasNotes && (
          <p className="text-xs text-muted dark:text-muted-dark mb-4">
            Built only from your uploaded notes.
          </p>
        )}
        {!hasTopic && hasNotes && (
          <p className="text-xs text-muted dark:text-muted-dark mb-4">
            No topic typed — the game will be built entirely from your notes.
          </p>
        )}
        {hasTopic && !hasNotes && <div className="mb-4" />}

        {!canPlay && (
          <p className="text-sm text-muted dark:text-muted-dark">
            Type a topic, or upload/paste your notes, on the left — a game gets
            built from either one, no separate setup needed.
          </p>
        )}

        {canPlay && (
          <div className="flex flex-col gap-2">
            {PLAY_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => onPlay(m.key)}
                className="group text-left border border-line dark:border-line-dark rounded-lg px-3 py-2.5 hover:-translate-y-0.5 transition-transform"
              >
                <span
                  className="hl block text-sm font-medium text-ink dark:text-ink-dark"
                  style={{ "--hl-color": m.marker }}
                >
                  {m.label}
                </span>
                <span className="block text-xs text-muted dark:text-muted-dark mt-0.5">
                  {m.desc}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
