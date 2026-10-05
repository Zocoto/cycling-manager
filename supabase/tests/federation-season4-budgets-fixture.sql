-- Minimal dependency fixtures for the in-memory PostgreSQL runner ONLY.
-- Never send this file to a Supabase project.
create role anon;
create role authenticated;
create role service_role;
create table public.seasons (id uuid primary key default gen_random_uuid(), game_year integer unique, status text);
create table public.countries (id uuid primary key default gen_random_uuid(), iso_alpha2 text, is_active boolean default true);
create table public.teams (id uuid primary key default gen_random_uuid(), status text default 'active');
create table public.sporting_directors (id uuid primary key default gen_random_uuid(), status text default 'active');
create table public.team_manager_assignments (team_id uuid, sporting_director_id uuid, role text default 'general_manager', status text default 'active');
create table public.team_seasons (team_id uuid, season_id uuid, registration_country_id uuid, status text default 'active');
create table public.races (id uuid primary key default gen_random_uuid(), country_id uuid, status text default 'active');
create table public.race_editions (id uuid primary key default gen_random_uuid(), race_id uuid, season_id uuid);
create table public.stages (id uuid primary key default gen_random_uuid(), race_edition_id uuid, status text);
create table public.race_registrations (id uuid primary key default gen_random_uuid(), race_edition_id uuid, status text);
create table public.race_rosters (id uuid primary key default gen_random_uuid(), race_registration_id uuid, status text);
create table public.national_federation_accounts (
  id uuid primary key default gen_random_uuid(), country_id uuid, season_id uuid,
  opening_balance numeric not null, balance numeric not null, source_game_year integer,
  uci_rank integer, nations_cup_division integer,
  objective_level text default 'none', objective_completed_count integer default 0,
  objective_bonus numeric default 0, updated_at timestamptz default now(),
  unique(country_id, season_id)
);
create table public.national_federation_transactions (
  id uuid primary key default gen_random_uuid(), account_id uuid, day_number integer,
  amount numeric, category text, description text, source_reference text unique, metadata jsonb
);
create table public.national_federation_journal_entries (
  country_id uuid, season_id uuid, day_number integer, category text, title text,
  detail text, source_reference text unique
);
create table public.test_country_scores (country_id uuid, season_id uuid, uci_points bigint, objectives integer);
create table public.national_federation_nations_cup_assignments (country_id uuid, season_id uuid, division integer, unique(country_id, season_id));
create function public.seed_nations_cup_assignments_for_season(p_season_id uuid)
returns integer language plpgsql as $$
begin
  insert into public.national_federation_nations_cup_assignments (country_id, season_id, division)
  select country.id, p_season_id,
    -- T25 has retained a D1 place even though its UCI rank is outside the top 20.
    case when substring(country.iso_alpha2 from 2)::integer <= 20 or country.iso_alpha2 = 'T25' then 1 else 2 end
  from public.countries country on conflict (country_id, season_id) do nothing;
  return 25;
end;
$$;
create function public.get_national_championship_country_rankings(p_season_id uuid)
returns table(country_id uuid, uci_points bigint) language sql as $$
  select score.country_id, score.uci_points from public.test_country_scores score where score.season_id = p_season_id;
$$;
create function public.get_national_federation_race_creation_score(p_country_id uuid, p_season_id uuid)
returns jsonb language sql as $$
  select jsonb_build_object('completedObjectiveCount', coalesce((select score.objectives from public.test_country_scores score where score.country_id = p_country_id and score.season_id = p_season_id), 0));
$$;
insert into public.seasons (game_year, status) values (2, 'completed'), (3, 'active'), (4, 'planned');
insert into public.countries (iso_alpha2) select 'T' || n from generate_series(1, 25) n;
insert into public.teams (id) select id from public.countries;
insert into public.sporting_directors (id) select id from public.countries;
insert into public.team_manager_assignments (team_id, sporting_director_id) select id, id from public.countries;
insert into public.team_seasons (team_id, season_id, registration_country_id)
select country.id, season.id, country.id from public.countries country cross join public.seasons season where season.game_year >= 3;
insert into public.test_country_scores (country_id, season_id, uci_points, objectives)
select country.id, season.id, 1000 - substring(country.iso_alpha2 from 2)::integer,
  case substring(country.iso_alpha2 from 2)::integer when 1 then 5 when 2 then 3 when 3 then 1 else 0 end
from public.countries country cross join public.seasons season where season.game_year in (2, 3);
