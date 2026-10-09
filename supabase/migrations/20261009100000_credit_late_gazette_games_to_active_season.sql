begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $patch_payment_context$
declare v_definition text; v_marker text;
begin
  select replace(pg_get_functiondef('public.complete_cyclogazette_game_for_user(uuid,uuid,text)'::regprocedure),chr(13),'') into v_definition;
  v_marker := '   and team_season.season_id = edition.season_id';
  if position(v_marker in v_definition)=0 then raise exception 'Gazette payment context missing'; end if;
  v_definition := replace(v_definition,v_marker,
    '   and team_season.season_id = (select id from public.seasons where status=''active'')');
  v_marker := '    edition.season_day_id,';
  if position(v_marker in v_definition)=0 then raise exception 'Gazette payment day selection missing'; end if;
  v_definition := replace(v_definition,v_marker,'    season_day.id as season_day_id,');
  v_marker := '    on season_day.id = edition.season_day_id';
  if position(v_marker in v_definition)=0 then raise exception 'Gazette payment day join missing'; end if;
  v_definition := replace(v_definition,v_marker,
    E'    on season_day.season_id = team_season.season_id\n'
    || '   and season_day.day_number = (select current_day_number from public.seasons where id=team_season.season_id)');
  execute v_definition;
end;
$patch_payment_context$;

create table public.gazette_late_payment_season_repairs (
  transaction_id uuid primary key references public.team_finance_transactions(id),
  source_team_season_id uuid not null references public.team_seasons(id),
  target_team_season_id uuid not null references public.team_seasons(id),
  amount numeric not null, repaired_at timestamptz not null default now()
);
alter table public.gazette_late_payment_season_repairs enable row level security;
revoke all on public.gazette_late_payment_season_repairs from public,anon,authenticated;
grant select on public.gazette_late_payment_season_repairs to service_role;

-- Move only rewards earned AFTER the durable S3 closure. The same transaction
-- UUID and source reference are retained; rerunning cannot pay a reward twice.
do $repair_late_payments$
declare v_payment record;
begin
  for v_payment in
    select f.id,f.amount,f.source_reference,s.id source_id,t.id target_id,d.id day_id,d.day_number
    from public.season_rollover_settlements x
    join public.seasons old_season on old_season.id=x.source_season_id and old_season.game_year=3
    join public.seasons new_season on new_season.id=x.target_season_id and new_season.game_year=4 and new_season.status='active'
    join public.team_seasons s on s.season_id=x.source_season_id
    join public.team_seasons t on t.team_id=s.team_id and t.season_id=x.target_season_id
    join public.season_days d on d.season_id=t.season_id and d.day_number=new_season.current_day_number
    join public.team_finance_transactions f on f.team_season_id=s.id and f.status='posted' and f.created_at>x.settled_at
    where f.source_reference like 'cyclogazette-game:%' or f.source_reference like 'cyclogazette-trophy:%'
    order by s.id,f.id for update of s,t,f
  loop
    insert into public.gazette_late_payment_season_repairs values(v_payment.id,v_payment.source_id,v_payment.target_id,v_payment.amount,now())
    on conflict(transaction_id) do nothing;
    if not found then continue; end if;
    update public.team_finance_transactions set team_season_id=v_payment.target_id,season_day_id=v_payment.day_id,day_number=v_payment.day_number
      where id=v_payment.id;
    update public.team_seasons set cash_balance=cash_balance-v_payment.amount where id=v_payment.source_id;
    update public.team_seasons set cash_balance=cash_balance+v_payment.amount where id=v_payment.target_id;
    update public.reward_events set team_season_id=v_payment.target_id
      where source_reference=v_payment.source_reference and team_season_id=v_payment.source_id;
    update public.cyclogazette_game_completions set team_season_id=v_payment.target_id
      where 'cyclogazette-game:'||id::text=v_payment.source_reference and team_season_id=v_payment.source_id;
  end loop;
end;
$repair_late_payments$;
notify pgrst,'reload schema';
commit;
