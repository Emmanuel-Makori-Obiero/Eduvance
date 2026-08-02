// src/api/tutor.js

const API_URL = "http://127.0.0.1:8000/api/tutor";

export async function askTutor(message) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Error talking to tutor:", error);
    return "⚠️ Could not reach the offline tutor. Is your FastAPI server running?";
  }
}
