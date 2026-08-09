import { getProvider } from "./provider";

import { BASE_URL } from "./config";

// Expected shape:
// {
//   pairs: [
//     { term: "short term or name", definition: "short matching definition or fact" },
//     ...
//   ]
// }
export async function generateMemoryGame(career, topic, notes = "") {
  try {
    const response = await fetch(`${BASE_URL}/api/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ career, topic, notes, provider: getProvider() }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error generating memory game:", error);
    return null;
  }
}
