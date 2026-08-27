begin;

insert into public.staff_talent_catalog (code, role, display_name)
values (
  'scout_academy_training',
  'scout',
  'Pédagogie junior'
)
on conflict (code) do update
set role = excluded.role,
    display_name = excluded.display_name;

-- The bonus is captured when the report is generated, then copied to the
-- academy rider. Training therefore remains a zero-extra-query hot path and
-- the effect naturally stops when the rider leaves the academy tables.
alter table public.youth_scouting_candidates
  add column if not exists scout_training_bonus_percentage numeric(5, 2)
  not null default 0;

alter table public.youth_scouting_candidates
  drop constraint if exists youth_candidates_scout_training_bonus_range;
alter table public.youth_scouting_candidates
  add constraint youth_candidates_scout_training_bonus_range
  check (scout_training_bonus_percentage between 0 and 100);

alter table public.youth_academy_riders
  add column if not exists scout_training_bonus_percentage numeric(5, 2)
  not null default 0;

alter table public.youth_academy_riders
  drop constraint if exists youth_academy_scout_training_bonus_range;
alter table public.youth_academy_riders
  add constraint youth_academy_scout_training_bonus_range
  check (scout_training_bonus_percentage between 0 and 100);

do $patch_signing$
declare
  v_definition text;
  v_patched_definition text;
  v_columns_marker constant text := E'    tuition_per_season\n  ) values (';
  v_columns_replacement constant text :=
    E'    tuition_per_season,\n    scout_training_bonus_percentage\n  ) values (';
  v_values_marker constant text :=
    E'    v_candidate.tuition_per_season\n  ) returning id into v_academy_id;';
  v_values_replacement constant text :=
    E'    v_candidate.tuition_per_season,\n    v_candidate.scout_training_bonus_percentage\n  ) returning id into v_academy_id;';
begin
  select pg_catalog.pg_get_functiondef(
    'public.sign_current_team_youth_candidate(uuid)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position('v_candidate.scout_training_bonus_percentage' in v_definition) > 0 then
    return;
  end if;

  if position(v_columns_marker in v_definition) = 0
    or position(v_values_marker in v_definition) = 0
  then
    raise exception
      'La copie du bonus scout vers l école ne peut pas être raccordée en sécurité.';
  end if;

  v_patched_definition := replace(
    replace(v_definition, v_columns_marker, v_columns_replacement),
    v_values_marker,
    v_values_replacement
  );

  if v_patched_definition = v_definition then
    raise exception 'La fonction de signature junior n a pas été modifiée.';
  end if;

  execute v_patched_definition;
end;
$patch_signing$;

create or replace function public.get_youth_school_training_multiplier(
  p_bonus_percentage numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select 1 + least(100, greatest(0, p_bonus_percentage)) / 100.0;
$$;

do $patch_manual_training$
declare
  v_definition text;
  v_patched_definition text;
  v_context_marker constant text :=
    E'    academy.training_mode,\n    academy.potential_steps,';
  v_context_replacement constant text :=
    E'    academy.training_mode,\n    academy.scout_training_bonus_percentage,\n    academy.potential_steps,';
  v_gain_marker constant text :=
    E'      v_weight,\n      v_session_variance\n    );';
  v_gain_replacement constant text :=
    E'      v_weight,\n      v_session_variance\n    ) * public.get_youth_school_training_multiplier(\n      v_context.scout_training_bonus_percentage\n    );';
begin
  select pg_catalog.pg_get_functiondef(
    'public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position('get_youth_school_training_multiplier' in v_definition) > 0 then
    return;
  end if;

  if position(v_context_marker in v_definition) = 0
    or position(v_gain_marker in v_definition) = 0
  then
    raise exception
      'Le bonus scout ne peut pas être raccordé à l entraînement manuel en sécurité.';
  end if;

  v_patched_definition := replace(
    replace(v_definition, v_context_marker, v_context_replacement),
    v_gain_marker,
    v_gain_replacement
  );

  if v_patched_definition = v_definition then
    raise exception 'La fonction d entraînement junior n a pas été modifiée.';
  end if;

  execute v_patched_definition;
end;
$patch_manual_training$;

revoke execute on function public.get_youth_school_training_multiplier(numeric)
  from public, anon, authenticated;

comment on column public.youth_scouting_candidates.scout_training_bonus_percentage is
  'Bonus d entraînement à l école acquis grâce au talent du scout lors de la détection.';
comment on column public.youth_academy_riders.scout_training_bonus_percentage is
  'Bonus scout appliqué uniquement aux séances réalisées dans l école de cyclisme.';
comment on function public.get_youth_school_training_multiplier(numeric) is
  'Convertit le bonus scout mémorisé sur un junior en multiplicateur d entraînement scolaire.';

notify pgrst, 'reload schema';

commit;
