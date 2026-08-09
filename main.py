import json
import os

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# python-dotenv is optional -- if it's not installed we just skip loading
# .env and rely on real environment variables instead.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- MODEL PROVIDERS ----------
# Three provider modes are supported:
#   "auto"   - (default) try your local Ollama server first; if it's not
#              reachable (server off, not started, wrong port), fall back
#              to Gemini automatically -- this is the "backup" behavior.
#   "ollama" - force local/offline only, never fall back.
#   "gemini" - force online only, skip Ollama entirely.
#
# The key is NEVER hardcoded here or sent from the frontend. It's read
# from the environment at request time, which is populated from a local
# .env file (gitignored) or from real environment variables / GitHub
# Actions secrets in CI. See .env.example for the expected variable name.

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "gemma4:e4b"

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

# Exceptions that mean "the Ollama server isn't reachable right now" as
# opposed to "Ollama reached us but errored" -- only these trigger an
# automatic fallback to Gemini in "auto" mode.
OLLAMA_UNREACHABLE_ERRORS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)


@app.get("/api/providers")
def list_providers():
    """Lets the frontend know which providers are actually usable right now,
    so it can hide/disable the online option if no key is configured, and
    show whether auto-fallback is currently possible."""
    return {
        "ollama": {"available": True, "label": "Offline (Ollama)"},
        "gemini": {
            "available": bool(GOOGLE_API_KEY),
            "label": "Online (Gemini)",
        },
        "auto": {
            "available": True,
            "label": "Auto (Ollama, falls back to Gemini)",
            "fallback_ready": bool(GOOGLE_API_KEY),
        },
    }


def _clean_json_text(raw_content: str) -> str:
    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()
    return cleaned


def _call_ollama(system: str, user_prompt: str) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
    }
    response = requests.post(OLLAMA_URL, json=payload, timeout=15)
    response.raise_for_status()
    result = response.json()
    return result["message"]["content"]


def _call_gemini(system: str, user_prompt: str) -> str:
    if not GOOGLE_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="No Gemini API key configured on the server. Set "
                   "GOOGLE_API_KEY in your .env file, or switch to the "
                   "offline (Ollama) provider.",
        )
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"},
    }
    try:
        response = requests.post(
            GEMINI_URL,
            params={"key": GOOGLE_API_KEY},
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        # requests' default error message includes the full request URL,
        # which contains the API key as a query param -- never let that
        # reach a client or a log. Report the status only.
        status = e.response.status_code if e.response is not None else "unknown"
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API request failed (status {status}). Check that "
                   f"your GOOGLE_API_KEY is valid and has quota remaining.",
        )
    except requests.exceptions.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Couldn't reach the Gemini API (network error).",
        )

    result = response.json()
    try:
        return result["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise HTTPException(
            status_code=500,
            detail="Gemini returned an unexpected response shape.",
        )


def call_llm(system: str, user_prompt: str, provider: str = "auto") -> str:
    """Routes to the chosen provider and returns the raw text response.

    "auto" tries Ollama first (short timeout, since a down local server
    should fail fast) and transparently falls back to Gemini if Ollama
    isn't reachable at all. If Ollama IS reachable but errors for some
    other reason (bad response, model error), that error is raised as-is
    rather than silently swapping providers.
    """
    provider = (provider or "auto").lower()

    if provider == "gemini":
        return _call_gemini(system, user_prompt)

    if provider == "ollama":
        return _call_ollama(system, user_prompt)

    if provider == "auto":
        try:
            return _call_ollama(system, user_prompt)
        except OLLAMA_UNREACHABLE_ERRORS:
            if GOOGLE_API_KEY:
                return _call_gemini(system, user_prompt)
            raise HTTPException(
                status_code=503,
                detail="Your offline model isn't running (couldn't reach "
                       "Ollama), and no Gemini backup key is configured. "
                       "Start Ollama, or set GOOGLE_API_KEY in your .env "
                       "file to enable the automatic backup.",
            )

    raise HTTPException(
        status_code=400,
        detail=f"Unknown provider '{provider}'. Use 'auto', 'ollama', or 'gemini'.",
    )


def call_llm_json(system: str, user_prompt: str, provider: str = "auto") -> dict:
    """Calls the model and parses its response as JSON, with the shared
    error handling every endpoint below used to duplicate."""
    try:
        raw_content = call_llm(system, user_prompt, provider)
        return json.loads(_clean_json_text(raw_content))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500, detail="Model did not return valid JSON. Try again."
        )
    except HTTPException:
        raise
    except Exception:
        # Deliberately not including str(e) here -- some exceptions (e.g.
        # from the requests library) embed the full request URL, which can
        # contain the Gemini API key as a query param. Never surface that.
        raise HTTPException(
            status_code=500,
            detail="Something went wrong generating a response. Try again.",
        )


JSON_SYSTEM_PROMPT = (
    "You are a precise JSON API. You only output valid JSON, never markdown, "
    "never extra commentary."
)


# ---------- CHAT (Phase 1) ----------
class ChatRequest(BaseModel):
    message: str
    provider: str = "auto"


@app.post("/api/tutor")
def chat_with_tutor(request: ChatRequest):
    system = (
        "You are a strict, step-by-step programming teacher. Never give code "
        "answers directly. Explain concepts simply and ask guiding questions."
    )
    try:
        content = call_llm(system, request.message, request.provider)
        return {"response": content}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Something went wrong reaching the tutor. Try again.",
        )


# ---------- LESSON + QUIZ (Phase 3) ----------
class LessonRequest(BaseModel):
    career: str
    topic: str
    notes: str = ""
    provider: str = "auto"


def _notes_block(notes: str, limit: int = 6000) -> str:
    """Trim uploaded notes to a safe prompt length."""
    notes = (notes or "").strip()
    if not notes:
        return ""
    if len(notes) > limit:
        notes = notes[:limit] + "\n...[truncated]"
    return notes


@app.post("/api/lesson")
def generate_lesson(request: LessonRequest):
    notes = _notes_block(request.notes)
    if notes:
        source_instruction = f"""Base the lesson STRICTLY on the student's own notes below - do not
introduce outside facts that aren't supported by these notes. Use the notes
as your single source of truth, and organize/clarify them into a lesson.

--- STUDENT'S NOTES ---
{notes}
--- END NOTES ---
"""
    else:
        source_instruction = ""

    prompt = f"""You are an expert {request.career} instructor creating a study lesson.

Topic: {request.topic}

{source_instruction}
Respond ONLY with valid JSON, no markdown formatting, no backticks, no extra text.
Use this exact structure:
{{
  "title": "short lesson title",
  "lesson": "a clear, well-explained lesson on the topic...",
  "quiz": [
    {{
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "the correct option text",
      "explanation": "brief explanation of why this is correct"
    }}
  ]
}}

Generate exactly 5 quiz questions."""

    return call_llm_json(JSON_SYSTEM_PROMPT, prompt, request.provider)


# ---------- CURRICULUM PROGRESSION (Phase 7) ----------
class NextTopicRequest(BaseModel):
    career: str
    previous_topics: list[str]
    provider: str = "auto"


@app.post("/api/next-topic")
def next_topic(request: NextTopicRequest):
    covered = ", ".join(request.previous_topics) if request.previous_topics else "nothing yet"
    prompt = f"""You are designing a study curriculum for a {request.career} student.

Topics already covered, in order: {covered}

Suggest the single next topic they should learn, following a logical teaching progression
(building on what they already know, not repeating a covered topic).

Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{{
  "topic": "the next topic name, short and specific"
}}"""

    return call_llm_json(JSON_SYSTEM_PROMPT, prompt, request.provider)


class QuizRequest(BaseModel):
    career: str
    topic: str
    lesson: str
    provider: str = "auto"


@app.post("/api/quiz")
def regenerate_quiz(request: QuizRequest):
    prompt = f"""You are an expert {request.career} instructor. A student just read this lesson on "{request.topic}":

{request.lesson}

Write a NEW set of 5 multiple-choice quiz questions testing this lesson - different questions and
different wording than any quiz you may have written before for this topic.

Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{{
  "quiz": [
    {{
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "the correct option text",
      "explanation": "brief explanation of why this is correct"
    }}
  ]
}}

Generate exactly 5 quiz questions."""

    return call_llm_json(JSON_SYSTEM_PROMPT, prompt, request.provider)


# ---------- GAME MODE ----------
class GameRequest(BaseModel):
    career: str
    topic: str
    notes: str = ""
    provider: str = "auto"


@app.post("/api/game")
def generate_game(request: GameRequest):
    notes = _notes_block(request.notes)
    if notes:
        source_instruction = f"""Every checkpoint dialogue, quiz question, and answer MUST be drawn
directly from the student's own notes below - do not invent facts that
aren't supported by these notes. If the notes don't cover 4 distinct ideas,
it's fine to teach the same idea from two angles rather than making
something up.

--- STUDENT'S NOTES ---
{notes}
--- END NOTES ---
"""
    else:
        source_instruction = ""

    prompt = f"""You are designing a short 2D top-down educational adventure game level
for a {request.career} student learning about "{request.topic}".

The game canvas is 900 wide and 560 tall. The player starts near (60, 500) and
walks around to visit checkpoints in order, then can bump into wandering
"villain" enemies to trigger a quiz battle.

Create 4 checkpoints, each teaching one key idea about "{request.topic}" in sequence.
Create 2 enemies themed as villains related to "{request.topic}" (e.g. misconceptions
or complications), each with 3 quiz questions.

{source_instruction}
Respond ONLY with valid JSON, no markdown, no backticks, no extra text.
Use this exact structure:
{{
  "checkpoints": [
    {{
      "name": "short checkpoint name",
      "position": {{"x": 200, "y": 450}},
      "speaker": "name of the NPC talking",
      "arrivalDialogue": "1-3 sentences teaching a concept related to {request.topic}",
      "nextObjective": "short instruction for where/what to do next, or null if this is the last checkpoint",
      "challenge": {{
        "type": "quiz",
        "question": "a question testing the concept just taught",
        "options": ["option A", "option B", "option C", "option D"],
        "answer": 0
      }}
    }}
  ],
  "enemies": [
    {{
      "name": "villain name",
      "color": "#c0392b",
      "spawn": {{"x": 400, "y": 300}},
      "range": 60,
      "after": 0,
      "intro": "1 sentence flavor text when the battle starts",
      "victory": "1 sentence flavor text when the villain is defeated",
      "questions": [
        {{
          "q": "quiz question text",
          "options": ["option A", "option B", "option C", "option D"],
          "answer": 0,
          "rightFact": "short fact shown when answered correctly",
          "wrongFact": "short fact shown when answered incorrectly"
        }}
      ]
    }}
  ]
}}

Rules:
- Positions must stay within x: 40-860, y: 40-520, and checkpoints should be spread out, not clustered.
- "answer" is a zero-based index into "options".
- "after" is the zero-based checkpoint index the enemy appears after (use 0 or 1).
- Each enemy needs exactly 3 questions. Each checkpoint needs exactly 1 challenge.
- The last checkpoint's "nextObjective" must be null.
- All content must be accurate and specific to "{request.topic}" for a {request.career} student."""

    data = call_llm_json(JSON_SYSTEM_PROMPT, prompt, request.provider)
    if not data.get("checkpoints"):
        raise HTTPException(status_code=500, detail="Model returned no checkpoints. Try again.")
    return data


# ---------- MEMORY MATCH ----------
class MemoryRequest(BaseModel):
    career: str
    topic: str
    notes: str = ""
    provider: str = "auto"


@app.post("/api/memory")
def generate_memory(request: MemoryRequest):
    notes = _notes_block(request.notes)
    if notes:
        source_instruction = f"""Draw every term and definition directly from the student's own notes
below - do not invent terms that aren't supported by these notes.

--- STUDENT'S NOTES ---
{notes}
--- END NOTES ---
"""
    else:
        source_instruction = ""

    prompt = f"""You are creating a memory-matching study game for a {request.career}
student learning about "{request.topic}".

Create 8 term/definition pairs covering key concepts of "{request.topic}".
Each "term" should be short (1-4 words, a name or key phrase). Each
"definition" should be a short, clear explanation (under 15 words) that
a student could match back to the term.

{source_instruction}
Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{{
  "pairs": [
    {{"term": "short term", "definition": "short matching definition"}}
  ]
}}

Generate exactly 8 pairs. No two terms or definitions should be confusingly similar."""

    data = call_llm_json(JSON_SYSTEM_PROMPT, prompt, request.provider)
    if not data.get("pairs") or len(data["pairs"]) < 3:
        raise HTTPException(status_code=500, detail="Model returned too few pairs. Try again.")
    return data


# ---------- CODER MODE (Phase 8, Step 3) ----------
class CodeRequest(BaseModel):
    mode: str          # "generate" | "review" | "fix"
    language: str      # e.g. "python", "javascript"
    prompt: str = ""   # used for "generate": what to build
    code: str = ""      # used for "review" and "fix": the student's current code
    error: str = ""     # used for "fix": the error message/traceback, if any
    provider: str = "auto"


def _build_code_prompt(request: CodeRequest) -> str:
    if request.mode == "generate":
        return f"""You are an expert {request.language} programmer helping a student.

Write code that does the following:
{request.prompt}

Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{{
  "code": "the complete, runnable {request.language} code as a single string, using \\n for newlines",
  "explanation": "a short, beginner-friendly explanation of how the code works, step by step"
}}"""

    if request.mode == "review":
        return f"""You are an expert {request.language} code reviewer helping a student learn.

Here is their code:
{request.code}

Review it for correctness, style, and common mistakes. Be encouraging but honest.

Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{{
  "summary": "one or two sentence overall verdict",
  "issues": [
    {{
      "line_hint": "short quote or description of the relevant part of the code",
      "issue": "what's wrong or could be improved",
      "suggestion": "a specific, beginner-friendly fix"
    }}
  ],
  "improved_code": "the full code with your suggested improvements applied, using \\n for newlines"
}}"""

    if request.mode == "fix":
        return f"""You are an expert {request.language} debugger helping a student.

Here is their code:
{request.code}

Here is the error they are seeing (may be empty if they just know it's not working):
{request.error}

Diagnose the problem in plain language, then provide corrected code.

Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{{
  "diagnosis": "plain-language explanation of what's causing the error",
  "fixed_code": "the corrected, complete, runnable code as a single string, using \\n for newlines",
  "explanation": "brief explanation of what changed and why"
}}"""

    raise HTTPException(status_code=400, detail="mode must be 'generate', 'review', or 'fix'")


@app.post("/api/code")
def code_assistant(request: CodeRequest):
    prompt = _build_code_prompt(request)
    system = (
        "You are a precise JSON API for a coding assistant. You only output "
        "valid JSON, never markdown, never extra commentary outside the JSON "
        "structure."
    )
    return call_llm_json(system, prompt, request.provider)