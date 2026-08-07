import Anthropic from "@anthropic-ai/sdk";
import { STATIC_SYSTEM_PROMPT, buildDynamicContext } from "./systemPrompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Default per build spec v0.3, Section 6/16: cheap model by default,
// with a documented upgrade path to a stronger model per-journey if
// quality ever clearly warrants it.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const UPGRADE_MODEL = "claude-sonnet-5"; // not wired to a selector yet — manual override only

const COMPLETION_MARKER = "[[JOURNEY_COMPLETE]]";
const SUGGEST_MARKER_RE = /\[\[SUGGEST:(.*?)\]\]/s;

/**
 * Sends one conversational turn to Claude and returns the assistant's
 * reply, with the completion marker and any suggested-reply marker
 * (Young User Mode) stripped out and reported separately.
 *
 * @param {Object} params
 * @param {Array<{role: 'user'|'assistant', content: string}>} params.messages
 * @param {{age?: number, displayName?: string, openingQuestion?: string}} params.userContext
 * @param {boolean} [params.useUpgradeModel]
 * @param {number} [params.maxTokens] - lower this for Young User Mode's shorter replies
 */
export async function runJourneyTurn({
  messages,
  userContext,
  useUpgradeModel = false,
  maxTokens = 700,
}) {
  const response = await anthropic.messages.create({
    model: useUpgradeModel ? UPGRADE_MODEL : DEFAULT_MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: STATIC_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: buildDynamicContext(userContext),
      },
    ],
    messages,
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  const completed = rawText.includes(COMPLETION_MARKER);
  let cleanText = rawText.replace(COMPLETION_MARKER, "");

  let suggestions = [];
  const suggestMatch = cleanText.match(SUGGEST_MARKER_RE);
  if (suggestMatch) {
    suggestions = suggestMatch[1]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    cleanText = cleanText.replace(SUGGEST_MARKER_RE, "");
  }

  cleanText = cleanText.trim();

  return {
    text: cleanText,
    completed,
    suggestions,
    usage: response.usage, // { input_tokens, output_tokens, cache_read_input_tokens, ... }
  };
}
