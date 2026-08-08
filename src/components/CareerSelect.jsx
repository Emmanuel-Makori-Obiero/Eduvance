import { useState, useEffect } from "react";
import { getCareers, addCareer } from "../api/careers";

const MARKERS = [
  "var(--color-marker-1)",
  "var(--color-marker-2)",
  "var(--color-marker-3)",
  "var(--color-marker-4)",
];

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
      <p className="font-mono text-xs tracking-widest text-muted dark:text-muted-dark mb-2 uppercase">
        Eduvance
      </p>
      <h1 className="font-display font-semibold text-3xl text-ink dark:text-ink-dark mb-8">
        What are you studying for?
      </h1>

      <div className="grid gap-3">
        {careers.map((c, i) => {
          const marker = MARKERS[i % MARKERS.length];
          return (
            <button
              key={c.name}
              onClick={() => onSelect(c.name)}
              className="group flex items-center gap-4 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg pl-0 pr-4 py-3 text-left hover:-translate-y-0.5 transition-transform overflow-hidden"
            >
              <span
                className="self-stretch w-1.5 shrink-0"
                style={{ background: marker }}
              />
              <span className="shrink-0 w-10 h-10 rounded-full border border-line dark:border-line-dark flex items-center justify-center font-display font-semibold text-lg text-ink dark:text-ink-dark">
                {c.name.charAt(0)}
              </span>
              <span>
                <span
                  className="hl block font-display font-semibold text-lg text-ink dark:text-ink-dark"
                  style={{ "--hl-color": marker }}
                >
                  {c.name}
                </span>
                <span className="block text-sm text-muted dark:text-muted-dark">
                  {c.blurb}
                </span>
              </span>
            </button>
          );
        })}
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
              className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="font-mono text-xs uppercase tracking-wide text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
          >
            + Add a career not listed here
          </button>
        )}
      </div>
    </div>
  );
}
