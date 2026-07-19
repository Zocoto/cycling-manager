-- ============================================================
-- CYCLING MANAGER
-- Portraits dans la sélection d'effectif d'une course
-- ============================================================

begin;

drop function if exists public.get_current_team_race_roster_options(uuid);

create function public.get_current_team_race_roster_options(
  p_race_edition_id uuid
)
returns table (
  rider_id uuid,
  first_name text,
  last_name text,
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
  is_selected boolean,
  is_available boolean,
  conflicting_race_slug text,
  conflicting_race_name text,
  conflicting_start_day integer,
  conflicting_end_day integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_context as (
    select
      assignment.team_id,
      edition.season_id,
      season.game_year,
      registration.id as registration_id
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.race_editions as edition
      on edition.id = p_race_edition_id
    join public.seasons as season
      on season.id = edition.season_id
    left join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
     and team_season.season_id = edition.season_id
    left join public.race_registrations as registration
      on registration.team_season_id = team_season.id
     and registration.race_edition_id = edition.id
    where director.auth_user_id = auth.uid()
    limit 1
  )
  select
    rider.id,
    rider.first_name,
    rider.last_name,
    country.name,
    country.iso_alpha2,
    rider.avatar_profile_key,
    rider.avatar_seed,
    rating.age::integer,
    rating.mountain::integer,
    rating.hills::integer,
    rating.flat::integer,
    rating.time_trial::integer,
    rating.cobbles::integer,
    rating.sprint::integer,
    coalesce(current_roster.status in ('selected', 'confirmed'), false),
    conflict.race_slug is null,
    conflict.race_slug,
    conflict.race_name,
    conflict.start_day,
    conflict.end_day
  from current_context as context
  join public.rider_contracts as contract
    on contract.team_id = context.team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
   and start_season.game_year <= context.game_year
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= context.game_year
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.status = 'active'
  join public.countries as country
    on country.id = rider.country_id
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = context.season_id
  left join public.race_rosters as current_roster
    on current_roster.race_registration_id = context.registration_id
   and current_roster.rider_id = rider.id
  left join lateral (
    select
      race.slug as race_slug,
      other_edition.display_name as race_name,
      min(other_day.day_number)::integer as start_day,
      max(other_day.day_number)::integer as end_day
    from public.race_rosters as other_roster
    join public.race_registrations as other_registration
      on other_registration.id = other_roster.race_registration_id
     and other_registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = other_registration.race_edition_id
     and other_edition.season_id = context.season_id
     and other_edition.id <> p_race_edition_id
    join public.races as race
      on race.id = other_edition.race_id
    join public.stages as other_stage
      on other_stage.race_edition_id = other_edition.id
    join public.season_days as other_day
      on other_day.id = other_stage.season_day_id
    where other_roster.rider_id = rider.id
      and other_roster.status in ('selected', 'confirmed')
      and exists (
        select 1
        from public.stages as target_stage
        where target_stage.race_edition_id = p_race_edition_id
          and target_stage.season_day_id = other_stage.season_day_id
      )
    group by race.slug, other_edition.display_name
    order by min(other_day.day_number)
    limit 1
  ) as conflict on true
  order by rider.last_name, rider.first_name;
$$;

revoke all
on function public.get_current_team_race_roster_options(uuid)
from public, anon;

grant execute
on function public.get_current_team_race_roster_options(uuid)
to authenticated;

comment on function public.get_current_team_race_roster_options(uuid) is
  'Retourne les coureurs disponibles pour une course avec leur identité de portrait permanente.';

commit;
