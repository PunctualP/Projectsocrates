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
    .select("id, status, original_prompt, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!journey || journey.user_id !== user.id) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("age")
    .eq("id", user.id)
    .maybeSingle();

  const youthMode =
    typeof profile?.age === "number" && profile.age <= YOUTH_MODE_MAX_AGE;

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
    />
  );
}
