import { useEffect, useState } from "react";
import { generateNovel } from "../api/novel";
import Spinner from "./Spinner";

// A paginated short novel woven around the topic, with an occasional
// "lesson" beat embedded at natural high points. Data comes from the
// AI-generated { title, genre, pages } payload (see src/api/novel.js).
const GENRES = [
  "fantasy adventure",
  "sci-fi",
  "mystery/thriller",
  "slice of life",
  "historical drama",
];

export default function NovelBook({ career, topic, notes = "", onClose }) {
  const [genre, setGenre] = useState(GENRES[0]);
  const [novelData, setNovelData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);

  const newNovel = () => setRetryKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    setNovelData(null);
    setError(null);
    setPageIndex(0);
    generateNovel(career, topic, notes, genre).then((data) => {
      if (cancelled) return;
      if (!data || !Array.isArray(data.pages) || data.pages.length === 0) {
        setError(
          "The AI didn't return a readable novel. Try generating again.",
        );
        return;
      }
      setNovelData(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career, topic, notes, retryKey]);

  const page = novelData?.pages?.[pageIndex];
  const isFirst = pageIndex === 0;
  const isLast = novelData ? pageIndex === novelData.pages.length - 1 : false;

  function goNext() {
    if (!isLast) setPageIndex((i) => i + 1);
  }
  function goPrev() {
    if (!isFirst) setPageIndex((i) => i - 1);
  }

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
          onClick={newNovel}
          className="text-sm text-muted dark:text-muted-dark underline underline-offset-2"
        >
          🔁 New novel
        </button>
      </div>

      {!novelData && !error && (
        <div className="max-w-xl mb-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-widest text-muted dark:text-muted-dark uppercase">
            Genre
          </span>
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                g === genre
                  ? "border-ink dark:border-ink-dark text-ink dark:text-ink-dark"
                  : "border-line dark:border-line-dark text-muted dark:text-muted-dark"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div>
          <p style={{ color: "#c0392b" }}>{error}</p>
          <button
            onClick={newNovel}
            className="mt-2 px-3 py-1.5 bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark rounded text-sm"
          >
            Try again
          </button>
        </div>
      )}
      {!novelData && !error && <Spinner />}

      {novelData && page && (
        <div className="max-w-xl">
          <p className="font-mono text-[10px] tracking-widest text-muted dark:text-muted-dark uppercase mb-1">
            Novel mode · {novelData.genre}
          </p>
          <h2 className="font-display font-semibold text-xl text-ink dark:text-ink-dark mb-4">
            {novelData.title}
          </h2>

          {page.chapterTitle && (
            <h3 className="font-display font-medium text-base text-ink dark:text-ink-dark mb-3">
              {page.chapterTitle}
            </h3>
          )}

          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-5 mb-5">
            <p className="whitespace-pre-line leading-relaxed text-ink dark:text-ink-dark">
              {page.text}
            </p>
            {page.lesson && (
              <p className="text-sm text-muted dark:text-muted-dark mt-4 pt-4 border-t border-line dark:border-line-dark">
                <span className="font-mono text-[10px] tracking-widest uppercase text-muted dark:text-muted-dark mr-1">
                  Lesson
                </span>
                <br />
                {page.lesson}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={isFirst}
              className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="font-mono text-[10px] tracking-widest text-muted dark:text-muted-dark uppercase">
              Page {pageIndex + 1} / {novelData.pages.length}
            </span>
            {!isLast ? (
              <button
                onClick={goNext}
                className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={newNovel}
                className="font-mono text-xs uppercase tracking-wide text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
              >
                Generate a new novel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
