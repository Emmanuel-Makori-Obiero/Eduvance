import { useState } from "react";
import Editor from "@monaco-editor/react";
import { generateCode, reviewCode, fixCode } from "../api/Code";
import Spinner from "./Spinner";

const MONACO_LANGUAGE_MAP = {
  javascript: "javascript",
  js: "javascript",
  react: "javascript",
  "react.js": "javascript",
  reactjs: "javascript",
  jsx: "javascript",
  "next.js": "javascript",
  nextjs: "javascript",
  vue: "javascript",
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  angular: "typescript",
  python: "python",
  django: "python",
  flask: "python",
  java: "java",
  spring: "java",
  "c#": "csharp",
  csharp: "csharp",
  ".net": "csharp",
  "c++": "cpp",
  cpp: "cpp",
  c: "c",
  go: "go",
  golang: "go",
  rust: "rust",
  php: "php",
  laravel: "php",
  ruby: "ruby",
  rails: "ruby",
  sql: "sql",
  html: "html",
  css: "css",
  shell: "shell",
  bash: "shell",
};

function toMonacoLanguage(freeText) {
  const key = freeText.trim().toLowerCase();
  return MONACO_LANGUAGE_MAP[key] || "plaintext";
}

const MODES = [
  { key: "generate", label: "Generate", marker: "var(--color-marker-1)" },
  { key: "review", label: "Review", marker: "var(--color-marker-3)" },
  { key: "fix", label: "Fix", marker: "var(--color-marker-4)" },
];

export default function Coder({ dark }) {
  const [activeMode, setActiveMode] = useState("generate");
  const [language, setLanguage] = useState("JavaScript");
  const [code, setCode] = useState("");
  const [promptText, setPromptText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);

    let data = null;
    if (activeMode === "generate") {
      if (!promptText.trim()) {
        setLoading(false);
        return;
      }
      data = await generateCode(language, promptText);
      if (data && data.code) setCode(data.code);
    } else if (activeMode === "review") {
      if (!code.trim()) {
        setLoading(false);
        return;
      }
      data = await reviewCode(language, code);
    } else if (activeMode === "fix") {
      if (!code.trim()) {
        setLoading(false);
        return;
      }
      data = await fixCode(language, code, errorText);
      if (data && data.fixed_code) setCode(data.fixed_code);
    }

    setResult(data);
    setLoading(false);
  }

  function switchMode(modeKey) {
    setActiveMode(modeKey);
    setResult(null);
  }

  return (
    <div>
      {/* Mode tabs */}
      <div className="flex gap-6 border-b border-line dark:border-line-dark mb-6">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => switchMode(m.key)}
            className={`pb-3 font-mono text-xs uppercase tracking-wide transition-colors border-b-2 ${
              activeMode === m.key
                ? "text-ink dark:text-ink-dark"
                : "text-muted dark:text-muted-dark border-transparent hover:text-ink dark:hover:text-ink-dark"
            }`}
            style={activeMode === m.key ? { borderColor: m.marker } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Language / framework input */}
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-xs uppercase tracking-wide text-muted dark:text-muted-dark shrink-0">
          Language
        </span>
        <input
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="e.g. Python, React, Next.js, C++"
          className="flex-1 bg-transparent border-b border-line dark:border-line-dark text-sm text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark py-1 focus:outline-none"
        />
      </div>

      {/* Generate mode: prompt input */}
      {activeMode === "generate" && (
        <div className="mb-4">
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
            placeholder="Describe what to build — e.g. a function that reverses a string"
            className="w-full bg-transparent border-b border-line dark:border-line-dark px-1 py-2 text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none"
          />
        </div>
      )}

      {/* Fix mode: error input */}
      {activeMode === "fix" && (
        <div className="mb-4">
          <textarea
            value={errorText}
            onChange={(e) => setErrorText(e.target.value)}
            placeholder="Paste the error message or traceback (optional)"
            rows={3}
            className="w-full bg-transparent border-b border-line dark:border-line-dark px-1 py-2 text-sm text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none resize-none"
          />
        </div>
      )}

      {/* Editor - shown for review and fix, and to display generated code */}
      {activeMode !== "generate" && (
        <p className="font-mono text-xs text-muted dark:text-muted-dark mb-2 uppercase tracking-widest">
          Your code
        </p>
      )}
      <div className="border border-line dark:border-line-dark rounded-lg overflow-hidden mb-6">
        <Editor
          height="320px"
          language={toMonacoLanguage(language)}
          theme={dark ? "vs-dark" : "light"}
          value={code}
          onChange={(value) => setCode(value || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            padding: { top: 12 },
          }}
        />
      </div>

      <button
        onClick={handleRun}
        className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1 mb-8"
      >
        {activeMode === "generate" && "Generate"}
        {activeMode === "review" && "Review code"}
        {activeMode === "fix" && "Diagnose and fix"}
      </button>

      {loading && <Spinner />}

      {/* Generate result */}
      {!loading && result && activeMode === "generate" && (
        <div>
          <p className="font-mono text-xs text-muted dark:text-muted-dark mb-2 uppercase tracking-widest">
            How it works
          </p>
          <p className="whitespace-pre-line leading-relaxed text-ink dark:text-ink-dark">
            {result.explanation}
          </p>
        </div>
      )}

      {/* Review result */}
      {!loading && result && activeMode === "review" && (
        <div>
          <p className="font-mono text-xs text-muted dark:text-muted-dark mb-2 uppercase tracking-widest">
            Summary
          </p>
          <p className="leading-relaxed text-ink dark:text-ink-dark mb-6">
            {result.summary}
          </p>

          {result.issues && result.issues.length > 0 && (
            <div>
              <p className="font-mono text-xs text-muted dark:text-muted-dark mb-4 uppercase tracking-widest">
                Issues
              </p>
              {result.issues.map((issue, i) => (
                <div
                  key={i}
                  className="mb-4 pb-4 border-b border-line dark:border-line-dark last:border-0"
                >
                  <p className="text-sm font-mono text-muted dark:text-muted-dark mb-1">
                    {issue.line_hint}
                  </p>
                  <p className="text-ink dark:text-ink-dark mb-1">
                    {issue.issue}
                  </p>
                  <p className="text-sm text-correct">{issue.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          {result.improved_code && (
            <button
              onClick={() => setCode(result.improved_code)}
              className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1"
            >
              Apply improved code
            </button>
          )}
        </div>
      )}

      {/* Fix result */}
      {!loading && result && activeMode === "fix" && (
        <div>
          <p className="font-mono text-xs text-muted dark:text-muted-dark mb-2 uppercase tracking-widest">
            Diagnosis
          </p>
          <p className="leading-relaxed text-ink dark:text-ink-dark mb-6">
            {result.diagnosis}
          </p>

          <p className="font-mono text-xs text-muted dark:text-muted-dark mb-2 uppercase tracking-widest">
            What changed
          </p>
          <p className="whitespace-pre-line leading-relaxed text-ink dark:text-ink-dark">
            {result.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
