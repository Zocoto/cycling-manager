begin;
set local lock_timeout='1s';
set local statement_timeout='5s';

-- Keep the legacy identifier so existing hires, slots, market candidates and
-- academy proposals survive the change without rerolls or lost talents.
update public.staff_talent_catalog
set display_name='Optimisation des charges'
where code='finance_daily_income' and role='financial_director';
insert into public.staff_talent_catalog(code,role,display_name,minimum_level,is_active)
values('finance_rider_salary','financial_director','Optimisation des salaires coureurs',1,true)
on conflict(code) do update set display_name=excluded.display_name,is_active=true;

-- One fixed rate per source payment: later corrections must use the rate
-- awarded then, even after the director levels up, changes country or leaves.
create table private.financial_director_salary_savings (
  source_transaction_id uuid primary key references public.team_finance_transactions(id) on delete cascade,
  discount_percentage numeric(5,2) not null check(discount_percentage>0 and discount_percentage<=11),
  created_at timestamptz not null default now()
);
alter table private.financial_director_salary_savings enable row level security;
revoke all on private.financial_director_salary_savings from public,anon,authenticated,service_role;

create function private.credit_financial_director_salary_savings()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_rate numeric; v_affix text; v_discount numeric; v_previous numeric:=0;
  v_receipt public.team_finance_transactions%rowtype; v_has_rate boolean;
begin
  -- Salary schedules are created in bulk. Pending rows and unchanged retries
  -- must not issue any savings lookup or join against staff contracts.
  if tg_op='INSERT' and new.status<>'posted' then return new; end if;
  if tg_op='UPDATE' then
    if new.status=old.status and new.amount=old.amount then return new; end if;
  end if;
  select discount_percentage into v_rate
  from private.financial_director_salary_savings
  where source_transaction_id=new.id for update;
  v_has_rate:=found;

  if not v_has_rate then
    -- Never grant a new saving while touching an already posted historical
    -- salary. Only a genuinely new payment can establish an entitlement.
    if tg_op='UPDATE' then
      if old.status='posted' then return new; end if;
    end if;
    if new.status<>'posted' or new.amount>=0 then return new; end if;
    v_affix:=case when new.category='staff_salary' then 'finance_daily_income'
      when new.category='rider_salary' then 'finance_rider_salary' end;
    if v_affix is null then return new; end if;

    -- Exact salary references only: no signing fees, dismissal payments,
    -- transfers, bonuses or the finance director's own salary are eligible.
    if new.category='staff_salary' then
      if new.source_reference !~ '^staff-contract:[0-9a-f-]{36}:[0-9a-f-]{36}:[1-4]$' then return new; end if;
    elsif new.source_reference !~ '^rider-salary:[0-9a-f-]{36}:[0-9a-f-]{36}:[1-4]$' then return new;
    end if;
    if split_part(new.source_reference,':',2) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return new; end if;

    select 2*least(5,greatest(1,m.level))
      *case when m.country_id=ts.registration_country_id then 1.10 else 1 end
    into v_rate
    from public.team_seasons ts
    join public.seasons s on s.id=ts.season_id and s.status='active'
    join public.season_days d on d.id=new.season_day_id and d.season_id=s.id
    join public.staff_contracts c on c.team_id=ts.team_id and c.status='active'
    join public.staff_members m on m.id=c.staff_member_id and m.role='financial_director'
    join public.staff_member_talents t on t.staff_member_id=m.id and t.talent_code=v_affix
    where ts.id=new.team_season_id and ts.status='active'
      and split_part(new.source_reference,':',3)=ts.season_id::text
      and d.day_number=new.day_number
      and d.day_number<=s.current_day_number
      and d.calendar_date<=(now() at time zone 'Europe/Paris')::date
      and new.day_number=7*split_part(new.source_reference,':',4)::integer
      and coalesce(new.posted_at,now())>=c.signed_at
      and coalesce(new.posted_at,now())>=t.created_at
      and d.calendar_date>=(c.signed_at at time zone 'Europe/Paris')::date
      and d.calendar_date>=(t.created_at at time zone 'Europe/Paris')::date
      and case when new.category='staff_salary' then exists(
        select 1 from public.staff_contracts paid
        join public.staff_members worker on worker.id=paid.staff_member_id
        where paid.id=split_part(new.source_reference,':',2)::uuid
          and paid.team_id=ts.team_id and worker.role<>'financial_director'
      ) else exists(
        select 1 from public.rider_contracts paid
        where paid.id=split_part(new.source_reference,':',2)::uuid and paid.team_id=ts.team_id
      ) end
    order by c.signed_at limit 1;
    if coalesce(v_rate,0)<=0 then return new; end if;
    insert into private.financial_director_salary_savings(source_transaction_id,discount_percentage)
    values(new.id,v_rate);
  end if;

  v_discount:=case when new.status='posted' and new.amount<0
    then round(-new.amount*v_rate/100,2) else 0 end;
  select * into v_receipt from public.team_finance_transactions
  where team_season_id=new.team_season_id
    and source_reference='financial-director:salary-savings:'||new.id::text for update;
  if found then
    v_previous:=case when v_receipt.status='posted' then v_receipt.amount else 0 end;
    update public.team_finance_transactions set
      amount=case when v_discount>0 then v_discount else amount end,
      status=case when v_discount>0 then 'posted' else 'cancelled' end
    where id=v_receipt.id;
  elsif v_discount>0 then
    insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,
      amount,category,status,description,source_reference,posted_at)
    values(new.team_season_id,new.season_day_id,new.day_number,v_discount,'other','posted',
      case when new.category='staff_salary' then 'Directeur financier · Économie sur les salaires du staff'
        else 'Directeur financier · Économie sur les salaires des coureurs' end,
      'financial-director:salary-savings:'||new.id::text,now());
  end if;
  if v_discount<>v_previous then
    update public.team_seasons set cash_balance=cash_balance+v_discount-v_previous
    where id=new.team_season_id;
  end if;
  return new;
end;
$$;
revoke all on function private.credit_financial_director_salary_savings() from public,anon,authenticated;
create trigger financial_director_salary_savings
after insert or update of status,amount on public.team_finance_transactions
for each row when(new.category in ('staff_salary','rider_salary'))
execute function private.credit_financial_director_salary_savings();

-- Base income no longer requires any particular affix. Existing team/day
-- receipts are reused: no double payment, catch-up or historical rewriting.
create or replace function public.settle_due_financial_director_income()
returns integer language plpgsql security definer set search_path=''
set lock_timeout='1s' set statement_timeout='5s' as $$
declare candidate record; receipt uuid; paid integer:=0;
begin
  for candidate in
    select ts.id as team_season_id,day.id as day_id,day.day_number,
      round((array[200,450,850,1600,2900])[least(5,greatest(1,m.level))]
        *case when m.country_id=ts.registration_country_id then 1.10 else 1 end,2) as amount
    from public.seasons s
    join public.season_days day on day.season_id=s.id and day.day_number=s.current_day_number
    join public.team_seasons ts on ts.season_id=s.id and ts.status='active'
    join public.staff_contracts c on c.team_id=ts.team_id and c.status='active'
    join public.staff_members m on m.id=c.staff_member_id and m.role='financial_director'
    where s.status='active' and day.calendar_date=(now() at time zone 'Europe/Paris')::date
      and (c.signed_at at time zone 'Europe/Paris')::date<=day.calendar_date
      and not exists(select 1 from public.team_finance_transactions tx where tx.team_season_id=ts.id
        and tx.source_reference='financial-director:daily:'||day.id::text)
    order by ts.id limit 200
  loop
    insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,
      amount,category,status,description,source_reference,posted_at)
    values(candidate.team_season_id,candidate.day_id,candidate.day_number,candidate.amount,'other','posted',
      'Directeur financier · Revenus quotidiens','financial-director:daily:'||candidate.day_id::text,now())
    on conflict(team_season_id,source_reference) do nothing returning id into receipt;
    if receipt is not null then
      update public.team_seasons set cash_balance=cash_balance+candidate.amount where id=candidate.team_season_id;
      paid:=paid+1;
    end if;
  end loop;
  return paid;
end;
$$;
revoke all on function public.settle_due_financial_director_income() from public,anon,authenticated;
grant execute on function public.settle_due_financial_director_income() to service_role;
notify pgrst,'reload schema';
commit;
