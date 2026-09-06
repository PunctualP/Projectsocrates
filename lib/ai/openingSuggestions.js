import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You generate short reply-option suggestions for Project Socrates, a curiosity companion, to help a young child respond to an opening question they've just been asked. Produce 2-3 short possible first guesses or reactions a child could tap instead of typing.

Rules:
- Each option is a few words — a plausible guess or reaction, never the actual correct answer, never a repeat of the question.
- Reply with ONLY the options, one per line. No numbering, bullets, or extra commentary.`;

/**
 * @param {Object} params
 * @param {string} params.question - the opening question already decided on
 * @param {number} [params.age]
 * @returns {Promise<string[]>} 2-3 short reply options
 */
export async function generateOpeningSuggestions({ question, age }) {
  const dynamicContext = `Opening question: "${question}".${
    typeof age === "number" ? ` Audience is ${age} years old.` : ""
  }`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 100,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: dynamicContext,
      },
    ],
    messages: [{ role: "user", content: "Give me 2-3 short reply options." }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text
    .split("\n")
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}
