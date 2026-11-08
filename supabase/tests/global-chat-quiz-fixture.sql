-- Isolated PostgreSQL only. Load this file, the original global chat migration,
-- quiz_fixture_install_chat_metadata(), then the quiz migrations in order.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create schema extensions;
create schema storage;
create schema cron;
create extension unaccent with schema extensions;
create publication supabase_realtime;

create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  bucket_id text not null references storage.buckets(id),
  name text not null,
  primary key (bucket_id, name)
);

create table cron.fixture_jobs (
  id bigint generated always as identity primary key,
  name text not null unique,
  schedule text not null,
  command text not null
);
create function cron.schedule(p_name text, p_schedule text, p_command text)
returns bigint language sql
as $$
  insert into cron.fixture_jobs(name, schedule, command)
  values (p_name, p_schedule, p_command)
  on conflict (name) do update set schedule = excluded.schedule, command = excluded.command
  returning id
$$;

create table public.seasons (id uuid primary key, game_year integer not null, status text not null);
create table public.sporting_directors (
  id uuid primary key,
  auth_user_id uuid not null unique,
  username text not null,
  display_name text not null,
  status text not null
);
create table public.teams (
  id uuid primary key,
  status text not null,
  amateur_name text,
  internal_name text not null
);
create table public.team_manager_assignments (
  sporting_director_id uuid not null references public.sporting_directors(id),
  team_id uuid not null references public.teams(id),
  role text not null,
  status text not null,
  primary key (sporting_director_id, team_id)
);
create table public.team_seasons (team_id uuid, display_name text, status text, created_at timestamptz);
create table public.alpha_bot_managers (sporting_director_id uuid primary key references public.sporting_directors(id));
create table public.riders (
  id uuid primary key,
  first_name text not null,
  last_name text not null,
  status text not null,
  avatar_profile_key text,
  avatar_seed bigint
);
create table public.rider_contracts (rider_id uuid primary key, team_id uuid not null, status text not null);
create table public.rider_season_ratings (
  rider_id uuid not null,
  season_id uuid not null,
  age smallint not null,
  primary key (rider_id, season_id)
);
create table public.cyclo_stickers_editions (
  collection_season_id uuid primary key references public.seasons(id),
  source_season_id uuid not null references public.seasons(id),
  configuration jsonb not null
);
create table public.cyclo_stickers_boosters (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null references public.sporting_directors(id),
  collection_season_id uuid not null references public.seasons(id),
  acquisition_source text not null,
  source_reference text not null,
  awarded_on date not null,
  opened_at timestamptz,
  unique (sporting_director_id, acquisition_source, source_reference)
);

insert into public.seasons values
  ('50000000-0000-4000-8000-000000000004', 4, 'completed'),
  ('50000000-0000-4000-8000-000000000005', 5, 'active');
insert into public.cyclo_stickers_editions values (
  '50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000004',
  '{"enabled":true,"publicApproved":true}'
);
insert into public.sporting_directors
select ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'ds' || i, 'DS ' || i, 'active'
from generate_series(1, 60) i;
insert into public.teams (id, status, internal_name)
select ('30000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'active', 'Team ' || i
from generate_series(1, 60) i;
insert into public.team_manager_assignments
select director.id, ('30000000-0000-4000-8000-' || right(director.id::text, 12))::uuid,
  'general_manager', 'active'
from public.sporting_directors director;
insert into public.alpha_bot_managers values ('10000000-0000-4000-8000-000000000060');
insert into public.riders values
  ('40000000-0000-4000-8000-000000000001', 'Émile', 'D’Arcy', 'active', 'france', 123456789012345678),
  ('40000000-0000-4000-8000-000000000002', 'Jean Luc', 'Martin', 'active', null, null),
  ('40000000-0000-4000-8000-000000000003', 'Jean', 'Luc Martin', 'active', null, null),
  ('40000000-0000-4000-8000-000000000004', 'Olivier', 'Retraité', 'retired', null, null);
insert into public.rider_contracts
select id, '30000000-0000-4000-8000-000000000001', 'active' from public.riders;
insert into public.rider_season_ratings
select id, '50000000-0000-4000-8000-000000000005', 28 from public.riders;

create function public.quiz_fixture_install_chat_metadata() returns void language plpgsql
as $$
begin
  alter table public.global_chat_messages
    add column source_race_edition_id uuid,
    add column source_stage_id uuid,
    add column image_path text,
    add column gif_attachment jsonb;
end;
$$;

create function public.quiz_fixture_open_round(p_duration interval default interval '30 minutes')
returns uuid language plpgsql
as $$
declare
  v_round uuid := gen_random_uuid();
  v_start timestamptz := clock_timestamp() - interval '1 minute';
begin
  delete from public.global_chat_quiz_events;
  delete from private.global_chat_quiz_rounds;
  insert into private.global_chat_quiz_rounds (
    id, paris_day, starts_at, ends_at, collection_season_id, rider_id, avatar_profile_key,
    avatar_seed, age, answer_name, answer_key, reverse_answer_key, portrait_ready
  ) values (
    v_round, (clock_timestamp() at time zone 'Europe/Paris')::date, v_start, v_start + p_duration,
    '50000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001',
    'france', 123456789012345678, 28, 'Émile D’Arcy', 'emile d''arcy', 'd''arcy emile', true
  );
  perform public.process_global_chat_quiz();
  return v_round;
end;
$$;
