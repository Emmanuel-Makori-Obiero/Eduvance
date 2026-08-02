import { useState, useEffect } from "react";
import CareerSelect from "./components/CareerSelect";
import Lesson from "./components/Lesson";
import Chat from "./components/Chat";
import History from "./components/History";
import { getTheme, setTheme } from "./api/theme";

const TABS = [
  { key: "lesson", label: "Lesson" },
  { key: "chat", label: "Chat" },
  { key: "history", label: "History" },
];

function App() {
  const [selectedCareer, setSelectedCareer] = useState(null);
  const [activeTab, setActiveTab] = useState("lesson");
  const [dark, setDark] = useState(getTheme() === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    setTheme(dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen bg-paper dark:bg-paper-dark transition-colors">
      <div className="max-w-2xl mx-auto relative">
        <button
          onClick={() => setDark(!dark)}
          className="absolute top-6 right-6 text-xs text-muted dark:text-muted-dark underline underline-offset-2"
        >
          {dark ? "Light mode" : "Dark mode"}
        </button>

        {!selectedCareer ? (
          <CareerSelect onSelect={setSelectedCareer} />
        ) : (
          <div className="px-6 pt-16 pb-16">
            <div className="flex items-baseline justify-between mb-6">
              <button
                onClick={() => setSelectedCareer(null)}
                className="text-sm text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
              >
                Change career
              </button>
              <span className="font-serif text-ink dark:text-ink-dark">
                {selectedCareer}
              </span>
            </div>

            <div className="flex gap-6 border-b border-line dark:border-line-dark mb-8">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`pb-3 text-sm transition-colors ${
                    activeTab === tab.key
                      ? "text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark"
                      : "text-muted dark:text-muted-dark"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "lesson" && <Lesson career={selectedCareer} />}
            {activeTab === "chat" && <Chat />}
            {activeTab === "history" && <History />}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
