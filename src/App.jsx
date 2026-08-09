import { useState, useEffect } from "react";
import ModeSelect from "./components/ModeSelect";
import Lesson from "./components/Lesson";
import Chat from "./components/chat";
import History from "./components/History";
import Coder from "./components/Coder";
import { getTheme, setTheme } from "./api/theme";
import {
  getProvider,
  setProvider,
  getAvailableProviders,
} from "./api/provider";

const TABS = [
  { key: "lesson", label: "Lesson" },
  { key: "chat", label: "Chat" },
  { key: "history", label: "History" },
];

const DEFAULT_CAREER = "General";

function App() {
  const [mode, setMode] = useState(null); // "academic" | "coder" | null
  const [activeTab, setActiveTab] = useState("lesson");
  const [dark, setDark] = useState(getTheme() === "dark");
  const [provider, setProviderState] = useState(getProvider());
  const [checkingProviders, setCheckingProviders] = useState(true);
  const [providers, setProviders] = useState({
    ollama: { available: true, label: "Offline (Ollama)" },
    gemini: { available: false, label: "Online (Gemini)" },
  });

  useEffect(() => {
    setCheckingProviders(true);
    getAvailableProviders().then((result) => {
      setProviders(result);
      setCheckingProviders(false);
    });
  }, []);

  function toggleProvider() {
    const geminiReady = providers.gemini?.available;
    const next = provider === "ollama" && geminiReady ? "gemini" : "ollama";
    setProvider(next);
    setProviderState(next);
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    setTheme(dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen bg-paper dark:bg-paper-dark transition-colors">
      <div className="max-w-2xl mx-auto px-6">
        <header className="flex items-center justify-between pt-8 pb-8">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-widest text-ink dark:text-ink-dark border border-line dark:border-line-dark px-2 py-1 rounded">
              EDV
            </span>
            <span className="font-display font-semibold text-base text-ink dark:text-ink-dark">
              Eduvance
            </span>
            {mode && (
              <>
                <span className="text-muted dark:text-muted-dark text-sm">
                  /
                </span>
                <button
                  onClick={() => setMode(null)}
                  className="group text-sm text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
                >
                  <span
                    className="hl"
                    style={{ "--hl-color": "var(--color-marker-1)" }}
                  >
                    {mode === "coder" ? "Coder" : "Academic"}
                  </span>
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleProvider}
              disabled={checkingProviders || !providers.gemini?.available}
              title={
                checkingProviders
                  ? "Checking backend status — this can take up to a minute if the server was asleep"
                  : providers.gemini?.available
                    ? "Switch between your offline model and Gemini"
                    : "Set GOOGLE_API_KEY in the backend's .env to enable Gemini"
              }
              className="font-mono text-[11px] tracking-wide text-muted dark:text-muted-dark border border-line dark:border-line-dark rounded px-2 py-1 hover:text-ink dark:hover:text-ink-dark hover:border-ink dark:hover:border-ink-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {checkingProviders
                ? "CHECKING…"
                : provider === "gemini"
                  ? "ONLINE · GEMINI"
                  : "OFFLINE · OLLAMA"}
            </button>
            <button
              onClick={() => setDark(!dark)}
              className="font-mono text-[11px] tracking-wide text-muted dark:text-muted-dark border border-line dark:border-line-dark rounded px-2 py-1 hover:text-ink dark:hover:text-ink-dark hover:border-ink dark:hover:border-ink-dark transition-colors"
            >
              {dark ? "LIGHT" : "DARK"}
            </button>
          </div>
        </header>

        <main className="pb-24">
          {!mode && <ModeSelect onSelect={setMode} />}

          {mode === "coder" && <Coder dark={dark} />}

          {mode === "academic" && (
            <div>
              <div className="flex gap-6 border-b border-line dark:border-line-dark mb-8">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`pb-3 font-mono text-xs tracking-wide uppercase transition-colors ${
                      activeTab === tab.key
                        ? "text-ink dark:text-ink-dark border-b-2 border-marker-1"
                        : "text-muted dark:text-muted-dark border-b-2 border-transparent hover:text-ink dark:hover:text-ink-dark"
                    }`}
                    style={
                      activeTab === tab.key
                        ? { borderColor: "var(--color-marker-1)" }
                        : undefined
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "lesson" && <Lesson career={DEFAULT_CAREER} />}
              {activeTab === "chat" && <Chat />}
              {activeTab === "history" && <History />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
