-- Sources for the Season 5 distinctions in the isolated PostgreSQL fixture.
alter table stage_results add column stage_id uuid, add column status text;
alter table rider_season_ratings
  add column mountain integer, add column hills integer, add column flat integer,
  add column time_trial integer, add column cobbles integer, add column sprint integer;
alter table rider_contracts add column acquisition_type text, add column transfer_fee numeric;
alter table cyclogazette_editions
  add column published_at timestamptz, add column content jsonb, add column season_day_id uuid;
alter table team_seasons add column cash_balance numeric not null default 0;
alter table sporting_directors add column auth_user_id uuid, add column status text;

create table rider_training_stat_progress (
  season_id uuid, rider_id uuid, stat_code text, initial_rating integer
);
create table media_center_articles (
  id uuid primary key, title text, published_edition_id uuid, sporting_director_id uuid,
  team_id uuid, team_name text, status text
);

-- A session-local identity for exercise of authenticated RPCs.
create function private.current_sporting_director_id()
returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('test.director_id', true), '')::uuid $$;

create schema auth;
create function auth.uid()
returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;

create table season_days (id uuid primary key, season_id uuid, day_number integer);
create table team_finance_transactions (
  team_season_id uuid, season_day_id uuid, day_number integer, amount numeric,
  category text, status text, description text, source_reference text, posted_at timestamptz
);
