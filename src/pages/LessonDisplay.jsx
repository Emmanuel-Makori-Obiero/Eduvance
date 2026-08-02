export default function LessonDisplay({ lessons }) {
  if (!lessons || lessons.length === 0) {
    return (
      <p style={{ color: "#888" }}>
        No lessons generated yet. Type a topic above to begin!
      </p>
    );
  }

  return (
    <div>
      <h3>Generated Lessons</h3>
      <ul style={{ listStyleType: "none", padding: 0 }}>
        {lessons.map((lesson, index) => (
          <li
            key={index}
            style={{
              background: "#f8f9fa",
              border: "1px solid #e9ecef",
              padding: "12px",
              marginBottom: "10px",
              borderRadius: "6px",
            }}
          >
            <strong>Lesson {index + 1}:</strong> {lesson}
          </li>
        ))}
      </ul>
    </div>
  );
}
