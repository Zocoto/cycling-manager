begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Reuse the existing settlement rules (including debt checkpoints), but make
-- them callable by the rollover without impersonating a player. Previously
-- old-season invoices were posted only when the DS visited the finances page.
do $global_finance_settlement$
declare
  v_definition text;
  v_start integer;
  v_end integer;
begin
  select replace(pg_get_functiondef('public.settle_current_team_finances()'::regprocedure), chr(13), '') into v_definition;
  v_start := position(E'  select\n    team_season.id as team_season_id,' in v_definition);
  v_end := position('  if v_context is null then' in v_definition);
  if v_start = 0 or v_end <= v_start then raise exception 'Finance context anchor missing'; end if;
  v_definition := overlay(v_definition placing $context$  select
    team_season.id as team_season_id,
    team_season.opening_cash_balance,
    team_season.finance_start_day_number,
    least(28, greatest(1, coalesce(p_through_day_number, season.current_day_number))) as current_day_number,
    sporting_director.id as sporting_director_id
  into v_context
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  left join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  left join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  where team_season.id = p_team_season_id
  limit 1
  for update of team_season;

$context$ from v_start for v_end - v_start);
  if position('public.settle_current_team_finances()' in v_definition) = 0 then
    raise exception 'Finance signature anchor missing';
  end if;
  v_definition := replace(v_definition, 'public.settle_current_team_finances()',
    'public.settle_team_season_finances(p_team_season_id uuid, p_through_day_number integer DEFAULT NULL)');
  execute v_definition;
end;
$global_finance_settlement$;
revoke all on function public.settle_team_season_finances(uuid, integer) from public, anon, authenticated;
grant execute on function public.settle_team_season_finances(uuid, integer) to service_role;

-- Opening aid must count the final roster, including promoted juniors, not
-- the temporary roster between activation and academy processing.
do $defer_opening_aid$
declare
  v_definition text;
  v_body text;
  v_guard constant text := $guard$  if new.status <> 'active' or old.status = 'active' then
    return new;
  end if;$guard$;
begin
  select replace(pg_get_functiondef('public.grant_understaffed_team_starting_aid()'::regprocedure), chr(13), '') into v_definition;
  if position(v_guard in v_definition) = 0 then raise exception 'Opening aid guard missing'; end if;
  select replace(prosrc, chr(13), '') into v_body from pg_proc
    where oid = 'public.grant_understaffed_team_starting_aid()'::regprocedure;
  v_body := replace(v_body, v_guard, '');
  v_body := replace(replace(v_body, 'new.id', 'p_season_id'), 'return new;', 'return;');
  execute 'create or replace function public.grant_understaffed_team_aid_for_season(p_season_id uuid) '
    || 'returns void language plpgsql security definer set search_path = '''' as ' || quote_literal(v_body);
  execute replace(v_definition, v_guard, v_guard || E'\n'
    || E'  if pg_catalog.current_setting(''cycling_manager.rollover_target_season'', true) = new.id::text then\n'
    || E'    return new;\n  end if;');
end;
$defer_opening_aid$;
revoke all on function public.grant_understaffed_team_aid_for_season(uuid) from public, anon, authenticated;
grant execute on function public.grant_understaffed_team_aid_for_season(uuid) to service_role;

-- Repeated ranking updates fired thousands of trophy notification triggers
-- during financial closure. Outside rollover, only genuinely changed ranks
-- need a write; during rollover the already frozen ranking is reused below.
create or replace function public.refresh_uci_rankings(p_season_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with ranked_teams as (
    select id, row_number() over (
      order by points desc, display_name, id
    )::integer ranking_position
    from public.team_seasons
    where season_id = p_season_id and status <> 'withdrawn'
  )
  update public.team_seasons t set final_rank = r.ranking_position
  from ranked_teams r
  where t.id = r.id and t.final_rank is distinct from r.ranking_position;

  with ranked_riders as (
    select s.id, row_number() over (
      order by coalesce(s.points, 0) desc, r.last_name, r.first_name, r.id
    )::integer ranking_position
    from public.rider_season_summaries s
    join public.riders r on r.id = s.rider_id
    where s.season_id = p_season_id
  )
  update public.rider_season_summaries s
  set uci_rank = r.ranking_position, updated_at = now()
  from ranked_riders r
  where s.id = r.id and s.uci_rank is distinct from r.ranking_position;
end;
$$;

-- These checks run inside the atomic rollover, before its durable receipt.
-- An error rolls back every age, contract, payment and promotion together.
create or replace function public.get_season_rollover_integrity(
  p_source_season_id uuid, p_target_season_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  with target as (select * from public.seasons where id = p_target_season_id)
  select jsonb_build_object(
    'invalidSeasonPair', case when exists (
      select 1 from public.seasons s, target t
      where s.id = p_source_season_id and s.game_year + 1 = t.game_year
        and s.status = 'completed' and t.status = 'active'
    ) then 0 else 1 end,
    'unclosedSourceTeams', (select count(*) from public.team_seasons
      where season_id = p_source_season_id and status not in ('completed', 'withdrawn')),
    'unpostedSourceInvoices', (select count(*) from public.team_finance_transactions x
      join public.team_seasons t on t.id = x.team_season_id
      where t.season_id = p_source_season_id and t.status <> 'withdrawn'
        and x.status = 'pending' and x.day_number <= 28),
    'missingTargetTeams', (select count(*) from public.team_seasons s
      where s.season_id = p_source_season_id and s.status <> 'withdrawn'
        and not exists (select 1 from public.team_seasons t
          where t.team_id = s.team_id and t.season_id = p_target_season_id and t.status = 'active')),
    'missingCopiedRatings', (select count(*) from public.rider_season_ratings s
      join public.riders r on r.id = s.rider_id
      where s.season_id = p_source_season_id and r.status not in ('retired', 'suspended')
        and not exists (select 1 from public.rider_season_ratings t
          where t.rider_id = s.rider_id and t.season_id = p_target_season_id)),
    'incorrectAges', (select count(*) from public.rider_season_ratings s
      join public.rider_season_ratings t on t.rider_id = s.rider_id and t.season_id = p_target_season_id
      where s.season_id = p_source_season_id and t.age <> least(120, s.age + 1)),
    'expiredActiveRiderContracts', (select count(*) from public.rider_contracts c
      join public.seasons e on e.id = c.end_season_id cross join target t
      where c.status = 'active' and e.game_year < t.game_year),
    'unactivatedRiderContracts', (select count(*) from public.rider_contracts
      where start_season_id = p_target_season_id and status = 'planned'),
    'missingContractRatings', (select count(*) from public.rider_contracts c
      where c.status = 'active' and not exists (select 1 from public.rider_season_ratings r
        where r.rider_id = c.rider_id and r.season_id = p_target_season_id)),
    'expiredActiveStaffContracts', (select count(*) from public.staff_contracts c
      join public.seasons e on e.id = c.end_season_id cross join target t
      where c.status = 'active' and e.game_year < t.game_year),
    'remainingDueYouth', (select count(*) from public.youth_academy_riders a cross join target t
      where (a.status = 'recruited' and a.promotion_game_year <= t.game_year)
        or (a.status = 'active' and t.game_year - a.birth_game_year > 18)
        or a.status = 'release_pending'),
    'missingSummaries', (select count(*) from public.rider_season_ratings r
      where r.season_id = p_target_season_id and not exists (
        select 1 from public.rider_season_summaries s where s.rider_id = r.rider_id and s.season_id = r.season_id)),
    'missingOpeningConditions', (select count(*) from public.rider_season_ratings r
      where r.season_id = p_target_season_id and not exists (
        select 1 from public.rider_condition_states c join public.season_days d on d.id = c.season_day_id
        where c.rider_id = r.rider_id and d.season_id = r.season_id and d.day_number = 1)),
    'invalidCalendar', case when (select count(*) from public.season_days where season_id = p_target_season_id) = 28
      and exists (select 1 from public.race_editions where season_id = p_target_season_id) then 0 else 1 end
  );
$$;
revoke all on function public.get_season_rollover_integrity(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_season_rollover_integrity(uuid, uuid) to service_role;

do $patch_rollover$
declare
  v_definition text;
  v_marker text;
  v_replacement text;
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.close_team_financial_season(uuid)'::regprocedure,
    'public.evaluate_team_sponsor_objectives(uuid,boolean)'::regprocedure
  ] loop
    select replace(pg_get_functiondef(v_signature), chr(13), '') into v_definition;
    v_marker := 'perform public.refresh_uci_rankings(v_team_season.season_id);';
    if (length(v_definition) - length(replace(v_definition, v_marker, ''))) / length(v_marker) <> 1 then
      raise exception 'Expected one ranking refresh in %', v_signature;
    end if;
    v_replacement := E'if pg_catalog.current_setting(''cycling_manager.rollover_ranked_season'', true)\n'
      || E'      is distinct from v_team_season.season_id::text then\n'
      || E'      perform public.refresh_uci_rankings(v_team_season.season_id);\n    end if;';
    execute replace(v_definition, v_marker, v_replacement);
  end loop;

  select replace(pg_get_functiondef('public.rollover_game_season(uuid,boolean)'::regprocedure), chr(13), '') into v_definition;
  v_marker := '  v_remaining_planned_contracts integer;';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover declarations missing'; end if;
  v_definition := replace(v_definition, v_marker, v_marker || E'\n  v_integrity jsonb;\n'
    || E'  v_previous_target_season text := pg_catalog.current_setting(''cycling_manager.rollover_target_season'', true);\n'
    || E'  v_previous_ranked_season text := pg_catalog.current_setting(''cycling_manager.rollover_ranked_season'', true);');

  v_marker := E'  perform pg_catalog.pg_advisory_xact_lock(\n'
    || E'    pg_catalog.hashtextextended(''cycling-manager:season-rollover'', 0)\n  );';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover lock missing'; end if;
  v_definition := replace(v_definition, v_marker,
    E'  if not pg_catalog.pg_try_advisory_xact_lock(\n'
    || E'    pg_catalog.hashtextextended(''cycling-manager:season-rollover'', 0)\n  ) then\n'
    || E'    return jsonb_build_object(''pending'', true, ''reason'', ''already_running'');\n  end if;');

  v_marker := '  perform public.refresh_uci_rankings(v_source.id);';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover ranking freeze missing'; end if;
  v_definition := replace(v_definition, v_marker, v_marker || E'\n'
    || E'  perform pg_catalog.set_config(''cycling_manager.rollover_ranked_season'', v_source.id::text, true);');
  v_marker := '    perform public.settle_due_equipment_assignments(v_team.id);';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover pre-closure loop missing'; end if;
  v_definition := replace(v_definition, v_marker,
    E'    perform public.settle_team_season_finances(v_team.id, 28);\n' || v_marker);
  v_marker := '  select count(*)::integer into v_carried_teams';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover financial closure end missing'; end if;
  v_definition := replace(v_definition, v_marker,
    E'  perform pg_catalog.set_config(''cycling_manager.rollover_ranked_season'', coalesce(v_previous_ranked_season, ''''), true);\n\n' || v_marker);

  v_marker := '  -- Youth transitions were previously lazy and happened only when a player';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover activation boundary missing'; end if;
  v_definition := replace(v_definition, v_marker,
    E'  -- Open federation accounts against the actual promoted/relegated divisions.\n'
    || E'  perform public.initialize_due_national_federation_accounts();\n'
    || E'  perform public.ensure_due_professional_nations_cup();\n\n' || v_marker);

  v_marker := E'  update public.seasons\n  set status = ''active'', current_day_number = 1';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover target activation missing'; end if;
  v_definition := replace(v_definition, v_marker,
    E'  perform pg_catalog.set_config(''cycling_manager.rollover_target_season'', v_target.id::text, true);\n' || v_marker);
  v_marker := '  -- Existing riders need the same J1 profile state that the insert trigger gives';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover youth processing end missing'; end if;
  v_definition := replace(v_definition, v_marker,
    E'  perform public.grant_understaffed_team_aid_for_season(v_target.id);\n'
    || E'  perform pg_catalog.set_config(''cycling_manager.rollover_target_season'', coalesce(v_previous_target_season, ''''), true);\n\n' || v_marker);

  v_marker := '  insert into public.season_rollover_settlements (';
  if position(v_marker in v_definition) = 0 then raise exception 'Rollover receipt missing'; end if;
  v_definition := replace(v_definition, v_marker,
    E'  v_integrity := public.get_season_rollover_integrity(v_source.id, v_target.id);\n'
    || E'  if exists (select 1 from jsonb_each_text(v_integrity) c where c.value::bigint <> 0) then\n'
    || E'    raise exception ''Season rollover integrity failed: %'', v_integrity;\n  end if;\n\n' || v_marker);
  execute v_definition;
end;
$patch_rollover$;

-- Run directly in Postgres, including summer/winter clock changes. The date
-- gate remains Europe/Paris. A failed attempt is retried, not forgotten for
-- 24 hours. Session-level timeouts must be set before SELECT: a function-level
-- SET alone cannot extend pg_cron's already armed statement timer (120s).
select cron.schedule('daily-season-rollover', '*/10 * * * *',
  $job$set statement_timeout = '5min'; set lock_timeout = '5s'; select public.settle_due_season_rollovers();$job$);

create or replace function public.get_season_rollover_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  with checks as (
    select
      (select count(*) from public.seasons where status = 'active') active_count,
      (select count(*) from public.seasons where status = 'active'
        and ends_on < timezone('Europe/Paris', now())::date) overdue_count,
      (select count(*) from public.seasons t join public.seasons s on s.game_year = t.game_year - 1
        where t.status = 'active' and not exists (select 1 from public.season_rollover_settlements x
          where x.source_season_id = s.id and x.target_season_id = t.id)) missing_receipt_count,
      (select count(*) from cron.job where jobname = 'daily-season-rollover' and active
        and schedule = '*/10 * * * *' and command like '%settle_due_season_rollovers()%') scheduled_count
  )
  select jsonb_build_object('healthy', active_count = 1 and overdue_count = 0
      and missing_receipt_count = 0 and scheduled_count = 1,
    'activeSeasonCount', active_count, 'overdueSeasonCount', overdue_count,
    'missingSettlementCount', missing_receipt_count, 'scheduledJobCount', scheduled_count)
  from checks;
$$;
revoke all on function public.get_season_rollover_health() from public, anon, authenticated;
grant execute on function public.get_season_rollover_health() to service_role;
notify pgrst, 'reload schema';
commit;
