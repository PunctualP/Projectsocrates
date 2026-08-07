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

/**
 * Sends one conversational turn to Claude and returns the assistant's
 * reply, with the completion marker (if present) stripped out and
 * reported separately.
 *
 * @param {Object} params
 * @param {Array<{role: 'user'|'assistant', content: string}>} params.messages
 * @param {{age?: number, displayName?: string}} params.userContext
 * @param {boolean} [params.useUpgradeModel]
 */
export async function runJourneyTurn({ messages, userContext, useUpgradeModel = false }) {
  const response = await anthropic.messages.create({
    model: useUpgradeModel ? UPGRADE_MODEL : DEFAULT_MODEL,
    max_tokens: 700,
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
  const cleanText = rawText.replace(COMPLETION_MARKER, "").trim();

  return {
    text: cleanText,
    completed,
    usage: response.usage, // { input_tokens, output_tokens, cache_read_input_tokens, ... }
  };
}
