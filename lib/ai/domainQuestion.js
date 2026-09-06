import Anthropic from "@anthropic-ai/sdk";
import { YOUTH_MODE_MAX_AGE } from "./systemPrompt";

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
  const youthMode = typeof age === "number" && age <= YOUTH_MODE_MAX_AGE;

  const dynamicContext = `Domain: ${category}.${
    typeof age === "number"
      ? ` The primary audience today is ${age} years old — calibrate vocabulary and framing accordingly.`
      : ""
  }${
    youthMode
      ? ` This is a child. Beyond simpler vocabulary, avoid heavy, disturbing, or graphic subject matter entirely as the topic itself — terrorism, extremist violence, war atrocities, death, abuse, tragedy, or disaster — even if it could be handled sensitively or presented in a balanced, educational way. That kind of care doesn't make it a good opening topic for a child; choose a genuinely light, age-appropriate angle instead, even within domains like history or culture that could otherwise lead there.`
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
