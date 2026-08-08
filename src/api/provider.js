const PROVIDER_KEY = "eduvance_provider";

// "ollama" = your local/offline model (default)
// "gemini" = Google AI Studio's Gemini API (needs a server-side key)
export function getProvider() {
  return localStorage.getItem(PROVIDER_KEY) || "ollama";
}

export function setProvider(provider) {
  localStorage.setItem(PROVIDER_KEY, provider);
}

const BASE_URL = "http://127.0.0.1:8000";

// Asks the backend which providers are actually usable right now (i.e.
// whether a Gemini key is configured server-side), so the UI can hide
// or disable the online option instead of offering it and failing.
export async function getAvailableProviders() {
  try {
    const response = await fetch(`${BASE_URL}/api/providers`);
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error checking providers:", error);
    // If the backend isn't reachable at all, assume only offline exists —
    // the rest of the app will surface the connection error anyway.
    return {
      ollama: { available: true, label: "Offline (Ollama)" },
      gemini: { available: false, label: "Online (Gemini)" },
    };
  }
}
