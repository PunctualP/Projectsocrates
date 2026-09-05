"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateTodaysPrompt, getFreshPrompt } from "@/lib/prompts/dailyPrompts";
import { generateTopicQuestion } from "@/lib/ai/topicQuestion";

export async function beginJourney() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { prompt, category, source } = await getOrCreateTodaysPrompt(supabase, user.id);

  const { data: journey, error } = await supabase
    .from("journeys")
    .insert({
      user_id: user.id,
      original_prompt: prompt,
      primary_category: category,
      status: "active",
      prompt_source: source,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Could not start journey: ${error.message}`);
  }

  const { error: messageError } = await supabase.from("messages").insert({
    journey_id: journey.id,
    role: "assistant",
    content: prompt,
  });

  if (messageError) {
    throw new Error(`Could not save opening message: ${messageError.message}`);
  }

  redirect(`/journey/${journey.id}`);
}

// "Something else?" — swaps today's cached curiosity for a new one, without
// waiting for a new calendar day. Only affects the not-yet-started prompt
// shown on the home screen; any journey already in progress is untouched.
export async function shufflePrompt() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await getFreshPrompt(supabase, user.id);
  // Not a redirect: we're already on /home, and redirecting to the same
  // page you're already on doesn't reliably force Next.js to refetch data.
  // revalidatePath is the correct way to refresh the current page.
  revalidatePath("/home");
}

// "What are you curious about?" — generates a fresh Wonder-stage question
// (or a brief answer + question, if what they typed was itself a question)
// from a topic the user typed, then starts a journey from it.
export async function beginTopicJourney(formData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const topic = (formData.get("topic") || "").toString().trim();
  if (!topic) {
    redirect("/home");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("age")
    .eq("id", user.id)
    .maybeSingle();

  let question;
  try {
    question = await generateTopicQuestion({ topic, age: profile?.age });
  } catch (err) {
    throw new Error(`Could not come up with a question for that topic: ${err.message}`);
  }

  const { data: journey, error } = await supabase
    .from("journeys")
    .insert({
      user_id: user.id,
      original_prompt: question,
      status: "active",
      topic_seed: topic,
      prompt_source: "topic_seed",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Could not start journey: ${error.message}`);
  }

  const { error: messageError } = await supabase.from("messages").insert({
    journey_id: journey.id,
    role: "assistant",
    content: question,
  });

  if (messageError) {
    throw new Error(`Could not save opening message: ${messageError.message}`);
  }

  redirect(`/journey/${journey.id}`);
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
