const PROVIDER_KEY = "eduvance_provider";

// The Electron desktop build bundles/runs a local Ollama server, so
// defaulting to "ollama" there is correct and free. The deployed web
// build has no local model to talk to -- a first-time visitor with
// nothing in localStorage yet would otherwise have every request sent
// with provider="ollama" straight to the hosted backend, which can
// never reach Ollama and would fail immediately. Electron sets
// "Electron" in the user agent by default, which is a reliable way to
// tell the two builds apart without any extra wiring.
const isElectron =
  typeof navigator !== "undefined" &&
  /Electron/i.test(navigator.userAgent || "");

const DEFAULT_PROVIDER = isElectron ? "ollama" : "gemini";

// "ollama" = your local/offline model (desktop app default)
// "gemini" = Google AI Studio's Gemini API (web app default; needs a
//            server-side key configured on the backend)
export function getProvider() {
  return localStorage.getItem(PROVIDER_KEY) || DEFAULT_PROVIDER;
}

export function setProvider(provider) {
  localStorage.setItem(PROVIDER_KEY, provider);
}

import { BASE_URL } from "./config";

// Asks the backend which providers are actually usable right now (i.e.
// whether a Gemini key is configured server-side), so the UI can hide
// or disable the online option instead of offering it and failing.
//
// Free hosting (e.g. Render's free tier) spins the backend down after
// inactivity, so the very first request after a while can take 30-60s
// to wake it back up, and may fail once or twice while it's booting.
// Retry a few times with increasing delays before giving up, so the
// toggle doesn't get stuck showing "unavailable" just because the
// first attempt hit a sleeping server.
const RETRY_DELAYS_MS = [1000, 3000, 6000, 10000, 15000]; // ~35s total

export async function getAvailableProviders() {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/api/providers`);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return await response.json();
    } catch (error) {
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      if (isLastAttempt) {
        console.error("Error checking providers (giving up):", error);
        break;
      }
      console.warn(
        `Providers check failed (attempt ${attempt + 1}), retrying in ${RETRY_DELAYS_MS[attempt]}ms — backend may be waking up...`,
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  // If the backend never responded after all retries, assume only
  // offline exists — the rest of the app will surface the connection
  // error anyway.
  return {
    ollama: { available: true, label: "Offline (Ollama)" },
    gemini: { available: false, label: "Online (Gemini)" },
  };
}
