const CURRICULUM_KEY = "eduvance_curriculum";

function getAll() {
  const raw = localStorage.getItem(CURRICULUM_KEY);
  return raw ? JSON.parse(raw) : {};
}

export function getCurriculum(career) {
  const all = getAll();
  return all[career] || [];
}

export function addToCurriculum(career, topic, title, score, total) {
  const all = getAll();
  const list = all[career] || [];
  list.push({
    topic,
    title,
    score,
    total,
    date: new Date().toLocaleDateString(),
  });
  all[career] = list;
  localStorage.setItem(CURRICULUM_KEY, JSON.stringify(all));
}
