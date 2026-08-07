"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

// How long to wait after an assistant message before showing suggestion
// chips, if the child hasn't started typing yet. Tune freely.
const SUGGESTION_DELAY_MS = 25000;

// Parses {{word::meaning}} markers (Young User Mode only — see
// lib/ai/systemPrompt.js) into plain text plus tappable glossary terms.
const GLOSSARY_RE = /\{\{([^:}]+)::([^}]+)\}\}/g;

function parseGlossaryContent(text) {
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  GLOSSARY_RE.lastIndex = 0;
  while ((match = GLOSSARY_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index), key: key++ });
    }
    parts.push({ type: "gloss", term: match[1], meaning: match[2], key: key++ });
    lastIndex = GLOSSARY_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex), key: key++ });
  }
  return parts;
}

export default function JourneyChat({
  journeyId,
  initialMessages,
  initialStatus,
  youthMode,
  selectableSuggestions = true,
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const bottomRef = useRef(null);
  const suggestionTimerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function clearSuggestionTimer() {
    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
  }

  function armSuggestionTimer(nextSuggestions) {
    clearSuggestionTimer();
    setShowSuggestions(false);
    if (youthMode && nextSuggestions.length > 0) {
      suggestionTimerRef.current = setTimeout(() => {
        setShowSuggestions(true);
      }, SUGGESTION_DELAY_MS);
    }
  }

  useEffect(() => {
    return () => clearSuggestionTimer();
  }, []);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || sending || status === "completed") return;

    clearSuggestionTimer();
    setShowSuggestions(false);
    setErrorMsg("");
    setInput("");
    setSending(true);

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

      const nextSuggestions = data.suggestions || [];
      setSuggestions(nextSuggestions);

      if (data.completed) {
        setStatus("completed");
      } else {
        armSuggestionTimer(nextSuggestions);
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

  function handleInputChange(e) {
    setInput(e.target.value);
    // Typing means they don't need the hint — hide it and stop the timer.
    if (e.target.value.trim()) {
      clearSuggestionTimer();
      setShowSuggestions(false);
    }
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

            {youthMode ? (
              <div className="mb-2 min-h-[34px]">
                {showSuggestions && suggestions.length > 0 && (
                  selectableSuggestions ? (
                    <div className="flex flex-wrap gap-2 animate-riseIn">
                      {suggestions.map((s, i) => (
                        <QuickButton
                          key={i}
                          label={s}
                          onClick={() => sendMessage(s)}
                          disabled={sending}
                          playful
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-mistDim animate-riseIn px-1">
                      Maybe: {suggestions.join(" · ")}
                    </p>
                  )
                )}
              </div>
            ) : (
              <div className="flex gap-2 mb-2">
                <QuickButton
                  label="I don't know"
                  onClick={() => sendMessage("I don't know")}
                  disabled={sending}
                />
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
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

            <div className="flex justify-center mt-2">
              <QuickButton
                label="Just tell me"
                onClick={() => sendMessage("Just tell me the answer")}
                disabled={sending}
              />
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function MessageBubble({ role, content }) {
  if (role === "assistant") {
    const parts = parseGlossaryContent(content);
    return (
      <div className="paper-surface shadow-paper px-5 py-4 max-w-[85%] animate-riseIn">
        <p className="font-display leading-relaxed whitespace-pre-wrap">
          {parts.map((part) =>
            part.type === "gloss" ? (
              <GlossaryWord key={part.key} term={part.term} meaning={part.meaning} />
            ) : (
              <span key={part.key}>{part.value}</span>
            )
          )}
        </p>
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

function GlossaryWord({ term, meaning }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="underline decoration-dotted decoration-2 underline-offset-2 text-ink font-semibold hover:text-gold/80 transition"
      >
        {term}
      </button>
      {open && (
        <span className="inline-block align-middle mx-1 px-2 py-0.5 rounded-full bg-gold/20 text-ink/80 text-sm not-italic font-sans animate-riseIn">
          {meaning}
        </span>
      )}
    </span>
  );
}

function QuickButton({ label, onClick, disabled, playful }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        playful
          ? "text-sm rounded-full border border-gold/50 bg-gold/10 text-goldSoft px-4 py-2 hover:bg-gold/20 transition disabled:opacity-40"
          : "text-xs rounded-full border border-mistDim/40 text-mistDim px-3 py-1.5 hover:border-gold/60 hover:text-gold transition disabled:opacity-40"
      }
    >
      {label}
    </button>
  );
}
