import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { YOUTH_MODE_MAX_AGE } from "@/lib/ai/systemPrompt";
import JourneyChat from "./JourneyChat";

export default async function JourneyPage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: journey } = await supabase
    .from("journeys")
    .select("id, status, original_prompt, user_id, prompt_source")
    .eq("id", params.id)
    .maybeSingle();

  if (!journey || journey.user_id !== user.id) {
    notFound();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("age")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[socrates] profile fetch error:", profileError.message);
  }

  const youthMode =
    typeof profile?.age === "number" && profile.age <= YOUTH_MODE_MAX_AGE;

  // Fetched separately from age on purpose: this column was added after the
  // initial schema, so on a project that hasn't run the migration yet, this
  // query can fail without taking youth mode itself down with it.
  let selectableSuggestions = true;
  if (youthMode) {
    const { data: settings, error: settingsError } = await supabase
      .from("profiles")
      .select("suggestions_selectable")
      .eq("id", user.id)
      .maybeSingle();

    if (settingsError) {
      console.error(
        "[socrates] suggestions_selectable fetch error — has the migration been run? ",
        settingsError.message
      );
    } else if (settings) {
      selectableSuggestions = settings.suggestions_selectable !== false;
    }
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("journey_id", journey.id)
    .order("created_at", { ascending: true });

  return (
    <JourneyChat
      journeyId={journey.id}
      initialMessages={messages || []}
      initialStatus={journey.status}
      youthMode={youthMode}
      selectableSuggestions={selectableSuggestions}
      isLesson={journey.prompt_source === "micro_lesson"}
    />
  );
}
