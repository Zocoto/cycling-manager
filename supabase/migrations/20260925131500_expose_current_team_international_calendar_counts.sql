begin;

-- Le calendrier affiche déjà le nombre de coureurs engagés par l'équipe du
-- DS sur les courses de clubs. Cette vue authentifiée fournit l'équivalent
-- pour les start-lists fédérales, sans exposer les compositions privées d'une
-- autre équipe.
create or replace function public.get_current_team_international_calendar_counts()
returns table (
  race_edition_id uuid,
  rider_category text,
  engaged_rider_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with managed_team as (
    select assignment.team_id
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    where director.auth_user_id = auth.uid()
    limit 1
  ), professional_counts as (
    select
      edition.id as race_edition_id,
      'professional'::text as rider_category,
      count(distinct roster.rider_id)::integer as engaged_rider_count
    from managed_team
    join public.rider_contracts as contract
      on contract.team_id = managed_team.team_id
     and contract.status = 'active'
    join public.race_rosters as roster
      on roster.rider_id = contract.rider_id
     and roster.status in ('selected', 'confirmed')
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
     and edition.status <> 'cancelled'
    join public.seasons as season
      on season.id = edition.season_id
     and season.status = 'active'
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type in (
       'world_championship',
       'continental_championship',
       'nations_cup'
     )
    group by edition.id
  ), junior_counts as (
    select
      edition.id as race_edition_id,
      'junior'::text as rider_category,
      count(distinct selected.academy_rider_id)::integer
        as engaged_rider_count
    from managed_team
    join public.youth_academy_riders as academy
      on academy.team_id = managed_team.team_id
    join public.national_federation_junior_race_registration_riders
      as selected
      on selected.academy_rider_id = academy.id
    join public.national_federation_junior_race_registrations as registration
      on registration.id = selected.registration_id
     and registration.status in ('registered', 'completed')
    join public.development_race_editions as edition
      on edition.id = registration.race_edition_id
     and edition.status <> 'cancelled'
     and edition.competition_type in (
       'continental_road',
       'continental_time_trial',
       'world_road',
       'world_time_trial',
       'nations_cup_junior'
     )
    join public.seasons as season
      on season.id = edition.season_id
     and season.status = 'active'
    group by edition.id
  )
  select * from professional_counts
  union all
  select * from junior_counts;
$$;

revoke all
on function public.get_current_team_international_calendar_counts()
from public, anon;

grant execute
on function public.get_current_team_international_calendar_counts()
to authenticated, service_role;

comment on function public.get_current_team_international_calendar_counts()
is 'Compte, par épreuve internationale de la saison active, les coureurs pros et juniors appartenant à l''équipe du DS connecté.';

commit;
