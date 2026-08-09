import { useState } from "react";
import { BASE_URL } from "../api/config";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error connecting to backend server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: "sans-serif",
      }}
    >
      <h2>Eduvance AI Tutor</h2>
      <div
        style={{
          border: "1px solid #ccc",
          height: "400px",
          overflowY: "scroll",
          padding: "10px",
          marginBottom: "10px",
          borderRadius: "5px",
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              margin: "10px 0",
              textAlign: msg.role === "user" ? "right" : "left",
            }}
          >
            <span
              style={{
                background: msg.role === "user" ? "#007bff" : "#e9ecef",
                color: msg.role === "user" ? "#fff" : "#000",
                padding: "8px 12px",
                borderRadius: "8px",
                display: "inline-block",
                maxWidth: "80%",
              }}
            >
              {msg.content}
            </span>
          </div>
        ))}
        {loading && (
          <p style={{ color: "#666", fontStyle: "italic" }}>
            AI is thinking...
          </p>
        )}
      </div>
      <form onSubmit={sendMessage} style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a programming question..."
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            background: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
