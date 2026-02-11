import { useState } from "react";

export default function Chatbot() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");

  const sendMessage = async () => {
    if (!query.trim()) return;

    const res = await fetch("/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();
    setResponse(data.response);
  };

  return (
    <div className="p-4">
      <textarea
        className="w-full border p-2 text-black"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask a financial question..."
      />
      <button className="mt-2 p-2 bg-blue-500 text-white" onClick={sendMessage}>
        Send
      </button>
      {response && <p className="mt-4 border p-2">{response}</p>}
    </div>
  );
}
