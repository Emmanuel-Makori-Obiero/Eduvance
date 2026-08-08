import { useState } from "react";
import { askTutor } from "../api/tutor";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const reply = await askTutor(input);

    setMessages((prev) => [...prev, { role: "tutor", content: reply }]);
    setLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSend();
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 mb-6 min-h-[280px]">
        {messages.length === 0 && !loading && (
          <p className="text-sm text-muted dark:text-muted-dark">
            Ask your tutor anything — it'll answer like a study partner, not a
            search engine.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg border px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "ml-auto border-ink dark:border-ink-dark text-ink dark:text-ink-dark"
                : "border-line dark:border-line-dark text-ink dark:text-ink-dark relative overflow-hidden"
            }`}
          >
            {msg.role === "tutor" && (
              <span
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: "var(--color-marker-3)" }}
              />
            )}
            <span className={msg.role === "tutor" ? "pl-2 block" : ""}>
              {msg.content}
            </span>
          </div>
        ))}
        {loading && (
          <div className="max-w-[85%] rounded-lg border border-line dark:border-line-dark px-4 py-2.5 text-sm text-muted dark:text-muted-dark italic">
            Thinking…
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your tutor something..."
          className="flex-1 bg-transparent border-b border-line dark:border-line-dark px-1 py-2 text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none focus:border-ink dark:focus:border-ink-dark transition-colors"
        />
        <button
          onClick={handleSend}
          className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
        >
          Send
        </button>
      </div>
    </div>
  );
}
