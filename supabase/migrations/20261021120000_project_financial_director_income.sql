begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Read-only counterpart of the existing settlement rules. These rows are
-- forecasts, never ledger entries: changing a forecast cannot move any cash.
-- Only the current director/earned affixes and already scheduled transactions
-- are used. Race results and conditional sponsor objectives are not invented.
create function private.get_team_financial_director_projection(p_team_season_id uuid)
returns table (
  source_reference text,
  source_transaction_id uuid,
  day_number integer,
  amount numeric,
  effect text,
  base_amount numeric,
  bonus_percentage numeric,
  description text
)
language sql stable security definer set search_path = '' as $$
  with director as materialized (
    select ts.id as team_season_id, ts.team_id, ts.season_id,
      s.current_day_number, c.signed_at, m.id as member_id,
      least(5, greatest(1, m.level)) as level,
      case when m.country_id = ts.registration_country_id then 1.10 else 1 end as affinity
    from public.team_seasons ts
    join public.seasons s on s.id = ts.season_id and s.status = 'active'
    join public.staff_contracts c on c.team_id = ts.team_id and c.status = 'active'
    join public.staff_members m on m.id = c.staff_member_id and m.role = 'financial_director'
    where ts.id = p_team_season_id and ts.status = 'active' and c.signed_at <= now()
    order by c.signed_at, c.id
    limit 1
  ), talents as materialized (
    select t.talent_code, t.created_at
    from director df
    join public.staff_member_talents t on t.staff_member_id = df.member_id
    where t.created_at <= now()
  ), pending as materialized (
    select tx.id, tx.day_number::integer, tx.amount, tx.category,
      tx.source_reference, tx.posted_at, d.calendar_date
    from director df
    join public.team_finance_transactions tx on tx.team_season_id = df.team_season_id
      and tx.status = 'pending'
      and tx.day_number >= df.current_day_number and tx.day_number between 1 and 28
    join public.season_days d on d.id = tx.season_day_id
      and d.season_id = df.season_id and d.day_number = tx.day_number
    where d.calendar_date >= (df.signed_at at time zone 'Europe/Paris')::date
      and coalesce(tx.posted_at, now()) >= df.signed_at
  ), bonuses as (
    select tx.id, tx.day_number, abs(tx.amount) as base_amount,
      case
        when tx.category = 'staff_salary' then 'staff_salary'
        when tx.category = 'rider_salary' then 'rider_salary'
        when tx.category = 'race_prize' then 'race_prize'
        when tx.source_reference like 'sponsor:%' then 'main_sponsor'
        else 'secondary_sponsor'
      end as effect,
      case when tx.category in ('staff_salary', 'rider_salary', 'race_prize') then 2
        when tx.source_reference like 'sponsor:%' then 0.5 else 1 end
        * df.level * df.affinity as bonus_percentage,
      case when tx.category in ('staff_salary', 'rider_salary')
        then 'financial-director:salary-savings:' else 'financial-director:bonus:' end
        || tx.id::text as source_reference
    from pending tx cross join director df
    where (
      tx.category = 'staff_salary' and tx.amount < 0
      and tx.day_number in (7, 14, 21, 28)
      and exists (
        select 1 from public.staff_contracts paid
        join public.staff_members worker on worker.id = paid.staff_member_id
        where paid.team_id = df.team_id and worker.role <> 'financial_director'
          and tx.source_reference = 'staff-contract:' || paid.id::text || ':'
            || df.season_id::text || ':' || (tx.day_number / 7)::text
      )
      and exists (select 1 from talents t where t.talent_code = 'finance_daily_income'
        and tx.calendar_date >= (t.created_at at time zone 'Europe/Paris')::date
        and coalesce(tx.posted_at, now()) >= t.created_at)
    ) or (
      tx.category = 'rider_salary' and tx.amount < 0
      and tx.day_number in (7, 14, 21, 28)
      and exists (select 1 from public.rider_contracts paid
        where paid.team_id = df.team_id
          and tx.source_reference = 'rider-salary:' || paid.id::text || ':'
            || df.season_id::text || ':' || (tx.day_number / 7)::text)
      and exists (select 1 from talents t where t.talent_code = 'finance_rider_salary'
        and tx.calendar_date >= (t.created_at at time zone 'Europe/Paris')::date
        and coalesce(tx.posted_at, now()) >= t.created_at)
    ) or (
      tx.category = 'race_prize' and tx.amount > 0
      and tx.source_reference !~* '(repair|correction|refund|replay|void)'
      and exists (select 1 from talents t where t.talent_code = 'finance_race_prizes'
        and coalesce(tx.posted_at, now()) >= t.created_at)
    ) or (
      tx.category = 'sponsor' and tx.amount > 0
      and tx.source_reference like 'sponsor:%'
      and exists (select 1 from public.team_sponsor_contracts sponsor
        where sponsor.team_id = df.team_id and sponsor.role = 'principal'
          and split_part(tx.source_reference, ':', 2) = sponsor.id::text)
      and exists (select 1 from talents t where t.talent_code = 'finance_main_sponsor'
        and coalesce(tx.posted_at, now()) >= t.created_at)
    ) or (
      tx.category = 'sponsor' and tx.amount > 0
      and tx.source_reference like 'secondary-sponsor-objective:%'
      and exists (select 1 from talents t where t.talent_code = 'finance_secondary_sponsor'
        and coalesce(tx.posted_at, now()) >= t.created_at)
    )
  ), forecast as (
    select 'financial-director:daily:' || d.id::text as source_reference,
      null::uuid as source_transaction_id, d.day_number::integer,
      round((array[200, 450, 850, 1600, 2900])[df.level] * df.affinity, 2) as amount,
      'daily_income'::text as effect, null::numeric as base_amount,
      null::numeric as bonus_percentage,
      'Directeur financier · Revenus quotidiens'::text as description
    from director df
    join public.season_days d on d.season_id = df.season_id
      and d.day_number > df.current_day_number and d.day_number between 1 and 28
    where d.calendar_date >= (df.signed_at at time zone 'Europe/Paris')::date
    union all
    select b.source_reference, b.id, b.day_number,
      round(b.base_amount * b.bonus_percentage / 100, 2),
      b.effect, b.base_amount, b.bonus_percentage,
      'Directeur financier · ' || case b.effect
        when 'staff_salary' then 'Économie sur les salaires du staff'
        when 'rider_salary' then 'Économie sur les salaires des coureurs'
        when 'race_prize' then 'Primes de performance'
        when 'main_sponsor' then 'Partenaire principal'
        else 'Partenaire secondaire' end
    from bonuses b
  )
  select f.source_reference, f.source_transaction_id, f.day_number, f.amount,
    f.effect, f.base_amount, f.bonus_percentage, f.description
  from forecast f
  where f.amount > 0 and not exists (
    select 1 from public.team_finance_transactions receipt
    where receipt.team_season_id = p_team_season_id
      and receipt.source_reference = f.source_reference
  )
  order by f.day_number, f.source_reference;
$$;

revoke all on function private.get_team_financial_director_projection(uuid)
  from public, anon, authenticated, service_role;

-- The client supplies no team id. Resolve ownership inside the definer and
-- expose only the authenticated active general manager's current season.
create function public.get_current_team_financial_director_projection()
returns table (
  source_reference text,
  source_transaction_id uuid,
  day_number integer,
  amount numeric,
  effect text,
  base_amount numeric,
  bonus_percentage numeric,
  description text
)
language plpgsql stable security definer set search_path = '' as $$
declare v_team_season_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  select ts.id into v_team_season_id
  from public.sporting_directors director
  join public.team_manager_assignments assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.team_seasons ts on ts.team_id = assignment.team_id and ts.status = 'active'
  join public.seasons season on season.id = ts.season_id and season.status = 'active'
  where director.auth_user_id = auth.uid() and director.status = 'active'
  order by ts.id limit 1;
  if v_team_season_id is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;
  return query select projection.*
    from private.get_team_financial_director_projection(v_team_season_id) projection;
end;
$$;
revoke all on function public.get_current_team_financial_director_projection()
  from public, anon;
grant execute on function public.get_current_team_financial_director_projection()
  to authenticated, service_role;

comment on function public.get_current_team_financial_director_projection() is
  'Prévision en lecture seule des futurs apports du Directeur financier, sans modifier les dépenses brutes ni créer de recette comptable.';
notify pgrst, 'reload schema';
commit;
