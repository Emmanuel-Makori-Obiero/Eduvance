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
            {"role": "system", "content": "You are a precise JSON API. You only output valid JSON, never markdown, never extra commentary."},
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
            {"role": "system", "content": "You are a precise JSON API. You only output valid JSON, never markdown, never extra commentary."},
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