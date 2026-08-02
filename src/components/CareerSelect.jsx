import { useState, useEffect } from "react";
import { getCareers, addCareer } from "../api/careers";

export default function CareerSelect({ onSelect }) {
  const [careers, setCareers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newCareer, setNewCareer] = useState("");

  useEffect(() => {
    setCareers(getCareers());
  }, []);

  function handleAdd() {
    const trimmed = newCareer.trim();
    if (!trimmed) return;
    const updated = addCareer(trimmed);
    setCareers(updated);
    setNewCareer("");
    setAdding(false);
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <p className="text-sm text-muted dark:text-muted-dark mb-1 tracking-wide">
        Eduvance
      </p>
      <h1 className="font-serif text-3xl text-ink dark:text-ink-dark mb-8">
        What are you studying for?
      </h1>

      <div className="border-t border-line dark:border-line-dark">
        {careers.map((c) => (
          <button
            key={c.name}
            onClick={() => onSelect(c.name)}
            className="w-full flex items-center gap-4 py-4 border-b border-line dark:border-line-dark text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
          >
            <span className="shrink-0 w-10 h-10 rounded-full border border-line dark:border-line-dark flex items-center justify-center font-serif text-lg text-ink dark:text-ink-dark">
              {c.name.charAt(0)}
            </span>
            <span>
              <span className="block font-serif text-lg text-ink dark:text-ink-dark">
                {c.name}
              </span>
              <span className="block text-sm text-muted dark:text-muted-dark">
                {c.blurb}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="pt-6">
        {adding ? (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={newCareer}
              onChange={(e) => setNewCareer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Name a career"
              className="flex-1 bg-transparent border-b border-line dark:border-line-dark px-1 py-2 text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none focus:border-ink dark:focus:border-ink-dark transition-colors"
            />
            <button
              onClick={handleAdd}
              className="text-sm text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-sm text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
          >
            + Add a career not listed here
          </button>
        )}
      </div>
    </div>
  );
}
