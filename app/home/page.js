import { createClient } from "@/lib/supabase/server";
import { getOrCreateTodaysPrompt } from "@/lib/prompts/dailyPrompts";
import { beginJourney, shufflePrompt, beginTopicJourney, beginMicroLesson, signOut } from "./actions";
import { YOUTH_MODE_MAX_AGE } from "@/lib/ai/systemPrompt";
import TopicSubmitButton from "./TopicSubmitButton";
import MicroLessonButton from "./MicroLessonButton";
import Link from "next/link";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, age")
    .eq("id", user.id)
    .maybeSingle();

  const youthMode =
    typeof profile?.age === "number" && profile.age <= YOUTH_MODE_MAX_AGE;

  const { data: activeJourney } = await supabase
    .from("journeys")
    .select("id, original_prompt, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const name = profile?.display_name || user.email;
  const todays = await getOrCreateTodaysPrompt(supabase, user.id);

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

        <div className="flex flex-col gap-5">
          {activeJourney && (
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
          )}

          <section className="paper-surface shadow-paper px-7 py-7 animate-riseIn">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-ink/50">
                Today's Curiosity
              </p>
              <form action={shufflePrompt}>
                <button className="text-xs text-ink/40 hover:text-gold/80 transition underline">
                  🔀 Something else?
                </button>
              </form>
            </div>
            <p className="font-display text-xl leading-snug mb-6">
              {todays.prompt}
            </p>
            <form action={beginJourney}>
              <button className="inline-block rounded-md bg-ink text-paper font-semibold px-5 py-2.5 hover:bg-ink/90 transition">
                Begin Journey →
              </button>
            </form>
          </section>

          <section className="paper-surface shadow-paper px-7 py-7 animate-riseIn">
            <p className="text-xs uppercase tracking-wide text-ink/50 mb-3">
              What are you curious about?
            </p>
            <p className="text-ink/60 text-sm mb-4">
              Type anything — a movie, an animal, a place — and get a question inspired by it, maybe about the real world behind it, or the story itself.
            </p>
            <form action={beginTopicJourney} className="flex flex-col gap-3">
              <input
                type="text"
                name="topic"
                required
                placeholder="Moana, volcanoes, soccer…"
                className="w-full rounded-md border border-ink/15 bg-white/70 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
              <TopicSubmitButton />
            </form>
          </section>

          {!youthMode && (
            <section className="paper-surface shadow-paper px-7 py-7 animate-riseIn">
              <p className="text-xs uppercase tracking-wide text-ink/50 mb-3">
                Micro Lesson
              </p>
              <p className="text-ink/60 text-sm mb-4">
                One short, surprising lesson — no questions, no back-and-forth. Read it and go.
              </p>
              <form action={beginMicroLesson}>
                <MicroLessonButton />
              </form>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
