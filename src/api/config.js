// Central place for the backend URL. Change this ONE value to match
// wherever your FastAPI backend is actually running.
//
// - Local testing on this computer: "http://127.0.0.1:8000"
// - Local testing from your phone on the same Wi-Fi: your computer's
//   LAN IP, e.g. "http://192.168.1.42:8000" (only works on that network,
//   and Ollama/offline mode only works this way too, since Ollama runs
//   on your machine).
// - Anyone, anywhere (deployed): your Render backend URL, e.g.
//   "https://eduvance-backend.onrender.com" — this is what makes
//   ONLINE · GEMINI mode work for remote users. OFFLINE · OLLAMA will
//   still only work for people running the backend + Ollama locally.

export const BASE_URL = "https://eduvance-5pav.onrender.com";
