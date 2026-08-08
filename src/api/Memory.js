const BASE_URL = "http://127.0.0.1:8000";

// Expected shape:
// {
//   pairs: [
//     { term: "short term or name", definition: "short matching definition or fact" },
//     ...
//   ]
// }
export async function generateMemoryGame(career, topic) {
  try {
    const response = await fetch(`${BASE_URL}/api/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ career, topic }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error generating memory game:", error);
    return null;
  }
}
