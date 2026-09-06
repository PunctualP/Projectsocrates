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

const COMPLETION_MARKER_RE = /\[\[\s*JOURNEY_COMPLETE\s*\]\]/i;
const SUGGEST_MARKER_RE = /\[\[SUGGEST:(.*?)\]\]/s;

// Backstop for the boundary-testing closure case: the model is instructed
// to always say something like "head back to the home screen and start a
// new journey" out loud when closing for that reason — that's necessary,
// visible text, not an easy-to-drop invisible marker. So even if the
// model forgets the bracket marker itself, catching this combination in
// what it actually said closes the journey anyway. The word "journey"
// essentially never comes up in normal conversation (the model is told
// not to name the stages or the format out loud), so this is a low
// false-positive way to catch a dropped marker.
const JOURNEY_WORD_RE = /\bjourney\b/i;
const HOME_REDIRECT_RE = /(home screen|start (?:a |another )?(?:new|fresh))/i;

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

  const impliedClosure = JOURNEY_WORD_RE.test(rawText) && HOME_REDIRECT_RE.test(rawText);
  const completed = COMPLETION_MARKER_RE.test(rawText) || impliedClosure;
  let cleanText = rawText.replace(COMPLETION_MARKER_RE, "");

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
    safetyClosure: impliedClosure,
    suggestions,
    usage: response.usage, // { input_tokens, output_tokens, cache_read_input_tokens, ... }
  };
}
