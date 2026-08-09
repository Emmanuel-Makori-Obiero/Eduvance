import { getProvider } from "./provider";

import { BASE_URL } from "./config";

// Expected shape of the resolved data (consumed by src/components/StoryGame.jsx):
//
// {
//   title: string,
//   start: "root",
//   nodes: {
//     root: { text: string, choices: [{ label, next }, { label, next }] },
//     n1a:  { text: string, choices: [{ label, next }, { label, next }] },
//     n1b:  { text: string, choices: [{ label, next }, { label, next }] },
//     end_1: { text: string, outcome: "good"|"mixed"|"poor", lesson: string },
//     end_2: { ... },
//     end_3: { ... },
//     end_4: { ... },
//   }
// }

export async function generateStory(career, topic, notes = "") {
  try {
    const response = await fetch(`${BASE_URL}/api/story`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ career, topic, notes, provider: getProvider() }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error generating story:", error);
    return null;
  }
}
