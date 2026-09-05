-- Project Socrates — Supabase schema
-- Implements the full data model from Prototype Build Spec v0.3, Section 17,
-- plus everything added since through real usage (provenance tracking,
-- generated question library, username-without-email support).
--
-- Run this once in the Supabase SQL Editor for a fresh project.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- USERS (extends Supabase's built-in auth.users)
-- ─────────────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age integer,
  role text not null default 'member' check (role in ('member', 'admin')),
  reflection_duration_minutes integer not null default 20,
  suggestions_selectable boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new account is created in Supabase Auth.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- JOURNEYS  (Milestone 1)
-- ─────────────────────────────────────────────────────────────────────────
create table journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_prompt text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  summary text,                 -- filled in starting Milestone 2/3 (My Curiosity view)
  primary_category text,
  secondary_categories text[],  -- filled in starting Milestone 2/3
  topic_seed text,               -- the free-text topic typed into "What are you curious about?", if any
  prompt_source text             -- 'ai_generated' | 'curated_bank' | 'topic_seed'
);

alter table journeys enable row level security;

create policy "Users can view their own journeys"
  on journeys for select
  using (auth.uid() = user_id);

create policy "Users can insert their own journeys"
  on journeys for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own journeys"
  on journeys for update
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- MESSAGES  (Milestone 1)
-- ─────────────────────────────────────────────────────────────────────────
create table messages (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references journeys(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "Users can view messages in their own journeys"
  on messages for select
  using (
    exists (
      select 1 from journeys
      where journeys.id = messages.journey_id
        and journeys.user_id = auth.uid()
    )
  );

create policy "Users can insert messages into their own journeys"
  on messages for insert
  with check (
    exists (
      select 1 from journeys
      where journeys.id = messages.journey_id
        and journeys.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- DAILY PROMPT HISTORY  (Milestone 1)
-- ─────────────────────────────────────────────────────────────────────────
create table daily_prompt_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  prompt text not null,
  category text not null,
  source text not null default 'ai_generated' check (source in ('ai_generated', 'curated_bank')),
  unique (user_id, date)
);

alter table daily_prompt_history enable row level security;

create policy "Users can view their own prompt history"
  on daily_prompt_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own prompt history"
  on daily_prompt_history for insert
  with check (auth.uid() = user_id);

-- Required for the "Something else?" shuffle: it upserts (insert-or-update)
-- today's row, and upsert's ON CONFLICT DO UPDATE path needs an UPDATE
-- policy too, not just INSERT — without this, every shuffle click was
-- silently rejected by RLS once today's row already existed.
create policy "Users can update their own prompt history"
  on daily_prompt_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- GENERATED PROMPTS  (growing library of proven-good AI-generated
-- questions — written to when a journey using an AI-generated question
-- actually completes. Shared across the whole family, not per-user, since
-- a good question is good regardless of who saw it first. Not yet read
-- from during selection — this is the write side of that; wiring it back
-- into selection is a deliberate future step, not done automatically.)
-- ─────────────────────────────────────────────────────────────────────────
create table generated_prompts (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  category text not null,
  created_at timestamptz not null default now()
);

alter table generated_prompts enable row level security;

-- Shared table: any signed-in family member can read and contribute to it.
create policy "Family members can view the generated prompt library"
  on generated_prompts for select
  using (auth.role() = 'authenticated');

create policy "Family members can add to the generated prompt library"
  on generated_prompts for insert
  with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────
-- REFLECTIONS  (Milestone 2)
-- ─────────────────────────────────────────────────────────────────────────
create table reflections (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references journeys(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  recommended_duration integer,
  bypassed_timer boolean not null default false
);

alter table reflections enable row level security;

create policy "Users can manage their own reflections"
  on reflections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- JOURNEY RELATIONSHIPS  (Milestone 2/3 — "related" / "continued" branches)
-- ─────────────────────────────────────────────────────────────────────────
create table journey_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_journey_id uuid not null references journeys(id) on delete cascade,
  child_journey_id uuid not null references journeys(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('related', 'continued'))
);

alter table journey_relationships enable row level security;

create policy "Users can view relationships on their own journeys"
  on journey_relationships for select
  using (
    exists (
      select 1 from journeys
      where journeys.id = journey_relationships.parent_journey_id
        and journeys.user_id = auth.uid()
    )
  );

create policy "Users can create relationships on their own journeys"
  on journey_relationships for insert
  with check (
    exists (
      select 1 from journeys
      where journeys.id = journey_relationships.parent_journey_id
        and journeys.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- PROFILE OBSERVATIONS  (Milestone 3 — simplified Curiosity Profile)
-- ─────────────────────────────────────────────────────────────────────────
create table profile_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dimension text not null check (
    dimension in ('breadth', 'depth', 'reflection', 'connections', 'intellectual_humility', 'question_quality')
  ),
  descriptor text,
  observation_text text,
  created_at timestamptz not null default now()
);

alter table profile_observations enable row level security;

create policy "Users can view their own profile observations"
  on profile_observations for select
  using (auth.uid() = user_id);

-- Written by server-side logic (service role), not directly by users.

-- ─────────────────────────────────────────────────────────────────────────
-- SAFETY ALERTS  (Milestone 4 — Admin Role and Alerts, spec Section 14)
-- Visible to Admin only. Not written to by client code in this build;
-- reserved so the schema is ready when the safety-trigger logging and
-- Admin alerts view are implemented.
-- ─────────────────────────────────────────────────────────────────────────
create table safety_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journey_id uuid references journeys(id) on delete set null,
  trigger_type text not null,
  context_paragraph text,
  created_at timestamptz not null default now(),
  acknowledged_by_admin boolean not null default false,
  acknowledged_at timestamptz,
  override_accessed_at timestamptz
);

alter table safety_alerts enable row level security;

-- Only Admin accounts can read alerts — never the account that triggered one.
create policy "Admins can view safety alerts"
  on safety_alerts for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can acknowledge safety alerts"
  on safety_alerts for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Inserts happen from server-side code using the Supabase service role key
-- (bypasses RLS), once Milestone 4 wires up trigger detection.
