import { useEffect, useRef, useState } from "react";
import { generateMemoryGame } from "../api/Memory";
import Spinner from "./Spinner";
import memoryWinImg from "../assets/memory-win.webp";

// Simple, original-design memory/matching game: flip cards to pair a
// term with its definition. Built from the same career/topic input as
// the other games, hitting a separate /api/memory endpoint.
export default function MemoryGame({ career, topic, notes = "", onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]); // indices currently face-up (max 2)
  const [matched, setMatched] = useState([]); // indices permanently matched
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const timeoutRef = useRef(null);

  const newGame = () => setRetryKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setCards([]);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    generateMemoryGame(career, topic, notes).then((res) => {
      if (cancelled) return;
      if (!res || !res.pairs || res.pairs.length < 3) {
        setError("The AI didn't return enough pairs. Try generating again.");
        return;
      }
      setData(res);
      const deck = [];
      res.pairs.forEach((p, i) => {
        deck.push({ id: `t${i}`, pairId: i, label: p.term, kind: "term" });
        deck.push({ id: `d${i}`, pairId: i, label: p.definition, kind: "def" });
      });
      // shuffle
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      setCards(deck);
    });
    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [career, topic, notes, retryKey]);

  function handleFlip(idx) {
    if (locked) return;
    if (flipped.includes(idx) || matched.includes(idx)) return;
    if (flipped.length === 2) return;

    const next = [...flipped, idx];
    setFlipped(next);

    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      const isMatch =
        cards[a].pairId === cards[b].pairId && cards[a].kind !== cards[b].kind;
      setLocked(true);
      timeoutRef.current = setTimeout(
        () => {
          if (isMatch) {
            setMatched((prev) => [...prev, a, b]);
          }
          setFlipped([]);
          setLocked(false);
        },
        isMatch ? 500 : 900,
      );
    }
  }

  const allMatched = cards.length > 0 && matched.length === cards.length;

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
          onClick={newGame}
          className="text-sm text-muted dark:text-muted-dark underline underline-offset-2"
        >
          🔁 New Game
        </button>
      </div>

      {error && (
        <div>
          <p style={{ color: "#c0392b" }}>{error}</p>
          <button
            onClick={newGame}
            className="mt-2 px-3 py-1.5 bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark rounded text-sm"
          >
            Try again
          </button>
        </div>
      )}
      {!data && !error && <Spinner />}

      {data && (
        <div className="w-full max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-4 px-1 text-sm text-muted dark:text-muted-dark">
            <div>Moves: {moves}</div>
            <div>
              Matched: {matched.length / 2}/{cards.length / 2}
            </div>
          </div>

          {allMatched ? (
            <div className="text-center py-16">
              <img
                src={memoryWinImg}
                alt="All matched"
                className="w-32 h-32 object-contain mx-auto mb-3"
              />
              <div className="text-xl text-ink dark:text-ink-dark mb-2">
                🎉 All matched!
              </div>
              <div className="text-sm text-muted dark:text-muted-dark mb-4">
                Finished in {moves} moves.
              </div>
              <button
                onClick={newGame}
                className="px-4 py-2 bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark rounded text-sm"
              >
                🔁 Play Another Round
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {cards.map((card, idx) => {
                const isFaceUp = flipped.includes(idx) || matched.includes(idx);
                const isMatchedCard = matched.includes(idx);
                return (
                  <button
                    key={card.id}
                    onClick={() => handleFlip(idx)}
                    disabled={isMatchedCard}
                    className={
                      "aspect-square rounded p-2 text-xs leading-snug flex items-center justify-center text-center transition-colors " +
                      (isMatchedCard
                        ? "bg-green-800/60 border border-green-500 text-green-100 cursor-default"
                        : isFaceUp
                          ? card.kind === "term"
                            ? "bg-sky-800 border border-sky-400 text-white"
                            : "bg-amber-800 border border-amber-400 text-white"
                          : "bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 text-neutral-500")
                    }
                  >
                    {isFaceUp ? card.label : "?"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
