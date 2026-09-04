begin;

-- Les CC et CM sont simules par nations : les roles et tactiques d'une equipe
-- de club ne doivent donc jamais pouvoir influencer leur course en ligne.
-- Les reglages CLM restent stockes par coureur dans la table dediee.
create or replace function public.reject_time_trial_race_preparation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage_type text;
  v_competition_type text;
begin
  select stage.stage_type, race.competition_type
  into v_stage_type, v_competition_type
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where stage.id = new.stage_id;

  if v_stage_type in (
    'individual_time_trial',
    'team_time_trial',
    'prologue'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Chrono : utilisez la preparation individuelle du coureur.';
  end if;

  if v_competition_type in (
    'continental_championship',
    'world_championship'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Course internationale : les consignes collectives sont gerees par la selection nationale.';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_time_trial_race_preparation()
from public, anon, authenticated;

-- Le RPC de lecture ne remonte plus les epreuves internationales en ligne.
-- Une edition internationale CLM reste visible afin de regler l'effort du
-- coureur convoque.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_current_team_race_preparation()'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_edition_join constant text :=
    '  join public.race_editions as edition' || chr(10) ||
    '    on edition.id = registration.race_edition_id' || chr(10) ||
    '   and edition.season_id = season.id' || chr(10) ||
    '   and edition.status <> ''cancelled''';
  v_race_join constant text :=
    '  join public.races as race' || chr(10) ||
    '    on race.id = edition.race_id';
  v_where constant text :=
    '  where director.auth_user_id = auth.uid()';
  v_filtered_where constant text :=
    '  where director.auth_user_id = auth.uid()' || chr(10) ||
    '    and (' || chr(10) ||
    '      race.competition_type not in (' || chr(10) ||
    '        ''continental_championship'', ''world_championship''' || chr(10) ||
    '      )' || chr(10) ||
    '      or stage.stage_type in (' || chr(10) ||
    '        ''individual_time_trial'', ''team_time_trial'', ''prologue''' || chr(10) ||
    '      )' || chr(10) ||
    '    )';
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
  into v_definition;

  if position('race.competition_type not in (' in v_definition) = 0 then
    if position(v_edition_join in v_definition) = 0
      or position(v_where in v_definition) = 0
    then
      raise exception
        'La fonction de lecture des preparations a une definition inattendue.';
    end if;

    v_patched_definition := replace(
      v_definition,
      v_edition_join,
      v_edition_join || chr(10) || v_race_join
    );
    v_patched_definition := replace(
      v_patched_definition,
      v_where,
      v_filtered_where
    );

    if v_patched_definition = v_definition then
      raise exception
        'La fonction de lecture des preparations n a pas ete modifiee.';
    end if;

    execute v_patched_definition;
  end if;
end;
$migration$;

-- Le rappel du bureau suit la meme frontiere : CC/CM route ne demandent
-- aucune action, tandis qu'un CLM international non regle reste signale.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_current_dashboard_assistant_summary()'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_registration_join constant text :=
    '    join public.race_registrations as registration' || chr(10) ||
    '      on registration.team_season_id = context.team_season_id' || chr(10) ||
    '     and registration.status = ''accepted''';
  v_race_joins constant text :=
    '    join public.race_editions as edition' || chr(10) ||
    '      on edition.id = registration.race_edition_id' || chr(10) ||
    '    join public.races as race' || chr(10) ||
    '      on race.id = edition.race_id';
  v_case_where constant text :=
    '    where case';
  v_filtered_case_where constant text :=
    '    where (' || chr(10) ||
    '      stage.stage_type in (' || chr(10) ||
    '        ''individual_time_trial'', ''team_time_trial'', ''prologue''' || chr(10) ||
    '      )' || chr(10) ||
    '      or race.competition_type not in (' || chr(10) ||
    '        ''continental_championship'', ''world_championship''' || chr(10) ||
    '      )' || chr(10) ||
    '    )' || chr(10) ||
    '    and case';
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
  into v_definition;

  if position('or race.competition_type not in (' in v_definition) = 0 then
    if position(v_registration_join in v_definition) = 0
      or position(v_case_where in v_definition) = 0
    then
      raise exception
        'Le rappel de preparation du bureau a une definition inattendue.';
    end if;

    v_patched_definition := replace(
      v_definition,
      v_registration_join,
      v_registration_join || chr(10) || v_race_joins
    );
    v_patched_definition := replace(
      v_patched_definition,
      v_case_where,
      v_filtered_case_where
    );

    if v_patched_definition = v_definition then
      raise exception
        'Le rappel de preparation du bureau n a pas ete modifie.';
    end if;

    execute v_patched_definition;
  end if;
end;
$migration$;

comment on function public.reject_time_trial_race_preparation() is
  'Bloque les roles et tactiques de club sur les chronos et sur toutes les courses internationales.';

comment on function public.get_current_team_race_preparation() is
  'Charge les plans des courses de club et les reglages individuels des CLM internationaux, jamais les tactiques de club des CC/CM route.';

notify pgrst, 'reload schema';

commit;
