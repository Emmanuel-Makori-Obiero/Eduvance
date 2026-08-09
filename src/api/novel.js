import { getProvider } from "./provider";

const BASE_URL = "http://127.0.0.1:8000";

// Expected shape of the resolved data (consumed by src/components/NovelBook.jsx):
//
// {
//   title: string,
//   genre: string,
//   pages: [
//     { page: 1, chapterTitle: string | null, text: string, lesson: string | null },
//     ...
//   ]
// }

export async function generateNovel(career, topic, notes = "", genre = "") {
  try {
    const response = await fetch(`${BASE_URL}/api/novel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        career,
        topic,
        notes,
        genre,
        provider: getProvider(),
      }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error generating novel:", error);
    return null;
  }
}
