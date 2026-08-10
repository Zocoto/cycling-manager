begin;

drop function public.get_current_team_race_preparation();

create function public.get_current_team_race_preparation()
returns table (
  race_edition_id uuid,
  race_registration_id uuid,
  team_id uuid,
  stage_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
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
  general_role text,
  stage_role text,
  objective text,
  collective_posture text,
  breakaway_policy text,
  chase_policy text,
  lieutenant_rider_id uuid,
  danger_pacer_rider_id uuid,
  protector_rider_id uuid,
  breakaway_rider_id uuid,
  attack_orders jsonb,
  strategy_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    registration.id,
    team_season.team_id,
    stage.id,
    roster.rider_id,
    rider.first_name,
    rider.last_name,
    rating.mountain::integer,
    rating.hills::integer,
    rating.flat::integer,
    rating.time_trial::integer,
    rating.cobbles::integer,
    rating.sprint::integer,
    rating.acceleration::integer,
    rating.downhill::integer,
    rating.endurance::integer,
    rating.resistance::integer,
    rating.recovery::integer,
    rating.breakaway::integer,
    rating.prologue::integer,
    roster.race_role,
    stage_role.race_role,
    coalesce(strategy.objective, 'balanced'),
    coalesce(strategy.collective_posture, 'balanced'),
    coalesce(strategy.breakaway_policy, 'opportunistic'),
    coalesce(strategy.chase_policy, 'dangerous_breakaway'),
    strategy.lieutenant_rider_id,
    strategy.danger_pacer_rider_id,
    strategy.protector_rider_id,
    strategy.breakaway_rider_id,
    coalesce(strategy.attack_orders, '[]'::jsonb),
    strategy.updated_at
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
  join public.seasons as season
    on season.id = team_season.season_id
   and season.status = 'active'
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.status = 'accepted'
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = season.id
   and edition.status <> 'cancelled'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.rider_season_ratings as rating
    on rating.rider_id = roster.rider_id
   and rating.season_id = season.id
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.status <> 'cancelled'
  left join public.race_roster_stage_roles as stage_role
    on stage_role.race_registration_id = registration.id
   and stage_role.rider_id = roster.rider_id
   and stage_role.stage_id = stage.id
  left join public.race_stage_strategies as strategy
    on strategy.race_registration_id = registration.id
   and strategy.stage_id = stage.id
  where director.auth_user_id = auth.uid()
  order by stage.departure_at nulls last, stage.stage_number,
    roster.bib_number nulls last, roster.rider_id;
$$;

revoke all on function public.get_current_team_race_preparation()
from public, anon;

grant execute on function public.get_current_team_race_preparation()
to authenticated, service_role;

comment on function public.get_current_team_race_preparation() is
  'Expose les plans et les notes saisonnières des coureurs engagés.';

create function public.reject_time_trial_race_preparation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage_type text;
begin
  select stage.stage_type
  into v_stage_type
  from public.stages as stage
  where stage.id = new.stage_id;

  if v_stage_type in (
    'individual_time_trial',
    'team_time_trial',
    'prologue'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Chrono : pas de planification de course.';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_time_trial_race_preparation()
from public, anon, authenticated;

create trigger race_stage_strategies_reject_time_trial
before insert or update
on public.race_stage_strategies
for each row
execute function public.reject_time_trial_race_preparation();

create trigger race_roster_stage_roles_reject_time_trial
before insert or update
on public.race_roster_stage_roles
for each row
execute function public.reject_time_trial_race_preparation();

comment on function public.reject_time_trial_race_preparation() is
  'Bloque toute planification route sur un chrono individuel, par équipes ou un prologue.';

notify pgrst, 'reload schema';

commit;
