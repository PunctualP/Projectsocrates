"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function JourneyChat({ journeyId, initialMessages, initialStatus }) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || sending || status === "completed") return;

    setErrorMsg("");
    setInput("");
    setSending(true);

    // Optimistic append of the user's message.
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, role: "user", content: trimmed },
    ]);

    try {
      const res = await fetch(`/api/journey/${journeyId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        throw new Error("request_failed");
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", content: data.content },
      ]);

      if (data.completed) {
        setStatus("completed");
      }
    } catch (err) {
      setErrorMsg("That didn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl flex flex-col flex-1">
        <div className="flex items-center justify-between mb-6">
          <Link href="/home" className="text-xs text-mistDim hover:text-mist transition">
            ← Home
          </Link>
          <p className="text-xs uppercase tracking-[0.3em] text-mistDim">
            Project Socrates
          </p>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-mistDim text-sm pl-1">
              <span className="spark-glyph animate-sparkPulse">✦</span>
              thinking…
            </div>
          )}

          {status === "completed" && (
            <div className="text-center py-6 animate-riseIn">
              <p className="text-gold text-sm">✦ Journey complete ✦</p>
              <Link
                href="/home"
                className="inline-block mt-3 text-xs text-mistDim hover:text-mist underline"
              >
                Back home
              </Link>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {status !== "completed" && (
          <form onSubmit={handleSubmit} className="mt-6 sticky bottom-4">
            {errorMsg && <p className="text-xs text-red-400 mb-2">{errorMsg}</p>}
            <div className="flex gap-2 mb-2">
              <QuickButton label="I don't know" onClick={() => sendMessage("I don't know")} disabled={sending} />
              <QuickButton label="Just tell me" onClick={() => sendMessage("Just tell me the answer")} disabled={sending} />
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Share your thinking…"
                disabled={sending}
                className="flex-1 rounded-md bg-duskLight border border-mistDim/30 px-4 py-3 text-mist placeholder:text-mistDim/60 outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="rounded-md bg-gold text-midnight font-semibold px-5 disabled:opacity-40 hover:bg-goldSoft transition"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function MessageBubble({ role, content }) {
  if (role === "assistant") {
    return (
      <div className="paper-surface shadow-paper px-5 py-4 max-w-[85%] animate-riseIn">
        <p className="font-display leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    );
  }
  return (
    <div className="self-end ml-auto max-w-[85%] animate-riseIn">
      <div className="rounded-2xl rounded-tr-sm bg-duskLight px-5 py-3 text-mist">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

function QuickButton({ label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-xs rounded-full border border-mistDim/40 text-mistDim px-3 py-1.5 hover:border-gold/60 hover:text-gold transition disabled:opacity-40"
    >
      {label}
    </button>
  );
}
