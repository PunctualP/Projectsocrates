# Project Socrates — Milestone 1

"Make Curiosity a Habit."

## 1. Create the Supabase project

1. Create a Supabase project (a dedicated one for Socrates, separate from
   WorkLedger/Chart Mark data).
2. Run the entire contents of `supabase/schema.sql` once in the SQL Editor.
3. Authentication → Users → manually create two accounts (no public sign-up
   screen by design):
   - Your account: use your real email.
   - Her account: doesn't need a real email — see "Accounts without email"
     below.
4. Table Editor → profiles → edit the auto-created rows:
   - Your row: `role` = `admin`.
   - Her row: `role` = `member`, `age` = her age.
   - Set `display_name` on both.

### Accounts without email

Give her account a synthetic address like `emma@socrates.local` in the
Supabase dashboard, with "Auto Confirm User" checked. On the login screen
she just types `emma` — the app appends the domain automatically. Your own
login still works with a real email as-is. Change the domain via
`NEXT_PUBLIC_USERNAME_DOMAIN` in `.env.local` if you want.

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
  Project Settings → API.
- `ANTHROPIC_API_KEY` — console.anthropic.com, same account as WorkLedger.

On Netlify, add the same variables under Site configuration → Environment
variables, then push to GitHub — Netlify builds and deploys automatically,
no local run required.

## What's in this build

- Account sign-in (including username-only accounts), home screen, Today's
  Curiosity (AI-generated within a fixed domain, curated bank as fallback
  only), a "Something else?" shuffle, and a "What are you curious about?"
  box that either invents a question from a topic or answers a direct
  question and turns it into one.
- Full journey conversation with "I don't know" / "Just tell me" handling,
  Young User Mode (age ≤ 12 by default — see `YOUTH_MODE_MAX_AGE` in
  `lib/ai/systemPrompt.js`): shorter replies, on-topic humor, clickable
  vocabulary, question coaching, a short-reply gate that requires typing a
  real sentence before sending, and proactive reply suggestions that can be
  tappable or plain hint text per-account (`suggestions_selectable` in
  `profiles`).
- 10-minute inactivity auto sign-out, everywhere in the app.
- A growing shared library (`generated_prompts`) of AI-generated questions
  that proved themselves by completing a journey — write-only for now, not
  yet read from during selection.

## What's deliberately not built yet

Reflection timer, Curiosity Profile, My Curiosity history view, Admin
safety alerts UI, native app, monetization. The schema already has room for
all of it.
