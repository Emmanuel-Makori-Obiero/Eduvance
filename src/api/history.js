const HISTORY_KEY = "eduvance_lesson_history";

export function saveLessonToHistory(career, topic, lessonData, score) {
  const history = getHistory();

  const entry = {
    id: Date.now(),
    career,
    topic,
    title: lessonData.title,
    lesson: lessonData.lesson,
    quiz: lessonData.quiz,
    score,
    date: new Date().toLocaleString(),
  };

  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function getHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function deleteHistoryEntry(id) {
  const history = getHistory().filter((entry) => entry.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
