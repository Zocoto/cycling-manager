begin;
set local application_name = 'cyclostratege-effective-attack-segments-20261027';
set local lock_timeout = '3s';
set local statement_timeout = '8s';

-- The calendar and official engine both use ensureCompleteRaceSegments:
-- complete stored routes keep their own numbering and segment lengths;
-- missing/inconsistent routes use the deterministic 10 km fallback instead.
-- Validate the same effective numbering without rewriting route or race data.
create or replace function private.is_effective_race_attack_segment_available(
  p_stage_id uuid,
  p_segment_number integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when stored.segment_count > 0
        -- getStageDistance rounds to two decimals; the subsequent comparison
        -- is JavaScript double arithmetic, including the 0.05 km boundary.
        and abs(
          round(stored.distance_km, 2)::double precision
            - stage.distance_km::double precision
        ) <= 0.05::double precision
      then coalesce(stored.has_requested_number, false)
      else p_segment_number <= ceil(stage.distance_km / 10.0)::integer
    end
    from public.stages as stage
    cross join lateral (
      select
        count(*) as segment_count,
        sum(segment.distance_km) as distance_km,
        bool_or(segment.segment_number = p_segment_number) as has_requested_number
      from public.stage_segments as segment
      where segment.stage_id = stage.id
    ) as stored
    where stage.id = p_stage_id
      and stage.distance_km > 0
      and p_segment_number > 0
  ), false);
$$;

revoke all
on function private.is_effective_race_attack_segment_available(uuid, integer)
from public, anon, authenticated;

grant execute
on function private.is_effective_race_attack_segment_available(uuid, integer)
to service_role;

comment on function private.is_effective_race_attack_segment_available(uuid, integer) is
  'Validates the exact effective course numbering used by ensureCompleteRaceSegments, including its deterministic fallback; does not modify routes.';

-- Preserve the deployed RPC body, privileges, race deadlines, registration and
-- rider-availability checks. Only replace the physical-segment lookup.
do $migration$
declare
  v_definition text;
  v_old constant text :=
    '    left join public.stage_segments as segment' || chr(10) ||
    '      on segment.stage_id = p_stage_id' || chr(10) ||
    '     and segment.segment_number = (attack.value ->> ''segmentNumber'')::integer' || chr(10) ||
    '    where roster.id is null or segment.id is null';
  v_new constant text :=
    '    where roster.id is null' || chr(10) ||
    '      or not private.is_effective_race_attack_segment_available(' || chr(10) ||
    '        p_stage_id, (attack.value ->> ''segmentNumber'')::integer' || chr(10) ||
    '      )';
  v_old_count integer;
  v_new_count integer;
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure
  ), chr(13), '') into v_definition;

  v_old_count := (length(v_definition) - length(replace(v_definition, v_old, '')))
    / length(v_old);
  v_new_count := (length(v_definition) - length(replace(v_definition, v_new, '')))
    / length(v_new);

  if v_old_count = 1 and v_new_count = 0 then
    execute replace(v_definition, v_old, v_new);
  elsif v_old_count <> 0 or v_new_count <> 1 then
    raise exception
      'Unexpected attack-segment validation in save_current_team_race_preparation: old %, effective %.',
      v_old_count, v_new_count;
  end if;
end;
$migration$;

commit;
