begin;

-- One guarded exception to official-race immutability. The exact source rows
-- are checked and backed up before the lock, stage, attack participants and
-- four provisional secondary classifications are replaced atomically.
create or replace function public.repair_boucle_stage9_race_dynamics_20260923(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key constant text := 'boucle-provinces-s3-stage9-race-dynamics-20260923';
  v_edition constant uuid := '716dad06-c144-47a7-afbc-68bff48f8e57';
  v_stage constant uuid := 'e426b44f-2393-439c-9d5c-c5c8f4afea0c';
  v_next_stage constant uuid := '244e7ac0-d11f-4381-a600-ca1fb8fd2768';
  v_source_engine constant text := '2026.09-real-pursuit-groups-v33';
  v_target_engine constant text := '2026.09-real-pursuit-groups-v34';
  v_lock public.official_stage_simulations%rowtype;
  v_snapshot jsonb;
  v_summary jsonb;
begin
  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or p_payload->>'editionId' is distinct from v_edition::text
    or p_payload->>'stageId' is distinct from v_stage::text
    or p_payload->>'oldEngineVersion' is distinct from v_source_engine
    or p_payload->>'newEngineVersion' is distinct from v_target_engine
    or jsonb_typeof(p_payload->'simulation') <> 'object'
    or jsonb_typeof(p_payload#>'{simulation,results}') <> 'array'
    or jsonb_typeof(p_payload#>'{simulation,timeline}') <> 'array'
    or jsonb_typeof(p_payload#>'{simulation,visualTimeline}') <> 'array'
    or jsonb_typeof(p_payload->'stageRows') <> 'array'
    or jsonb_typeof(p_payload->'secondaryBefore') <> 'array'
    or jsonb_typeof(p_payload->'secondaryAfter') <> 'array'
    or jsonb_typeof(p_payload->'auditSummary') <> 'object'
    or jsonb_typeof(p_payload->'attackBefore') <> 'array'
    or jsonb_typeof(p_payload->'attackAfter') <> 'array'
    or jsonb_typeof(p_payload->'newsBefore') <> 'array'
    or jsonb_typeof(p_payload->'newsAfter') <> 'array'
    or jsonb_typeof(p_payload->'interviewsBefore') <> 'array'
    or jsonb_typeof(p_payload->'interviewReactionsBefore') <> 'array'
    or jsonb_array_length(p_payload#>'{simulation,results}') <> 177
    or jsonb_array_length(p_payload#>'{simulation,timeline}') <> 12
    or jsonb_array_length(p_payload#>'{simulation,visualTimeline}') < 12
    or jsonb_array_length(p_payload->'stageRows') <> 177
    or jsonb_array_length(p_payload->'interviewsBefore') <> 8
    or jsonb_array_length(p_payload->'interviewReactionsBefore') <> 0 then
    raise exception 'Charge de correction de la Boucle des Provinces invalide.';
  end if;
  if p_payload#>>'{simulation,stageId}' is distinct from v_stage::text
    or (select count(distinct result.value->>'riderId')
        from jsonb_array_elements(p_payload#>'{simulation,results}') as result(value)) <> 177 then
    raise exception 'Étape ou startlist corrigée invalide.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  lock table public.official_stage_simulations,
    public.official_stage_simulation_claims,
    public.post_race_news_events,
    public.post_race_interviews,
    public.post_race_interview_answer_reactions
    in share row exclusive mode;
  select * into v_lock
  from public.official_stage_simulations
  where stage_id = v_stage and race_edition_id = v_edition
  for update;

  if exists (
    select 1 from public.official_race_historical_corrections
    where correction_key = v_key
  ) then
    if v_lock.engine_version = v_target_engine
      and v_lock.simulation_data = p_payload->'simulation' then
      return jsonb_build_object('status', 'already_applied');
    end if;
    raise exception 'Correction de la Boucle des Provinces déjà appliquée avec un autre contenu.';
  end if;

  if v_lock.stage_id is null or v_lock.engine_version <> v_source_engine then
    raise exception 'Simulation source de la Boucle des Provinces non conforme.';
  end if;
  if clock_timestamp() >= timestamptz '2026-09-23 15:50:00+00' then
    raise exception 'Fenêtre sûre dépassée avant le pré-calcul de l étape 10.';
  end if;
  if (select count(*) from public.stages where race_edition_id = v_edition) <> 12
    or (select count(*) from public.stages
        where race_edition_id = v_edition and status = 'completed') <> 9
    or (select stage_number from public.stages where id = v_stage) <> 9
    or (select status from public.stages where id = v_next_stage) <> 'planned'
    or exists (select 1 from public.official_stage_simulations where stage_id = v_next_stage)
    or exists (select 1 from public.official_stage_simulation_claims where stage_id = v_next_stage)
    or (select count(*) from public.stage_results where stage_id = v_stage) <> 177 then
    raise exception 'État sportif de la Boucle des Provinces différent de l audit.';
  end if;
  if p_payload#>>'{simulation,results,0,riderId}' is distinct from
      v_lock.simulation_data#>>'{results,0,riderId}'
    or exists (
      (select result.value->>'riderId'
       from jsonb_array_elements(p_payload#>'{simulation,results}') as result(value)
       except
       select result.value->>'riderId'
       from jsonb_array_elements(v_lock.simulation_data->'results') as result(value))
      union all
      (select result.value->>'riderId'
       from jsonb_array_elements(v_lock.simulation_data->'results') as result(value)
       except
       select result.value->>'riderId'
       from jsonb_array_elements(p_payload#>'{simulation,results}') as result(value))
    )
    or exists (
      select 1
      from jsonb_array_elements(p_payload#>'{simulation,results}') as corrected(value)
      join jsonb_array_elements(v_lock.simulation_data->'results') as source(value)
        on source.value->>'riderId' = corrected.value->>'riderId'
      where source.value->>'status' is distinct from corrected.value->>'status'
        or source.value->'injury' is distinct from corrected.value->'injury'
        or source.value->'abandonment' is distinct from corrected.value->'abandonment'
    ) then
    raise exception 'Vainqueur, startlist ou disponibilité du replay incompatibles.';
  end if;

  create temporary table pg_temp.boucle_stage_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'stageRows') as row(
    "resultId" uuid, "rosterId" uuid, "riderId" uuid,
    "oldStatus" text, "oldRank" smallint, "oldTime" bigint, "oldGap" bigint,
    "oldMountain" integer, "oldSprint" integer, "oldBonus" smallint,
    "oldPenalty" smallint, "oldAbandonment" text, "oldInjuryId" uuid,
    "newStatus" text, "newRank" smallint, "newTime" bigint, "newGap" bigint,
    "newMountain" integer, "newSprint" integer, "newBonus" smallint,
    "newPenalty" smallint, "newAbandonment" text, "newInjuryId" uuid
  );
  create temporary table pg_temp.boucle_secondary_before on commit drop as
  select * from jsonb_to_recordset(p_payload->'secondaryBefore') as row(
    id uuid, "classificationType" text, "rosterId" uuid,
    "teamSeasonId" uuid, "historicalName" text, rank smallint,
    points integer, time bigint
  );
  create temporary table pg_temp.boucle_secondary_after on commit drop as
  select * from jsonb_to_recordset(p_payload->'secondaryAfter') as row(
    "classificationType" text, "rosterId" uuid,
    "teamSeasonId" uuid, "historicalName" text, rank smallint,
    points integer, time bigint
  );
  create temporary table pg_temp.boucle_attack_before on commit drop as
  select * from jsonb_to_recordset(p_payload->'attackBefore') as row(
    "rosterId" uuid, "participationType" text, "firstSegmentNumber" smallint
  );
  create temporary table pg_temp.boucle_attack_after on commit drop as
  select * from jsonb_to_recordset(p_payload->'attackAfter') as row(
    "rosterId" uuid, "riderId" uuid, "participationType" text,
    "firstSegmentNumber" smallint
  );
  create temporary table pg_temp.boucle_news_before on commit drop as
  select * from jsonb_to_recordset(p_payload->'newsBefore') as row(
    id text, "eventKind" text, title text, detail text,
    "featuredRiderId" uuid, "featuredTeamId" uuid, "happenedAt" timestamptz
  );
  create temporary table pg_temp.boucle_news_after on commit drop as
  select * from jsonb_to_recordset(p_payload->'newsAfter') as row(
    id text, "eventKind" text, title text, detail text,
    "featuredRiderId" uuid, "featuredTeamId" uuid, "happenedAt" timestamptz
  );
  create temporary table pg_temp.boucle_interviews_before on commit drop as
  select value as row_json
  from jsonb_array_elements(p_payload->'interviewsBefore');

  if (select count(*) from pg_temp.boucle_stage_rows) <> 177
    or (select count(distinct "resultId") from pg_temp.boucle_stage_rows) <> 177
    or (select count(distinct "rosterId") from pg_temp.boucle_stage_rows) <> 177
    or (select count(distinct "riderId") from pg_temp.boucle_stage_rows) <> 177
    or (select count(*) from pg_temp.boucle_secondary_before)
       <> (select count(*) from public.race_secondary_results where race_edition_id = v_edition)
    or (select count(distinct id) from pg_temp.boucle_secondary_before)
       <> (select count(*) from pg_temp.boucle_secondary_before)
    or (select count(*) from pg_temp.boucle_secondary_after) = 0
    or exists (select 1 from pg_temp.boucle_secondary_after
      where "classificationType" not in ('mountain', 'sprint', 'youth', 'team')
        or rank < 1)
    or exists (select 1 from pg_temp.boucle_secondary_after
      group by "classificationType", rank having count(*) <> 1) then
    raise exception 'Cardinalité du rattrapage différente de l audit.';
  end if;
  if (select count(*) from pg_temp.boucle_news_before)
       <> (select count(*) from public.post_race_news_events where stage_id = v_stage)
    or (select count(*) from pg_temp.boucle_news_after) = 0
    or exists (select 1 from pg_temp.boucle_news_after
      where id not like 'post-race:' || v_stage::text || ':%'
        or "eventKind" not in ('breakaway', 'incident', 'classification'))
    or (select count(*) from pg_temp.boucle_interviews_before) <> 8 then
    raise exception 'Actualités ou interviews de la correction invalides.';
  end if;
  if exists (
    select 1 from pg_temp.boucle_stage_rows as payload
    left join public.stage_results as result
      on result.id = payload."resultId" and result.stage_id = v_stage
    left join public.race_rosters as roster on roster.id = result.race_roster_id
    where result.id is null
      or result.race_roster_id is distinct from payload."rosterId"
      or roster.rider_id is distinct from payload."riderId"
      or result.status is distinct from payload."oldStatus"
      or result.rank is distinct from payload."oldRank"
      or result.elapsed_time_ms is distinct from payload."oldTime"
      or result.gap_to_winner_ms is distinct from payload."oldGap"
      or result.mountain_points is distinct from payload."oldMountain"
      or result.sprint_points is distinct from payload."oldSprint"
      or result.time_bonus_seconds is distinct from payload."oldBonus"
      or result.time_penalty_seconds is distinct from payload."oldPenalty"
      or result.abandonment_reason is distinct from payload."oldAbandonment"
      or result.injury_id is distinct from payload."oldInjuryId"
      or payload."oldStatus" is distinct from payload."newStatus"
      or payload."oldInjuryId" is distinct from payload."newInjuryId"
      or payload."oldAbandonment" is distinct from payload."newAbandonment"
  ) then
    raise exception 'Résultats sources différents de la copie auditée.';
  end if;
  if exists (
    select 1 from pg_temp.boucle_secondary_before as payload
    left join public.race_secondary_results as result
      on result.id = payload.id and result.race_edition_id = v_edition
    where result.id is null
      or result.classification_type is distinct from payload."classificationType"
      or result.race_roster_id is distinct from payload."rosterId"
      or result.team_season_id is distinct from payload."teamSeasonId"
      or result.historical_team_name is distinct from payload."historicalName"
      or result.rank is distinct from payload.rank
      or result.points is distinct from payload.points
      or result.total_time_ms is distinct from payload.time
  ) or (select count(*) from pg_temp.boucle_attack_before)
       <> (select count(*) from public.stage_attack_participants where stage_id = v_stage)
    or exists (
      select 1 from pg_temp.boucle_attack_before as payload
      left join public.stage_attack_participants as participant
        on participant.stage_id = v_stage
       and participant.race_roster_id = payload."rosterId"
      where participant.race_roster_id is null
        or participant.participation_type is distinct from payload."participationType"
        or participant.first_segment_number is distinct from payload."firstSegmentNumber"
    ) then
    raise exception 'Classements annexes ou attaquants différents de la copie auditée.';
  end if;
  if exists (
    select 1 from pg_temp.boucle_news_before as payload
    left join public.post_race_news_events as news
      on news.id = payload.id and news.stage_id = v_stage
    where news.id is null
      or news.event_kind is distinct from payload."eventKind"
      or news.title is distinct from payload.title
      or news.detail is distinct from payload.detail
      or news.featured_rider_id is distinct from payload."featuredRiderId"
      or news.featured_team_id is distinct from payload."featuredTeamId"
      or news.happened_at is distinct from payload."happenedAt"
  ) or exists (
    select 1
    from public.post_race_interviews as interview
    left join pg_temp.boucle_interviews_before as payload
      on payload.row_json->>'id' = interview.id::text
    where interview.stage_id = v_stage and (
      payload.row_json is null
      or interview.race_edition_id::text is distinct from payload.row_json->>'race_edition_id'
      or interview.team_id::text is distinct from payload.row_json->>'team_id'
      or interview.sporting_director_id::text is distinct from payload.row_json->>'sporting_director_id'
      or interview.season_id::text is distinct from payload.row_json->>'season_id'
      or interview.question_set is distinct from payload.row_json->'question_set'
      or interview.answers is distinct from payload.row_json->'answers'
      or interview.closing_note is distinct from payload.row_json->>'closing_note'
      or interview.context is distinct from payload.row_json->'context'
      or interview.status is distinct from payload.row_json->>'status'
      or interview.submitted_at is distinct from (payload.row_json->>'submitted_at')::timestamptz
      or interview.created_at is distinct from (payload.row_json->>'created_at')::timestamptz
      or interview.updated_at is distinct from (payload.row_json->>'updated_at')::timestamptz
      or interview.event_choice_id is distinct from payload.row_json->>'event_choice_id'
      or interview.event_outcome is distinct from nullif(payload.row_json->'event_outcome', 'null'::jsonb)
      or interview.event_resolved_at is distinct from (payload.row_json->>'event_resolved_at')::timestamptz
    )
  ) or (select count(*) from public.post_race_interviews where stage_id = v_stage) <> 8
    or exists (
    select 1 from public.post_race_interviews
    where stage_id = v_stage and (
      status <> 'pending' or answers <> '[]'::jsonb or closing_note is not null
      or submitted_at is not null or event_choice_id is not null
      or event_outcome is not null or event_resolved_at is not null)
  ) or exists (
    select 1 from public.post_race_interview_answer_reactions as reaction
    join public.post_race_interviews as interview on interview.id = reaction.interview_id
    where interview.stage_id = v_stage
  ) then
    raise exception 'Actualités ou interviews différentes de la copie auditée.';
  end if;
  if exists (
    select 1 from pg_temp.boucle_secondary_after as payload
    left join public.race_rosters as roster on roster.id = payload."rosterId"
    left join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    where (payload."classificationType" <> 'team' and (
          roster.id is null or registration.race_edition_id <> v_edition
          or payload."teamSeasonId" is not null))
       or (payload."classificationType" = 'team' and (
          payload."rosterId" is not null
          or (payload."teamSeasonId" is null and payload."historicalName" is null)))
  ) or exists (
    select 1 from pg_temp.boucle_attack_after as payload
    left join public.race_rosters as roster on roster.id = payload."rosterId"
    left join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    where roster.rider_id is distinct from payload."riderId"
      or registration.race_edition_id <> v_edition
      or payload."participationType" not in ('breakaway', 'chase')
      or payload."firstSegmentNumber" < 1
  ) then
    raise exception 'Cibles annexes ou attaquants invalides.';
  end if;

  select jsonb_build_object(
    'officialLock', to_jsonb(v_lock),
    'stageResults', (select jsonb_agg(to_jsonb(result) order by result.rank nulls last)
      from public.stage_results as result where result.stage_id = v_stage),
    'secondaryResults', (select jsonb_agg(to_jsonb(result)
      order by result.classification_type, result.rank)
      from public.race_secondary_results as result where result.race_edition_id = v_edition),
    'attackParticipants', (select jsonb_agg(to_jsonb(participant))
      from public.stage_attack_participants as participant where participant.stage_id = v_stage),
    'postRaceNews', (select jsonb_agg(to_jsonb(news))
      from public.post_race_news_events as news where news.stage_id = v_stage),
    'postRaceInterviews', (select jsonb_agg(to_jsonb(interview))
      from public.post_race_interviews as interview where interview.stage_id = v_stage),
    'postRaceInterviewReactions', (select jsonb_agg(to_jsonb(reaction))
      from public.post_race_interview_answer_reactions as reaction
      join public.post_race_interviews as interview on interview.id = reaction.interview_id
      where interview.stage_id = v_stage)
  ) into v_snapshot;

  insert into public.official_race_historical_corrections (
    correction_key, race_edition_id, stage_id, payload_md5,
    before_snapshot, after_summary
  ) values (
    v_key, v_edition, v_stage, md5(p_payload::text), v_snapshot,
    jsonb_build_object('status', 'applying')
  );

  -- Move ranks outside the constrained range before applying the new order.
  update public.stage_results
  set rank = rank + 1000, updated_at = now()
  where stage_id = v_stage and rank is not null;

  update public.stage_results as result set
    status = payload."newStatus",
    rank = payload."newRank",
    elapsed_time_ms = payload."newTime",
    gap_to_winner_ms = payload."newGap",
    mountain_points = payload."newMountain",
    sprint_points = payload."newSprint",
    time_bonus_seconds = payload."newBonus",
    time_penalty_seconds = payload."newPenalty",
    abandonment_reason = payload."newAbandonment",
    injury_id = payload."newInjuryId",
    updated_at = now()
  from pg_temp.boucle_stage_rows as payload
  where result.id = payload."resultId";

  delete from public.race_secondary_results where race_edition_id = v_edition;
  insert into public.race_secondary_results (
    race_edition_id, classification_type, race_roster_id, team_season_id,
    historical_team_name, rank, points, total_time_ms
  ) select v_edition, "classificationType", "rosterId", "teamSeasonId",
    "historicalName", rank, points, time
  from pg_temp.boucle_secondary_after;

  delete from public.stage_attack_participants where stage_id = v_stage;
  insert into public.stage_attack_participants (
    stage_id, race_roster_id, participation_type, first_segment_number
  ) select v_stage, "rosterId", "participationType", "firstSegmentNumber"
  from pg_temp.boucle_attack_after;

  delete from public.post_race_news_events where stage_id = v_stage;
  insert into public.post_race_news_events (
    id, race_edition_id, stage_id, event_kind, title, detail,
    featured_rider_id, featured_team_id, happened_at
  ) select id, v_edition, v_stage, "eventKind", title, detail,
    "featuredRiderId", "featuredTeamId", "happenedAt"
  from pg_temp.boucle_news_after;

  -- These eight rows are still untouched drafts. They are recreated lazily
  -- from the corrected result when a sporting director next opens the page.
  delete from public.post_race_interviews where stage_id = v_stage;

  update public.official_stage_simulations
  set engine_version = v_target_engine,
      simulation_data = p_payload->'simulation'
  where stage_id = v_stage and race_edition_id = v_edition;

  v_summary := jsonb_build_object(
    'status', 'applied',
    'engineVersion', v_target_engine,
    'stageRows', (select count(*) from pg_temp.boucle_stage_rows),
    'secondaryRows', (select count(*) from pg_temp.boucle_secondary_after),
    'mountainRows', (select count(*) from pg_temp.boucle_secondary_after where "classificationType" = 'mountain'),
    'sprintRows', (select count(*) from pg_temp.boucle_secondary_after where "classificationType" = 'sprint'),
    'youthRows', (select count(*) from pg_temp.boucle_secondary_after where "classificationType" = 'youth'),
    'teamRows', (select count(*) from pg_temp.boucle_secondary_after where "classificationType" = 'team'),
    'attackRows', (select count(*) from pg_temp.boucle_attack_after),
    'newsRows', (select count(*) from pg_temp.boucle_news_after),
    'resetInterviews', (select count(*) from pg_temp.boucle_interviews_before)
  ) || (p_payload->'auditSummary');
  update public.official_race_historical_corrections
  set after_summary = v_summary where correction_key = v_key;
  return v_summary;
end;
$$;

revoke all on function public.repair_boucle_stage9_race_dynamics_20260923(jsonb)
  from public, anon, authenticated;
grant execute on function public.repair_boucle_stage9_race_dynamics_20260923(jsonb)
  to service_role;

commit;
