-- GolfClub schema, RLS, storage, and seed data
-- Run this in the Supabase SQL editor after creating a project.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('subscriber', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tournament_status as enum ('upcoming', 'live', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entry_status as enum ('registered', 'submitted', 'verified', 'rejected', 'rewarded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reward_kind as enum ('tournament', 'monthly_draw');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reward_status as enum ('pending', 'approved', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.draw_status as enum ('open', 'drawn', 'paid');
exception when duplicate_object then null; end $$;

create table if not exists public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text,
  description text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'subscriber',
  charity_id uuid references public.charities (id) on delete set null,
  is_subscribed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities (id) on delete cascade,
  title text not null,
  match_type smallint not null check (match_type in (3, 4, 5)),
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reward_pool numeric(12, 2) not null default 0,
  notes text,
  status public.tournament_status not null default 'upcoming',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  target_score integer not null check (target_score > 0),
  actual_score integer check (actual_score > 0),
  score_image_path text,
  status public.entry_status not null default 'registered',
  admin_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, tournament_id)
);

create table if not exists public.monthly_draws (
  id uuid primary key default gen_random_uuid(),
  period date not null unique,
  prize_amount numeric(12, 2) not null default 0,
  status public.draw_status not null default 'open',
  winner_id uuid references public.profiles (id) on delete set null,
  notes text,
  drawn_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid references public.entries (id) on delete set null,
  draw_id uuid references public.monthly_draws (id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  kind public.reward_kind not null,
  status public.reward_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists tournaments_charity_idx on public.tournaments (charity_id);
create index if not exists tournaments_starts_idx on public.tournaments (starts_at);
create index if not exists entries_user_idx on public.entries (user_id);
create index if not exists entries_tournament_idx on public.entries (tournament_id);
create index if not exists rewards_user_idx on public.rewards (user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_active_subscriber()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('subscriber', 'admin')
      and (is_subscribed = true or role = 'admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_subscribed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'subscriber',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_subscribed := old.is_subscribed;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

create or replace function public.run_monthly_draw(p_draw_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw public.monthly_draws%rowtype;
  v_winner uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_draw from public.monthly_draws where id = p_draw_id for update;
  if not found then
    raise exception 'draw not found';
  end if;
  if v_draw.status <> 'open' then
    raise exception 'draw already completed';
  end if;

  select e.user_id
    into v_winner
  from public.entries e
  join public.profiles p on p.id = e.user_id
  where e.status in ('verified', 'rewarded')
    and p.is_subscribed = true
    and coalesce(e.submitted_at, e.created_at) >= v_draw.period
    and coalesce(e.submitted_at, e.created_at) < (v_draw.period + interval '1 month')
  order by random()
  limit 1;

  if v_winner is null then
    raise exception 'no eligible players for this month';
  end if;

  update public.monthly_draws
  set winner_id = v_winner,
      status = 'drawn',
      drawn_at = now()
  where id = p_draw_id;

  insert into public.rewards (user_id, draw_id, amount, kind, status)
  values (v_winner, p_draw_id, v_draw.prize_amount, 'monthly_draw', 'approved');

  return v_winner;
end;
$$;

grant execute on function public.run_monthly_draw(uuid) to authenticated;

alter table public.charities enable row level security;
alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.entries enable row level security;
alter table public.monthly_draws enable row level security;
alter table public.rewards enable row level security;

drop policy if exists "charities are public" on public.charities;
create policy "charities are public"
  on public.charities for select
  using (true);

drop policy if exists "admins manage charities" on public.charities;
create policy "admins manage charities"
  on public.charities for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "read own or admin profiles" on public.profiles;
create policy "read own or admin profiles"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "update own limited profile" on public.profiles;
create policy "update own limited profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tournaments are public" on public.tournaments;
create policy "tournaments are public"
  on public.tournaments for select
  using (true);

drop policy if exists "admins manage tournaments" on public.tournaments;
create policy "admins manage tournaments"
  on public.tournaments for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "subscribers read own entries" on public.entries;
create policy "subscribers read own entries"
  on public.entries for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "subscribers insert own entries" on public.entries;
create policy "subscribers insert own entries"
  on public.entries for insert
  with check (auth.uid() = user_id and public.is_active_subscriber());

drop policy if exists "subscribers update own pending entries" on public.entries;
create policy "subscribers update own pending entries"
  on public.entries for update
  using (auth.uid() = user_id and public.is_active_subscriber())
  with check (auth.uid() = user_id);

drop policy if exists "admins manage entries" on public.entries;
create policy "admins manage entries"
  on public.entries for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "draws are public" on public.monthly_draws;
create policy "draws are public"
  on public.monthly_draws for select
  using (true);

drop policy if exists "admins manage draws" on public.monthly_draws;
create policy "admins manage draws"
  on public.monthly_draws for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "read own rewards" on public.rewards;
create policy "read own rewards"
  on public.rewards for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins manage rewards" on public.rewards;
create policy "admins manage rewards"
  on public.rewards for all
  using (public.is_admin())
  with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('scorecards', 'scorecards', false)
on conflict (id) do nothing;

drop policy if exists "subscribers upload scorecards" on storage.objects;
create policy "subscribers upload scorecards"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'scorecards'
    and public.is_active_subscriber()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "subscribers update own scorecards" on storage.objects;
create policy "subscribers update own scorecards"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'scorecards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "read own or admin scorecards" on storage.objects;
create policy "read own or admin scorecards"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'scorecards'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

insert into public.charities (name, slug, tagline, description, city)
values
  (
    'Green Horizon Relief',
    'green-horizon',
    'Youth access to the game',
    'Funds junior coaching, travel, and kit for players who would otherwise never reach a first tee.',
    'Austin'
  ),
  (
    'Coastal Care Classic',
    'coastal-care',
    'Shoreline restoration',
    'Pairs tournament weekends with dune restoration and coastal community clinics.',
    'Charleston'
  ),
  (
    'Fairway Futures',
    'fairway-futures',
    'Scholarship rounds',
    'Turns verified scores into scholarship draws for first-generation college athletes.',
    'Chicago'
  ),
  (
    'Night Range Collective',
    'night-range',
    'City night golf',
    'Keeps municipal ranges open after dark and funds adaptive golf programs.',
    'Los Angeles'
  )
on conflict (slug) do nothing;

insert into public.monthly_draws (period, prize_amount, status, notes)
values (
  date_trunc('month', now())::date,
  2500,
  'open',
  'Every verified scorecard this month is a ticket.'
)
on conflict (period) do nothing;

insert into public.tournaments (charity_id, title, match_type, venue, starts_at, ends_at, reward_pool, notes)
select c.id, t.title, t.match_type, t.venue, t.starts_at, t.ends_at, t.reward_pool, t.notes
from public.charities c
join (
  values
    ('green-horizon', 'Horizon Five', 5, 'East Municipal', now() + interval '5 days', now() + interval '6 days', 1500, 'Full-field 5-number match'),
    ('green-horizon', 'Relief Four', 4, 'East Municipal', now() + interval '12 days', now() + interval '13 days', 900, 'Standard 4-number match'),
    ('coastal-care', 'Dune Line Three', 3, 'Harbor Links', now() + interval '8 days', now() + interval '9 days', 700, 'Compact 3-number match'),
    ('fairway-futures', 'Scholarship Five', 5, 'Lakefront', now() + interval '16 days', now() + interval '17 days', 2000, 'Full-field 5-number match'),
    ('night-range', 'After Dark Four', 4, 'City Range', now() + interval '3 days', now() + interval '4 days', 800, 'Standard 4-number match')
) as t(slug, title, match_type, venue, starts_at, ends_at, reward_pool, notes)
  on c.slug = t.slug
where not exists (
  select 1 from public.tournaments existing
  where existing.title = t.title and existing.charity_id = c.id
);
