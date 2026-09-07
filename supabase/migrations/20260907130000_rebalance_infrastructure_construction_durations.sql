begin;

create or replace function public.get_team_infrastructure_base_duration_days(
  p_infrastructure_code text,
  p_target_level integer
)
returns integer
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_durations integer[];
begin
  case p_infrastructure_code
    when 'recruitment_data_room' then v_durations := array[7, 14, 21];
    when 'staff_academy' then v_durations := array[10, 16, 22, 28, 35];
    when 'training_center' then v_durations := array[5, 9, 14, 20, 28];
    when 'fan_club_headquarters' then v_durations := array[6, 10, 15, 21, 28];
    when 'club_shop' then v_durations := array[5, 9, 14, 20, 26];
    when 'international_youth_center' then v_durations := array[10, 16, 22, 28, 35];
    when 'indoor_track' then v_durations := array[7, 11, 16, 22, 28];
    when 'cryotherapy_center' then v_durations := array[6, 10, 15, 21, 28];
    when 'wind_tunnel' then v_durations := array[9, 14, 20, 27, 35];
    when 'weather_center' then v_durations := array[6, 10, 15, 21, 28];
    when 'media_center' then v_durations := array[9, 14, 20, 27, 35];
    when 'international_welcome_center' then v_durations := array[10, 16, 22, 28, 35];
    when 'research_lab' then v_durations := array[10, 15, 20, 25, 30, 33, 35];
    else raise exception 'Cette infrastructure d’équipe n’existe pas.';
  end case;

  if p_target_level < 1 or p_target_level > cardinality(v_durations) then
    raise exception 'Niveau d’infrastructure d’équipe invalide.';
  end if;

  return v_durations[p_target_level];
end;
$$;

create or replace function public.get_federation_infrastructure_base_duration_days(
  p_infrastructure_code text,
  p_target_level integer
)
returns integer
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_durations integer[];
begin
  case p_infrastructure_code
    when 'national_detection_network' then v_durations := array[7, 10, 14, 18, 23];
    when 'regional_academies' then v_durations := array[8, 12, 16, 21, 27];
    when 'national_performance_center' then v_durations := array[9, 14, 19, 24, 30];
    when 'federal_staff_institute' then v_durations := array[7, 11, 15, 20, 26];
    when 'federal_medical_network' then v_durations := array[7, 10, 14, 18, 23];
    when 'national_technical_laboratory' then v_durations := array[9, 14, 19, 25, 32];
    when 'race_organization_office' then v_durations := array[7, 10, 14, 18, 23];
    when 'federal_integration_office' then v_durations := array[9, 14, 19, 24, 30];
    when 'home_advantage_program' then v_durations := array[6, 9, 13, 18, 23];
    else raise exception 'Cette infrastructure fédérale n’existe pas.';
  end case;

  if p_target_level < 1 or p_target_level > cardinality(v_durations) then
    raise exception 'Niveau d’infrastructure fédérale invalide.';
  end if;

  return v_durations[p_target_level];
end;
$$;

-- Les RPC de lancement restent responsables des coûts, droits et architectes.
-- La durée est remplacée juste après leur catalogue historique afin que le
-- serveur et l’interface partagent la nouvelle grille sans dupliquer ces règles.
do $migration$
declare
  v_definition text;
  v_needle text := E'\n  v_base_cost := round(';
begin
  select pg_catalog.pg_get_functiondef(
    'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
  ) into v_definition;

  if position('get_team_infrastructure_base_duration_days' in v_definition) = 0 then
    if position(v_needle in v_definition) = 0 then
      raise exception 'Point d’intégration des durées d’équipe introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_needle,
      E'\n  v_base_duration := public.get_team_infrastructure_base_duration_days(\n'
        || E'    p_infrastructure_code,\n'
        || E'    v_target_level\n'
        || E'  );\n\n  v_base_cost := round('
    );
    execute v_definition;
  end if;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_needle text := E'\n  perform pg_catalog.pg_advisory_xact_lock(';
begin
  select pg_catalog.pg_get_functiondef(
    'public.start_national_federation_infrastructure_project(text,text,text)'::regprocedure
  ) into v_definition;

  if position('get_federation_infrastructure_base_duration_days' in v_definition) = 0 then
    if position(v_needle in v_definition) = 0 then
      raise exception 'Point d’intégration des durées fédérales introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_needle,
      E'\n  v_base_duration := public.get_federation_infrastructure_base_duration_days(\n'
        || E'    p_infrastructure_code,\n'
        || E'    v_target_level\n'
        || E'  );\n\n  perform pg_catalog.pg_advisory_xact_lock('
    );
    execute v_definition;
  end if;
end;
$migration$;

-- Les chantiers actifs bénéficient immédiatement de la nouvelle grille. Les
-- jours déjà économisés (architecte ou récompense) sont conservés en valeur
-- absolue, et aucun chantier ne peut être rallongé par ce recalcul.
with recalculated as (
  select
    project.id,
    least(
      project.base_duration_days,
      public.get_team_infrastructure_base_duration_days(
        project.infrastructure_code,
        project.target_level
      )
    ) as base_duration_days,
    least(
      project.final_duration_days,
      greatest(
        1,
        public.get_team_infrastructure_base_duration_days(
          project.infrastructure_code,
          project.target_level
        ) - greatest(
          0,
          project.base_duration_days - project.final_duration_days
        )
      )
    ) as final_duration_days
  from public.infrastructure_projects as project
  where project.status = 'active'
)
update public.infrastructure_projects as project
set base_duration_days = recalculated.base_duration_days,
    final_duration_days = least(
      recalculated.base_duration_days,
      recalculated.final_duration_days
    ),
    completes_game_day_index = project.starts_game_day_index + least(
      recalculated.base_duration_days,
      recalculated.final_duration_days
    )
from recalculated
where recalculated.id = project.id;

with recalculated as (
  select
    project.id,
    least(
      project.base_duration_days,
      public.get_federation_infrastructure_base_duration_days(
        project.infrastructure_code,
        project.target_level
      )
    ) as base_duration_days,
    least(
      project.final_duration_days,
      greatest(
        1,
        public.get_federation_infrastructure_base_duration_days(
          project.infrastructure_code,
          project.target_level
        ) - greatest(
          0,
          project.base_duration_days - project.final_duration_days
        )
      )
    ) as final_duration_days
  from public.national_federation_infrastructure_projects as project
  where project.status = 'active'
)
update public.national_federation_infrastructure_projects as project
set base_duration_days = recalculated.base_duration_days,
    final_duration_days = least(
      recalculated.base_duration_days,
      recalculated.final_duration_days
    ),
    completes_game_day_index = project.starts_game_day_index + least(
      recalculated.base_duration_days,
      recalculated.final_duration_days
    ),
    updated_at = now()
from recalculated
where recalculated.id = project.id;

revoke all on function public.get_team_infrastructure_base_duration_days(text, integer)
  from public, anon, authenticated;
revoke all on function public.get_federation_infrastructure_base_duration_days(text, integer)
  from public, anon, authenticated;
grant execute on function public.get_team_infrastructure_base_duration_days(text, integer)
  to service_role;
grant execute on function public.get_federation_infrastructure_base_duration_days(text, integer)
  to service_role;

comment on function public.get_team_infrastructure_base_duration_days(text, integer) is
  'Grille équilibrée des durées de construction d’équipe, plafonnée à 35 jours.';
comment on function public.get_federation_infrastructure_base_duration_days(text, integer) is
  'Grille équilibrée des durées fédérales, plafonnée à 32 jours.';

notify pgrst, 'reload schema';

commit;
