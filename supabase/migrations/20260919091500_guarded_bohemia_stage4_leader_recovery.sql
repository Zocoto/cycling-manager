begin;

-- A single, auditable exception to the immutability of official races. The
-- function refuses every edition, stage and source engine other than the one
-- reproduced from the locked input on 18 September 2026.
create or replace function public.repair_bohemia_stage4_20260918(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key constant text := 'bohemia-s3-stage4-leader-recovery-20260918';
  v_edition constant uuid := 'cb59a394-1463-4f10-91a2-6a73dbd74a42';
  v_stage constant uuid := '0ea120e6-9fd0-437d-b0d1-d5c98736f76a';
  v_lock public.official_stage_simulations%rowtype;
  v_row record;
  v_event public.reward_events%rowtype;
  v_context record;
  v_final_day record;
  v_snapshot jsonb;
  v_summary jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_payload->>'editionId' is distinct from v_edition::text
    or p_payload->>'stageId' is distinct from v_stage::text
    or p_payload->>'oldEngineVersion' is distinct from '2026.09-observed-finish-times-v29'
    or p_payload->>'newEngineVersion' is distinct from '2026.09-leader-recovery-priority-v30'
    or jsonb_typeof(p_payload->'stageRows') <> 'array'
    or jsonb_typeof(p_payload->'raceRows') <> 'array'
    or jsonb_typeof(p_payload->'secondaryRows') <> 'array'
    or jsonb_typeof(p_payload->'rewardRows') <> 'array'
    or jsonb_typeof(p_payload->'attackRows') <> 'array'
    or jsonb_typeof(p_payload->'newsRow') <> 'object'
    or jsonb_typeof(p_payload->'simulation') <> 'object' then
    raise exception 'Charge de correction Bohême invalide.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  if exists (select 1 from public.official_race_historical_corrections where correction_key = v_key) then
    raise exception 'Correction Bohême déjà appliquée.';
  end if;
  select * into v_lock from public.official_stage_simulations
  where stage_id = v_stage and race_edition_id = v_edition for update;
  if not found or v_lock.engine_version <> p_payload->>'oldEngineVersion' then
    raise exception 'Simulation source non conforme à l audit.';
  end if;
  if (select count(*) from public.stages where race_edition_id = v_edition) <> 4
    or (select count(*) from public.stages where race_edition_id = v_edition and status = 'completed') <> 4
    or (select count(*) from public.race_editions where id = v_edition and status = 'completed') <> 1
    or (select stage_number from public.stages where id = v_stage) <> 4 then
    raise exception 'Édition ou étape Bohême modifiée.';
  end if;
  select stage.season_day_id, day.day_number into v_final_day
  from public.stages as stage join public.season_days as day on day.id = stage.season_day_id
  where stage.id = v_stage;
  if v_final_day is null then raise exception 'Jour de règlement absent.'; end if;

  create temporary table pg_temp.bohemia_stage_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'stageRows') as r(
    id uuid, "riderId" uuid, "oldRank" smallint, "oldTime" bigint, "oldGap" bigint,
    "oldMountain" integer, "oldSprint" integer, "oldBonus" integer,
    "newRank" smallint, "newTime" bigint, "newGap" bigint,
    "newMountain" integer, "newSprint" integer, "newBonus" integer
  );
  create temporary table pg_temp.bohemia_race_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'raceRows') as r(
    id uuid, "riderId" uuid, "oldRank" smallint, "oldTime" bigint, "oldGap" bigint,
    "newRank" smallint, "newTime" bigint, "newGap" bigint
  );
  create temporary table pg_temp.bohemia_secondary_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'secondaryRows') as r(
    id uuid, type text, "oldRank" smallint, "oldPoints" integer, "oldTime" bigint,
    "newRank" smallint, "newPoints" integer, "newTime" bigint
  );
  create temporary table pg_temp.bohemia_reward_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'rewardRows') as r(
    "riderId" uuid, "rosterId" uuid, kind text,
    "oldSource" text, "newSource" text, "oldCash" numeric, "newCash" numeric,
    "oldUci" integer, "newUci" integer, "oldRep" numeric, "newRep" numeric,
    "oldXp" integer, "newXp" integer, "newDescription" text
  );
  create temporary table pg_temp.bohemia_attack_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'attackRows') as r(
    "rosterId" uuid, "riderId" uuid, type text, segment smallint
  );

  if (select count(*) from pg_temp.bohemia_stage_rows) <> 33
    or (select count(distinct id) from pg_temp.bohemia_stage_rows) <> 33
    or (select count(*) from pg_temp.bohemia_race_rows) <> 33
    or (select count(distinct id) from pg_temp.bohemia_race_rows) <> 33
    or (select count(*) from pg_temp.bohemia_secondary_rows) <> 49
    or (select count(distinct id) from pg_temp.bohemia_secondary_rows) <> 49
    or (select count(*) from pg_temp.bohemia_reward_rows) <> 30
    or (select count(distinct "oldSource") from pg_temp.bohemia_reward_rows) <> 30
    or (select count(distinct "newSource") from pg_temp.bohemia_reward_rows) <> 30
    or (select count(*) from pg_temp.bohemia_attack_rows) <> 4
    or (select count(distinct "rosterId") from pg_temp.bohemia_attack_rows) <> 4
    or (select count(*) from public.stage_results where stage_id = v_stage) <> 33
    or (select count(*) from public.race_results where race_edition_id = v_edition) <> 33
    or (select count(*) from public.race_secondary_results where race_edition_id = v_edition) <> 49 then
    raise exception 'Cardinalités Bohême différentes de l audit.';
  end if;
  if (select id from pg_temp.bohemia_stage_rows where "oldRank" = 1)
    is distinct from (select id from pg_temp.bohemia_stage_rows where "newRank" = 1)
    or (select id from pg_temp.bohemia_race_rows where "oldRank" = 1)
    is distinct from (select id from pg_temp.bohemia_race_rows where "newRank" = 1)
    or exists (
      select 1 from pg_temp.bohemia_secondary_rows
      where type in ('mountain', 'sprint', 'youth', 'team') and "oldRank" = 1
        and id is distinct from (
          select id from pg_temp.bohemia_secondary_rows as newer
          where newer.type = bohemia_secondary_rows.type and newer."newRank" = 1
        )
    ) then
    raise exception 'Un vainqueur a changé : le plan de palmarès ne suffit plus.';
  end if;
  if exists (
    select 1 from pg_temp.bohemia_stage_rows as p
    left join public.stage_results as s on s.id = p.id and s.stage_id = v_stage
    left join public.race_rosters as roster on roster.id = s.race_roster_id
    where s.id is null or roster.rider_id is distinct from p."riderId"
      or s.status <> 'finished' or s.rank is distinct from p."oldRank"
      or s.elapsed_time_ms is distinct from p."oldTime"
      or s.gap_to_winner_ms is distinct from p."oldGap"
      or s.mountain_points is distinct from p."oldMountain"
      or s.sprint_points is distinct from p."oldSprint"
      or s.time_bonus_seconds is distinct from p."oldBonus"
      or s.time_penalty_seconds <> 0 or s.injury_id is not null
  ) or exists (
    select 1 from pg_temp.bohemia_race_rows as p
    left join public.race_results as r on r.id = p.id and r.race_edition_id = v_edition
    left join public.race_rosters as roster on roster.id = r.race_roster_id
    where r.id is null or roster.rider_id is distinct from p."riderId"
      or r.status <> 'classified' or r.final_rank is distinct from p."oldRank"
      or r.total_time_ms is distinct from p."oldTime"
      or r.gap_to_winner_ms is distinct from p."oldGap"
  ) or exists (
    select 1 from pg_temp.bohemia_secondary_rows as p
    left join public.race_secondary_results as r
      on r.id = p.id and r.race_edition_id = v_edition and r.classification_type = p.type
    where r.id is null or p.type not in ('mountain', 'sprint', 'youth', 'team')
      or r.rank is distinct from p."oldRank" or r.points is distinct from p."oldPoints"
      or r.total_time_ms is distinct from p."oldTime"
  ) then
    raise exception 'Classements officiels différents de la copie source.';
  end if;
  if p_payload#>>'{simulation,stageId}' is distinct from v_stage::text
    or jsonb_array_length(p_payload#>'{simulation,results}') <> 33
    or jsonb_array_length(p_payload#>'{simulation,timeline}') = 0
    or jsonb_array_length(p_payload#>'{simulation,visualTimeline}') = 0
    or exists (
      select 1 from pg_temp.bohemia_stage_rows as p
      left join jsonb_array_elements(p_payload#>'{simulation,results}') as sim_result(value)
        on sim_result.value->>'riderId' = p."riderId"::text
      where sim_result.value is null or (sim_result.value->>'rank')::smallint is distinct from p."newRank"
        or (sim_result.value->>'elapsedTimeSeconds')::bigint * 1000 is distinct from p."newTime"
    ) then
    raise exception 'Replay corrigé incomplet ou incompatible avec les résultats.';
  end if;
  if (select count(*) from public.stage_attack_participants where stage_id = v_stage) <> 3
    or (select count(*) from public.stage_attack_participants
        where stage_id = v_stage and participation_type = 'breakaway' and first_segment_number = 2
          and race_roster_id in (
            select roster.id from public.race_rosters as roster
            where roster.rider_id in (
              'cf3e4ba4-ae50-4928-9d43-7f91316998ce'::uuid,
              'd806d170-1cc3-4f85-8524-bb3572c4bdfa'::uuid,
              'e24f1be4-f5e1-4c8c-b04a-6314357bfd83'::uuid
            )
          )) <> 3
    or (select count(*) from pg_temp.bohemia_attack_rows where type = 'breakaway' and segment = 2) <> 3
    or (select count(*) from pg_temp.bohemia_attack_rows
        where "riderId" = '331d0656-9330-42a8-a1a8-e68650c7f4f2'::uuid
          and type = 'chase' and segment = 8) <> 1
    or exists (select 1 from pg_temp.bohemia_attack_rows as p
      left join public.race_rosters as roster on roster.id = p."rosterId"
      where roster.rider_id is distinct from p."riderId") then
    raise exception 'Attaquants non conformes à la chronologie auditée.';
  end if;
  if not exists (
    select 1 from public.post_race_news_events as news
    where news.id = p_payload#>>'{newsRow,id}' and news.stage_id = v_stage
      and news.event_kind = 'classification'
      and news.detail = p_payload#>>'{newsRow,oldDetail}'
      and news.featured_rider_id::text = p_payload#>>'{newsRow,oldRiderId}'
      and news.featured_team_id::text is not distinct from p_payload#>>'{newsRow,oldTeamId}'
  ) or not exists (select 1 from public.teams where id::text = p_payload#>>'{newsRow,newTeamId}') then
    raise exception 'Brève de course modifiée depuis l audit.';
  end if;

  create temporary table pg_temp.bohemia_account_deltas (
    rider_id uuid not null, team_season_id uuid not null, season_id uuid not null,
    sporting_director_id uuid, source_reference text not null,
    cash_delta numeric(14, 2) not null, uci_delta integer not null,
    rep_delta numeric(12, 2) not null, xp_delta integer not null
  ) on commit drop;
  for v_row in select * from pg_temp.bohemia_reward_rows loop
    select roster.rider_id, registration.team_season_id, team.season_id,
      rider.country_id, director.id as sporting_director_id into v_context
    from public.race_rosters as roster
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team on team.id = registration.team_season_id
    join public.riders as rider on rider.id = roster.rider_id
    left join public.team_manager_assignments as assignment
      on assignment.team_id = team.team_id and assignment.role = 'general_manager'
        and assignment.status = 'active'
    left join public.sporting_directors as director on director.id = assignment.sporting_director_id
    where roster.id = v_row."rosterId" and roster.rider_id = v_row."riderId"
      and registration.race_edition_id = v_edition limit 1;
    if v_context is null then raise exception 'Destinataire absent : %', v_row."riderId"; end if;
    select * into v_event from public.reward_events
    where source_reference = v_row."oldSource" for update;
    if found then
      if v_event.rider_id is distinct from v_row."riderId"
        or v_event.team_season_id is distinct from v_context.team_season_id
        or v_event.source_type is distinct from v_row.kind
        or v_event.cash_prize is distinct from v_row."oldCash"
        or v_event.uci_points is distinct from v_row."oldUci"
        or v_event.reputation_points is distinct from v_row."oldRep"
        or v_event.experience_points is distinct from v_row."oldXp" then
        raise exception 'Prime source divergente : %', v_row."oldSource";
      end if;
      v_context.sporting_director_id := v_event.sporting_director_id;
    elsif v_row."oldCash" <> 0 or v_row."oldUci" <> 0
      or v_row."oldRep" <> 0 or v_row."oldXp" <> 0 then
      raise exception 'Prime source absente : %', v_row."oldSource";
    end if;
    if v_context.sporting_director_id is null
      and (v_row."newRep" <> v_row."oldRep" or v_row."newXp" <> v_row."oldXp") then
      raise exception 'Directeur sportif absent pour %', v_row."riderId";
    end if;
    if v_row."newCash" < 0 or v_row."newUci" < 0
      or v_row."newRep" < 0 or v_row."newXp" < 0
      or v_row."newDescription" is null then
      raise exception 'Valeur cible de prime invalide.';
    end if;
    if not exists (select 1 from public.rider_season_summaries as summary
      where summary.rider_id = v_row."riderId" and summary.season_id = v_context.season_id) then
      raise exception 'Palmarès saisonnier absent pour %', v_row."riderId";
    end if;
    if v_row."oldCash" > 0 and not exists (
      select 1 from public.team_finance_transactions as transaction
      where transaction.team_season_id = v_context.team_season_id
        and transaction.source_reference = 'reward:' || v_row."oldSource"
        and transaction.status = 'posted' and transaction.amount = v_row."oldCash"
    ) then
      raise exception 'Écriture financière source absente : %', v_row."oldSource";
    end if;
    insert into pg_temp.bohemia_account_deltas values (
      v_row."riderId", v_context.team_season_id, v_context.season_id,
      v_context.sporting_director_id, v_row."oldSource",
      v_row."newCash" - v_row."oldCash", v_row."newUci" - v_row."oldUci",
      v_row."newRep" - v_row."oldRep", v_row."newXp" - v_row."oldXp"
    );
  end loop;
  if (select count(*) from public.reward_events
      where source_reference like 'official-race:' || v_edition || ':%'
        or source_reference like 'official-stage-%:' || v_edition || ':stage:' || v_stage || ':%') <> 25
    or (select count(*) from public.reward_events
      where source_reference in (select "oldSource" from pg_temp.bohemia_reward_rows)) <> 25
    or exists (
      select 1 from pg_temp.bohemia_reward_rows as p
      where p."newSource" <> p."oldSource"
        and exists (select 1 from public.reward_events where source_reference = p."newSource")
    ) then
    raise exception 'Ensemble des récompenses différent de l audit.';
  end if;

  select jsonb_build_object(
    'officialLock', to_jsonb(v_lock),
    'stageResults', (select jsonb_agg(to_jsonb(r)) from public.stage_results as r where stage_id = v_stage),
    'raceResults', (select jsonb_agg(to_jsonb(r)) from public.race_results as r where race_edition_id = v_edition),
    'secondaryResults', (select jsonb_agg(to_jsonb(r)) from public.race_secondary_results as r where race_edition_id = v_edition),
    'rewardEvents', (select jsonb_agg(to_jsonb(r)) from public.reward_events as r
      where source_reference in (select "oldSource" from pg_temp.bohemia_reward_rows)),
    'attackParticipants', (select jsonb_agg(to_jsonb(r)) from public.stage_attack_participants as r where stage_id = v_stage),
    'postRaceNews', (select jsonb_agg(to_jsonb(r)) from public.post_race_news_events as r where stage_id = v_stage),
    'teamSeasons', (select jsonb_agg(to_jsonb(r)) from public.team_seasons as r
      where id in (select team_season_id from pg_temp.bohemia_account_deltas)),
    'riderSummaries', (select jsonb_agg(to_jsonb(r)) from public.rider_season_summaries as r
      where (r.rider_id, r.season_id) in (select rider_id, season_id from pg_temp.bohemia_account_deltas)),
    'sportingDirectors', (select jsonb_agg(to_jsonb(r)) from public.sporting_directors as r
      where id in (select sporting_director_id from pg_temp.bohemia_account_deltas)),
    'finance', (select jsonb_agg(to_jsonb(r)) from public.team_finance_transactions as r
      where source_reference in (select 'reward:' || "oldSource" from pg_temp.bohemia_reward_rows))
  ) into v_snapshot;
  insert into public.official_race_historical_corrections (
    correction_key, race_edition_id, stage_id, payload_md5, before_snapshot
  ) values (v_key, v_edition, v_stage, md5(p_payload::text), v_snapshot);

  update public.stage_results set rank = rank + 1000, updated_at = now()
  where stage_id = v_stage and rank is not null;
  update public.stage_results as result set
    rank = p."newRank", elapsed_time_ms = p."newTime", gap_to_winner_ms = p."newGap",
    mountain_points = p."newMountain", sprint_points = p."newSprint",
    time_bonus_seconds = p."newBonus", updated_at = now()
  from pg_temp.bohemia_stage_rows as p where result.id = p.id;
  update public.race_results set final_rank = final_rank + 1000, updated_at = now()
  where race_edition_id = v_edition and final_rank is not null;
  update public.race_results as result set
    final_rank = p."newRank", total_time_ms = p."newTime",
    gap_to_winner_ms = p."newGap", updated_at = now()
  from pg_temp.bohemia_race_rows as p where result.id = p.id;
  update public.race_secondary_results set rank = rank + 1000, updated_at = now()
  where race_edition_id = v_edition;
  update public.race_secondary_results as result set
    rank = p."newRank", points = p."newPoints", total_time_ms = p."newTime", updated_at = now()
  from pg_temp.bohemia_secondary_rows as p where result.id = p.id;
  update public.official_stage_simulations set
    engine_version = p_payload->>'newEngineVersion', simulation_data = p_payload->'simulation'
  where stage_id = v_stage;
  insert into public.stage_attack_participants (
    stage_id, race_roster_id, participation_type, first_segment_number
  ) select v_stage, p."rosterId", p.type, p.segment
  from pg_temp.bohemia_attack_rows as p
  on conflict (stage_id, race_roster_id) do update set
    participation_type = excluded.participation_type,
    first_segment_number = excluded.first_segment_number;
  update public.post_race_news_events set
    detail = p_payload#>>'{newsRow,newDetail}',
    featured_rider_id = (p_payload#>>'{newsRow,newRiderId}')::uuid,
    featured_team_id = (p_payload#>>'{newsRow,newTeamId}')::uuid,
    updated_at = now()
  where id = p_payload#>>'{newsRow,id}';

  for v_row in select * from pg_temp.bohemia_reward_rows loop
    select * into v_event from public.reward_events
    where source_reference = v_row."oldSource";
    if found then
      update public.reward_events set
        source_reference = v_row."newSource", cash_prize = v_row."newCash",
        uci_points = v_row."newUci", reputation_points = v_row."newRep",
        experience_points = v_row."newXp",
        description = case
          when v_row."oldSource" <> v_row."newSource"
            or v_row."oldCash" <> v_row."newCash"
            or v_row."oldUci" <> v_row."newUci"
            or v_row."oldRep" <> v_row."newRep"
            or v_row."oldXp" <> v_row."newXp"
          then v_row."newDescription" else description end
      where id = v_event.id;
    elsif v_row."newCash" <> 0 or v_row."newUci" <> 0
      or v_row."newRep" <> 0 or v_row."newXp" <> 0 then
      select delta.team_season_id, delta.sporting_director_id, rider.country_id into v_context
      from pg_temp.bohemia_account_deltas as delta
      join public.riders as rider on rider.id = delta.rider_id
      where delta.source_reference = v_row."oldSource";
      -- Insert at zero reputation to avoid crediting the community-manager
      -- trigger twice. The approved adjusted value is then set by update.
      insert into public.reward_events (
        source_reference, source_type, sporting_director_id, team_season_id,
        rider_id, country_id, reputation_points, experience_points,
        cash_prize, uci_points, description
      ) values (
        v_row."newSource", v_row.kind, v_context.sporting_director_id,
        v_context.team_season_id, v_row."riderId", v_context.country_id,
        0, v_row."newXp", v_row."newCash", v_row."newUci",
        v_row."newDescription"
      );
      update public.reward_events set reputation_points = v_row."newRep"
      where source_reference = v_row."newSource";
    end if;
  end loop;

  update public.team_seasons as team set
    points = coalesce(team.points, 0) + delta.uci_delta,
    cash_balance = coalesce(team.cash_balance, 0) + delta.cash_delta
  from (select team_season_id, sum(uci_delta)::integer as uci_delta,
      sum(cash_delta) as cash_delta from pg_temp.bohemia_account_deltas
      group by team_season_id) as delta
  where team.id = delta.team_season_id;
  update public.rider_season_summaries as summary set
    points = coalesce(summary.points, 0) + delta.uci_delta, updated_at = now()
  from (select rider_id, season_id, sum(uci_delta)::integer as uci_delta
      from pg_temp.bohemia_account_deltas group by rider_id, season_id) as delta
  where summary.rider_id = delta.rider_id and summary.season_id = delta.season_id;
  update public.sporting_directors as director set
    reputation_points = coalesce(director.reputation_points, 0) + delta.rep_delta,
    experience_points = coalesce(director.experience_points, 0) + delta.xp_delta
  from (select sporting_director_id, sum(rep_delta) as rep_delta,
      sum(xp_delta)::integer as xp_delta from pg_temp.bohemia_account_deltas
      where sporting_director_id is not null group by sporting_director_id) as delta
  where director.id = delta.sporting_director_id;
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  ) select delta.team_season_id, v_final_day.season_day_id,
    v_final_day.day_number, delta.cash_delta, 'race_prize', 'posted',
    'Rectification Tour de la Voie Royale de Bohême S3, étape 4 : '
      || rider.first_name || ' ' || rider.last_name,
    'historical-correction:' || v_key || ':' || delta.source_reference, now()
  from pg_temp.bohemia_account_deltas as delta
  join public.riders as rider on rider.id = delta.rider_id
  where delta.cash_delta <> 0;
  perform public.refresh_race_edition_uci_rankings(v_edition);

  v_summary := jsonb_build_object(
    'status', 'applied', 'stageRows', 33, 'raceRows', 33, 'secondaryRows', 49,
    'rewardRows', 30,
    'changedRewards', (select count(*) from pg_temp.bohemia_reward_rows
      where "oldSource" <> "newSource" or "oldCash" <> "newCash"
        or "oldUci" <> "newUci" or "oldRep" <> "newRep" or "oldXp" <> "newXp"),
    'cashCorrections', (select count(*) from pg_temp.bohemia_account_deltas where cash_delta <> 0),
    'netCash', (select coalesce(sum(cash_delta), 0) from pg_temp.bohemia_account_deltas),
    'netUci', (select coalesce(sum(uci_delta), 0) from pg_temp.bohemia_account_deltas),
    'netReputation', (select coalesce(sum(rep_delta), 0) from pg_temp.bohemia_account_deltas),
    'netExperience', (select coalesce(sum(xp_delta), 0) from pg_temp.bohemia_account_deltas)
  );
  update public.official_race_historical_corrections set after_summary = v_summary
  where correction_key = v_key;
  return v_summary;
end;
$$;

revoke all on function public.repair_bohemia_stage4_20260918(jsonb)
  from public, anon, authenticated;
grant execute on function public.repair_bohemia_stage4_20260918(jsonb)
  to service_role;

commit;
