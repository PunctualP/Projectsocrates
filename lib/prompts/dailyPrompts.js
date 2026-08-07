import { generateDomainQuestion } from "@/lib/ai/domainQuestion";

// Curated bank — no longer the primary source, but kept as a safety-net
// fallback if the generation call ever fails (bad network, API outage,
// etc.), so a bad moment never breaks the experience. Also the source of
// the fixed domain list below.
export const PROMPT_BANK = [
  { question: "Why do we dream, and why do dreams feel so real while they're happening?", category: "psychology" },
  { question: "If you cut a starfish in half, sometimes you get two starfish. What does that tell us about what it means to be 'one' living thing?", category: "science" },
  { question: "Why did ancient people in completely separate parts of the world all end up building pyramids?", category: "history" },
  { question: "Is a shadow a real thing, or just an absence of something?", category: "philosophy" },
  { question: "Why does a bridge stay up even though nothing is holding it from below?", category: "engineering" },
  { question: "Why do leaves change color in the fall instead of just staying green until they drop?", category: "nature" },
  { question: "If everyone in a town decided to grow their own food instead of buying it, would the town be richer or poorer?", category: "economics" },
  { question: "Why do almost all cultures that never met each other still tell stories about a great flood?", category: "culture" },
  { question: "Why does a piece of music make you feel something, when it's really just air vibrating?", category: "art" },
  { question: "Is there a biggest number, or does counting just never stop?", category: "mathematics" },
  { question: "Why do we itch, and why does scratching make it feel better for a moment and then worse?", category: "science" },
  { question: "Why did handwriting exist for thousands of years before anyone thought to put spaces between words?", category: "history" },
  { question: "If a tree falls in a forest and no one is around, does it make a sound?", category: "philosophy" },
  { question: "Why don't skyscrapers tip over in the wind?", category: "engineering" },
  { question: "Why do some animals migrate thousands of miles instead of just staying where the weather is nice?", category: "nature" },
  { question: "Why does the price of something go up when more people want it, even though it's the exact same object?", category: "economics" },
  { question: "Why do so many cultures independently invented board games with dice or counting pieces?", category: "culture" },
  { question: "Why do we find some faces more beautiful than others — is it something we're born knowing, or something we learn?", category: "art" },
  { question: "Why does a shuffled deck of cards almost certainly make an arrangement that has never existed before in history?", category: "mathematics" },
  { question: "Why do we forget most of our dreams within minutes of waking up?", category: "psychology" },
  { question: "Why does hot water sometimes freeze faster than cold water?", category: "science" },
  { question: "Why did so many old civilizations collapse right around the time they seemed most powerful?", category: "history" },
  { question: "If you replaced every part of a ship, one plank at a time, is it still the same ship at the end?", category: "philosophy" },
  { question: "Why do some very tall buildings sway on purpose instead of being built perfectly rigid?", category: "engineering" },
  { question: "Why do some trees live for thousands of years while others live for only a few decades?", category: "nature" },
  { question: "Why does a country sometimes get poorer even when everyone in it is working hard?", category: "economics" },
  { question: "Why do almost all human cultures decorate their bodies somehow — jewelry, tattoos, paint, clothing patterns?", category: "culture" },
  { question: "Why does a sad song sometimes make you feel better instead of worse?", category: "art" },
  { question: "Why can you never quite fold a piece of paper in half more than about seven or eight times?", category: "mathematics" },
  { question: "Why do we get 'butterflies' in our stomach when we're nervous, when nothing is actually happening in there?", category: "psychology" },
];

const CATEGORIES = [...new Set(PROMPT_BANK.map((p) => p.category))];

const RECENT_LOOKBACK = 7; // days of history to avoid repeating a category

function todayDateString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function pickFallback(category) {
  const inCategory = PROMPT_BANK.filter((p) => p.category === category);
  const pool = inCategory.length > 0 ? inCategory : PROMPT_BANK;
  return pool[Math.floor(Math.random() * pool.length)].question;
}

/**
 * Returns today's curiosity prompt for this user, creating and logging one
 * if it hasn't been picked yet today. Safe to call more than once per day —
 * it will just return the same prompt already on record.
 */
export async function getOrCreateTodaysPrompt(supabase, userId) {
  const today = todayDateString();

  const { data: existing } = await supabase
    .from("daily_prompt_history")
    .select("prompt, category, source")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  return pickAndStorePrompt(supabase, userId, today);
}

/**
 * Always picks a new prompt, overwriting today's cached one — used by the
 * "Something else?" shuffle option on the home screen. Unlike
 * getOrCreateTodaysPrompt, this ignores any existing prompt for today.
 */
export async function getFreshPrompt(supabase, userId) {
  const today = todayDateString();
  return pickAndStorePrompt(supabase, userId, today);
}

async function pickAndStorePrompt(supabase, userId, today) {
  const [{ data: recent }, { data: profile }] = await Promise.all([
    supabase
      .from("daily_prompt_history")
      .select("category")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(RECENT_LOOKBACK),
    supabase.from("profiles").select("age").eq("id", userId).maybeSingle(),
  ]);

  const recentCategories = new Set((recent || []).map((r) => r.category));

  let candidateCategories = CATEGORIES.filter((c) => !recentCategories.has(c));
  if (candidateCategories.length === 0) {
    candidateCategories = CATEGORIES; // exhausted variety — fall back to full list
  }

  const category =
    candidateCategories[Math.floor(Math.random() * candidateCategories.length)];

  let question;
  let source;
  try {
    question = await generateDomainQuestion({ category, age: profile?.age });
    source = "ai_generated";
  } catch (err) {
    console.error(
      `[socrates] domain question generation failed for category "${category}", falling back to curated bank:`,
      err.message
    );
    question = pickFallback(category);
    source = "curated_bank";
  }

  await supabase.from("daily_prompt_history").upsert(
    {
      user_id: userId,
      date: today,
      prompt: question,
      category,
      source,
    },
    { onConflict: "user_id,date" }
  );

  return { prompt: question, category, source };
}
