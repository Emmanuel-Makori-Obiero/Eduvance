import { useState, useEffect } from "react";
import { getHistory, deleteHistoryEntry } from "../api/history";
import historyEmptyImg from "../assets/history-empty.webp";

export default function History() {
  const [history, setHistory] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  function handleDelete(id) {
    deleteHistoryEntry(id);
    setHistory(getHistory());
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-10">
        <img
          src={historyEmptyImg}
          alt=""
          className="w-28 h-28 object-contain mx-auto mb-3"
        />
        <p className="text-sm text-muted dark:text-muted-dark">
          Nothing here yet — completed lessons will appear in this list.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {history.map((entry, i) => (
        <div
          key={entry.id}
          className="border border-line dark:border-line-dark rounded-lg overflow-hidden"
        >
          <div
            className="flex justify-between items-center gap-4 cursor-pointer px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
            onClick={() =>
              setExpandedId(expandedId === entry.id ? null : entry.id)
            }
          >
            <span
              className="shrink-0 w-1.5 self-stretch -my-3 -ml-4"
              style={{
                background: `var(--color-marker-${(i % 4) + 1})`,
              }}
            />
            <div className="min-w-0">
              <p className="font-display font-medium text-ink dark:text-ink-dark truncate">
                {entry.title}
              </p>
              <p className="font-mono text-xs text-muted dark:text-muted-dark mt-0.5">
                {entry.career} · {entry.date} · {entry.score}/
                {entry.quiz.length}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(entry.id);
              }}
              className="ml-auto shrink-0 font-mono text-xs uppercase tracking-wide text-muted dark:text-muted-dark hover:text-incorrect transition-colors"
            >
              Remove
            </button>
          </div>

          {expandedId === entry.id && (
            <p className="whitespace-pre-line text-sm text-ink dark:text-ink-dark leading-relaxed px-4 pb-4">
              {entry.lesson}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
