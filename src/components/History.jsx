import { useState, useEffect } from "react";
import { getHistory, deleteHistoryEntry } from "../api/history";

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
      <p className="text-muted dark:text-muted-dark">
        Nothing here yet — completed lessons will appear in this list.
      </p>
    );
  }

  return (
    <div>
      {history.map((entry) => (
        <div
          key={entry.id}
          className="border-b border-line dark:border-line-dark py-4"
        >
          <div
            className="flex justify-between items-baseline cursor-pointer"
            onClick={() =>
              setExpandedId(expandedId === entry.id ? null : entry.id)
            }
          >
            <div>
              <p className="font-serif text-ink dark:text-ink-dark">
                {entry.title}
              </p>
              <p className="text-sm text-muted dark:text-muted-dark">
                {entry.career} · {entry.date} · {entry.score}/
                {entry.quiz.length}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(entry.id);
              }}
              className="text-sm text-muted dark:text-muted-dark hover:text-incorrect transition-colors"
            >
              Remove
            </button>
          </div>

          {expandedId === entry.id && (
            <p className="whitespace-pre-line text-sm text-ink dark:text-ink-dark leading-relaxed mt-4">
              {entry.lesson}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
