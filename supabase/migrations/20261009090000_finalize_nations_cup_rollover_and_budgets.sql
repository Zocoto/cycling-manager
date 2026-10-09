begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Future-season standings used to create provisional D4 allocations, then
-- the seed's fast path mistook them for final allocations at season opening.
do $seed_fix$
declare
  v_definition text;
  v_start integer;
  v_end integer;
  v_source_block text;
  v_marker text;
begin
  select replace(pg_get_functiondef('public.seed_nations_cup_assignments_for_season(uuid)'::regprocedure),chr(13),'') into v_definition;
  v_start := position('  select season.* into v_source' in v_definition);
  v_end := position(E'  if v_source.id is not null\n     and v_target.game_year >= 4' in v_definition);
  if v_start=0 or v_end<=v_start then raise exception 'Nations Cup source block missing'; end if;
  v_source_block := substring(v_definition from v_start for v_end-v_start);
  v_definition := overlay(v_definition placing '' from v_start for v_end-v_start);
  v_marker := '  -- Season opening creates several federation accounts in the same batch.';
  if position(v_marker in v_definition)=0 then raise exception 'Nations Cup fast path boundary missing'; end if;
  v_definition := replace(v_definition,v_marker,v_source_block || E'\n'
    || E'  if v_target.status = ''planned'' and v_target.game_year >= 4\n'
    || E'    and (v_source.id is null or v_expected_events < 5 or v_completed_events <> v_expected_events) then\n'
    || E'    return 0; -- Never freeze a future fallback before its source Cup finishes.\n  end if;\n\n' || v_marker);
  v_marker := E'  if not exists (\n    select 1\n    from public.countries as country';
  if position(v_marker in v_definition)=0 then raise exception 'Nations Cup fast path guard missing'; end if;
  v_definition := replace(v_definition,v_marker,
    E'  if not exists (select 1 from public.national_federation_nations_cup_assignments p\n'
    || E'    where p.season_id = v_target.id and v_target.game_year >= 4\n'
    || E'      and p.movement = ''initial'' and p.source_season_id is null)\n'
    || E'    and not exists (\n    select 1\n    from public.countries as country');
  v_marker := 'on conflict (country_id, season_id) do nothing;';
  if (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker)<>3 then
    raise exception 'Expected three Nations Cup assignment insert branches';
  end if;
  v_definition := replace(v_definition,v_marker,$upsert$on conflict (country_id, season_id) do update set
      division=excluded.division, group_code=excluded.group_code,
      source_season_id=excluded.source_season_id, source_division=excluded.source_division,
      movement=excluded.movement, source_overall_rank=excluded.source_overall_rank
    where v_target.game_year >= 4
      and national_federation_nations_cup_assignments.movement='initial'
      and national_federation_nations_cup_assignments.source_season_id is null;$upsert$);
  execute v_definition;
end;
$seed_fix$;

create table public.nations_cup_opening_budget_repairs (
  account_id uuid primary key references public.national_federation_accounts(id),
  source_season_id uuid not null references public.seasons(id),
  target_season_id uuid not null references public.seasons(id),
  old_opening_balance numeric not null, new_opening_balance numeric not null,
  old_balance numeric not null, new_balance numeric not null,
  old_objective_bonus numeric not null, new_objective_bonus numeric not null,
  old_metadata jsonb not null, new_metadata jsonb not null,
  repaired_at timestamptz not null default now()
);
alter table public.nations_cup_opening_budget_repairs enable row level security;
revoke all on public.nations_cup_opening_budget_repairs from public,anon,authenticated;
grant select,insert on public.nations_cup_opening_budget_repairs to service_role;

create or replace function public.repair_nations_cup_opening_budgets(p_target_season_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_target public.seasons%rowtype;
  v_source_id uuid;
  v_account record;
  v_base numeric;
  v_premium numeric;
  v_structural numeric;
  v_opening_grant numeric;
  v_objective_bonus numeric;
  v_rate numeric;
  v_delta numeric;
  v_metadata jsonb;
  v_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nations-cup-opening-repair:'||p_target_season_id::text,0));
  select * into v_target from public.seasons where id=p_target_season_id;
  select id into v_source_id from public.seasons where game_year=v_target.game_year-1;
  if v_target.id is null or v_target.game_year<4 then raise exception 'Invalid Nations Cup budget repair season'; end if;
  if exists(select 1 from public.race_editions e join public.races r on r.id=e.race_id
    where e.season_id=v_target.id and r.competition_type='nations_cup'
      and e.status not in ('planned','registration_open','registration_closed','cancelled')) then
    raise exception 'Cannot repair Nations Cup divisions once the target Cup has started';
  end if;
  perform public.seed_nations_cup_assignments_for_season(v_target.id);
  if exists(select 1 from public.national_federation_nations_cup_assignments n
    where n.season_id=v_target.id and (n.movement='initial' or n.source_season_id is distinct from v_source_id)) then
    raise exception 'Nations Cup assignments are still provisional';
  end if;
  for v_account in
    select a.*,t.id transaction_id,t.amount old_grant,t.metadata
    from public.national_federation_accounts a
    join public.national_federation_transactions t on t.account_id=a.id and t.category='opening_grant'
    where a.season_id=v_target.id and not exists(select 1 from public.nations_cup_opening_budget_repairs x where x.account_id=a.id)
    order by a.id for update of a,t
  loop
    if not (v_account.metadata ?& array['commonGrant','uciGrant','nationsCupGrant','raceRevenue']) then
      raise exception 'Missing opening budget components for account %',v_account.id;
    end if;
    v_base := case v_account.nations_cup_division when 1 then 450000 when 2 then 300000 when 3 then 200000 else 120000 end;
    v_premium := public.get_national_federation_ranking_bonus(v_target.game_year,v_account.uci_rank,v_account.nations_cup_division);
    v_structural := (v_account.metadata->>'commonGrant')::numeric+(v_account.metadata->>'uciGrant')::numeric+v_base+v_premium;
    v_opening_grant := v_structural+(v_account.metadata->>'raceRevenue')::numeric;
    v_rate := case when v_account.objective_completed_count>=5 then .10
      when v_account.objective_completed_count>=3 then .06 when v_account.objective_completed_count>=1 then .03 else 0 end;
    v_objective_bonus := round(v_structural*v_rate/5000)*5000;
    v_delta := v_opening_grant-v_account.old_grant+v_objective_bonus-v_account.objective_bonus;
    v_metadata := v_account.metadata || jsonb_build_object('nationsCupBaseGrant',v_base,
      'nationRankingBonus',v_premium,'nationsCupGrant',v_base+v_premium,'budgetGameYear',v_target.game_year);
    insert into public.nations_cup_opening_budget_repairs values(v_account.id,v_source_id,v_target.id,
      v_account.opening_balance,v_account.opening_balance+v_delta,v_account.balance,v_account.balance+v_delta,
      v_account.objective_bonus,v_objective_bonus,v_account.metadata,v_metadata,now())
    on conflict(account_id) do nothing;
    if not found then continue; end if;
    update public.national_federation_transactions set amount=v_opening_grant,metadata=v_metadata where id=v_account.transaction_id;
    if v_objective_bonus>0 then
      insert into public.national_federation_transactions(account_id,day_number,amount,category,description,source_reference,metadata)
      values(v_account.id,1,v_objective_bonus,'objective_bonus','Bonus des objectifs fédéraux réalisés en S'||v_account.source_game_year||'.',
        'federation-account:'||v_account.id::text||':previous-objectives',jsonb_build_object('sourceGameYear',v_account.source_game_year,
          'completedObjectiveCount',v_account.objective_completed_count,'objectiveLevel',v_account.objective_level,
          'bonusRatePercentage',v_rate*100,'structuralRevenue',v_structural))
      on conflict(source_reference) do update set amount=excluded.amount,metadata=excluded.metadata;
    end if;
    update public.national_federation_accounts set opening_balance=opening_balance+v_delta,
      balance=balance+v_delta,objective_bonus=v_objective_bonus,updated_at=now() where id=v_account.id;
    v_count := v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.repair_nations_cup_opening_budgets(uuid) from public,anon,authenticated;
grant execute on function public.repair_nations_cup_opening_budgets(uuid) to service_role;

-- Make an incomplete federation transition block future rollover receipts.
do $integrity_fix$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_season_rollover_integrity(uuid,uuid)'::regprocedure) into v_definition;
  if position('  select jsonb_build_object(' in v_definition)=0 then raise exception 'Integrity payload missing'; end if;
  execute replace(v_definition,'  select jsonb_build_object(', $integrity$  select jsonb_build_object(
    'invalidNationsCupAssignments',(select count(*) from public.national_federation_nations_cup_assignments n cross join target t
      where n.season_id=t.id and t.game_year>=4 and (n.movement='initial' or n.source_season_id is distinct from p_source_season_id)),$integrity$);
end;
$integrity_fix$;

create or replace function public.get_season_rollover_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  with checks as (
    select
      (select count(*) from public.seasons where status='active') active_count,
      (select count(*) from public.seasons where status='active' and ends_on<timezone('Europe/Paris',now())::date) overdue_count,
      (select count(*) from public.seasons t join public.seasons s on s.game_year=t.game_year-1
        where t.status='active' and not exists(select 1 from public.season_rollover_settlements x
          where x.source_season_id=s.id and x.target_season_id=t.id)) missing_receipt_count,
      (select count(*) from cron.job where jobname='daily-season-rollover' and active
        and schedule='*/10 * * * *' and command like '%settle_due_season_rollovers()%') scheduled_count,
      (select count(*) from public.national_federation_nations_cup_assignments n join public.seasons t on t.id=n.season_id
        join public.seasons s on s.game_year=t.game_year-1 where t.status='active' and t.game_year>=4
          and (n.movement='initial' or n.source_season_id is distinct from s.id)) provisional_count
  )
  select jsonb_build_object('healthy',active_count=1 and overdue_count=0 and missing_receipt_count=0 and scheduled_count=1 and provisional_count=0,
    'activeSeasonCount',active_count,'overdueSeasonCount',overdue_count,'missingSettlementCount',missing_receipt_count,
    'scheduledJobCount',scheduled_count,'provisionalDivisionCount',provisional_count) from checks;
$$;

-- Targeted S4 correction only. All balances change by the missing grant delta;
-- player spending and historical S3 accounts remain untouched.
select public.repair_nations_cup_opening_budgets(id) from public.seasons where game_year=4 and status='active';
select public.ensure_due_professional_nations_cup();
notify pgrst,'reload schema';
commit;
