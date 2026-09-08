begin;

-- Les orientations du Centre d'entraînement complètent le bonus de niveau du
-- bâtiment. Leur puissance reste progressive : 60 % au N3, 80 % au N4 et
-- 100 % au N5.
create or replace function public.get_team_training_center_specialization_progress_multiplier(
  p_team_id uuid,
  p_stat_code text,
  p_current_rating numeric,
  p_trainer_country_match boolean default false
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_level integer := 0;
  v_specialization text;
  v_full_power_bonus numeric := 0;
  v_power numeric := 0;
begin
  select coalesce(max(infrastructure.level), 0)
  into v_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = p_team_id
    and infrastructure.infrastructure_code = 'training_center';

  if v_level < 3 then return 1; end if;

  v_specialization := public.get_team_infrastructure_specialization(
    p_team_id,
    'training_center'
  );
  v_power := public.get_infrastructure_specialization_power_multiplier(v_level);

  if v_specialization = 'individualization' then
    if p_current_rating < 70 then
      v_full_power_bonus := v_full_power_bonus + 0.05;
    end if;
    if p_current_rating < 65
      and p_stat_code = any(array[
        'acceleration',
        'downhill',
        'endurance',
        'resistance',
        'recovery',
        'breakaway',
        'prologue'
      ])
    then
      v_full_power_bonus := v_full_power_bonus + 0.05;
    end if;
  elsif v_specialization = 'elite_performance' then
    if p_current_rating between 75 and 82 then
      v_full_power_bonus := v_full_power_bonus + 0.02;
    end if;
    if coalesce(p_trainer_country_match, false) then
      v_full_power_bonus := v_full_power_bonus + 0.05;
    end if;
  end if;

  return (1 + v_full_power_bonus * v_power)::numeric;
end;
$$;

create or replace function public.get_team_skipped_training_form_gain(
  p_team_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_level integer := 0;
  v_specialization text;
begin
  select coalesce(max(infrastructure.level), 0)
  into v_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = p_team_id
    and infrastructure.infrastructure_code = 'training_center';

  if v_level < 3 then return 2; end if;

  v_specialization := public.get_team_infrastructure_specialization(
    p_team_id,
    'training_center'
  );

  return case
    when v_specialization = 'durability'
      then 2 + public.get_infrastructure_specialization_power_multiplier(v_level)
    else 2
  end::numeric;
end;
$$;

-- Le multiplicateur est appliqué à chaque statistique après les autres
-- facteurs d'entraînement, afin que les deux critères d'Individualisation et
-- les deux critères de Haute performance puissent se cumuler proprement.
do $migration$
declare
  v_definition text;
  v_marker constant text :=
    'public.get_team_training_center_progress_multiplier(v_rider.team_id)';
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  ) into v_definition;

  if position(
    'get_team_training_center_specialization_progress_multiplier' in v_definition
  ) = 0 then
    v_marker_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);

    if v_marker_count <> 1 then
      raise exception
        'Point d’intégration de la spécialisation du Centre d’entraînement inattendu (% marqueurs).',
        v_marker_count;
    end if;

    v_definition := replace(
      v_definition,
      v_marker,
      v_marker || chr(10) ||
        '            * public.get_team_training_center_specialization_progress_multiplier(' || chr(10) ||
        '                v_rider.team_id,' || chr(10) ||
        '                v_stat.stat_code,' || chr(10) ||
        '                v_stat.current_rating,' || chr(10) ||
        '                v_trainer_country_match' || chr(10) ||
        '              )'
    );
    execute v_definition;
  end if;
end;
$migration$;

-- Développement durable s'applique précisément au repos automatique provoqué
-- par le seuil de forme du DS. Les absences pour blessure, stage ou
-- reconnaissance conservent leurs propres règles de forme.
do $migration$
declare
  v_definition text;
  v_marker constant text :=
    'v_form_delta := least(2, 100 - v_session.form_before);';
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.apply_low_form_training_recovery(uuid)'::regprocedure
  ) into v_definition;

  if position('get_team_skipped_training_form_gain' in v_definition) = 0 then
    v_marker_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);

    if v_marker_count <> 1 then
      raise exception
        'Point d’intégration de Développement durable inattendu (% marqueurs).',
        v_marker_count;
    end if;

    v_definition := replace(
      v_definition,
      v_marker,
      'v_form_delta := least(' ||
        'public.get_team_skipped_training_form_gain(v_session.team_id), ' ||
        '100 - v_session.form_before);'
    );
    execute v_definition;
  end if;
end;
$migration$;

revoke all on function public.get_team_training_center_specialization_progress_multiplier(
  uuid,
  text,
  numeric,
  boolean
) from public, anon, authenticated;
revoke all on function public.get_team_skipped_training_form_gain(uuid)
  from public, anon, authenticated;

grant execute on function public.get_team_training_center_specialization_progress_multiplier(
  uuid,
  text,
  numeric,
  boolean
) to service_role;
grant execute on function public.get_team_skipped_training_form_gain(uuid)
  to service_role;

comment on function public.get_team_training_center_specialization_progress_multiplier(
  uuid,
  text,
  numeric,
  boolean
) is
  'Applique Individualisation ou Haute performance à la progression quotidienne, avec cumul des critères éligibles.';
comment on function public.get_team_skipped_training_form_gain(uuid) is
  'Retourne 2 points de repos sous le seuil, ou jusqu’à 3 avec Développement durable.';
comment on function public.apply_low_form_training_recovery(uuid) is
  'Crédite le repos automatique sous le seuil du DS, bonifié jusqu’à 3 points par Développement durable.';
comment on function public.settle_due_training_sessions() is
  'Règle les séances quotidiennes et applique les spécialisations actives du Centre d’entraînement.';

notify pgrst, 'reload schema';

commit;
