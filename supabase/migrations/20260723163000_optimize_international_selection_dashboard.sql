begin;
-- The dashboard only needs a compact projection of the current director's
-- international selections. Keeping the joins in PostgreSQL avoids several
-- sequential network round-trips on every page render.
create or replace function public.get_international_championship_selections_for_auth_user(
  p_auth_user_id uuid
)
returns table (
  candidate_id uuid,
  rider_id uuid,
  rider_name text,
  rider_rank integer,
  uci_points integer,
  overall_rating numeric,
  response_status text,
  is_selected boolean,
  was_selected boolean,
  responded_at timestamptz,
  country_name text,
  country_code text,
  nation_rank integer,
  continent_code text,
  championship_name text,
  championship_slug text,
  competition_type text,
  race_edition_id uuid,
  day_number integer,
  departure_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate.id as candidate_id,
    candidate.rider_id,
    concat_ws(' ', rider.first_name, rider.last_name) as rider_name,
    candidate.rider_rank,
    candidate.uci_points,
    candidate.overall_rating,
    candidate.response_status,
    candidate.is_selected,
    candidate.selected_at is not null as was_selected,
    candidate.responded_at,
    country.name as country_name,
    country.iso_alpha2 as country_code,
    selection.nation_rank::integer,
    selection.continent_code,
    edition.display_name as championship_name,
    race.slug as championship_slug,
    race.competition_type,
    edition.id as race_edition_id,
    first_stage.day_number,
    first_stage.departure_at
  from public.sporting_directors as director
  join public.international_championship_rider_selections as candidate
    on candidate.sporting_director_id = director.id
  join public.international_championship_nation_selections as selection
    on selection.id = candidate.nation_selection_id
  join public.riders as rider
    on rider.id = candidate.rider_id
  join public.countries as country
    on country.id = selection.country_id
  join public.race_editions as edition
    on edition.id = selection.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in (
     'continental_championship',
     'world_championship'
   )
  join lateral (
    select
      day.day_number::integer as day_number,
      stage.departure_at
    from public.stages as stage
    join public.season_days as day
      on day.id = stage.season_day_id
    where stage.race_edition_id = edition.id
      and stage.departure_at is not null
    order by stage.departure_at, stage.stage_number
    limit 1
  ) as first_stage on true
  where director.auth_user_id = p_auth_user_id
    and director.status = 'active'
    and (
      candidate.is_selected
      or candidate.selected_at is not null
      or candidate.response_status in (
        'confirmed',
        'automatic',
        'declined'
      )
    )
  order by
    first_stage.departure_at,
    candidate.rider_rank,
    rider.last_name,
    rider.first_name;
$$;
revoke all
on function public.get_international_championship_selections_for_auth_user(uuid)
from public, anon, authenticated;
grant execute
on function public.get_international_championship_selections_for_auth_user(uuid)
to service_role;
-- The roster page used to fetch rider potential in a second request after the
-- base roster had loaded. This wrapper keeps the existing public contract
-- intact for other screens while exposing the extra field in one round-trip.
create or replace function public.get_current_team_roster_with_potential()
returns table (
  rider_id uuid,
  first_name text,
  last_name text,
  country_id uuid,
  country_name text,
  country_iso_alpha2 text,
  avatar_profile_key text,
  avatar_seed bigint,
  age integer,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer,
  salary_per_season numeric,
  contract_currency text,
  contract_end_season_id uuid,
  contract_end_season_name text,
  potential_steps integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    roster.rider_id,
    roster.first_name,
    roster.last_name,
    roster.country_id,
    roster.country_name,
    roster.country_iso_alpha2,
    roster.avatar_profile_key,
    roster.avatar_seed,
    roster.age,
    roster.mountain,
    roster.hills,
    roster.flat,
    roster.time_trial,
    roster.cobbles,
    roster.sprint,
    roster.acceleration,
    roster.downhill,
    roster.endurance,
    roster.resistance,
    roster.recovery,
    roster.breakaway,
    roster.prologue,
    roster.salary_per_season,
    roster.contract_currency,
    roster.contract_end_season_id,
    roster.contract_end_season_name,
    rider.potential_steps::integer
  from public.get_current_team_roster() as roster
  join public.riders as rider
    on rider.id = roster.rider_id
  order by roster.last_name, roster.first_name;
$$;
revoke all
on function public.get_current_team_roster_with_potential()
from public, anon;
grant execute
on function public.get_current_team_roster_with_potential()
to authenticated;
notify pgrst, 'reload schema';
commit;
