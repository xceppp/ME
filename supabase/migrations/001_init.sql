-- PEACE MODE Postgres schema for Supabase.
-- Apply with the Supabase CLI or SQL editor. Local development uses SQLite instead.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'Africa/Casablanca',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_timezone_len check (char_length(timezone) between 1 and 80)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  icon text not null,
  color text not null,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_len check (char_length(name) between 1 and 80),
  constraint categories_color check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null,
  description text,
  recurrence_type text not null,
  recurrence_config jsonb not null default '{}'::jsonb,
  target_quantity numeric,
  target_unit text,
  start_date date not null,
  end_date date,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  reminder_enabled boolean not null default false,
  reminder_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habits_title_len check (char_length(title) between 1 and 160),
  constraint habits_recurrence check (recurrence_type in ('daily', 'weekdays', 'weekly', 'once')),
  constraint habits_dates check (end_date is null or end_date >= start_date),
  constraint habits_quantity check (target_quantity is null or target_quantity > 0)
);

create table if not exists public.habit_schedule_versions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  effective_until date,
  schedule_configuration jsonb not null,
  created_at timestamptz not null default now(),
  constraint habit_versions_range check (effective_until is null or effective_until >= effective_from)
);

create table if not exists public.habit_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  schedule_version_id uuid references public.habit_schedule_versions (id) on delete set null,
  occurrence_date date not null,
  occurrence_snapshot jsonb not null,
  status text not null default 'pending',
  quantity numeric,
  note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_occurrences_status check (status in ('pending', 'completed', 'skipped', 'not_applicable')),
  constraint habit_occurrences_unique unique (habit_id, occurrence_date),
  constraint habit_occurrences_note_len check (note is null or char_length(note) <= 500)
);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium',
  scheduled_date date not null,
  target_time text,
  status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_tasks_priority check (priority in ('low', 'medium', 'high')),
  constraint daily_tasks_status check (status in ('pending', 'completed')),
  constraint daily_tasks_title check (char_length(title) between 1 and 160)
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  morning_intention text,
  morning_intention_custom text,
  personal_commitment text,
  morning_completed_at timestamptz,
  peace_rating integer,
  confidence_rating integer,
  what_went_well text,
  energy_drainers text,
  tomorrow_adjustment text,
  evening_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_checkins_unique unique (user_id, local_date),
  constraint daily_checkins_peace check (peace_rating is null or peace_rating between 1 and 10),
  constraint daily_checkins_confidence check (confidence_rating is null or confidence_rating between 1 and 10),
  constraint daily_checkins_text check (
    (what_went_well is null or char_length(what_went_well) <= 2000)
    and (energy_drainers is null or char_length(energy_drainers) <= 2000)
    and (tomorrow_adjustment is null or char_length(tomorrow_adjustment) <= 2000)
    and (personal_commitment is null or char_length(personal_commitment) <= 500)
  )
);

create table if not exists public.daily_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  category_id uuid references public.categories (id) on delete set null,
  title text not null,
  description text,
  target_time text,
  status text not null default 'pending',
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_priorities_status check (status in ('pending', 'completed')),
  constraint daily_priorities_title check (char_length(title) between 1 and 160)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  title text not null,
  body text not null,
  category_id uuid references public.categories (id) on delete set null,
  mood_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_title check (char_length(title) between 1 and 200),
  constraint journal_body check (char_length(body) between 1 and 20000)
);

create table if not exists public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_type text not null,
  reference_id uuid,
  is_enabled boolean not null default false,
  reminder_time text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_type check (reminder_type in ('morning_planning', 'evening_reflection', 'habit'))
);

create index if not exists categories_user_idx on public.categories (user_id, sort_order);
create index if not exists habits_user_idx on public.habits (user_id, is_archived, sort_order);
create index if not exists habit_versions_lookup_idx on public.habit_schedule_versions (habit_id, effective_from);
create index if not exists habit_occurrences_user_date_idx on public.habit_occurrences (user_id, occurrence_date);
create index if not exists daily_tasks_user_date_idx on public.daily_tasks (user_id, scheduled_date);
create index if not exists daily_checkins_user_date_idx on public.daily_checkins (user_id, local_date);
create index if not exists daily_priorities_user_date_idx on public.daily_priorities (user_id, local_date, sort_order);
create index if not exists journal_user_date_idx on public.journal_entries (user_id, local_date);

create or replace function public.enforce_category_owner()
returns trigger
language plpgsql
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'category_owner_mismatch';
  end if;
  if tg_table_name = 'habit_occurrences' then
    if not exists (select 1 from public.habits h where h.id = new.habit_id and h.user_id = new.user_id) then
      raise exception 'habit_owner_mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists habits_updated_at on public.habits;
create trigger habits_updated_at before update on public.habits
for each row execute function public.set_updated_at();
drop trigger if exists occurrences_updated_at on public.habit_occurrences;
create trigger occurrences_updated_at before update on public.habit_occurrences
for each row execute function public.set_updated_at();
drop trigger if exists tasks_updated_at on public.daily_tasks;
create trigger tasks_updated_at before update on public.daily_tasks
for each row execute function public.set_updated_at();
drop trigger if exists checkins_updated_at on public.daily_checkins;
create trigger checkins_updated_at before update on public.daily_checkins
for each row execute function public.set_updated_at();
drop trigger if exists priorities_updated_at on public.daily_priorities;
create trigger priorities_updated_at before update on public.daily_priorities
for each row execute function public.set_updated_at();
drop trigger if exists journal_updated_at on public.journal_entries;
create trigger journal_updated_at before update on public.journal_entries
for each row execute function public.set_updated_at();
drop trigger if exists reminders_updated_at on public.reminder_preferences;
create trigger reminders_updated_at before update on public.reminder_preferences
for each row execute function public.set_updated_at();

drop trigger if exists habits_category_owner on public.habits;
create trigger habits_category_owner before insert or update on public.habits
for each row execute function public.enforce_category_owner();
drop trigger if exists tasks_category_owner on public.daily_tasks;
create trigger tasks_category_owner before insert or update on public.daily_tasks
for each row execute function public.enforce_category_owner();
drop trigger if exists priorities_category_owner on public.daily_priorities;
create trigger priorities_category_owner before insert or update on public.daily_priorities
for each row execute function public.enforce_category_owner();
drop trigger if exists journal_category_owner on public.journal_entries;
create trigger journal_category_owner before insert or update on public.journal_entries
for each row execute function public.enforce_category_owner();
drop trigger if exists occurrences_owner on public.habit_occurrences;
create trigger occurrences_owner before insert or update on public.habit_occurrences
for each row execute function public.enforce_category_owner();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.habits enable row level security;
alter table public.habit_schedule_versions enable row level security;
alter table public.habit_occurrences enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.daily_priorities enable row level security;
alter table public.journal_entries enable row level security;
alter table public.reminder_preferences enable row level security;

create policy profiles_all on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy categories_all on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy habits_all on public.habits
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

create policy habit_versions_all on public.habit_schedule_versions
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
  );

create policy habit_occurrences_all on public.habit_occurrences
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
  );

create policy daily_tasks_all on public.daily_tasks
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

create policy daily_checkins_all on public.daily_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy daily_priorities_all on public.daily_priorities
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

create policy journal_all on public.journal_entries
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

create policy reminders_all on public.reminder_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, timezone, preferences)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Africa/Casablanca'),
    jsonb_build_object(
      'theme', 'dark',
      'reducedMotion', false,
      'streakThreshold', 70,
      'startOfWeek', 1,
      'motivationalEnabled', true,
      'dashboardMission', 'Today, your mission is to protect your peace and make meaningful progress.',
      'onboardingComplete', false,
      'quietHoursStart', '22:00',
      'quietHoursEnd', '07:00'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
