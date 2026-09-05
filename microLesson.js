import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-haiku-4-5-20251001";

const MICRO_LESSON_SYSTEM_PROMPT = `You write a single short, complete micro-lesson for Project Socrates, a curiosity companion. You'll be told one domain. Teach ONE genuinely interesting, surprising, or lesser-known idea from that domain — something a well-read adult likely hasn't already heard, not common trivia.

Rules:
- Self-contained: explain the idea clearly enough that no follow-up is needed. Two to four short paragraphs, readable in under a minute.
- Teach, don't just state a fact — briefly explain why it's true or how it works, not just "did you know X."
- End on the explanation itself — no question, no invitation to keep talking. This is a complete, standalone lesson, not the start of a dialogue.
- Warm and engaging tone, not a dry textbook or encyclopedia voice.
- State uncertainty plainly where it exists; never present speculation as settled fact.
- Never provide dangerous instructions, sexual content, or anything inappropriate.
- Reply with ONLY the lesson text — no title, no preamble like "Here's a fun fact:".`;

/**
 * @param {Object} params
 * @param {string} params.category - one of the fixed domain categories
 * @param {number} [params.age]
 * @returns {Promise<string>} a short, standalone lesson
 */
export async function generateMicroLesson({ category, age }) {
  const dynamicContext = `Domain: ${category}.${
    typeof age === "number" ? ` Calibrate for an audience aged ${age}.` : ""
  }`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: MICRO_LESSON_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: dynamicContext,
      },
    ],
    messages: [
      { role: "user", content: `Give me one micro-lesson from the ${category} domain.` },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text.replace(/^["']+|["']+$/g, "").trim();
}
