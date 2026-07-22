begin;

create or replace function public.get_active_calendar_engaged_riders()
returns table (
  race_edition_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_id uuid,
  team_name text,
  team_primary_color text,
  team_secondary_color text,
  age integer,
  form integer,
  race_role text,
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
  prologue integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    rider.id,
    rider.first_name,
    rider.last_name,
    team.id,
    team_season.display_name,
    coalesce(team.amateur_jersey_primary_color, '#176951'),
    coalesce(team.amateur_jersey_secondary_color, '#FFFDF4'),
    coalesce(rating.age, 25)::integer,
    coalesce(condition.form, 75)::integer,
    roster.race_role,
    coalesce(rating.mountain, 50)::integer,
    coalesce(rating.hills, 50)::integer,
    coalesce(rating.flat, 50)::integer,
    coalesce(rating.time_trial, 50)::integer,
    coalesce(rating.cobbles, 50)::integer,
    coalesce(rating.sprint, 50)::integer,
    coalesce(rating.acceleration, 50)::integer,
    coalesce(rating.downhill, 50)::integer,
    coalesce(rating.endurance, 50)::integer,
    coalesce(rating.resistance, 50)::integer,
    coalesce(rating.recovery, 50)::integer,
    coalesce(rating.breakaway, 50)::integer,
    coalesce(rating.prologue, 50)::integer
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.teams as team
    on team.id = team_season.team_id
  join public.riders as rider
    on rider.id = roster.rider_id
  left join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = edition.season_id
  left join lateral (
    select state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
     and condition_day.season_id = edition.season_id
    where state.rider_id = rider.id
      and condition_day.day_number <= coalesce(season.current_day_number, 28)
    order by condition_day.day_number desc
    limit 1
  ) as condition on true
  where edition.status <> 'cancelled'
  order by
    edition.id,
    team_season.display_name,
    roster.bib_number nulls last,
    rider.last_name,
    rider.first_name;
$$;

comment on function public.get_active_calendar_engaged_riders() is
  'Startlists officielles de la saison active : uniquement les inscriptions acceptees et leurs coureurs selectionnes ou confirmes.';

revoke all
on function public.get_active_calendar_engaged_riders()
from public, anon;

grant execute
on function public.get_active_calendar_engaged_riders()
to authenticated;

-- Rattrapage ponctuel demandé pour tester immédiatement le GP de Bretagne.
-- Les inscriptions et les rosters sont volontairement laissés intacts.
do $$
declare
  target_edition_id uuid;
  accepted_team_count integer;
  selected_rider_count integer;
begin
  select edition.id
  into target_edition_id
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  where race.slug = 'grand-prix-de-bretagne'
  limit 1;

  if target_edition_id is null then
    raise exception 'Edition active du Grand Prix de Bretagne introuvable.';
  end if;

  select
    count(distinct registration.id)::integer,
    count(roster.id)::integer
  into accepted_team_count, selected_rider_count
  from public.race_registrations as registration
  left join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where registration.race_edition_id = target_edition_id
    and registration.status = 'accepted';

  if accepted_team_count = 0 or selected_rider_count = 0 then
    raise exception 'Le GP de Bretagne ne peut pas être relancé sans inscription acceptée et sans coureur sélectionné.';
  end if;

  update public.race_editions
  set status = 'in_progress'
  where id = target_edition_id;

  update public.stages
  set
    status = 'in_progress',
    departure_at = now()
  where race_edition_id = target_edition_id;

  raise notice 'GP de Bretagne relancé avec % équipes et % coureurs.',
    accepted_team_count,
    selected_rider_count;
end;
$$;

commit;
