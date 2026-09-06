import Anthropic from "@anthropic-ai/sdk";
import { YOUTH_MODE_MAX_AGE } from "./systemPrompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-haiku-4-5-20251001";

const TOPIC_SYSTEM_PROMPT = `You generate the opening message for a Project Socrates journey — an AI-guided curiosity companion. Someone has typed something they're curious about. It might be a genuine question ("what is Maui's hook made of?") or just a topic or interest ("Moana", "volcanoes").

If what they typed is a genuine question:
- Answer it — briefly. One or two short sentences, not a lecture.
- Then add ONE open question that builds on that answer and invites a guess or prediction — this is what actually starts the journey. Don't just end on a flat fact with nothing to wonder about next.
- Example shape: "Maui's hook is made from a giant fish bone! What kind of fish do you think could have a bone that big?"

If what they typed is just a topic or interest, not a direct question:
- Skip the answer step. Invent ONE short, open-ended question that would genuinely spark curiosity about it.
- Choose whichever angle is most naturally engaging: for a specific movie, show, book, or game, a question about its characters and their choices, the setting, or how it was made can be the most engaging angle — many kids love this. For a broader subject (an animal, a place, a hobby), connecting it to real science, history, or nature usually works better.

Rules:
- Keep it short either way — a factual answer, if there is one, is one or two sentences; the question is always exactly one sentence.
- The message must always end on a single open, curious question — never end on just a fact.
- Never quote song lyrics, poem text, or extended dialogue to answer something — describe what happens or what it means instead, then ask your question.
- No preamble like "Great question!" or "Here's your answer:". No surrounding quotation marks.
- Never provide dangerous instructions, sexual content, or anything inappropriate for a young person, regardless of the topic.
- If what they typed is inappropriate, nonsensical, or unworkable, don't refuse outright — gently pivot to a safe, related wonder a curious kid would enjoy instead.
- Reply with ONLY the message itself — nothing else.`;

/**
 * @param {Object} params
 * @param {string} params.topic - free text typed by the user (a topic or a direct question)
 * @param {number} [params.age]
 * @returns {Promise<string>} the opening message — a question alone, or a brief answer plus a question
 */
export async function generateTopicQuestion({ topic, age }) {
  const youthMode = typeof age === "number" && age <= YOUTH_MODE_MAX_AGE;

  const dynamicContext = `They typed: "${topic}".${
    typeof age === "number"
      ? ` The user is ${age} years old — calibrate vocabulary and framing accordingly.`
      : ""
  }${
    youthMode
      ? ` This is a child. Beyond simpler vocabulary, avoid heavy, disturbing, or graphic subject matter entirely — terrorism, extremist violence, war atrocities, death, abuse, tragedy, or disaster — even if what they typed points toward one of these and even if it could be handled sensitively. Pivot to a genuinely light, age-appropriate angle instead, the same as you would for an inappropriate or unworkable topic.`
      : ""
  }`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 160,
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
      { role: "user", content: `Here's what they typed: ${topic}` },
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
