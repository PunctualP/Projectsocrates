import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runJourneyTurn } from "@/lib/ai/anthropicClient";
import { YOUTH_MODE_MAX_AGE } from "@/lib/ai/systemPrompt";

export async function POST(request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { content } = await request.json();
  if (!content || !content.trim()) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  const { data: journey } = await supabase
    .from("journeys")
    .select("id, user_id, status, original_prompt, primary_category, prompt_source")
    .eq("id", params.id)
    .maybeSingle();

  if (!journey || journey.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (journey.status === "completed") {
    return NextResponse.json({ error: "journey_completed" }, { status: 409 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, age")
    .eq("id", user.id)
    .maybeSingle();

  // Persist the user's message first, so nothing is lost even if the AI
  // call below fails.
  await supabase.from("messages").insert({
    journey_id: journey.id,
    role: "user",
    content: content.trim(),
  });

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("journey_id", journey.id)
    .order("created_at", { ascending: true });

  // history[0] is always the AI's opening ("Wonder" stage) question, saved
  // when the journey was created. The Anthropic API requires the messages
  // array to start with a 'user' turn, so that opening question is passed
  // as context instead of as a leading assistant message.
  const [opening, ...conversation] = history;

  let turn;
  try {
    const youthMode =
      typeof profile?.age === "number" && profile.age <= YOUTH_MODE_MAX_AGE;

    turn = await runJourneyTurn({
      messages: conversation.map((m) => ({ role: m.role, content: m.content })),
      userContext: {
        age: profile?.age,
        displayName: profile?.display_name,
        openingQuestion: opening?.content,
      },
      maxTokens: youthMode ? 350 : 700,
    });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return NextResponse.json({ error: "ai_unavailable" }, { status: 502 });
  }

  await supabase.from("messages").insert({
    journey_id: journey.id,
    role: "assistant",
    content: turn.text,
  });

  if (turn.completed) {
    await supabase
      .from("journeys")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", journey.id);

    // A completed journey is the "actively used" signal — save the
    // question into the shared library so it can earn a permanent place
    // rather than every generated question being disposable. Only for
    // questions that came from domain generation, not ones seeded by a
    // typed-in topic (those are personal to whoever typed them).
    if (journey.prompt_source === "ai_generated" && journey.primary_category) {
      const { error: libraryError } = await supabase.from("generated_prompts").insert({
        question: journey.original_prompt,
        category: journey.primary_category,
      });
      if (libraryError) {
        console.error("[socrates] could not save to generated_prompts:", libraryError.message);
      }
    }
  }

  // Rough per-call token logging for cost awareness (build spec v0.3,
  // Section 16). Milestone 4 will turn this into a real per-account log.
  if (turn.usage) {
    console.log(
      `[socrates] journey=${journey.id} in=${turn.usage.input_tokens} out=${turn.usage.output_tokens} cache_read=${turn.usage.cache_read_input_tokens || 0}`
    );
  }

  return NextResponse.json({
    content: turn.text,
    completed: turn.completed,
    suggestions: turn.suggestions,
  });
}
