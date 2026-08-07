import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-haiku-4-5-20251001";

const DOMAIN_SYSTEM_PROMPT = `You generate a single opening "Wonder" question for Project Socrates, an AI-guided curiosity companion. You'll be told one domain to draw from. Invent ONE short, open-ended, genuinely intriguing question from that domain — the kind of question a curious person could actually explore through conversation: making a prediction, being wrong or right, and discovering why.

Rules:
- One sentence, phrased as an open, curious question. No preamble, no answer, no surrounding quotation marks.
- Favor a surprising or counterintuitive angle over textbook trivia ("what is X") — something that invites a guess before an explanation.
- Draw only on well-established facts or genuinely open scientific/historical questions — never invent a fictional premise disguised as fact.
- Never provide dangerous instructions, sexual content, or anything inappropriate for a young person.
- Reply with ONLY the question text.`;

/**
 * @param {Object} params
 * @param {string} params.category - one of the fixed domain categories
 * @param {number} [params.age]
 * @returns {Promise<string>} a single Wonder-stage question
 */
export async function generateDomainQuestion({ category, age }) {
  const dynamicContext = `Domain: ${category}.${
    typeof age === "number"
      ? ` The primary audience today is ${age} years old — calibrate vocabulary and framing accordingly.`
      : ""
  }`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 120,
    system: [
      {
        type: "text",
        text: DOMAIN_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: dynamicContext,
      },
    ],
    messages: [
      { role: "user", content: `Give me one wonder question from the ${category} domain.` },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text.replace(/^["']+|["']+$/g, "").trim();
}
