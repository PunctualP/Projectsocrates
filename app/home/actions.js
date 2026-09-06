"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateTodaysPrompt, getFreshPrompt, CATEGORIES } from "@/lib/prompts/dailyPrompts";
import { generateTopicQuestion } from "@/lib/ai/topicQuestion";
import { generateMicroLesson } from "@/lib/ai/microLesson";
import { generateOpeningSuggestions } from "@/lib/ai/openingSuggestions";
import { YOUTH_MODE_MAX_AGE } from "@/lib/ai/systemPrompt";

// Inserts a journey, tolerating a database that hasn't run the
// opening_suggestions migration yet. Without this, a missing column would
// fail journey creation entirely — for every account, not just youth-mode
// ones — rather than just quietly doing without that one feature.
async function insertJourney(supabase, journeyData) {
  let { data: journey, error } = await supabase
    .from("journeys")
    .insert(journeyData)
    .select()
    .single();

  if (error && Object.prototype.hasOwnProperty.call(journeyData, "opening_suggestions")) {
    console.error(
      "[socrates] journey insert failed, retrying without opening_suggestions — has that migration been run?",
      error.message
    );
    const { opening_suggestions, ...withoutSuggestions } = journeyData;
    ({ data: journey, error } = await supabase
      .from("journeys")
      .insert(withoutSuggestions)
      .select()
      .single());
  }

  return { journey, error };
}

export async function beginJourney() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { prompt, category, source } = await getOrCreateTodaysPrompt(supabase, user.id);

  // If a journey already exists for today's specific curiosity — whether
  // still in progress or already finished — reopen that one instead of
  // creating a duplicate. This is what lets someone review a completed
  // conversation, or pick a continued one back up, just by clicking Begin
  // Journey again. A genuinely new journey only gets created once today's
  // prompt actually changes (a new day, or "Something else?"), since that
  // changes the text this is matched against.
  const { data: existing } = await supabase
    .from("journeys")
    .select("id")
    .eq("user_id", user.id)
    .eq("original_prompt", prompt)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    redirect(`/journey/${existing.id}`);
  }

  // Only generated for youth-mode accounts — an adult doesn't need tap-to-
  // guess chips, so skip the extra API call and cost entirely for them.
  const { data: profile } = await supabase
    .from("profiles")
    .select("age")
    .eq("id", user.id)
    .maybeSingle();

  const youthMode =
    typeof profile?.age === "number" && profile.age <= YOUTH_MODE_MAX_AGE;

  let openingSuggestions = null;
  if (youthMode) {
    try {
      openingSuggestions = await generateOpeningSuggestions({
        question: prompt,
        age: profile.age,
      });
    } catch (err) {
      console.error("[socrates] opening suggestions failed, continuing without them:", err.message);
    }
  }

  const { journey, error } = await insertJourney(supabase, {
    user_id: user.id,
    original_prompt: prompt,
    primary_category: category,
    status: "active",
    prompt_source: source,
    opening_suggestions: openingSuggestions,
  });

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

  const youthMode =
    typeof profile?.age === "number" && profile.age <= YOUTH_MODE_MAX_AGE;

  let openingSuggestions = null;
  if (youthMode) {
    try {
      openingSuggestions = await generateOpeningSuggestions({
        question,
        age: profile.age,
      });
    } catch (err) {
      console.error("[socrates] opening suggestions failed, continuing without them:", err.message);
    }
  }

  const { journey, error } = await insertJourney(supabase, {
    user_id: user.id,
    original_prompt: question,
    status: "active",
    topic_seed: topic,
    prompt_source: "topic_seed",
    opening_suggestions: openingSuggestions,
  });

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

// "Micro Lesson" — one short, standalone lesson with no question and no
// back-and-forth. The journey is marked completed at creation, which is
// what actually prevents any further AI calls on it: the reading page
// hides the input box entirely once a journey is completed, so there's no
// way to spend more credits on this one regardless of what anyone types
// elsewhere. Adults only — gated in the UI by youthMode, not here, so if
// you ever change that gate, this action doesn't need to change with it.
export async function beginMicroLesson() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: recent } = await supabase
    .from("journeys")
    .select("primary_category")
    .eq("user_id", user.id)
    .eq("prompt_source", "micro_lesson")
    .order("created_at", { ascending: false })
    .limit(7);

  const recentCategories = new Set((recent || []).map((r) => r.primary_category));
  let candidates = CATEGORIES.filter((c) => !recentCategories.has(c));
  if (candidates.length === 0) {
    candidates = CATEGORIES;
  }
  const category = candidates[Math.floor(Math.random() * candidates.length)];

  let lesson;
  try {
    lesson = await generateMicroLesson({ category });
  } catch (err) {
    throw new Error(`Could not generate a lesson: ${err.message}`);
  }

  const { data: journey, error } = await supabase
    .from("journeys")
    .insert({
      user_id: user.id,
      original_prompt: lesson,
      primary_category: category,
      status: "completed",
      completed_at: new Date().toISOString(),
      prompt_source: "micro_lesson",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Could not save lesson: ${error.message}`);
  }

  const { error: messageError } = await supabase.from("messages").insert({
    journey_id: journey.id,
    role: "assistant",
    content: lesson,
  });

  if (messageError) {
    throw new Error(`Could not save lesson message: ${messageError.message}`);
  }

  redirect(`/journey/${journey.id}`);
}
