import { createClient } from "@/lib/supabase/server";
import { getOrCreateTodaysPrompt } from "@/lib/prompts/dailyPrompts";
import { beginJourney, signOut } from "./actions";
import Link from "next/link";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: activeJourney } = await supabase
    .from("journeys")
    .select("id, original_prompt, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const name = profile?.display_name || user.email;
  const todays = activeJourney ? null : await getOrCreateTodaysPrompt(supabase, user.id);

  return (
    <main className="min-h-screen px-6 py-10 flex flex-col items-center">
      <div className="w-full max-w-xl">
        <header className="flex items-center justify-between mb-12">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-mistDim">
              Project Socrates
            </p>
            <h1 className="font-display italic text-lg text-paper mt-1">
              Make Curiosity a Habit.
            </h1>
          </div>
          <form action={signOut}>
            <button className="text-xs text-mistDim hover:text-mist transition">
              Sign out
            </button>
          </form>
        </header>

        <p className="text-sm text-mistDim mb-6">Welcome back, {name}.</p>

        {activeJourney ? (
          <section className="paper-surface shadow-paper px-7 py-7 animate-riseIn">
            <p className="text-xs uppercase tracking-wide text-ink/50 mb-3">
              Continue your journey
            </p>
            <p className="font-display text-xl leading-snug mb-6">
              {activeJourney.original_prompt}
            </p>
            <Link
              href={`/journey/${activeJourney.id}`}
              className="inline-block rounded-md bg-ink text-paper font-semibold px-5 py-2.5 hover:bg-ink/90 transition"
            >
              Continue →
            </Link>
          </section>
        ) : (
          <section className="paper-surface shadow-paper px-7 py-7 animate-riseIn">
            <p className="text-xs uppercase tracking-wide text-ink/50 mb-3">
              Today's Curiosity
            </p>
            <p className="font-display text-xl leading-snug mb-6">
              {todays.prompt}
            </p>
            <form action={beginJourney}>
              <button className="inline-block rounded-md bg-ink text-paper font-semibold px-5 py-2.5 hover:bg-ink/90 transition">
                Begin Journey →
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
