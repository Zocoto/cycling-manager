begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';

-- Match the course with one of the rider's main strengths, relative to their
-- own notes. A developing rider can have a suitable course too.
create or replace function private.is_ambitious_rider_terrain(
  p_rider_id uuid, p_season_id uuid, p_profile_type text
)
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((
    select case p_profile_type
      when 'flat' then greatest(rating.flat, rating.sprint)
      when 'sprint' then rating.sprint
      when 'hilly' then rating.hills
      when 'mountain' then rating.mountain
      when 'cobbles' then rating.cobbles
      when 'mixed' then greatest(rating.mountain, rating.hills, rating.flat, rating.cobbles)
    end >= greatest(
      rating.mountain, rating.hills, rating.flat, rating.sprint, rating.cobbles, rating.time_trial
    ) - 5
    from public.rider_season_ratings as rating
    where rating.rider_id = p_rider_id and rating.season_id = p_season_id
  ), false);
$$;

revoke all on function private.is_ambitious_rider_terrain(uuid,uuid,text)
  from public, anon, authenticated;

-- Reuse the current result triggers and morale ledger. The existing
-- contextual assessment decides whether the result was a disappointment.
-- Read explicit appointments from the official start. Legacy snapshots lack
-- this evidence and do not qualify for role-specific personality effects.
do $personality_patch$
declare
  v_signature regprocedure;
  v_definition text;
  v_replacements text[][];
  v_pair text[];
  v_marker constant text := 'v_colerique_penalty boolean := false;';
begin
  foreach v_signature in array array[
    'public.apply_stage_result_morale()'::regprocedure,
    'public.apply_race_result_morale()'::regprocedure
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature), E'\r\n', E'\n');
    if position(v_marker in v_definition) > 0 then continue; end if;

    if v_signature = 'public.apply_stage_result_morale()'::regprocedure then
      v_replacements := array[
        array['  v_delta numeric;', '  v_delta numeric;' || E'\n  ' || v_marker],
        array['    roster.rider_id,', $stage_context$    roster.rider_id,
    rider.personality_key,
    case
      when rider.personality_key in ('ambitieux', 'colerique') then (
        select official.input_data #>> array['personalityLeadershipByRiderId', roster.rider_id::text, 'stageRole']
        from public.official_stage_simulations as official
        where official.stage_id = stage.id
          and official.input_data #>> array['personalityLeadershipByRiderId', roster.rider_id::text, 'personalityKey']
            = rider.personality_key
      )
    end as race_role,
    stage.stage_type,
    stage.profile_type,$stage_context$],
        array['  if v_delta <> 0 then', $stage_delta$  v_colerique_penalty := coalesce(
    v_context.personality_key = 'colerique' and v_scope = 'one_day'
    and new.status = 'finished' and new.rank is not null
    and v_context.stage_type <> 'team_time_trial'
    and v_context.race_role in ('leader', 'sprinter', 'leader_sprinter')
    and v_delta < 0, false
  );
  if v_colerique_penalty then v_delta := v_delta - 1; end if;

  if v_delta <> 0 then$stage_delta$],
        array[E'    );\n\n    perform public.apply_rider_morale_event(\n      v_context.rider_id,', $stage_description$    );
    if v_colerique_penalty then
      v_description := v_description || ' · Caractère Colérique';
    end if;

    perform public.apply_rider_morale_event(
      v_context.rider_id,$stage_description$],
        array[$win$  if new.status = 'finished' and new.rank = 1 then$win$, $ambition$  if v_context.personality_key = 'ambitieux'
    and new.status = 'finished'
    and v_context.stage_type = 'road'
    and v_context.race_role in ('leader', 'sprinter', 'leader_sprinter')
    and private.is_ambitious_rider_terrain(
      v_context.rider_id, v_context.season_id, v_context.profile_type
    )
    and not exists (
      select 1
      from public.rider_morale_events as event
      where event.rider_id = v_context.rider_id
        and event.source_type = 'stage_result'
        and event.source_reference = 'personality:ambitieux:' || v_context.race_edition_id::text
    )
  then
    -- The existing ledger's unique source ensures at most one reward per edition.
    perform public.apply_rider_morale_event(
      v_context.rider_id,
      v_context.season_day_id,
      'stage_result',
      'personality:ambitieux:' || v_context.race_edition_id::text,
      1,
      'Caractère Ambitieux — Leader sur son terrain · ' || coalesce(v_context.race_name, 'course'),
      jsonb_build_object(
        'personalityKey', 'ambitieux',
        'raceEditionId', v_context.race_edition_id,
        'stageResultId', new.id,
        'role', v_context.race_role,
        'profile', v_context.profile_type
      )
    );
  end if;

  if new.status = 'finished' and new.rank = 1 then$ambition$]
      ];
    else
      v_replacements := array[
        array['  v_delta numeric;', '  v_delta numeric;' || E'\n  ' || v_marker],
        array['    roster.rider_id,', $gc_context$    roster.rider_id,
    rider.personality_key,
    case
      when rider.personality_key = 'colerique' then (
        select official.input_data #>> array['personalityLeadershipByRiderId', roster.rider_id::text, 'generalRole']
        from public.official_stage_simulations as official
        where official.stage_id = (
          select stage.id
          from public.stages as stage
          where stage.race_edition_id = edition.id
          order by stage.stage_number
          limit 1
        )
          and official.input_data #>> array['personalityLeadershipByRiderId', roster.rider_id::text, 'personalityKey']
            = rider.personality_key
      )
    end as race_role,$gc_context$],
        array[E'\n    if v_delta <> 0 then', $gc_delta$
    v_colerique_penalty := coalesce(
      v_context.personality_key = 'colerique'
      and new.status = 'classified' and new.final_rank is not null
      and v_context.race_role in ('leader', 'leader_sprinter')
      and v_delta < 0, false
    );
    if v_colerique_penalty then v_delta := v_delta - 1; end if;

    if v_delta <> 0 then$gc_delta$],
        array[E'\n      perform public.apply_rider_morale_event(\n        v_context.rider_id,\n        v_context.season_day_id,\n        ''race_result'',', $gc_description$
      if v_colerique_penalty then
        v_description := v_description || ' · Caractère Colérique';
      end if;

      perform public.apply_rider_morale_event(
        v_context.rider_id,
        v_context.season_day_id,
        'race_result',$gc_description$]
      ];
    end if;

    foreach v_pair slice 1 in array v_replacements loop
      -- pg_get_functiondef normalizes newlines even when this file uses CRLF.
      v_pair := array[replace(v_pair[1], chr(13), ''), replace(v_pair[2], chr(13), '')];
      if length(v_definition) - length(replace(v_definition, v_pair[1], '')) <> length(v_pair[1]) then
        raise exception 'Unexpected result morale definition for %, anchor: %', v_signature, v_pair[1];
      end if;
      v_definition := replace(v_definition, v_pair[1], v_pair[2]);
    end loop;
    execute v_definition;
  end loop;
end;
$personality_patch$;

commit;
