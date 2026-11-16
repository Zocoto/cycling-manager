begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';

-- Return native youth-note adjustments for saved instructions in one stage
-- (or all stages of one international edition). Missing/neutral plans keep
-- the original score. The selection is checked again at simulation time.
create or replace function private.get_development_race_tactical_adjustments(
  p_edition_id uuid,
  p_stage_id uuid,
  p_federation boolean
)
returns table (stage_id uuid, registration_id uuid, academy_rider_id uuid, adjustment numeric)
language sql stable
set search_path = ''
as $$
  with valid_plans as (
    select stage.id as stage_id, stage.stage_type, stage.profile_type, stage.distance_km,
      case when p_federation then plan.federation_registration_id else plan.development_registration_id end as registration_id,
      plan.academy_rider_id, plan.instruction,
      youth.endurance, youth.resistance, youth.acceleration, youth.breakaway, youth.time_trial, youth.prologue,
      case stage.profile_type
        when 'hilly' then youth.hills
        when 'mountain' then youth.mountain
        when 'cobbles' then youth.cobbles
        when 'sprint' then youth.sprint
        when 'mixed' then (youth.hills + youth.flat) / 2.0
        else youth.flat
      end as terrain_note
    from public.development_race_stages stage
    join public.development_race_stage_plans plan on plan.stage_id = stage.id
    join public.youth_academy_riders youth on youth.id = plan.academy_rider_id
    where stage.race_edition_id = p_edition_id
      and (p_stage_id is null or stage.id = p_stage_id)
      and case stage.stage_type
        when 'individual_time_trial' then plan.instruction in ('progressive', 'aggressive')
        when 'road' then plan.instruction in ('leader', 'domestique', 'attack')
        else false
      end
      and case when p_federation then exists (
        select 1
        from public.national_federation_junior_race_registrations registration
        join public.national_federation_junior_race_registration_riders selected
          on selected.registration_id = registration.id and selected.academy_rider_id = plan.academy_rider_id
        where registration.id = plan.federation_registration_id
          and registration.race_edition_id = p_edition_id and registration.status = 'registered'
      ) else exists (
        select 1
        from public.development_race_registrations registration
        join public.development_race_registration_riders selected
          on selected.registration_id = registration.id and selected.academy_rider_id = plan.academy_rider_id
        where registration.id = plan.development_registration_id
          and registration.race_edition_id = p_edition_id and registration.status = 'registered'
      ) end
  ), support as (
    select valid_plans.*,
      .035 + .065 * ((endurance + resistance + terrain_note) / 3.0 - 1) / 5.0 as support_value
    from valid_plans
  ), team_tactics as (
    select support.*,
      count(*) filter (where instruction = 'leader') over team_stage as leader_count,
      sum(support_value) filter (where instruction = 'domestique') over team_stage as support_pool
    from support
    window team_stage as (partition by stage_id, registration_id)
  )
  -- +/- .18 on the 1..6 native scale is at most 1.44 displayed points,
  -- or about 12 seconds road / 8 chrono. Weak real riders stay above fillers.
  select tactic.stage_id, tactic.registration_id, tactic.academy_rider_id,
    greatest(-.18, least(.18, case tactic.instruction
      when 'leader' then coalesce(tactic.support_pool / nullif(tactic.leader_count, 0), 0)
      when 'domestique' then case when tactic.leader_count > 0 then -.65 * tactic.support_value else 0 end
      when 'attack' then -.065
        + .14 * ((2 * tactic.terrain_note + tactic.acceleration + tactic.breakaway + tactic.resistance) / 5.0 - 1) / 5.0
        + case tactic.profile_type when 'flat' then -.05 when 'sprint' then -.05 else .025 end
        + .24 * (public.development_hash_unit(tactic.stage_id::text || ':' || tactic.academy_rider_id::text || ':attack') - .5)
      when 'progressive' then -.045
        + .12 * (.45 * tactic.endurance + .35 * tactic.resistance + .20 * tactic.time_trial - 1) / 5.0
      when 'aggressive' then -.08
        + .145 * (.40 * tactic.time_trial + .35 * tactic.prologue + .25 * tactic.resistance - 1) / 5.0
        + case when tactic.distance_km <= 24 then .03 else -.035 end
        + .16 * (public.development_hash_unit(tactic.stage_id::text || ':' || tactic.academy_rider_id::text || ':aggressive') - .5)
      else 0
    end))
  from team_tactics tactic;
$$;

revoke all on function private.get_development_race_tactical_adjustments(uuid, uuid, boolean)
from public, anon, authenticated, service_role;

-- Patch only the real riders' scoring queries. Retain the deployed engines,
-- point calculations, equipment, and public function settings and grants.
do $junior_tactics$
declare
  v_signature regprocedure;
  v_definition text;
  v_join text;
  v_tactics_join text;
  v_score text;
  v_new_score text;
  v_edit record;
begin
  for v_edit in
    select * from (values
      ('public.simulate_development_race_stage(uuid,uuid)'::regprocedure, '  ', false),
      ('public.simulate_development_race_pre_federation_juniors(uuid)'::regprocedure, '    ', false),
      ('public.simulate_development_race(uuid)'::regprocedure, '  ', true)
    ) engines(signature, indent, federation)
  loop
    v_signature := v_edit.signature;
    v_definition := replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '');
    if position('private.get_development_race_tactical_adjustments(' in v_definition) > 0 then continue; end if;

    if v_edit.federation then
      v_join := E'  cross join public.development_race_stages as stage\n  cross join lateral (';
      v_tactics_join := E'  cross join public.development_race_stages as stage\n'
        || E'  left join private.get_development_race_tactical_adjustments(v_edition.id, null, true) as tactic\n'
        || E'    on tactic.stage_id = stage.id and tactic.registration_id = registration.id\n'
        || E'    and tactic.academy_rider_id = academy.id\n  cross join lateral (';
      v_score := E'      + (public.development_hash_unit(\n          v_edition.id::text';
      v_new_score := E'      + coalesce(tactic.adjustment, 0)\n' || v_score;
    else
      v_join := v_edit.indent || E'join public.countries as country on country.id = youth.country_id\n'
        || v_edit.indent || 'cross join lateral (';
      v_tactics_join := v_edit.indent || E'join public.countries as country on country.id = youth.country_id\n'
        || v_edit.indent || E'left join private.get_development_race_tactical_adjustments(v_edition.id, v_stage.id, false) as tactic\n'
        || v_edit.indent || E'  on tactic.registration_id = registration.id and tactic.academy_rider_id = youth.id\n'
        || v_edit.indent || 'cross join lateral (';
      v_score := v_edit.indent || E'    end\n' || v_edit.indent || '    + (public.development_hash_unit(';
      v_new_score := v_edit.indent || E'    end\n' || v_edit.indent || E'    + coalesce(tactic.adjustment, 0)\n'
        || v_edit.indent || '    + (public.development_hash_unit(';
    end if;

    if (length(v_definition) - length(replace(v_definition, v_join, ''))) / length(v_join) <> 1
      or (length(v_definition) - length(replace(v_definition, v_score, ''))) / length(v_score) <> 1 then
      raise exception 'Unexpected junior scoring definition for %.', v_signature;
    end if;
    execute replace(replace(v_definition, v_join, v_tactics_join), v_score, v_new_score);
  end loop;
end;
$junior_tactics$;

-- Published club stage results are authoritative. Complete missing stages
-- with the daily scorer, even when the scheduled daily pass was missed.
do $junior_tours$
declare
  v_signature constant regprocedure := 'public.simulate_development_race_pre_federation_juniors(uuid)'::regprocedure;
  v_definition text := replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '');
  v_start constant text := E'  delete from public.development_race_results\n  where race_edition_id = v_edition.id;';
  v_end constant text := E'  end loop;\n\n  insert into public.development_race_results (';
begin
  if position('junior_preserve_published_club_stages' in v_definition) > 0 then return; end if;
  if (length(v_definition) - length(replace(v_definition, v_start, ''))) / length(v_start) <> 1
    or (length(v_definition) - length(replace(v_definition, v_end, ''))) / length(v_end) <> 1 then
    raise exception 'Unexpected junior tour settlement definition.';
  end if;
  v_definition := replace(v_definition, v_start, $source$  -- junior_preserve_published_club_stages
  if v_edition.competition_type = 'open' and v_edition.race_format = 'stage_race' then
    delete from public.development_race_results
    where race_edition_id = v_edition.id and result_scope <> 'stage';

    for v_stage in
      select * from public.development_race_stages
      where race_edition_id = v_edition.id
      order by stage_number
    loop
      perform public.simulate_development_race_stage(v_edition.id, v_stage.id);
    end loop;
  else
$source$ || v_start);
  v_definition := replace(v_definition, v_end,
    E'  end loop;\n  end if;\n\n  insert into public.development_race_results (');
  execute v_definition;
end;
$junior_tours$;

commit;
