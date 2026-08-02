const CAREERS_KEY = "eduvance_careers";

const DEFAULT_CAREERS = [
  { name: "Pharmacy", blurb: "Drug mechanisms, interactions, and dosing." },
  { name: "Medicine", blurb: "Diagnosis, physiology, and clinical reasoning." },
  { name: "Nursing", blurb: "Patient care, procedures, and monitoring." },
  { name: "Dentistry", blurb: "Oral anatomy, procedures, and pathology." },
  {
    name: "Veterinary Medicine",
    blurb: "Animal physiology and clinical care.",
  },
  { name: "Physiotherapy", blurb: "Movement, rehabilitation, and anatomy." },
  {
    name: "Software Development",
    blurb: "Programming concepts and systems design.",
  },
];

export function getCareers() {
  const raw = localStorage.getItem(CAREERS_KEY);
  const custom = raw ? JSON.parse(raw) : [];
  return [...DEFAULT_CAREERS, ...custom];
}

export function addCareer(name) {
  const raw = localStorage.getItem(CAREERS_KEY);
  const custom = raw ? JSON.parse(raw) : [];

  const alreadyExists = getCareers().some(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (alreadyExists) return getCareers();

  const entry = {
    name,
    blurb: "Lessons and quizzes generated for this field.",
  };
  custom.push(entry);
  localStorage.setItem(CAREERS_KEY, JSON.stringify(custom));
  return getCareers();
}
