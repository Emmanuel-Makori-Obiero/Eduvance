import { useState, useEffect } from "react";
import { generateLesson, getNextTopic, regenerateQuiz } from "../api/lesson";
import { saveLessonToHistory } from "../api/history";
import { getCurriculum, addToCurriculum } from "../api/curriculum";
import Spinner from "./Spinner";

export default function Lesson({ career }) {
  const [topic, setTopic] = useState("");
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
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
    const data = await generateLesson(career, t);
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

  return (
    <div>
      {curriculum.length > 0 && (
        <div className="mb-10">
          <p className="text-sm text-muted dark:text-muted-dark mb-3 uppercase tracking-wide">
            Your curriculum so far
          </p>
          <div className="flex flex-col gap-2">
            {curriculum.map((c, i) => (
              <div
                key={i}
                className="flex justify-between items-baseline border-b border-line dark:border-line-dark pb-2"
              >
                <span className="text-ink dark:text-ink-dark">{c.title}</span>
                <span className="text-sm text-muted dark:text-muted-dark">
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
          className="text-sm text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
        >
          Generate
        </button>
      </div>

      {loading && <Spinner />}

      {lessonData && (
        <div>
          <h2 className="font-serif text-2xl text-ink dark:text-ink-dark mb-4">
            {lessonData.title}
          </h2>
          <p className="whitespace-pre-line leading-relaxed text-ink dark:text-ink-dark mb-10">
            {lessonData.lesson}
          </p>

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted dark:text-muted-dark uppercase tracking-wide">
              Quiz
            </p>
            {!regeneratingQuiz && (
              <button
                onClick={handleRegenerateQuiz}
                className="text-sm text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
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
                  {i + 1}. {q.question}
                </p>
                <div className="flex flex-col gap-1">
                  {q.options.map((opt, j) => {
                    const isSelected = selectedAnswers[i] === opt;
                    const isCorrect = opt === q.correct_answer;
                    let style =
                      "text-left px-3 py-2 rounded border transition-colors ";

                    if (submitted) {
                      if (isCorrect)
                        style += "border-correct text-correct bg-correct/5";
                      else if (isSelected && !isCorrect)
                        style +=
                          "border-incorrect text-incorrect bg-incorrect/5";
                      else
                        style +=
                          "border-line dark:border-line-dark text-muted dark:text-muted-dark";
                    } else if (isSelected) {
                      style +=
                        "border-ink dark:border-ink-dark text-ink dark:text-ink-dark";
                    } else {
                      style +=
                        "border-line dark:border-line-dark text-ink dark:text-ink-dark hover:border-muted";
                    }

                    return (
                      <button
                        key={j}
                        onClick={() => selectAnswer(i, opt)}
                        className={style}
                      >
                        {opt}
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
                className="text-sm text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
              >
                Submit answers
              </button>
            ) : (
              <div>
                <p className="font-serif text-lg text-ink dark:text-ink-dark mb-6">
                  {calculateScore()} out of {lessonData.quiz.length}
                </p>
                {loadingNext ? (
                  <Spinner />
                ) : (
                  <button
                    onClick={handleContinueCurriculum}
                    className="text-sm text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
                  >
                    Continue curriculum
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
