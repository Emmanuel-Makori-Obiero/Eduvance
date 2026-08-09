import { useEffect, useState } from "react";
import { generateNovel } from "../api/novel";
import { generateSceneImage } from "../api/sceneImage";
import Spinner from "./Spinner";
import novelFantasyImg from "../assets/novel-fantasy.webp";
import novelFantasyImg2 from "../assets/novel-fantasy-2.webp";
import novelScifiImg from "../assets/novel-scifi.webp";
import novelScifiImg2 from "../assets/novel-scifi-2.webp";
import novelMysteryImg from "../assets/novel-mystery.webp";
import novelMysteryImg2 from "../assets/novel-mystery-2.webp";
import novelSliceOfLifeImg from "../assets/novel-sliceoflife.webp";
import novelSliceOfLifeImg2 from "../assets/novel-sliceoflife-2.webp";
import novelHistoricalImg from "../assets/novel-historical.webp";
import novelHistoricalImg2 from "../assets/novel-historical-2.webp";

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

// Each genre maps to a pool of illustrations. A different one is picked
// per page so the same picture doesn't repeat across a whole novel.
const GENRE_IMAGES = {
  "fantasy adventure": [novelFantasyImg, novelFantasyImg2],
  "sci-fi": [novelScifiImg, novelScifiImg2],
  "mystery/thriller": [novelMysteryImg, novelMysteryImg2],
  "slice of life": [novelSliceOfLifeImg, novelSliceOfLifeImg2],
  "historical drama": [novelHistoricalImg, novelHistoricalImg2],
};

// Deterministic pick so the same page always shows the same image during
// a session (no flicker on re-render), but different pages get variety.
function pickImage(pool, seedKey) {
  if (!pool || pool.length === 0) return null;
  let hash = 0;
  const str = String(seedKey);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

export default function NovelBook({ career, topic, notes = "", onClose }) {
  const [genre, setGenre] = useState(GENRES[0]);
  const [novelData, setNovelData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  // Real, scene-specific illustrations generated on demand, keyed by page
  // index. Falls back to the static genre pool while loading or on failure.
  const [pageImages, setPageImages] = useState({});
  const [imageLoading, setImageLoading] = useState(false);

  const newNovel = () => setRetryKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    setNovelData(null);
    setError(null);
    setPageIndex(0);
    setPageImages({});
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

  // Generate a real illustration for this exact page's text once the page
  // is showing and we don't already have one cached for it.
  useEffect(() => {
    if (!novelData || !page) return;
    if (pageImages[pageIndex] !== undefined) return; // already have it (or already tried)

    let cancelled = false;
    setImageLoading(true);
    const scenePrompt = `${genre} scene: ${
      page.chapterTitle ? page.chapterTitle + " — " : ""
    }${page.text.slice(0, 260)}`;

    generateSceneImage(scenePrompt).then((imageUrl) => {
      if (cancelled) return;
      setImageLoading(false);
      // Store null on failure too, so we don't keep retrying every render -
      // the render below falls back to the static pool when this is null.
      setPageImages((prev) => ({ ...prev, [pageIndex]: imageUrl }));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelData, pageIndex]);

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

          {(() => {
            const aiImage = pageImages[pageIndex];
            if (aiImage) {
              return (
                <img
                  src={aiImage}
                  alt={page.chapterTitle || genre}
                  className="w-full h-40 object-cover rounded-md mb-3"
                />
              );
            }
            if (imageLoading) {
              return (
                <div className="w-full h-40 rounded-md mb-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark flex items-center justify-center">
                  <Spinner />
                </div>
              );
            }
            const fallback = pickImage(
              GENRE_IMAGES[genre],
              `${novelData.title}-${pageIndex}`,
            );
            return fallback ? (
              <img
                src={fallback}
                alt={genre}
                className="w-full h-40 object-cover rounded-md mb-3"
              />
            ) : null;
          })()}

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
