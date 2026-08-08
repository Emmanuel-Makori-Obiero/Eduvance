const CODE_API_URL = "http://127.0.0.1:8000/api/code";

async function callCode(payload) {
  try {
    const response = await fetch(CODE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error talking to code assistant:", error);
    return null;
  }
}

export async function generateCode(language, prompt) {
  return callCode({ mode: "generate", language, prompt });
}

export async function reviewCode(language, code) {
  return callCode({ mode: "review", language, code });
}

export async function fixCode(language, code, error) {
  return callCode({ mode: "fix", language, code, error });
}
