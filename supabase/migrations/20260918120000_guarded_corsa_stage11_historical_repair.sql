begin;

-- Le scénario officiel de S3 est normalement immuable. Cette exception
-- historique conserve une copie intégrale des lignes modifiées et ne peut
-- s'exécuter que sur l'édition/l'étape/v28 explicitement auditées.
create table if not exists public.official_race_historical_corrections (
  correction_key text primary key,
  race_edition_id uuid not null references public.race_editions(id),
  stage_id uuid not null references public.stages(id),
  payload_md5 text not null,
  before_snapshot jsonb not null,
  after_summary jsonb,
  applied_at timestamptz not null default now()
);

alter table public.official_race_historical_corrections enable row level security;
revoke all on public.official_race_historical_corrections from public, anon, authenticated;
grant select on public.official_race_historical_corrections to service_role;

create or replace function public.repair_corsa_stage11_20260918(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key constant text := 'corsa-s3-stage11-observed-finish-times-20260918';
  v_edition constant uuid := 'd62c5b5b-1552-473a-89a5-5747496c9a21';
  v_stage constant uuid := 'd6d9dfa6-bf76-42b4-93fb-f8c75db070f5';
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
    or p_payload->>'oldEngineVersion' is distinct from '2026.09-bonus-aligned-gc-v28'
    or p_payload->>'newEngineVersion' is distinct from '2026.09-observed-finish-times-v29'
    or jsonb_typeof(p_payload->'stageRows') <> 'array'
    or jsonb_typeof(p_payload->'raceRows') <> 'array'
    or jsonb_typeof(p_payload->'secondaryRows') <> 'array'
    or jsonb_typeof(p_payload->'prizeRows') <> 'array'
    or jsonb_typeof(p_payload->'replay') <> 'object' then
    raise exception 'Charge de correction invalide.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  if exists (select 1 from public.official_race_historical_corrections where correction_key = v_key) then
    raise exception 'Cette correction historique a déjà été appliquée.';
  end if;

  select * into v_lock
  from public.official_stage_simulations
  where stage_id = v_stage and race_edition_id = v_edition
  for update;
  if not found or v_lock.engine_version <> p_payload->>'oldEngineVersion' then
    raise exception 'La simulation officielle n est plus dans l état audité.';
  end if;
  if (select count(*) from public.stages where race_edition_id = v_edition) <> 12
    or (select count(*) from public.race_editions where id = v_edition and status = 'completed') <> 1 then
    raise exception 'Édition incomplète ou inattendue.';
  end if;

  select stage.season_day_id, day.day_number
  into v_final_day
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
  where stage.race_edition_id = v_edition
  order by stage.stage_number desc
  limit 1;
  if v_final_day is null then raise exception 'Jour de règlement introuvable.'; end if;

  create temporary table pg_temp.corsa_stage_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'stageRows') as r(
    id uuid, "riderId" uuid, "oldRank" smallint, "oldTime" bigint, "oldGap" bigint,
    "newRank" smallint, "newTime" bigint, "newGap" bigint
  );
  create temporary table pg_temp.corsa_race_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'raceRows') as r(
    id uuid, "riderId" uuid, "oldRank" smallint, "oldTime" bigint, "oldGap" bigint,
    "newRank" smallint, "newTime" bigint, "newGap" bigint
  );
  create temporary table pg_temp.corsa_secondary_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'secondaryRows') as r(
    id uuid, type text, "oldRank" smallint, "oldTime" bigint,
    "newRank" smallint, "newTime" bigint
  );
  create temporary table pg_temp.corsa_prize_rows on commit drop as
  select * from jsonb_to_recordset(p_payload->'prizeRows') as r(
    "riderId" uuid, "rosterId" uuid, "oldSource" text, "newSource" text,
    kind text, "oldCash" numeric, "newCash" numeric, "oldUci" integer,
    "newUci" integer, "oldRep" numeric, "newRep" numeric,
    "oldXp" integer, "newXp" integer
  );

  if (select count(*) from pg_temp.corsa_stage_rows) <> 198
    or (select count(distinct id) from pg_temp.corsa_stage_rows) <> 198
    or (select count(*) from pg_temp.corsa_race_rows) <> 199
    or (select count(distinct id) from pg_temp.corsa_race_rows) <> 199
    or (select count(*) from pg_temp.corsa_secondary_rows) <> 148
    or (select count(distinct id) from pg_temp.corsa_secondary_rows) <> 148
    or (select count(*) from pg_temp.corsa_prize_rows) <> 12
    or (select count(distinct "oldSource") from pg_temp.corsa_prize_rows) <> 12 then
    raise exception 'Cardinalité de la correction différente de l audit.';
  end if;
  if (select count(*) from public.stage_results where stage_id = v_stage) <> 198
    or (select count(*) from public.race_results where race_edition_id = v_edition) <> 199
    or (select count(*) from public.race_secondary_results where race_edition_id = v_edition and classification_type in ('youth', 'team')) <> 148 then
    raise exception 'Les classements ont changé depuis le contrôle préalable.';
  end if;
  if (select id from pg_temp.corsa_secondary_rows where type = 'team' and "oldRank" = 1)
    is distinct from (select id from pg_temp.corsa_secondary_rows where type = 'team' and "newRank" = 1)
    or (select id from pg_temp.corsa_secondary_rows where type = 'youth' and "oldRank" = 1)
    is distinct from (select id from pg_temp.corsa_secondary_rows where type = 'youth' and "newRank" = 1) then
    raise exception 'Un vainqueur annexe a changé : primes à recalculer.';
  end if;
  if exists (
    select 1 from pg_temp.corsa_stage_rows as p
    left join public.stage_results as s on s.id = p.id and s.stage_id = v_stage
    left join public.race_rosters as roster on roster.id = s.race_roster_id
    where s.id is null or roster.rider_id is distinct from p."riderId"
      or s.rank is distinct from p."oldRank"
      or s.elapsed_time_ms is distinct from p."oldTime"
      or s.gap_to_winner_ms is distinct from p."oldGap"
  ) or exists (
    select 1 from pg_temp.corsa_race_rows as p
    left join public.race_results as r on r.id = p.id and r.race_edition_id = v_edition
    left join public.race_rosters as roster on roster.id = r.race_roster_id
    where r.id is null or roster.rider_id is distinct from p."riderId"
      or r.final_rank is distinct from p."oldRank"
      or r.total_time_ms is distinct from p."oldTime"
      or r.gap_to_winner_ms is distinct from p."oldGap"
  ) or exists (
    select 1 from pg_temp.corsa_secondary_rows as p
    left join public.race_secondary_results as r
      on r.id = p.id and r.race_edition_id = v_edition and r.classification_type = p.type
    where r.id is null or p.type not in ('youth', 'team')
      or r.rank is distinct from p."oldRank"
      or r.total_time_ms is distinct from p."oldTime"
  ) then
    raise exception 'Les classements officiels ne correspondent plus à la copie source.';
  end if;

  if jsonb_array_length(p_payload#>'{replay,results}') <> 198
    or (v_lock.simulation_data->'timeline') is null
    or (v_lock.simulation_data->'visualTimeline') is null
    or (p_payload#>>'{replay,timelineIndex}')::integer <> jsonb_array_length(v_lock.simulation_data->'timeline') - 1
    or (p_payload#>>'{replay,visualIndex}')::integer <> jsonb_array_length(v_lock.simulation_data->'visualTimeline') - 1 then
    raise exception 'Replay corrigé incomplet.';
  end if;

  create temporary table pg_temp.corsa_account_deltas (
    rider_id uuid not null,
    roster_id uuid not null,
    team_season_id uuid not null,
    season_id uuid not null,
    sporting_director_id uuid,
    source_reference text not null,
    cash_delta numeric(14, 2) not null,
    uci_delta integer not null,
    rep_delta numeric(12, 2) not null,
    xp_delta integer not null
  ) on commit drop;

  for v_row in select * from pg_temp.corsa_prize_rows loop
    select roster.rider_id, registration.team_season_id, team.season_id,
      rider.country_id, director.id as sporting_director_id
    into v_context
    from public.race_rosters as roster
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team on team.id = registration.team_season_id
    join public.riders as rider on rider.id = roster.rider_id
    left join public.team_manager_assignments as assignment
      on assignment.team_id = team.team_id and assignment.role = 'general_manager'
      and assignment.status = 'active'
    left join public.sporting_directors as director on director.id = assignment.sporting_director_id
    where roster.id = v_row."rosterId" and registration.race_edition_id = v_edition
      and roster.rider_id = v_row."riderId"
    limit 1;
    if v_context is null then raise exception 'Destinataire de prime absent : %', v_row."riderId"; end if;

    select * into v_event from public.reward_events
    where source_reference = v_row."oldSource" for update;
    if found then
      if v_event.rider_id is distinct from v_row."riderId"
        or v_event.team_season_id is distinct from v_context.team_season_id
        or v_event.cash_prize is distinct from v_row."oldCash"
        or v_event.uci_points is distinct from v_row."oldUci"
        or v_event.reputation_points is distinct from v_row."oldRep"
        or v_event.experience_points is distinct from v_row."oldXp" then
        raise exception 'Prime source divergente : %', v_row."oldSource";
      end if;
      v_context.sporting_director_id := v_event.sporting_director_id;
    elsif v_row."oldCash" <> 0 or v_row."oldUci" <> 0
      or v_row."oldRep" <> 0 or v_row."oldXp" <> 0 then
      raise exception 'Prime source manquante : %', v_row."oldSource";
    end if;
    if v_context.sporting_director_id is null and (v_row."newRep" <> v_row."oldRep" or v_row."newXp" <> v_row."oldXp") then
      raise exception 'Directeur sportif introuvable pour %', v_row."riderId";
    end if;
    if not exists (
      select 1 from public.rider_season_summaries as summary
      where summary.rider_id = v_row."riderId" and summary.season_id = v_context.season_id
    ) then
      raise exception 'Palmarès saisonnier introuvable pour %', v_row."riderId";
    end if;
    if v_row."oldCash" > 0 and not exists (
      select 1 from public.team_finance_transactions as transaction
      where transaction.team_season_id = v_context.team_season_id
        and transaction.source_reference = 'reward:' || v_row."oldSource"
        and transaction.status = 'posted'
        and transaction.amount = v_row."oldCash"
    ) then
      raise exception 'Écriture financière source absente : %', v_row."oldSource";
    end if;
    if v_row."newCash" < 0 or v_row."newUci" < 0 or v_row."newRep" < 0 or v_row."newXp" < 0 then
      raise exception 'Prime cible négative.';
    end if;
    insert into pg_temp.corsa_account_deltas values (
      v_row."riderId", v_row."rosterId", v_context.team_season_id,
      v_context.season_id, v_context.sporting_director_id, v_row."oldSource",
      v_row."newCash" - v_row."oldCash", v_row."newUci" - v_row."oldUci",
      v_row."newRep" - v_row."oldRep", v_row."newXp" - v_row."oldXp"
    );
  end loop;
  if (select coalesce(sum(cash_delta), 0) from pg_temp.corsa_account_deltas) <> 0
    or (select coalesce(sum(uci_delta), 0) from pg_temp.corsa_account_deltas) <> 0
    or (select coalesce(sum(rep_delta), 0) from pg_temp.corsa_account_deltas) <> 0
    or (select coalesce(sum(xp_delta), 0) from pg_temp.corsa_account_deltas) <> 0 then
    raise exception 'Bilan des primes non nul, correction refusée.';
  end if;

  select jsonb_build_object(
    'officialLock', to_jsonb(v_lock),
    'stageResults', (select jsonb_agg(to_jsonb(r)) from public.stage_results as r where stage_id = v_stage),
    'raceResults', (select jsonb_agg(to_jsonb(r)) from public.race_results as r where race_edition_id = v_edition),
    'timeSecondaryResults', (select jsonb_agg(to_jsonb(r)) from public.race_secondary_results as r where race_edition_id = v_edition and classification_type in ('youth', 'team')),
    'rewardEvents', (select jsonb_agg(to_jsonb(r)) from public.reward_events as r where source_reference in (select "oldSource" from pg_temp.corsa_prize_rows)),
    'teamSeasons', (select jsonb_agg(to_jsonb(r)) from public.team_seasons as r where id in (select team_season_id from pg_temp.corsa_account_deltas)),
    'riderSummaries', (select jsonb_agg(to_jsonb(r)) from public.rider_season_summaries as r where (r.rider_id, r.season_id) in (select rider_id, season_id from pg_temp.corsa_account_deltas)),
    'sportingDirectors', (select jsonb_agg(to_jsonb(r)) from public.sporting_directors as r where id in (select sporting_director_id from pg_temp.corsa_account_deltas)),
    'finance', (select jsonb_agg(to_jsonb(r)) from public.team_finance_transactions as r where source_reference in (select 'reward:' || "oldSource" from pg_temp.corsa_prize_rows))
  ) into v_snapshot;
  insert into public.official_race_historical_corrections (
    correction_key, race_edition_id, stage_id, payload_md5, before_snapshot
  ) values (v_key, v_edition, v_stage, md5(p_payload::text), v_snapshot);

  update public.stage_results set rank = rank + 1000, updated_at = now()
  where stage_id = v_stage and rank is not null;
  update public.stage_results as r set
    rank = p."newRank", elapsed_time_ms = p."newTime",
    gap_to_winner_ms = p."newGap", updated_at = now()
  from pg_temp.corsa_stage_rows as p where r.id = p.id;

  update public.race_results set final_rank = final_rank + 1000, updated_at = now()
  where race_edition_id = v_edition and final_rank is not null;
  update public.race_results as r set
    final_rank = p."newRank", total_time_ms = p."newTime",
    gap_to_winner_ms = p."newGap", updated_at = now()
  from pg_temp.corsa_race_rows as p where r.id = p.id;

  update public.race_secondary_results set rank = rank + 1000, updated_at = now()
  where race_edition_id = v_edition and classification_type in ('youth', 'team');
  update public.race_secondary_results as r set
    rank = p."newRank", total_time_ms = p."newTime", updated_at = now()
  from pg_temp.corsa_secondary_rows as p where r.id = p.id;

  update public.official_stage_simulations set
    engine_version = p_payload->>'newEngineVersion',
    simulation_data = jsonb_set(
      jsonb_set(
        jsonb_set(v_lock.simulation_data, '{results}', p_payload#>'{replay,results}', false),
        array['timeline', p_payload#>>'{replay,timelineIndex}'],
        p_payload#>'{replay,timelineFinal}', false
      ),
      array['visualTimeline', p_payload#>>'{replay,visualIndex}'],
      p_payload#>'{replay,visualFinal}', false
    )
  where stage_id = v_stage;

  for v_row in select * from pg_temp.corsa_prize_rows loop
    select * into v_event from public.reward_events
    where source_reference = v_row."oldSource";
    if found then
      update public.reward_events set
        source_reference = v_row."newSource",
        cash_prize = v_row."newCash", uci_points = v_row."newUci",
        reputation_points = v_row."newRep", experience_points = v_row."newXp",
        description = description || ' · classement rectifié (étape 11)'
      where id = v_event.id;
    elsif v_row."newCash" <> 0 or v_row."newUci" <> 0
      or v_row."newRep" <> 0 or v_row."newXp" <> 0 then
      select delta.team_season_id, delta.sporting_director_id, rider.country_id
      into v_context
      from pg_temp.corsa_account_deltas as delta
      join public.riders as rider on rider.id = delta.rider_id
      where delta.source_reference = v_row."oldSource";
      insert into public.reward_events (
        source_reference, source_type, sporting_director_id, team_season_id,
        rider_id, country_id, reputation_points, experience_points,
        cash_prize, uci_points, description
      ) values (
        v_row."newSource", v_row.kind, v_context.sporting_director_id,
        v_context.team_season_id, v_row."riderId", v_context.country_id,
        v_row."newRep", v_row."newXp", v_row."newCash", v_row."newUci",
        'Corsa delle Regioni · classement rectifié de l étape 11'
      );
    end if;
  end loop;

  update public.team_seasons as team set
    points = team.points + delta.uci_delta,
    cash_balance = team.cash_balance + delta.cash_delta
  from (
    select team_season_id, sum(uci_delta)::integer as uci_delta,
      sum(cash_delta) as cash_delta
    from pg_temp.corsa_account_deltas group by team_season_id
  ) as delta where team.id = delta.team_season_id;

  update public.rider_season_summaries as summary set
    points = summary.points + delta.uci_delta, updated_at = now()
  from (
    select rider_id, season_id, sum(uci_delta)::integer as uci_delta
    from pg_temp.corsa_account_deltas group by rider_id, season_id
  ) as delta
  where summary.rider_id = delta.rider_id and summary.season_id = delta.season_id;

  update public.sporting_directors as director set
    reputation_points = director.reputation_points + delta.rep_delta,
    experience_points = director.experience_points + delta.xp_delta
  from (
    select sporting_director_id, sum(rep_delta) as rep_delta,
      sum(xp_delta)::integer as xp_delta
    from pg_temp.corsa_account_deltas
    where sporting_director_id is not null
    group by sporting_director_id
  ) as delta where director.id = delta.sporting_director_id;

  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  )
  select delta.team_season_id, v_final_day.season_day_id,
    v_final_day.day_number, delta.cash_delta, 'race_prize', 'posted',
    'Rectification Corsa delle Regioni S3, étape 11 : ' || rider.first_name || ' ' || rider.last_name,
    'historical-correction:' || v_key || ':' || delta.source_reference, now()
  from pg_temp.corsa_account_deltas as delta
  join public.riders as rider on rider.id = delta.rider_id
  where delta.cash_delta <> 0;

  perform public.refresh_race_edition_uci_rankings(v_edition);

  v_summary := jsonb_build_object(
    'status', 'applied', 'stageRows', 198, 'raceRows', 199,
    'timeSecondaryRows', 148, 'rewardRows', 12,
    'cashCorrections', (select count(*) from pg_temp.corsa_account_deltas where cash_delta <> 0),
    'netCash', (select sum(cash_delta) from pg_temp.corsa_account_deltas),
    'netUci', (select sum(uci_delta) from pg_temp.corsa_account_deltas)
  );
  update public.official_race_historical_corrections
  set after_summary = v_summary where correction_key = v_key;
  return v_summary;
end;
$$;

revoke all on function public.repair_corsa_stage11_20260918(jsonb)
  from public, anon, authenticated;
grant execute on function public.repair_corsa_stage11_20260918(jsonb)
  to service_role;

commit;
