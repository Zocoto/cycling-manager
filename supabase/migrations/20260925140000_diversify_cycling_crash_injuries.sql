begin;

-- Preserve historic diagnoses and durations. Only future race crashes can
-- produce these additional, shorter and rarer long-term injuries.
alter table public.rider_injuries
  drop constraint if exists rider_injuries_type_allowed,
  drop constraint if exists rider_injuries_diagnosis_allowed;

alter table public.rider_injuries
  add constraint rider_injuries_type_allowed check (
    injury_type in (
      'abrasions', 'contusion', 'sprain', 'concussion', 'fracture', 'fatigue'
    )
  ),
  add constraint rider_injuries_diagnosis_allowed check (
    diagnosis_code in (
      'road_rash', 'hip_contusion', 'shoulder_sprain',
      'rib_fracture', 'wrist_fracture', 'concussion',
      'clavicle_fracture', 'pelvis_fracture', 'fatigue_exhaustion',
      'legacy_fracture', 'legacy_concussion', 'legacy_contusion',
      'legacy_abrasions'
    )
  );

create or replace function public.get_rider_injury_label(p_diagnosis_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_diagnosis_code
    when 'road_rash' then 'Abrasions superficielles'
    when 'hip_contusion' then 'Contusion de la hanche'
    when 'shoulder_sprain' then 'Entorse de l’épaule'
    when 'rib_fracture' then 'Fracture des côtes'
    when 'wrist_fracture' then 'Fracture du poignet'
    when 'concussion' then 'Commotion cérébrale'
    when 'clavicle_fracture' then 'Fracture de la clavicule'
    when 'pelvis_fracture' then 'Fracture du bassin'
    when 'fatigue_exhaustion' then 'Blessure de fatigue'
    when 'legacy_fracture' then 'Fracture'
    when 'legacy_concussion' then 'Commotion'
    when 'legacy_contusion' then 'Contusion'
    when 'legacy_abrasions' then 'Abrasions'
    else 'Blessure en cours'
  end;
$$;

-- Extend daily condition penalties to every active crash diagnosis. The
-- guard accepts a replay safely but fails if the underlying function changed.
do $migration$
declare
  v_definition text;
  v_patched text;
  v_pattern constant text := $pattern$and[[:space:]]+injury[.]diagnosis_code[[:space:]]+in[[:space:]]*[(][[:space:]]*'rib_fracture'[[:space:]]*,[[:space:]]*'wrist_fracture'[[:space:]]*,[[:space:]]*'clavicle_fracture'[[:space:]]*[)]$pattern$;
  v_new constant text := 'and injury.diagnosis_code <> ''fatigue_exhaustion''';
begin
  select pg_catalog.pg_get_functiondef(
    'public.settle_current_health_and_form()'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'La fonction de règlement médical est absente.';
  elsif position(v_new in lower(v_definition)) > 0 then
    null;
  else
    v_patched := pg_catalog.regexp_replace(
      v_definition,
      v_pattern,
      v_new,
      'i'
    );
    if v_patched = v_definition then
      raise exception 'Le filtre des pénalités de blessure a changé.';
    end if;
    execute v_patched;
  end if;
end;
$migration$;

-- SQL-generated roster and inventory labels use the same catalogue as the
-- application so all new diagnoses remain understandable in every screen.
do $migration$
declare
  v_definition text;
  v_patched text;
  v_pattern constant text := $pattern$case[[:space:]]+injury[.]diagnosis_code[[:space:]]+when[[:space:]]+'rib_fracture'[[:space:]]+then[[:space:]]+'Fracture des côtes'[[:space:]]+when[[:space:]]+'wrist_fracture'[[:space:]]+then[[:space:]]+'Fracture du poignet'[[:space:]]+when[[:space:]]+'clavicle_fracture'[[:space:]]+then[[:space:]]+'Fracture de la clavicule'[[:space:]]+else[[:space:]]+'Blessure en cours'[[:space:]]+end$pattern$;
  v_new constant text := 'public.get_rider_injury_label(injury.diagnosis_code)';
begin
  select pg_catalog.pg_get_functiondef(
    'public.get_current_team_race_roster_options_before_reconnaissance(uuid)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'La fonction des inscriptions de course est absente.';
  elsif position(v_new in v_definition) > 0 then
    null;
  else
    v_patched := pg_catalog.regexp_replace(
      v_definition,
      v_pattern,
      v_new,
      'i'
    );
    if v_patched = v_definition then
      raise exception 'Le libellé médical des inscriptions a changé.';
    end if;
    execute v_patched;
  end if;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_patched text;
  v_pattern constant text := $pattern$case[[:space:]]+active_injury[.]diagnosis_code[[:space:]]+when[[:space:]]+'rib_fracture'[[:space:]]+then[[:space:]]+'Fracture des côtes'[[:space:]]+when[[:space:]]+'wrist_fracture'[[:space:]]+then[[:space:]]+'Fracture du poignet'[[:space:]]+when[[:space:]]+'clavicle_fracture'[[:space:]]+then[[:space:]]+'Fracture de la clavicule'[[:space:]]+when[[:space:]]+'fatigue_exhaustion'[[:space:]]+then[[:space:]]+'Blessure de fatigue'[[:space:]]+else[[:space:]]+'Blessure en cours'[[:space:]]+end$pattern$;
  v_new constant text := 'public.get_rider_injury_label(active_injury.diagnosis_code)';
begin
  select pg_catalog.pg_get_functiondef(
    'public.get_current_team_item_target_values()'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'La fonction des cibles d’objets est absente.';
  elsif position(v_new in v_definition) > 0 then
    null;
  else
    v_patched := pg_catalog.regexp_replace(
      v_definition,
      v_pattern,
      v_new,
      'i'
    );
    if v_patched = v_definition then
      raise exception 'Le libellé médical des objets de soin a changé.';
    end if;
    execute v_patched;
  end if;
end;
$migration$;

revoke all on function public.get_rider_injury_label(text)
  from public, anon;
grant execute on function public.get_rider_injury_label(text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
