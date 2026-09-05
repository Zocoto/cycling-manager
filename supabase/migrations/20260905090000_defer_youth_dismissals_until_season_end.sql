begin;

alter table public.youth_academy_riders
  drop constraint if exists youth_academy_riders_status_allowed;

alter table public.youth_academy_riders
  add constraint youth_academy_riders_status_allowed check (
    status in (
      'active',
      'recruited',
      'release_pending',
      'promoted',
      'free_agent',
      'released'
    )
  );

-- A dismissal now stops the academy relationship immediately without creating
-- a professional free agent before the next season starts.
create or replace function public.dismiss_current_team_youth_rider(
  p_academy_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_academy public.youth_academy_riders%rowtype;
  v_development_team_id uuid;
  v_withdrawn_registration_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Vous devez être authentifié.';
  end if;

  if p_academy_rider_id is null then
    raise exception 'Le junior est obligatoire.';
  end if;

  perform public.settle_current_team_finances();

  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1) as day_number,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select academy.*
  into v_academy
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id
    and academy.team_id = v_context.team_id
  for update;

  if v_academy.id is null
    or v_academy.status not in ('active', 'recruited') then
    raise exception 'Ce junior ne fait plus partie de votre école de cyclisme.';
  end if;

  select development_team.id
  into v_development_team_id
  from public.development_teams as development_team
  where development_team.team_id = v_context.team_id
    and development_team.season_id = v_context.season_id
    and development_team.status = 'active'
  limit 1
  for update;

  if v_development_team_id is not null and exists (
    select 1
    from public.development_race_registration_riders as selected
    join public.development_race_registrations as registration
      on registration.id = selected.registration_id
    join public.development_race_editions as edition
      on edition.id = registration.race_edition_id
    where registration.development_team_id = v_development_team_id
      and registration.status = 'registered'
      and selected.academy_rider_id = v_academy.id
      and edition.start_day_number <= v_context.day_number
  ) then
    raise exception
      'Ce junior est engagé dans une épreuve déjà commencée. Son départ sera programmable après la publication des résultats.';
  end if;

  update public.youth_academy_training_attempts
  set status = 'expired'
  where academy_rider_id = v_academy.id
    and status = 'started';

  update public.youth_academy_riders
  set
    status = 'release_pending',
    promotion_game_year = null,
    promoted_rider_id = null,
    pending_training_mode = null,
    pending_training_mode_after_season_id = null,
    pending_training_mode_after_day_number = null,
    updated_at = now()
  where id = v_academy.id;

  -- Already-posted tuition remains paid. Every future installment for the
  -- current season is cancelled, so the DS owes nothing after the decision.
  update public.team_finance_transactions as transaction
  set status = 'cancelled'
  where transaction.team_season_id = v_context.team_season_id
    and transaction.status = 'pending'
    and transaction.source_reference like
      'youth-tuition:' || v_academy.id::text || ':' || v_context.season_id::text || ':%';

  if v_development_team_id is not null then
    delete from public.development_race_registration_riders as selected
    using public.development_race_registrations as registration
    where selected.registration_id = registration.id
      and registration.development_team_id = v_development_team_id
      and registration.status = 'registered'
      and selected.academy_rider_id = v_academy.id;

    with invalid_registrations as (
      select registration.id
      from public.development_race_registrations as registration
      join public.development_race_editions as edition
        on edition.id = registration.race_edition_id
      where registration.development_team_id = v_development_team_id
        and registration.status = 'registered'
        and (
          select count(*)
          from public.development_race_registration_riders as selected
          where selected.registration_id = registration.id
        ) < edition.selection_minimum
    ),
    withdrawn as (
      update public.development_race_registrations as registration
      set status = 'withdrawn', updated_at = now()
      where registration.id in (
        select invalid_registration.id
        from invalid_registrations as invalid_registration
      )
      returning registration.id
    ),
    cleared_selections as (
      delete from public.development_race_registration_riders as selected
      where selected.registration_id in (
        select withdrawn_registration.id
        from withdrawn as withdrawn_registration
      )
    )
    select count(*)::integer
    into v_withdrawn_registration_count
    from withdrawn;

    delete from public.development_team_roster
    where development_team_id = v_development_team_id
      and academy_rider_id = v_academy.id;
  end if;

  return jsonb_build_object(
    'academyRiderId', v_academy.id,
    'riderId', null,
    'riderName', concat_ws(' ', v_academy.first_name, v_academy.last_name),
    'releaseScheduled', true,
    'releaseGameYear', v_context.game_year + 1,
    'freeAgent', false,
    'tuitionCost', 0,
    'withdrawnRegistrationCount', v_withdrawn_registration_count
  );
end;
$$;

comment on function public.dismiss_current_team_youth_rider(uuid) is
  'Programme gratuitement le départ d’un junior à la fin de la saison, interrompt sa formation et annule ses frais futurs.';

revoke all on function public.dismiss_current_team_youth_rider(uuid)
from public, anon;
grant execute on function public.dismiss_current_team_youth_rider(uuid)
to authenticated;

-- The current rollover implementation already turns every non-promoted due
-- academy rider into a free agent. Add scheduled departures to both due sets so
-- the professional rider is created only in the target season.
do $rollover_migration$
declare
  v_definition text;
  v_marker constant text :=
    'and v_target.game_year - academy.birth_game_year > 18)';
  v_replacement constant text :=
    'and v_target.game_year - academy.birth_game_year > 18)' || E'\n    or academy.status = ''release_pending''';
  v_occurrences integer;
begin
  select pg_get_functiondef(
    'public.rollover_game_season(uuid,boolean)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);

  if v_occurrences <> 2 then
    raise exception
      'Le traitement des départs juniors à J1 est introuvable ou ambigu (% occurrences).',
      v_occurrences;
  end if;

  execute replace(v_definition, v_marker, v_replacement);
end;
$rollover_migration$;

comment on function public.rollover_game_season(uuid, boolean) is
  'Clôture atomiquement une saison et ouvre la suivante. À J1, les promotions sont arbitrées et les départs juniors programmés deviennent agents libres.';

-- Rewards must track immutable player actions. A dismissed academy row is not
-- a signing, and only an academy row actually promoted to the pro team is a
-- promotion.
do $objective_migration$
declare
  v_definition text;
  v_old_signings constant text := $old$
    when 'youth_academy_signings' then
      select count(*)::integer into v_value
      from public.youth_academy_riders as youth
      where exists (
        select 1 from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = youth.team_id
      );
$old$;
  v_new_signings constant text := $new$
    when 'youth_academy_signings' then
      select count(*)::integer into v_value
      from public.youth_scouting_candidates as candidate
      join public.youth_scouting_missions as mission
        on mission.id = candidate.mission_id
      where candidate.status = 'signed'
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = mission.team_id
        );
$new$;
  v_old_promotions constant text :=
    '      where youth.promoted_rider_id is not null' || E'\n        and exists (';
  v_new_promotions constant text :=
    '      where youth.status = ''promoted''' || E'\n        and youth.promoted_rider_id is not null\n        and exists (';
begin
  select pg_get_functiondef(
    'public.calculate_expanded_game_objective_progress(text,uuid)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position(v_old_signings in v_definition) = 0 then
    raise exception 'Le calcul des signatures juniors est introuvable.';
  end if;
  v_definition := replace(v_definition, v_old_signings, v_new_signings);

  if position(v_old_promotions in v_definition) = 0 then
    raise exception 'Le calcul des promotions juniors est introuvable.';
  end if;
  v_definition := replace(v_definition, v_old_promotions, v_new_promotions);

  execute v_definition;
end;
$objective_migration$;

notify pgrst, 'reload schema';

commit;
