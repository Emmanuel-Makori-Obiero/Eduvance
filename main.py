import json
import os
import time

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

# Defense in depth: the frontend already caps how much notes text it will
# ever send, but reject an oversized request body here too, before it's
# fully read into memory. Without this, a very large body on a low-memory
# host (e.g. Render's free tier) can crash the process mid-request, which
# shows up client-side as a confusing "502 Bad Gateway" instead of a clear
# error. 1MB is generous -- every prompt in this app only ever uses the
# first 6000 characters of notes.
MAX_REQUEST_BODY_BYTES = 1 * 1024 * 1024


@app.middleware("http")
async def limit_request_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BODY_BYTES:
        return JSONResponse(
            status_code=413,
            content={
                "detail": "That request is too large. Try uploading a "
                          "shorter file or pasting a shorter excerpt of "
                          "your notes."
            },
        )
    return await call_next(request)

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

# Every model in this chain is hosted by the Gemini API and uses the SAME
# API key -- no separate account or key needed for any of them. When the
# model currently being tried is rate-limited or temporarily unavailable,
# the next one in the list is tried automatically, since each is a
# distinct model with its own separate quota bucket. Order = preference:
# best/fastest first, most resilient (smallest/most available) last.
# Override with a comma-separated FALLBACK_CHAIN env var if you want a
# different lineup.
DEFAULT_FALLBACK_CHAIN = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemma-4-26b-a4b-it",
    "gemma-4-31b-it",
]
FALLBACK_CHAIN = [
    m.strip()
    for m in os.environ.get(
        "FALLBACK_CHAIN", ",".join(DEFAULT_FALLBACK_CHAIN)
    ).split(",")
    if m.strip()
]

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def _model_url(model_id: str) -> str:
    return f"{GEMINI_API_BASE}/{model_id}:generateContent"


# Exceptions that mean "the Ollama server isn't reachable right now" as
# opposed to "Ollama reached us but errored" -- only these trigger an
# automatic fallback to the hosted chain in "auto" mode.
OLLAMA_UNREACHABLE_ERRORS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)


@app.get("/api/providers")
def list_providers():
    """Lets the frontend know which providers are actually usable right now,
    so it can hide/disable the online option if no key is configured, and
    show whether auto-fallback is currently possible."""
    chain_label = (
        "Online (" + " \u2192 ".join(FALLBACK_CHAIN) + ")"
        if FALLBACK_CHAIN
        else "Online (Gemini)"
    )
    return {
        "ollama": {"available": True, "label": "Offline (Ollama)"},
        "gemini": {
            "available": bool(GOOGLE_API_KEY),
            "label": chain_label,
        },
        "gemma": {
            "available": bool(GOOGLE_API_KEY),
            "label": "Online (Gemma 4, fallback)",
        },
        "auto": {
            "available": True,
            "label": f"Auto (Ollama, falls back through {len(FALLBACK_CHAIN)} hosted models)",
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


def _call_gemini_api(system: str, user_prompt: str, url: str, model_label: str) -> str:
    """Shared implementation for calling any model hosted on the Gemini
    API (Gemini itself, or Gemma 4) -- same request/response shape, same
    API key, just a different URL/model."""
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
        "generationConfig": {
            "response_mime_type": "application/json",
            # Gemini 2.5+ models have "thinking" enabled by default, and
            # thinking tokens are deducted from the SAME output token
            # budget as the actual JSON response. On a long structured
            # task (a full lesson + 5 quiz questions, an 8-page novel,
            # etc.) the model can spend its whole budget thinking and
            # return an empty/truncated "text" part -- which then fails
            # json.loads() here and looks like "the model is broken" when
            # it's really a silent truncation. Disabling thinking makes
            # avoids this silent-truncation failure mode entirely.
            # A generous max_output_tokens is set too so long structured
            # responses (novel/game/story modes) aren't cut off either.
            "thinkingConfig": {"thinkingBudget": 0},
            "maxOutputTokens": 8192,
        },
    }

    # 429 (rate limit) and 503 (model temporarily overloaded) are
    # transient -- the free tier's per-minute limit resets quickly, so a
    # short backoff-and-retry recovers from it automatically instead of
    # failing the student's request outright. Everything else (bad key,
    # permission denied, bad request, model not found) is NOT transient
    # and retrying won't help -- fail immediately with the real reason
    # instead of masking it as a generic error.
    RATE_LIMIT_RETRY_DELAYS = [2, 5]

    for attempt in range(len(RATE_LIMIT_RETRY_DELAYS) + 1):
        try:
            response = requests.post(
                url,
                params={"key": GOOGLE_API_KEY},
                json=payload,
                timeout=120,
            )
            response.raise_for_status()
            break
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            if status in (429, 503) and attempt < len(RATE_LIMIT_RETRY_DELAYS):
                time.sleep(RATE_LIMIT_RETRY_DELAYS[attempt])
                continue

            # requests' default error message includes the full request
            # URL, which contains the API key as a query param -- never
            # let that reach a client or a log. Report the status only,
            # but keep the real status code so the caller can tell a
            # transient issue apart from a permanent one (bad key, no
            # permission, model not found, etc.) instead of everything
            # looking like a generic 502.
            if status == 429:
                raise HTTPException(
                    status_code=429,
                    detail=f"{model_label}'s free-tier rate limit was hit "
                           f"and didn't recover after retrying.",
                )
            if status == 503:
                raise HTTPException(
                    status_code=503,
                    detail=f"{model_label} is temporarily overloaded on "
                           f"Google's side and didn't recover after retrying.",
                )
            if status == 404:
                # This specific model isn't reachable right now (wrong ID,
                # not enabled for this key/project, or deprecated) -- that
                # says nothing about the OTHER models in the chain, so
                # it's treated as a capacity-style error: move on to the
                # next model instead of giving up entirely.
                raise HTTPException(
                    status_code=404,
                    detail=f"{model_label} isn't reachable (model not found "
                           f"or not enabled for this API key).",
                )
            if status == 400:
                raise HTTPException(
                    status_code=400,
                    detail=f"{model_label} rejected the request as malformed "
                           f"(status 400). This isn't a quota issue.",
                )
            if status in (401, 403):
                raise HTTPException(
                    status_code=401,
                    detail=f"{model_label} rejected the API key (status {status}). "
                           f"Your GOOGLE_API_KEY is likely invalid, revoked, or "
                           f"doesn't have access to this model. Generate a new key "
                           f"at https://aistudio.google.com/apikey and update it "
                           f"in Render's Environment settings.",
                )
            raise HTTPException(
                status_code=502,
                detail=f"{model_label} request failed (status {status or 'unknown'}).",
            )
        except requests.exceptions.RequestException:
            raise HTTPException(
                status_code=502,
                detail=f"Couldn't reach {model_label} (network error).",
            )

    result = response.json()
    try:
        candidate = result["candidates"][0]
        text = candidate["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        # A safety block (finishReason "SAFETY"/"PROHIBITED_CONTENT") or a
        # response with no parts at all lands here -- there's no "text"
        # to fall back on, so surface a clear reason instead of a raw
        # KeyError.
        finish_reason = None
        try:
            finish_reason = result["candidates"][0].get("finishReason")
        except (KeyError, IndexError):
            pass
        if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS"):
            raise HTTPException(
                status_code=422,
                detail=f"{model_label} declined to answer (reason: "
                       f"{finish_reason}). Try rephrasing the topic/notes.",
            )
        raise HTTPException(
            status_code=500,
            detail=f"{model_label} returned an unexpected response shape.",
        )

    # finishReason MAX_TOKENS with response_mime_type=json almost always
    # means the JSON got cut off mid-structure -- json.loads() further up
    # the call chain would fail on this anyway, but raising here gives a
    # much clearer error message than a generic "invalid JSON" one, and
    # avoids burning the second of the two JSON-parse retry attempts on
    # a response we already know is truncated.
    if candidate.get("finishReason") == "MAX_TOKENS":
        raise HTTPException(
            status_code=500,
            detail=f"{model_label}'s response was cut off (hit the output "
                   f"token limit) before finishing valid JSON. Try again, "
                   f"or shorten the notes/topic.",
        )

    return text


def _call_hosted_model(system: str, user_prompt: str, model_id: str) -> str:
    return _call_gemini_api(system, user_prompt, _model_url(model_id), model_id)


# HTTPExceptions from a hosted-model call that mean "this specific model
# is rate-limited or unavailable right now" -- not an auth/key problem,
# so it's safe and useful to transparently retry the SAME request against
# the next model in the chain rather than failing outright.
def _is_capacity_error(exc: HTTPException) -> bool:
    # 429 (rate limited), 503 (temporarily overloaded), and 404 (this
    # specific model isn't reachable) all say nothing about whether the
    # NEXT model in the chain would work -- so all three advance to the
    # next model instead of failing the whole request. 400/401/403 do
    # NOT advance, since a bad request or bad key fails identically on
    # every model in the chain.
    return exc.status_code in (429, 503, 404)


def _call_hosted_chain(system: str, user_prompt: str, start_at: str = None) -> str:
    """Walks FALLBACK_CHAIN in order, trying each hosted model until one
    succeeds. Only capacity-type failures (rate limit / temporarily
    unavailable) move on to the next model -- a real error (bad key,
    malformed request) is raised immediately rather than burning through
    the whole chain for no reason.

    `start_at` lets a caller jump into the chain partway through (e.g. the
    explicit "gemma" provider starts at the first Gemma model instead of
    retrying Gemini first).
    """
    if not FALLBACK_CHAIN:
        raise HTTPException(
            status_code=500,
            detail="No hosted models are configured (FALLBACK_CHAIN is empty).",
        )

    models = FALLBACK_CHAIN
    if start_at:
        matching = [i for i, m in enumerate(models) if m == start_at]
        if matching:
            models = models[matching[0]:]

    last_exc = None
    for i, model_id in enumerate(models):
        try:
            return _call_hosted_model(system, user_prompt, model_id)
        except HTTPException as e:
            last_exc = e
            is_last_model = i == len(models) - 1
            if not _is_capacity_error(e) or is_last_model:
                raise
            continue

    raise last_exc or HTTPException(
        status_code=502,
        detail="All hosted models are currently unavailable. Try again shortly.",
    )





def call_llm(system: str, user_prompt: str, provider: str = "auto") -> str:
    """Routes to the chosen provider and returns the raw text response.

    "auto" tries Ollama first (short timeout, since a down local server
    should fail fast), then walks the full hosted FALLBACK_CHAIN --
    Gemini, then progressively lighter/more-available models, all on the
    same API key -- stopping at the first one that responds. If Ollama IS
    reachable but errors for some other reason (bad response, model
    error), that error is raised as-is rather than silently swapping
    providers.
    """
    provider = (provider or "auto").lower()

    if provider == "gemini":
        return _call_hosted_chain(system, user_prompt)

    if provider == "gemma":
        first_gemma = next(
            (m for m in FALLBACK_CHAIN if m.startswith("gemma")), None
        )
        return _call_hosted_chain(system, user_prompt, start_at=first_gemma)

    if provider == "ollama":
        try:
            return _call_ollama(system, user_prompt)
        except OLLAMA_UNREACHABLE_ERRORS:
            # Explicitly-forced "ollama" (as opposed to "auto") used to
            # let this ConnectionError/Timeout bubble straight up into an
            # unhandled exception, which FastAPI turns into a bare,
            # unhelpful 500. This matters in practice: Ollama can never
            # be reached from the deployed Render backend (it only runs
            # on someone's local machine), so anyone whose frontend ever
            # sends provider="ollama" against the deployed BASE_URL hits
            # this every time.
            raise HTTPException(
                status_code=503,
                detail="Couldn't reach your offline model (Ollama isn't "
                       "running, or isn't reachable from this server). "
                       "Offline mode only works when the backend and "
                       "Ollama are running on the same machine -- switch "
                       "to 'auto' or 'gemini' when using the deployed "
                       "backend.",
            )

    if provider == "auto":
        try:
            return _call_ollama(system, user_prompt)
        except OLLAMA_UNREACHABLE_ERRORS:
            if not GOOGLE_API_KEY:
                raise HTTPException(
                    status_code=503,
                    detail="Your offline model isn't running (couldn't reach "
                           "Ollama), and no Gemini backup key is configured. "
                           "Start Ollama, or set GOOGLE_API_KEY in your .env "
                           "file to enable the automatic backup.",
                )
            return _call_hosted_chain(system, user_prompt)

    raise HTTPException(
        status_code=400,
        detail=f"Unknown provider '{provider}'. Use 'auto', 'ollama', 'gemini', or 'gemma'.",
    )


def call_llm_json(system: str, user_prompt: str, provider: str = "auto") -> dict:
    """Calls the model and parses its response as JSON, with the shared
    error handling every endpoint below used to duplicate.

    LLMs occasionally return malformed JSON on a single attempt (more
    common with smaller local Ollama models than Gemini). Retry once
    before giving up, so a one-off bad generation doesn't force the
    student to manually hit "try again" themselves.
    """
    last_error = None
    for attempt in range(2):
        try:
            raw_content = call_llm(system, user_prompt, provider)
            return json.loads(_clean_json_text(raw_content))
        except json.JSONDecodeError as e:
            last_error = e
            continue
        except HTTPException:
            raise
        except Exception:
            # Deliberately not including str(e) here -- some exceptions
            # (e.g. from the requests library) embed the full request URL,
            # which can contain the Gemini API key as a query param. Never
            # surface that.
            raise HTTPException(
                status_code=500,
                detail="Something went wrong generating a response. Try again.",
            )
    raise HTTPException(
        status_code=500, detail="Model did not return valid JSON. Try again."
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


# ---------- STORY MODE (branching choice scenario) ----------
class StoryRequest(BaseModel):
    career: str
    topic: str
    notes: str = ""
    provider: str = "auto"


@app.post("/api/story")
def generate_story(request: StoryRequest):
    notes = _notes_block(request.notes)
    if notes:
        source_instruction = f"""Base the scenario, choices, and outcomes STRICTLY on the student's own
notes below - do not invent situations or lessons that aren't supported
by these notes.

--- STUDENT'S NOTES ---
{notes}
--- END NOTES ---
"""
    else:
        source_instruction = ""

    prompt = f"""You are designing a short branching "choose your path" story scenario
for a {request.career} student learning about "{request.topic}". This is a
choice-driven visual-novel style mini-game: the student is dropped into a
realistic situation related to "{request.topic}", faces a decision with two
options, and each option leads to a further decision, which finally leads
to an ending that shows the consequence of the whole path taken and what
it teaches about "{request.topic}".

{source_instruction}
Build EXACTLY this tree shape:
- One root decision node ("root").
- Root has exactly 2 choices, leading to two level-1 decision nodes.
- Each level-1 node has exactly 2 choices, leading to four total ending nodes.
- Every ending node is a leaf (no choices) and explains the realistic
  consequence of that specific path, plus the lesson it teaches.

Respond ONLY with valid JSON, no markdown, no backticks, no extra text.
Use this exact structure:
{{
  "title": "short title for the scenario",
  "start": "root",
  "nodes": {{
    "root": {{
      "text": "2-4 sentences setting up a realistic situation and the decision the student must make",
      "choices": [
        {{"label": "short label for option A", "next": "n1a"}},
        {{"label": "short label for option B", "next": "n1b"}}
      ]
    }},
    "n1a": {{
      "text": "2-4 sentences on what happens immediately after choosing option A, then a follow-up decision",
      "choices": [
        {{"label": "short label", "next": "end_1"}},
        {{"label": "short label", "next": "end_2"}}
      ]
    }},
    "n1b": {{
      "text": "2-4 sentences on what happens immediately after choosing option B, then a follow-up decision",
      "choices": [
        {{"label": "short label", "next": "end_3"}},
        {{"label": "short label", "next": "end_4"}}
      ]
    }},
    "end_1": {{
      "text": "3-5 sentences narrating the final consequence of this exact path",
      "outcome": "good | mixed | poor",
      "lesson": "1-2 sentence takeaway connecting this path to {request.topic}"
    }},
    "end_2": {{ "text": "...", "outcome": "good | mixed | poor", "lesson": "..." }},
    "end_3": {{ "text": "...", "outcome": "good | mixed | poor", "lesson": "..." }},
    "end_4": {{ "text": "...", "outcome": "good | mixed | poor", "lesson": "..." }}
  }}
}}

Rules:
- Node ids must be exactly: root, n1a, n1b, end_1, end_2, end_3, end_4 (n1a's choices point to end_1 and end_2; n1b's choices point to end_3 and end_4).
- "outcome" must be exactly one of: "good", "mixed", "poor" - reflect the realistic quality of that path's result, not just "choice A is always good."
- Not every path needs to be a simple right/wrong dichotomy - realistic situations can have mixed or nuanced outcomes.
- All content must be realistic, age-appropriate, and specific to "{request.topic}" for a {request.career} student."""

    data = call_llm_json(JSON_SYSTEM_PROMPT, prompt, request.provider)
    nodes = data.get("nodes") or {}
    required = ["root", "n1a", "n1b", "end_1", "end_2", "end_3", "end_4"]
    if not all(k in nodes for k in required):
        raise HTTPException(status_code=500, detail="Model returned an incomplete story tree. Try again.")
    return data


# ---------- NOVEL MODE (paginated storyteller with embedded lessons) ----------
class NovelRequest(BaseModel):
    career: str
    topic: str
    notes: str = ""
    genre: str = "fantasy adventure"
    provider: str = "auto"


NOVEL_PAGE_COUNT = 10


@app.post("/api/novel")
def generate_novel(request: NovelRequest):
    notes = _notes_block(request.notes)
    if notes:
        source_instruction = f"""Weave in real lessons drawn STRICTLY from the student's own notes below at
a handful of key story beats - do not invent facts that aren't supported
by these notes. The lessons should emerge naturally from what the
characters experience, never feel like a lecture bolted onto the plot.

--- STUDENT'S NOTES ---
{notes}
--- END NOTES ---
"""
    else:
        source_instruction = f"""There are no notes provided, so draw the lessons from accurate, real
knowledge about "{request.topic}" appropriate for a {request.career} student."""

    genre = (request.genre or "fantasy adventure").strip()

    prompt = f"""You are a masterful, professional storyteller writing a short original
novel for a {request.career} student. Genre: "{genre}". The story should be
built around "{request.topic}" the way a great novelist would - it should
NOT feel like a textbook. Write it like a page-turner: a gripping hook
on page 1, vivid scenes, real characters with wants and stakes, rising
tension, and a satisfying arc that resolves by the final page. Open with
a strong hook appropriate to the "{genre}" genre and tone (it doesn't have
to literally say "once upon a time" unless that fits the genre/tone).

{source_instruction}

Structure the novel into EXACTLY {NOVEL_PAGE_COUNT} pages, each a self-contained
chunk of about 150-220 words of vivid, well-written prose (dialogue,
sensory detail, momentum - never a summary or list). At natural high points
in the story (roughly 3-4 of the {NOVEL_PAGE_COUNT} pages, not evenly spaced,
wherever it truly fits the scene), include a short "lesson" the reader can
take away, tied to "{request.topic}" and growing organically out of what just
happened to the characters - never preachy, never breaking the story's voice.

Respond ONLY with valid JSON, no markdown, no backticks, no extra text.
Use this exact structure:
{{
  "title": "an evocative novel title",
  "genre": "{genre}",
  "pages": [
    {{
      "page": 1,
      "chapterTitle": "a chapter or part title for the opening (only page 1 needs one, or later pages if a new chapter begins there, otherwise use null)",
      "text": "150-220 words of vivid narrative prose for this page",
      "lesson": "a short, natural takeaway tied to {request.topic}, or null if this page has none"
    }}
  ]
}}

Rules:
- Return exactly {NOVEL_PAGE_COUNT} page objects, numbered 1 to {NOVEL_PAGE_COUNT} in order.
- "chapterTitle" should be null on most pages - only set it where a new chapter or clear scene shift genuinely begins.
- "lesson" must be null on pages where no lesson naturally fits - do not force one onto every page.
- The final page must bring the story to a satisfying, complete resolution.
- All content must be original (no copyrighted characters, quotes, or plots) and age-appropriate."""

    data = call_llm_json(JSON_SYSTEM_PROMPT, prompt, request.provider)
    pages = data.get("pages") or []
    if len(pages) < NOVEL_PAGE_COUNT:
        raise HTTPException(status_code=500, detail="Model returned an incomplete novel. Try again.")
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