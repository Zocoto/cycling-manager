begin;

-- Un abandon (ou toute autre indisponibilité sportive définitive pour le tour)
-- ne modifie pas la start-list historique. La préparation doit donc s'appuyer
-- sur le registre immuable des indisponibilités, comme la simulation officielle.
create index if not exists stage_rider_unavailabilities_edition_rider_idx
  on public.stage_rider_unavailabilities (race_edition_id, rider_id);

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_match_count integer;
  v_roster_filter constant text :=
    'and roster.status in (''selected'', ''confirmed'')';
  v_save_roster_filter constant text :=
    'and roster.status in (''selected'', ''confirmed'')' || chr(10) ||
    '    and not exists (' || chr(10) ||
    '      select 1' || chr(10) ||
    '      from public.stage_rider_unavailabilities as unavailable' || chr(10) ||
    '      where unavailable.race_edition_id = p_race_edition_id' || chr(10) ||
    '        and unavailable.rider_id = roster.rider_id' || chr(10) ||
    '    )';
  v_unqualified_roster_filter constant text :=
    'and status in (''selected'', ''confirmed'')';
  v_available_unqualified_roster_filter constant text :=
    'and status in (''selected'', ''confirmed'')' || chr(10) ||
    '        and not exists (' || chr(10) ||
    '          select 1' || chr(10) ||
    '          from public.stage_rider_unavailabilities as unavailable' || chr(10) ||
    '          where unavailable.race_edition_id = p_race_edition_id' || chr(10) ||
    '            and unavailable.rider_id = race_rosters.rider_id' || chr(10) ||
    '        )';
begin
  v_signature :=
    'public.get_current_team_race_preparation()'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;

  if position('stage_rider_unavailabilities' in v_definition) = 0 then
    v_match_count := (
      length(v_definition) - length(replace(v_definition, v_roster_filter, ''))
    ) / length(v_roster_filter);
    if v_match_count <> 1 then
      raise exception
        'La fonction get_current_team_race_preparation a % filtres roster au lieu de 1.',
        v_match_count;
    end if;
    v_patched_definition := replace(
      v_definition,
      v_roster_filter,
      v_roster_filter || chr(10) ||
        '   and not exists (' || chr(10) ||
        '     select 1' || chr(10) ||
        '     from public.stage_rider_unavailabilities as unavailable' || chr(10) ||
        '     where unavailable.race_edition_id = edition.id' || chr(10) ||
        '       and unavailable.rider_id = roster.rider_id' || chr(10) ||
        '   )'
    );
    if v_patched_definition = v_definition then
      raise exception
        'La fonction get_current_team_race_preparation a une définition inattendue.';
    end if;
    execute v_patched_definition;
  end if;

  v_signature :=
    'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;

  if position('stage_rider_unavailabilities' in v_definition) = 0 then
    v_match_count := (
      length(v_definition) - length(replace(v_definition, v_roster_filter, ''))
    ) / length(v_roster_filter);
    if v_match_count <> 4 then
      raise exception
        'La fonction save_current_team_race_preparation a % filtres roster au lieu de 4.',
        v_match_count;
    end if;
    v_patched_definition := replace(
      v_definition,
      v_roster_filter,
      v_save_roster_filter
    );
    if v_patched_definition = v_definition then
      raise exception
        'La fonction save_current_team_race_preparation a une définition inattendue.';
    end if;
    execute v_patched_definition;
  end if;

  v_signature :=
    'public.save_current_team_time_trial_preparation(uuid,uuid,jsonb)'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;

  if position('stage_rider_unavailabilities' in v_definition) = 0 then
    v_match_count := (
      length(v_definition) - length(replace(v_definition, v_roster_filter, ''))
    ) / length(v_roster_filter);
    if v_match_count <> 2 then
      raise exception
        'La fonction save_current_team_time_trial_preparation a % filtres roster au lieu de 2.',
        v_match_count;
    end if;
    v_patched_definition := replace(
      v_definition,
      v_roster_filter,
      v_save_roster_filter
    );
    if v_patched_definition = v_definition then
      raise exception
        'La fonction save_current_team_time_trial_preparation a une définition inattendue.';
    end if;
    execute v_patched_definition;
  end if;

  v_signature :=
    'public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;

  if position('stage_rider_unavailabilities' in v_definition) = 0 then
    v_match_count := (
      length(v_definition) - length(replace(v_definition, v_roster_filter, ''))
    ) / length(v_roster_filter);
    if v_match_count <> 2 then
      raise exception
        'La fonction save_current_team_race_equipment_plan a une définition roster inattendue (% filtres qualifiés).',
        v_match_count;
    end if;
    v_match_count := (
      length(v_definition) - length(
        replace(v_definition, v_unqualified_roster_filter, '')
      )
    ) / length(v_unqualified_roster_filter);
    if v_match_count <> 1 then
      raise exception
        'La fonction save_current_team_race_equipment_plan a % filtre roster non qualifié au lieu de 1.',
        v_match_count;
    end if;
    v_patched_definition := replace(
      v_definition,
      v_roster_filter,
      v_save_roster_filter
    );
    v_patched_definition := replace(
      v_patched_definition,
      v_unqualified_roster_filter,
      v_available_unqualified_roster_filter
    );
    if v_patched_definition = v_definition then
      raise exception
        'La fonction save_current_team_race_equipment_plan a une définition inattendue.';
    end if;
    execute v_patched_definition;
  end if;
end;
$migration$;

comment on function public.get_current_team_race_preparation() is
  'Charge uniquement les coureurs encore en course et leurs plans de préparation.';

comment on function public.save_current_team_race_preparation(
  uuid,
  uuid,
  jsonb,
  jsonb
) is
  'Enregistre les rôles et la stratégie des seuls coureurs encore en course.';

comment on function public.save_current_team_time_trial_preparation(
  uuid,
  uuid,
  jsonb
) is
  'Enregistre le plan CLM des seuls coureurs encore en course.';

comment on function public.save_current_team_race_equipment_plan(
  uuid,
  uuid,
  jsonb,
  boolean
) is
  'Enregistre le matériel des seuls coureurs encore en course.';

notify pgrst, 'reload schema';

commit;
