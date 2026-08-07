"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateTodaysPrompt } from "@/lib/prompts/dailyPrompts";

export async function beginJourney() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { prompt, category } = await getOrCreateTodaysPrompt(supabase, user.id);

  const { data: journey, error } = await supabase
    .from("journeys")
    .insert({
      user_id: user.id,
      original_prompt: prompt,
      primary_category: category,
      status: "active",
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

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
