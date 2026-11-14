begin;

update public.newcomer_journey_step_definitions
set title = 'Regarder un live ou un replay',
    description = 'Suivez une course en direct ou lancez le replay d’une course terminée.',
    href = '/jeu/resultats?filtre=spectateur'
where step_key = 'follow_race_live';

create or replace function public.record_current_newcomer_replay_visit(
  p_stage_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_journey_id uuid;
begin
  if v_user_id is null then
    return false;
  end if;

  select step.journey_id
  into v_journey_id
  from public.sporting_directors as director
  join public.newcomer_journeys as journey
    on journey.sporting_director_id = director.id
  join public.newcomer_journey_steps as step
    on step.journey_id = journey.id
    and step.step_key = 'follow_race_live'
  where director.auth_user_id = v_user_id
    and director.status = 'active'
    and journey.completed_at is null
    and step.completed_at is null;

  if v_journey_id is null then
    return false;
  end if;

  -- A locked simulation may already exist before the race starts. The replay
  -- also needs official results and a stage that has finished.
  if not exists (
    select 1
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.season_days as season_day
      on season_day.id = stage.season_day_id
    join public.official_stage_simulations as simulation
      on simulation.stage_id = stage.id
      and simulation.race_edition_id = edition.id
    where stage.id = p_stage_id
      and stage.status <> 'cancelled'
      and edition.status <> 'cancelled'
      and coalesce(
        stage.departure_at,
        (season_day.calendar_date + case stage.day_slot
          when 'early' then time '14:00'
          else time '18:00'
        end) at time zone 'Europe/Paris'
      ) <= now()
      and (
        stage.status = 'completed'
        or (
          stage.departure_at + make_interval(
            mins => greatest(8, least(48, round(stage.distance_km / 6)::integer))
          ) <= now()
        )
      )
      and exists (
        select 1
        from public.stage_results as result
        where result.stage_id = stage.id
      )
  ) then
    return false;
  end if;

  update public.newcomer_journey_steps
  set completed_at = now()
  where journey_id = v_journey_id
    and step_key = 'follow_race_live'
    and completed_at is null;

  return found;
end;
$$;

revoke all on function public.record_current_newcomer_replay_visit(uuid)
  from public, anon;
grant execute on function public.record_current_newcomer_replay_visit(uuid)
  to authenticated;

commit;
