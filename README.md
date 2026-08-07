# Project Socrates — Milestone 1

"Make Curiosity a Habit."

This is Milestone 1 from Build Spec v0.3: account sign-in, home screen,
Today's Curiosity, full journey conversation (with "I don't know" and
"just tell me" handling), and persistence. Reflection timer, Curiosity
Profile, My Curiosity tree view, and Admin safety alerts come in later
milestones — the database schema already has room for them so nothing
here needs to be rebuilt.

## 1. Create the Supabase project

1. In Supabase, create a new project (a dedicated one for Socrates is
   cleanest — keeps it separate from WorkLedger/Chart Mark data).
2. Open the **SQL Editor** and run the entire contents of
   `supabase/schema.sql` once. This creates every table from the spec's
   data model, with row-level security so each account can only see its
   own data.
3. Go to **Authentication → Users** and manually create two accounts
   (per spec — there's no public sign-up screen):
   - Your account: use your real email.
   - Your daughter's account: she doesn't need a real email — see
     "Accounts without email" below.
4. Go to **Table Editor → profiles**. A row was auto-created for each
   account. Edit them:
   - Your row: set `role` to `admin`.
   - Her row: set `role` to `member`, and set `age` to `8`.
   - Set `display_name` on both to whatever you want shown in the app.

### Accounts without email

Supabase requires every account to have *something* in the email field
internally, even if no real email is ever sent — there's no native
bare-username account type. The app works around this: when you create
her account in the Supabase dashboard, give it a synthetic address like

```
emma@socrates.local
```

and check **"Auto Confirm User"** so it never tries to send a
verification email to an address that doesn't exist. Set a password for
her the normal way.

On the login screen, she then just types `emma` (not the full address)
— the app fills in `@socrates.local` automatically. Your own login is
unaffected: typing a real email with an `@` in it is used as-is. If you
want a different domain than `socrates.local`, set
`NEXT_PUBLIC_USERNAME_DOMAIN` in `.env.local` — just make sure it
matches exactly what you typed into the Supabase dashboard.

## 2. Get your API keys

- **Supabase**: Project Settings → API → copy the Project URL and the
  `anon` `public` key. 
- **Anthropic**: console.anthropic.com → API Keys → use the same
  account already billing WorkLedger's receipt reading, or create a new
  key under it.

Copy `.env.local.example` to `.env.local` and fill in all three values.
Never commit `.env.local` — it's already in `.gitignore`.

## 3. Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with one of the two accounts, and
you should see Today's Curiosity waiting.

## 4. Deploy to Netlify

Same flow as your other apps:

1. Push this project to a new repo under `PunctualP` on GitHub.
2. In Netlify, "Add a new site" → import that repo.
3. Netlify auto-detects Next.js and installs the required plugin — no
   manual build config needed.
4. Add the same three environment variables from `.env.local` in
   Netlify's **Site settings → Environment variables**.
5. Deploy.

## What's deliberately not built yet

Per spec Section 5 ("Do Not Build Yet") and the Milestone 1 scope: no
reflection timer, no Curiosity Profile, no My Curiosity history view, no
related/random branching after a journey ends, no Admin alerts UI, no
native app, no monetization. The `journeys` table already has
`summary` and `secondary_categories` columns, and `safety_alerts` /
`reflections` / `profile_observations` / `journey_relationships` tables
already exist — reserved for the next milestones so this build doesn't
need schema changes later.

## Cost notes

Default model is Claude Haiku 4.5 via the Anthropic API, with prompt
caching enabled on the system prompt (see `lib/ai/anthropicClient.js`).
Each API call logs rough token usage (including cache reads) to the
server console — check your hosting provider's function logs if you
want to see per-conversation cost while testing.
