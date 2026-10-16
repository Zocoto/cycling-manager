begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
set local application_name = 'financial-director-feature-migration';

-- Extend the existing domains without replacing unrelated roles/checks.
do $roles$
declare item record; definition text;
begin
  for item in select * from (values
    ('staff_members', 'staff_members_role_allowed'),
    ('staff_talent_catalog', 'staff_talent_catalog_role_allowed'),
    ('recruitment_alerts', 'recruitment_alerts_staff_role_allowed')
  ) as domains(table_name, constraint_name) loop
    select pg_get_constraintdef(oid) into strict definition from pg_constraint
    where conrelid = ('public.' || item.table_name)::regclass and conname = item.constraint_name;
    if position('financial_director' in definition) = 0 then
      definition := replace(definition, '''educator''::text', '''educator''::text, ''financial_director''::text');
      if position('financial_director' in definition) = 0 then raise exception 'Unknown staff domain %', item.constraint_name; end if;
      execute format('alter table public.%I drop constraint %I', item.table_name, item.constraint_name);
      execute format('alter table public.%I add constraint %I %s', item.table_name, item.constraint_name, definition);
    end if;
  end loop;
end;
$roles$;

insert into public.staff_talent_catalog(code, role, display_name, minimum_level) values
  ('finance_race_prizes','financial_director','Primes de performance',1),
  ('finance_daily_income','financial_director','Réseau d’affaires',1),
  ('finance_main_sponsor','financial_director','Valorisation du partenaire principal',1),
  ('finance_secondary_sponsor','financial_director','Développement des partenaires secondaires',1)
on conflict(code) do update set role=excluded.role,display_name=excluded.display_name,
  minimum_level=excluded.minimum_level,is_active=true;

-- Keep market atomicity, one generated talent, mandate validation and salary
-- rules. Fail closed if a future function changes an expected anchor.
do $staff_paths$
declare signature regprocedure; definition text; patched text;
begin
  foreach signature in array array[
    'public.create_daily_staff_market(date,jsonb)'::regprocedure,
    'public.append_staff_market_wave(date,integer,jsonb)'::regprocedure,
    'public.redeem_custom_staff_recruitment_reward(uuid,uuid,uuid,text,text,text,integer,text,text,text)'::regprocedure,
    'public.calculate_staff_salary(text,integer)'::regprocedure
  ] loop
    select replace(pg_get_functiondef(signature),chr(13),'') into definition;
    if position('financial_director' in definition)>0 then continue; end if;
    patched := case when signature='public.calculate_staff_salary(text,integer)'::regprocedure
      then replace(definition, 'when ''educator'' then 18000', 'when ''educator'' then 18000 when ''financial_director'' then 18000')
      else replace(definition, '''research_engineer'', ''educator''', '''research_engineer'', ''educator'', ''financial_director''') end;
    if patched=definition or position('financial_director' in patched)=0 then raise exception 'Unknown staff path %',signature; end if;
    patched := replace(patched, 'when ''educator'' then ''Formateur''',
      'when ''educator'' then ''Formateur'' when ''financial_director'' then ''Directeur financier''');
    execute patched;
  end loop;

  signature := 'public.start_current_team_staff_academy_training(uuid,text)'::regprocedure;
  select replace(pg_get_functiondef(signature),chr(13),'') into definition;
  patched := replace(definition, 'if v_talent_count >= 3 then',
    'if v_member.role = ''financial_director'' and v_talent_count >= least(3,v_member.level) then
      raise exception ''Augmentez le niveau du Directeur financier pour débloquer un emplacement supplémentaire (trois maximum).'';
    end if;
    if v_talent_count >= 3 then');
  if patched=definition and position('financial_director' in definition)=0 then raise exception 'Unknown academy capacity guard'; end if;
  execute patched;
end;
$staff_paths$;

create function private.enforce_financial_director_contract_limit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status<>'active' or not exists(select 1 from public.staff_members where id=new.staff_member_id and role='financial_director') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('team-financial-director:' || new.team_id::text,0));
  if exists(select 1 from public.staff_contracts c join public.staff_members m on m.id=c.staff_member_id
    where c.team_id=new.team_id and c.status='active' and m.role='financial_director' and c.id<>new.id) then
    raise exception 'Une équipe ne peut employer qu’un seul Directeur financier actif.';
  end if;
  return new;
end;
$$;
create trigger staff_contracts_financial_director_limit before insert or update of team_id,staff_member_id,status
on public.staff_contracts for each row execute function private.enforce_financial_director_contract_limit();

create function private.enforce_financial_director_talent_capacity()
returns trigger language plpgsql security definer set search_path='' as $$
declare member_level integer;
begin
  select level into member_level from public.staff_members where id=new.staff_member_id and role='financial_director' for update;
  if found then
    if new.slot_number > least(3,member_level) then raise exception 'Augmentez le niveau du Directeur financier pour débloquer cet emplacement.'; end if;
    if new.slot_number>1 and new.unlocked_by<>'professions_building' then raise exception 'Les affixes supplémentaires nécessitent l’Académie des métiers.'; end if;
  end if;
  return new;
end;
$$;
create trigger financial_director_talent_capacity before insert or update on public.staff_member_talents
for each row execute function private.enforce_financial_director_talent_capacity();

-- No salary, sponsor contract, result, points or existing receipt is rewritten.
-- One extra ledger receipt per original transaction. Positive cash only.
create function private.credit_financial_director_transaction_bonus()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_talent_code text; rate numeric; bonus numeric; receipt uuid; previous_bonus record;
begin
  -- Keep an already awarded bonus consistent if its source is corrected or
  -- cancelled later, without consulting today's staff/level or re-awarding it.
  if tg_op='UPDATE' then
    if old.status='posted' then
      select id,amount into previous_bonus from public.team_finance_transactions
      where team_season_id=new.team_season_id and status='posted'
        and source_reference='financial-director:bonus:' || new.id::text for update;
      if found and (new.status<>'posted' or new.amount<>old.amount) then
        bonus:=case when new.status='posted' and new.amount>0 and old.amount>0
          then round(previous_bonus.amount*new.amount/old.amount,2) else 0 end;
        update public.team_finance_transactions set
          amount=case when bonus>0 then bonus else amount end,
          status=case when bonus>0 then 'posted' else 'cancelled' end
        where id=previous_bonus.id;
        update public.team_seasons set cash_balance=cash_balance+bonus-previous_bonus.amount
        where id=new.team_season_id;
      end if;
      return new;
    end if;
  end if;
  if new.status<>'posted' or new.amount<=0 or new.category not in ('race_prize','sponsor') then return new; end if;
  if new.category='race_prize' then
    -- Corrections and reimbursements are not new sporting earnings.
    if new.source_reference ~* '(repair|correction|refund|replay|void)' then return new; end if;
    v_talent_code := 'finance_race_prizes'; rate:=2;
  elsif new.source_reference like 'sponsor:%' then
    if not exists(select 1 from public.team_sponsor_contracts c
      join public.team_seasons ts on ts.team_id=c.team_id
      where ts.id=new.team_season_id and c.role='principal'
        and split_part(new.source_reference,':',2)=c.id::text) then return new; end if;
    v_talent_code := 'finance_main_sponsor'; rate:=0.5;
  elsif new.source_reference like 'secondary-sponsor-objective:%' then
    v_talent_code := 'finance_secondary_sponsor'; rate:=1;
  else return new;
  end if;

  select round(new.amount * rate * least(5,greatest(1,m.level))
    * case when m.country_id=ts.registration_country_id then 1.10 else 1 end / 100,2)
  into bonus
  from public.team_seasons ts join public.seasons s on s.id=ts.season_id and s.status='active'
  join public.season_days day on day.id=new.season_day_id and day.season_id=s.id
  join public.staff_contracts c on c.team_id=ts.team_id and c.status='active'
  join public.staff_members m on m.id=c.staff_member_id and m.role='financial_director'
  join public.staff_member_talents talent on talent.staff_member_id=m.id and talent.talent_code=v_talent_code
  where ts.id=new.team_season_id and ts.status='active'
    and day.calendar_date >= (c.signed_at at time zone 'Europe/Paris')::date
    and coalesce(new.posted_at,now()) >= c.signed_at
    and coalesce(new.posted_at,now()) >= talent.created_at
  order by c.signed_at limit 1;
  if coalesce(bonus,0)<=0 then return new; end if;
  insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at)
  values(new.team_season_id,new.season_day_id,new.day_number,bonus,'other','posted',
    'Directeur financier · ' || case v_talent_code when 'finance_race_prizes' then 'Primes de performance' when 'finance_main_sponsor' then 'Partenaire principal' else 'Partenaire secondaire' end,
    'financial-director:bonus:' || new.id::text,now())
  on conflict(team_season_id,source_reference) do update set amount=excluded.amount,status='posted',posted_at=excluded.posted_at
    where team_finance_transactions.status='cancelled' returning id into receipt;
  if receipt is not null then update public.team_seasons set cash_balance=cash_balance+bonus where id=new.team_season_id; end if;
  return new;
end;
$$;
create trigger financial_director_transaction_bonus after insert or update of status,amount
on public.team_finance_transactions for each row
when(new.category in ('race_prize','sponsor'))
execute function private.credit_financial_director_transaction_bonus();

create function public.settle_due_financial_director_income()
returns integer language plpgsql security definer set search_path=''
set lock_timeout='1s' set statement_timeout='5s' as $$
declare candidate record; receipt uuid; paid integer:=0;
begin
  -- Current game day only, never retroactive; team/day key survives replacements
  -- and level changes. Each call is bounded and repeated calls resume safely.
  for candidate in
    select ts.id as team_season_id,day.id as day_id,day.day_number,
      round(150*least(5,greatest(1,m.level))*case when m.country_id=ts.registration_country_id then 1.10 else 1 end,2) as amount
    from public.seasons s join public.season_days day on day.season_id=s.id and day.day_number=s.current_day_number
    join public.team_seasons ts on ts.season_id=s.id and ts.status='active'
    join public.staff_contracts c on c.team_id=ts.team_id and c.status='active'
    join public.staff_members m on m.id=c.staff_member_id and m.role='financial_director'
    join public.staff_member_talents talent on talent.staff_member_id=m.id and talent.talent_code='finance_daily_income'
    where s.status='active' and day.calendar_date=(now() at time zone 'Europe/Paris')::date
      and (c.signed_at at time zone 'Europe/Paris')::date<=day.calendar_date
      and talent.created_at<=now()
      and not exists(select 1 from public.team_finance_transactions tx where tx.team_season_id=ts.id
        and tx.source_reference='financial-director:daily:' || day.id::text)
    order by ts.id limit 200
  loop
    insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at)
    values(candidate.team_season_id,candidate.day_id,candidate.day_number,candidate.amount,'other','posted',
      'Directeur financier · Réseau d’affaires','financial-director:daily:' || candidate.day_id::text,now())
    on conflict(team_season_id,source_reference) do nothing returning id into receipt;
    if receipt is not null then
      update public.team_seasons set cash_balance=cash_balance+candidate.amount where id=candidate.team_season_id;
      paid:=paid+1;
    end if;
  end loop;
  return paid;
end;
$$;

revoke all on function private.enforce_financial_director_contract_limit() from public,anon,authenticated;
revoke all on function private.enforce_financial_director_talent_capacity() from public,anon,authenticated;
revoke all on function private.credit_financial_director_transaction_bonus() from public,anon,authenticated;
revoke all on function public.settle_due_financial_director_income() from public,anon,authenticated;
grant execute on function public.settle_due_financial_director_income() to service_role;
notify pgrst,'reload schema';
commit;
