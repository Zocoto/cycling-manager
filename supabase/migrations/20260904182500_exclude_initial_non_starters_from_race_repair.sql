begin;

-- Les coureurs explicitement indisponibles avant la première étape figurent
-- dans la startlist historique mais n'ont jamais pris le départ. Ils ne doivent
-- donc pas faire considérer indéfiniment un classement final comme incomplet.
create or replace function public.get_incomplete_completed_race_edition_ids(
  p_season_id uuid
)
returns table (race_edition_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with expected_rosters as (
    select
      edition.id as race_edition_id,
      race.competition_type,
      roster.id as race_roster_id
    from public.race_editions as edition
    join public.races as race
      on race.id = edition.race_id
    join public.race_registrations as registration
      on registration.race_edition_id = edition.id
     and registration.status = 'accepted'
     and registration.team_season_id is not null
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
    where edition.season_id = p_season_id
      and edition.status = 'completed'
      and (
        roster.status in ('selected', 'confirmed')
        or (
          roster.status = 'withdrawn'
          and exists (
            select 1
            from public.stage_results as outside_time_result
            join public.stages as result_stage
              on result_stage.id = outside_time_result.stage_id
            where outside_time_result.race_roster_id = roster.id
              and outside_time_result.status = 'outside_time_limit'
              and result_stage.race_edition_id = edition.id
          )
        )
      )
      and not exists (
        select 1
        from public.stages as first_stage
        join public.official_stage_simulations as simulation
          on simulation.stage_id = first_stage.id
        where first_stage.race_edition_id = edition.id
          and first_stage.stage_number = 1
          and coalesce(
            simulation.input_data -> 'unavailableRiderIds',
            '[]'::jsonb
          ) ? roster.rider_id::text
      )
  ), eligible_editions as (
    select expected.race_edition_id
    from expected_rosters as expected
    group by expected.race_edition_id, expected.competition_type
    having count(*) >= case
      when expected.competition_type = 'standard' then 2
      else 1
    end
  )
  select distinct expected.race_edition_id
  from expected_rosters as expected
  join eligible_editions as eligible
    on eligible.race_edition_id = expected.race_edition_id
  left join public.race_results as result
    on result.race_edition_id = expected.race_edition_id
   and result.race_roster_id = expected.race_roster_id
  where result.id is null
  order by expected.race_edition_id;
$$;

revoke all
on function public.get_incomplete_completed_race_edition_ids(uuid)
from public, anon, authenticated;

grant execute
on function public.get_incomplete_completed_race_edition_ids(uuid)
to service_role;

comment on function public.get_incomplete_completed_race_edition_ids(uuid)
is 'Liste les éditions clôturées réellement incomplètes, hors non-partants initiaux verrouillés.';

commit;
