import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-haiku-4-5-20251001";

const TOPIC_SYSTEM_PROMPT = `You generate a single opening "Wonder" question for Project Socrates, an AI-guided curiosity companion. Someone has typed a topic they're currently interested in — a movie, animal, hobby, place, anything. Your job is to invent ONE short, open-ended question that uses that topic as a genuine springboard into a real, explorable idea from science, history, engineering, nature, culture, art, psychology, economics, or mathematics.

Rules:
- Use the topic only as a jumping-off point into the real world behind or around it — never a trivia question about the topic's own plot, characters, or copyrighted content itself. Example: a movie about the ocean should lead to a question about real ocean navigation, marine biology, or shipbuilding — not about the movie's story or characters.
- One sentence, phrased as an open, curious question. No preamble, no answer, no surrounding quotation marks.
- Never provide dangerous instructions, sexual content, or anything inappropriate for a young person, regardless of what the topic is.
- If the topic itself is inappropriate, nonsensical, or unworkable, don't refuse outright — gently pivot to a safe, related wonder a curious kid would enjoy instead.
- Reply with ONLY the question text.`;

/**
 * @param {Object} params
 * @param {string} params.topic - free text typed by the user
 * @param {number} [params.age]
 * @returns {Promise<string>} a single Wonder-stage question
 */
export async function generateTopicQuestion({ topic, age }) {
  const dynamicContext = `Topic: "${topic}".${
    typeof age === "number"
      ? ` The user is ${age} years old — calibrate vocabulary and framing accordingly.`
      : ""
  }`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 120,
    system: [
      {
        type: "text",
        text: TOPIC_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: dynamicContext,
      },
    ],
    messages: [
      { role: "user", content: `Give me one wonder question inspired by: ${topic}` },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  // Strip stray surrounding quotes in case the model adds them anyway.
  return text.replace(/^["']+|["']+$/g, "").trim();
}
