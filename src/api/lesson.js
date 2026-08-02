const BASE_URL = "http://127.0.0.1:8000";

export async function generateLesson(career, topic) {
  try {
    const response = await fetch(`${BASE_URL}/api/lesson`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ career, topic }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error generating lesson:", error);
    return null;
  }
}

export async function getNextTopic(career, previousTopics) {
  try {
    const response = await fetch(`${BASE_URL}/api/next-topic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ career, previous_topics: previousTopics }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    return data.topic;
  } catch (error) {
    console.error("Error getting next topic:", error);
    return null;
  }
}

export async function regenerateQuiz(career, topic, lesson) {
  try {
    const response = await fetch(`${BASE_URL}/api/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ career, topic, lesson }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    return data.quiz;
  } catch (error) {
    console.error("Error regenerating quiz:", error);
    return null;
  }
}
