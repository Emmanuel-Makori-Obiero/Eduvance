import { BASE_URL } from "./config";

// Asks the backend to generate a real illustration for this specific scene
// (a novel page or a story ending), instead of picking from a small pool of
// pre-made pictures. Returns a data: URL string, or null on failure -- the
// caller is expected to fall back to a static image when this returns null.
export async function generateSceneImage(promptText) {
  const prompt = (promptText || "").trim();
  if (!prompt) return null;

  try {
    const response = await fetch(`${BASE_URL}/api/scene-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    return data.image || null;
  } catch (error) {
    console.error("Error generating scene image:", error);
    return null;
  }
}
