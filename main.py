from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434/api/chat"


# ---------- CHAT (Phase 1) ----------
class ChatRequest(BaseModel):
    message: str


@app.post("/api/tutor")
def chat_with_tutor(request: ChatRequest):
    payload = {
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": "You are a strict, step-by-step programming "
             "teacher. Never give code answers directly. Explain concepts simply and "
             "ask guiding questions."},
            {"role": "user", "content": request.message}
        ],
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        return {"response": result["message"]["content"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- LESSON + QUIZ (Phase 3) ----------
class LessonRequest(BaseModel):
    career: str
    topic: str


@app.post("/api/lesson")
def generate_lesson(request: LessonRequest):
    prompt = f"""You are an expert {request.career} instructor creating a study lesson.

Topic: {request.topic}

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

    payload = {
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": "You are a precise JSON API. You only output "
             "valid JSON, never markdown, never extra commentary."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        raw_content = result["message"]["content"]
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model did not return valid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- CURRICULUM PROGRESSION (Phase 7) ----------
class NextTopicRequest(BaseModel):
    career: str
    previous_topics: list[str]


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

    payload = {
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": "You are a precise JSON API. You only output "
             "valid JSON, never markdown, never extra commentary."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        raw_content = result["message"]["content"]
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model did not return valid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class QuizRequest(BaseModel):
    career: str
    topic: str
    lesson: str


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

    payload = {
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": "You are a precise JSON API. You only output "
             "valid JSON, never markdown, never extra commentary."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        raw_content = result["message"]["content"]
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model did not return valid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- ADD THIS BLOCK TO main.py ----------
# Paste this near your other routes (e.g. right after /api/quiz).
# It reuses the exact same OLLAMA_URL / payload / JSON-cleaning pattern
# as your other endpoints, so no new imports are needed.


class GameRequest(BaseModel):
    career: str
    topic: str


@app.post("/api/game")
def generate_game(request: GameRequest):
    prompt = f"""You are designing a short 2D top-down educational adventure game level
for a {request.career} student learning about "{request.topic}".

The game canvas is 900 wide and 560 tall. The player starts near (60, 500) and
walks around to visit checkpoints in order, then can bump into wandering
"villain" enemies to trigger a quiz battle.

Create 4 checkpoints, each teaching one key idea about "{request.topic}" in sequence.
Create 2 enemies themed as villains related to "{request.topic}" (e.g. misconceptions
or complications), each with 3 quiz questions.

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

    payload = {
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": "You are a precise JSON API. You only output "
             "valid JSON, never markdown, never extra commentary."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        raw_content = result["message"]["content"]
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        data = json.loads(cleaned)
        if not data.get("checkpoints"):
            raise HTTPException(status_code=500, detail="Model returned no checkpoints. Try again.")
        return data
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model did not return valid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ---------- ADD THIS BLOCK TO main.py ----------
# Paste near your other routes (e.g. right after /api/game).


class MemoryRequest(BaseModel):
    career: str
    topic: str


@app.post("/api/memory")
def generate_memory(request: MemoryRequest):
    prompt = f"""You are creating a memory-matching study game for a {request.career}
student learning about "{request.topic}".

Create 8 term/definition pairs covering key concepts of "{request.topic}".
Each "term" should be short (1-4 words, a name or key phrase). Each
"definition" should be a short, clear explanation (under 15 words) that
a student could match back to the term.

Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{{
  "pairs": [
    {{"term": "short term", "definition": "short matching definition"}}
  ]
}}

Generate exactly 8 pairs. No two terms or definitions should be confusingly similar."""

    payload = {
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": "You are a precise JSON API. You only output "
             "valid JSON, never markdown, never extra commentary."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        raw_content = result["message"]["content"]
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        data = json.loads(cleaned)
        if not data.get("pairs") or len(data["pairs"]) < 3:
            raise HTTPException(status_code=500, detail="Model returned too few pairs. Try again.")
        return data
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model did not return valid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- CODER MODE (Phase 8, Step 3) ----------
class CodeRequest(BaseModel):
    mode: str          # "generate" | "review" | "fix"
    language: str      # e.g. "python", "javascript"
    prompt: str = ""   # used for "generate": what to build
    code: str = ""      # used for "review" and "fix": the student's current code
    error: str = ""     # used for "fix": the error message/traceback, if any


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

    payload = {
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": "You are a precise JSON API for a coding "
             "assistant. You only output valid JSON, never markdown, never extra "
             "commentary outside the JSON structure."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        raw_content = result["message"]["content"]
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model did not return valid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))