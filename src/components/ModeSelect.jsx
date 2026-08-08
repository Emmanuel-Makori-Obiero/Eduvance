const MODES = [
  {
    key: "academic",
    label: "Academic",
    code: "MODE / 01",
    desc: "Lessons, quizzes, and chat for Pharmacy, Medicine, and other careers.",
    marker: "var(--color-marker-1)",
  },
  {
    key: "coder",
    label: "Coder",
    code: "MODE / 02",
    desc: "Generate, review, and run code with an offline AI assistant.",
    marker: "var(--color-marker-3)",
  },
];

export default function ModeSelect({ onSelect }) {
  return (
    <div className="py-6">
      <p className="font-mono text-xs tracking-widest text-muted dark:text-muted-dark mb-2 uppercase">
        Welcome back
      </p>
      <h1 className="font-display font-semibold text-3xl text-ink dark:text-ink-dark mb-10 leading-snug">
        How do you want to study today?
      </h1>

      <div className="grid sm:grid-cols-2 gap-4">
        {MODES.map((m, i) => (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            className="group text-left bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-sm"
            style={{
              transform: `rotate(${i % 2 === 0 ? "-0.4deg" : "0.4deg"})`,
            }}
          >
            <div className="card-tab" style={{ background: m.marker }} />
            <div className="p-5">
              <div className="flex items-baseline justify-between mb-4">
                <span className="font-mono text-[10px] tracking-widest text-muted dark:text-muted-dark">
                  {m.code}
                </span>
                <span className="text-muted dark:text-muted-dark group-hover:translate-x-0.5 group-hover:text-ink dark:group-hover:text-ink-dark transition-all">
                  →
                </span>
              </div>
              <span
                className="hl block font-display font-semibold text-xl text-ink dark:text-ink-dark mb-2"
                style={{ "--hl-color": m.marker }}
              >
                {m.label}
              </span>
              <span className="block text-sm text-muted dark:text-muted-dark leading-relaxed">
                {m.desc}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
