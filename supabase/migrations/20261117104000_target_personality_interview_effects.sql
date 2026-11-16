begin;

-- Only the server may read the saved catalogue of possible consequences.
-- An authenticated owner retains the readable question set and resolved reply.
revoke select on public.post_race_interviews from public, anon, authenticated;
revoke select (context) on public.post_race_interviews from public, anon, authenticated;
grant select (
  id, race_edition_id, stage_id, team_id, sporting_director_id, season_id,
  question_set, answers, closing_note, status, submitted_at, created_at, updated_at,
  event_choice_id, event_outcome, event_resolved_at
) on public.post_race_interviews to authenticated;

create or replace function private.resolve_mixed_zone_event_rider(
  p_context jsonb,
  p_stage_id uuid,
  p_team_id uuid
)
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_rider_id uuid := nullif(p_context -> 'zoneMixteEvent' ->> 'riderId', '')::uuid;
begin
  if v_rider_id is null then
    return nullif(p_context ->> 'riderId', '')::uuid;
  end if;

  if not exists (
    select 1
    from public.stage_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    where result.stage_id = p_stage_id and team_season.team_id = p_team_id
      and roster.rider_id = v_rider_id
      and result.status in ('finished', 'did_not_finish', 'outside_time_limit')
  ) then
    raise exception 'Le coureur de cette question ne figure pas dans les résultats de votre équipe.';
  end if;

  return v_rider_id;
end;
$$;

revoke all on function private.resolve_mixed_zone_event_rider(jsonb, uuid, uuid)
  from public, anon, authenticated, service_role;

do $patch$
declare
  v_submit text := replace(pg_get_functiondef('public.submit_post_race_interview_with_event(uuid,uuid,jsonb,text,text)'::regprocedure), E'\r\n', E'\n');
  v_morale text := replace(pg_get_functiondef('public.apply_interview_morale()'::regprocedure), E'\r\n', E'\n');
  v_pair text[];
  v_submit_replacements constant text[][] := array[
    array['    interview.team_id,', E'    interview.team_id,\n    interview.stage_id,'],
    array['    if v_reputation_delta <> 0 then', $resolve$    v_rider_id := private.resolve_mixed_zone_event_rider(
      v_context.interview_context, v_context.stage_id, v_context.team_id
    );
    if v_reputation_delta <> 0 then$resolve$],
    array[$old$        nullif(v_context.interview_context ->> 'riderId', '')::uuid,$old$, '        v_rider_id,'],
    array[$old$    v_rider_id := nullif(v_context.interview_context ->> 'riderId', '')::uuid;
$old$, '']
  ];
  v_morale_anchor constant text := $old$  v_rider_id := nullif(new.context ->> 'riderId', '')::uuid;$old$;
begin
  if position('private.resolve_mixed_zone_event_rider(' in v_submit) = 0 then
    foreach v_pair slice 1 in array v_submit_replacements loop
      if length(v_submit) - length(replace(v_submit, v_pair[1], '')) <> length(v_pair[1]) then
        raise exception 'Unexpected mixed-zone submission definition, personality update aborted.';
      end if;
      v_submit := replace(v_submit, v_pair[1], v_pair[2]);
    end loop;
    execute v_submit;
  end if;

  if position('private.resolve_mixed_zone_event_rider(' in v_morale) = 0 then
    if length(v_morale) - length(replace(v_morale, v_morale_anchor, '')) <> length(v_morale_anchor) then
      raise exception 'Unexpected mixed-zone morale definition, personality update aborted.';
    end if;
    execute replace(v_morale, v_morale_anchor,
      '  v_rider_id := private.resolve_mixed_zone_event_rider(new.context, new.stage_id, new.team_id);');
  end if;
end;
$patch$;

notify pgrst, 'reload schema';

commit;
