begin;

create table public.national_federation_accounts (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  opening_balance numeric(14, 2) not null default 0,
  balance numeric(14, 2) not null default 0,
  source_game_year integer not null,
  uci_rank integer not null,
  nations_cup_division smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_federation_accounts_balance_non_negative check (balance >= 0),
  constraint national_federation_accounts_rank_positive check (uci_rank > 0),
  constraint national_federation_accounts_division_valid check (
    nations_cup_division between 1 and 4
  ),
  constraint national_federation_accounts_country_season_unique
    unique (country_id, season_id)
);

create table public.national_federation_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.national_federation_accounts(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  day_number smallint not null,
  amount numeric(14, 2) not null,
  category text not null,
  description text not null,
  source_reference text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint national_federation_transactions_amount_non_zero check (amount <> 0),
  constraint national_federation_transactions_day_valid check (day_number between 1 and 28),
  constraint national_federation_transactions_category_allowed check (
    category in ('opening_grant', 'race_revenue', 'objective_bonus', 'donation', 'solidarity', 'infrastructure', 'refund', 'hosting')
  ),
  constraint national_federation_transactions_text_present check (
    btrim(description) <> '' and btrim(source_reference) <> ''
  ),
  constraint national_federation_transactions_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index national_federation_transactions_account_created_idx
  on public.national_federation_transactions (account_id, created_at desc, id desc);

create table public.national_federation_solidarity_plans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique
    references public.national_federation_accounts(id) on delete cascade,
  reputation_threshold integer not null,
  amount_per_team numeric(14, 2) not null,
  beneficiary_count integer not null,
  total_amount numeric(14, 2) not null,
  executed_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  executed_at timestamptz not null default now(),
  constraint national_federation_solidarity_threshold_valid check (
    reputation_threshold between 0 and 500
  ),
  constraint national_federation_solidarity_amount_valid check (
    amount_per_team >= 0 and total_amount >= 0 and beneficiary_count >= 0
  )
);

alter table public.national_federation_accounts enable row level security;
alter table public.national_federation_transactions enable row level security;
alter table public.national_federation_solidarity_plans enable row level security;

create policy national_federation_accounts_select_authenticated
on public.national_federation_accounts for select to authenticated using (true);
create policy national_federation_transactions_select_authenticated
on public.national_federation_transactions for select to authenticated using (true);
create policy national_federation_solidarity_plans_select_authenticated
on public.national_federation_solidarity_plans for select to authenticated using (true);

grant select on table public.national_federation_accounts to authenticated;
grant select on table public.national_federation_transactions to authenticated;
grant select on table public.national_federation_solidarity_plans to authenticated;
grant all on table public.national_federation_accounts to service_role;
grant all on table public.national_federation_transactions to service_role;
grant all on table public.national_federation_solidarity_plans to service_role;

create or replace function public.initialize_due_national_federation_accounts()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_previous_season_id uuid;
  v_country_id uuid;
  v_rank integer := 173;
  v_division integer := 4;
  v_completed_days integer := 0;
  v_completed_editions integer := 0;
  v_starters integer := 0;
  v_average_starters integer := 0;
  v_course_fill_rate numeric := 0;
  v_uci_performance numeric := 0;
  v_uci_grant numeric := 150000;
  v_nations_grant numeric := 120000;
  v_race_revenue numeric := 0;
  v_opening_balance numeric := 0;
  v_account_id uuid;
  v_inserted integer := 0;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  select id into v_previous_season_id
  from public.seasons where game_year = v_season.game_year - 1 limit 1;
  select id into v_country_id
  from public.countries where iso_alpha2 = 'BE' and is_active = true limit 1;
  if v_country_id is null then return 0; end if;
  if exists (
    select 1 from public.national_federation_accounts
    where country_id = v_country_id and season_id = v_season.id
  ) then return 0; end if;

  if v_previous_season_id is not null then
    with country_points as (
      select ranking.country_id, sum(ranking.uci_points)::bigint as points
      from public.get_national_championship_country_rankings(v_previous_season_id) as ranking
      group by ranking.country_id
    ), ranked as (
      select country_id,
        row_number() over (order by points desc, country_id)::integer as rank
      from country_points
    )
    select coalesce(rank, 173) into v_rank
    from ranked where country_id = v_country_id;
    v_rank := coalesce(v_rank, 173);

    select
      count(stage.id)::integer,
      count(distinct edition.id)::integer
    into v_completed_days, v_completed_editions
    from public.races as race
    join public.race_editions as edition
      on edition.race_id = race.id and edition.season_id = v_previous_season_id
    join public.stages as stage
      on stage.race_edition_id = edition.id and stage.status = 'completed'
    where race.country_id = v_country_id and race.status = 'active';

    select count(roster.id)::integer into v_starters
    from public.races as race
    join public.race_editions as edition
      on edition.race_id = race.id and edition.season_id = v_previous_season_id
    join public.race_registrations as registration
      on registration.race_edition_id = edition.id and registration.status = 'accepted'
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
     and roster.status in ('selected', 'confirmed')
    where race.country_id = v_country_id and race.status = 'active';
  end if;

  v_division := case when v_rank <= 20 then 1 when v_rank <= 60 then 2
    when v_rank <= 100 then 3 else 4 end;
  v_average_starters := case when v_completed_editions > 0
    then round(v_starters::numeric / v_completed_editions)::integer else 0 end;
  v_course_fill_rate := least(1, v_average_starters::numeric / 160);
  v_uci_performance := 1 - (least(173, greatest(1, v_rank)) - 1)::numeric / 172;
  v_uci_grant := round((150000 + 850000 * sqrt(v_uci_performance)) / 5000) * 5000;
  v_nations_grant := case v_division when 1 then 450000 when 2 then 300000
    when 3 then 200000 else 120000 end;
  v_race_revenue := round((least(40, v_completed_days) * (5000 + 12000 * v_course_fill_rate)) / 1000) * 1000;
  v_opening_balance := 1200000 + v_uci_grant + v_nations_grant + v_race_revenue;

  insert into public.national_federation_accounts (
    country_id, season_id, opening_balance, balance, source_game_year,
    uci_rank, nations_cup_division
  ) values (
    v_country_id, v_season.id, v_opening_balance, v_opening_balance,
    v_season.game_year - 1, v_rank, v_division
  ) on conflict (country_id, season_id) do nothing
  returning id into v_account_id;
  if v_account_id is null then return 0; end if;

  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description,
    source_reference, metadata
  ) values (
    v_account_id, 1, v_opening_balance, 'opening_grant',
    'Dotation d’ouverture calculée depuis la saison précédente.',
    'federation-account:' || v_account_id::text || ':opening',
    jsonb_build_object(
      'commonGrant', 1200000, 'uciGrant', v_uci_grant,
      'nationsCupGrant', v_nations_grant, 'raceRevenue', v_race_revenue,
      'completedRaceDays', v_completed_days, 'averageStarters', v_average_starters
    )
  );
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_country_id, v_season.id, 1, 'finance', 'Budget fédéral ouvert',
    'La dotation de la fédération a été calculée depuis les résultats de la saison précédente.',
    'federation-account:' || v_account_id::text || ':journal'
  ) on conflict (source_reference) do nothing;
  v_inserted := 1;
  return v_inserted;
end;
$$;

create or replace function public.donate_to_current_national_federation(
  p_country_code text,
  p_amount numeric
)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_team_season public.team_seasons%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_day_id uuid;
  v_operation_id uuid := gen_random_uuid();
  v_amount numeric := round(coalesce(p_amount, 0) / 5000) * 5000;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'Les dons sont limités à la fédération belge pendant la bêta.';
  end if;
  if v_amount < 25000 or v_amount > 5000000 then
    raise exception 'Le don doit être compris entre 25 000 € et 5 000 000 €.';
  end if;

  perform public.initialize_due_national_federation_accounts();
  perform public.settle_current_team_finances();
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.game_year < 3 or v_identity.team_id is null then
    raise exception 'Les dons fédéraux seront disponibles à partir de la Saison 3.';
  end if;
  select * into v_team_season from public.team_seasons
  where team_id = v_identity.team_id and season_id = v_season.id
    and status in ('planned', 'active') for update;
  select * into v_account from public.national_federation_accounts
  where country_id = v_identity.country_id and season_id = v_season.id for update;
  if v_account.id is null then raise exception 'Le budget fédéral n’est pas initialisé.'; end if;
  if v_team_season.cash_balance < v_amount then
    raise exception 'La trésorerie de votre équipe est insuffisante.';
  end if;
  select id into v_day_id from public.season_days
  where season_id = v_season.id and day_number = v_season.current_day_number limit 1;

  update public.team_seasons set cash_balance = cash_balance - v_amount
  where id = v_team_season.id;
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  ) values (
    v_team_season.id, v_day_id, v_season.current_day_number, -v_amount,
    'other', 'posted', 'Don à la Fédération belge',
    'federation-donation:' || v_operation_id::text, now()
  );
  update public.national_federation_accounts
  set balance = balance + v_amount, updated_at = now() where id = v_account.id;
  insert into public.national_federation_transactions (
    account_id, team_id, day_number, amount, category, description, source_reference
  ) values (
    v_account.id, v_identity.team_id, v_season.current_day_number, v_amount,
    'donation', 'Don de ' || v_identity.team_name,
    'federation-donation:' || v_operation_id::text
  );
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number, 'finance',
    'Contribution d’une équipe',
    v_identity.team_name || ' verse ' || trim(to_char(v_amount, 'FM999G999G999')) || ' € à la fédération.',
    'federation-donation:' || v_operation_id::text
  );
  return v_amount;
end;
$$;

create or replace function public.execute_national_federation_solidarity(
  p_country_code text,
  p_reputation_threshold integer,
  p_amount_per_team numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_plan_id uuid;
  v_beneficiary_count integer;
  v_total numeric;
  v_amount numeric := round(coalesce(p_amount_per_team, 0) / 5000) * 5000;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'La solidarité est limitée à la fédération belge pendant la bêta.';
  end if;
  if p_reputation_threshold not between 0 and 500 or v_amount < 0 or v_amount > 500000 then
    raise exception 'Les paramètres du fonds de solidarité sont invalides.';
  end if;
  perform public.initialize_due_national_federation_accounts();
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.game_year < 3 then
    raise exception 'Le fonds de solidarité sera disponible à partir de la Saison 3.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then raise exception 'Seul le président élu peut valider ce fonds.'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_identity.country_id::text || ':' || v_season.id::text || ':solidarity', 0)
  );
  select * into v_account from public.national_federation_accounts
  where country_id = v_identity.country_id and season_id = v_season.id for update;
  if exists (select 1 from public.national_federation_solidarity_plans where account_id = v_account.id) then
    raise exception 'Le fonds de solidarité de cette saison a déjà été versé.';
  end if;

  select count(*)::integer into v_beneficiary_count
  from public.team_seasons as team_season
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id and director.status = 'active'
  where team_season.season_id = v_season.id
    and team_season.registration_country_id = v_identity.country_id
    and team_season.status in ('planned', 'active')
    and director.reputation_points <= p_reputation_threshold;
  v_total := v_beneficiary_count * v_amount;
  if v_total > v_account.balance then
    raise exception 'Budget insuffisant : la dépense dépasse la trésorerie fédérale.';
  end if;

  insert into public.national_federation_solidarity_plans (
    account_id, reputation_threshold, amount_per_team, beneficiary_count,
    total_amount, executed_by_director_id
  ) values (
    v_account.id, p_reputation_threshold, v_amount, v_beneficiary_count,
    v_total, v_identity.sporting_director_id
  ) returning id into v_plan_id;

  if v_amount > 0 then
    update public.team_seasons as team_season
    set cash_balance = team_season.cash_balance + v_amount
    from public.team_manager_assignments as assignment,
         public.sporting_directors as director
    where assignment.team_id = team_season.team_id
      and assignment.role = 'general_manager' and assignment.status = 'active'
      and director.id = assignment.sporting_director_id and director.status = 'active'
      and director.reputation_points <= p_reputation_threshold
      and team_season.season_id = v_season.id
      and team_season.registration_country_id = v_identity.country_id
      and team_season.status in ('planned', 'active');

    insert into public.team_finance_transactions (
      team_season_id, season_day_id, day_number, amount, category, status,
      description, source_reference, posted_at
    )
    select
      team_season.id, season_day.id, v_season.current_day_number, v_amount,
      'other', 'posted', 'Fonds de solidarité de la Fédération belge',
      'federation-solidarity:' || v_plan_id::text || ':' || team_season.team_id::text,
      now()
    from public.team_seasons as team_season
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager' and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id and director.status = 'active'
    left join public.season_days as season_day
      on season_day.season_id = v_season.id
     and season_day.day_number = v_season.current_day_number
    where team_season.season_id = v_season.id
      and team_season.registration_country_id = v_identity.country_id
      and team_season.status in ('planned', 'active')
      and director.reputation_points <= p_reputation_threshold;
  end if;

  if v_total > 0 then
    update public.national_federation_accounts
    set balance = balance - v_total, updated_at = now() where id = v_account.id;
    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description, source_reference, metadata
    ) values (
      v_account.id, v_season.current_day_number, -v_total, 'solidarity',
      'Versement du fonds de solidarité',
      'federation-solidarity:' || v_plan_id::text,
      jsonb_build_object('beneficiaryCount', v_beneficiary_count, 'amountPerTeam', v_amount,
        'reputationThreshold', p_reputation_threshold)
    );
  end if;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number, 'finance',
    'Fonds de solidarité versé',
    v_beneficiary_count::text || ' équipe(s) bénéficiaire(s) pour un total de ' || trim(to_char(v_total, 'FM999G999G999')) || ' €.',
    'federation-solidarity:' || v_plan_id::text
  );
  return jsonb_build_object('beneficiaryCount', v_beneficiary_count, 'totalAmount', v_total);
end;
$$;

revoke all on function public.initialize_due_national_federation_accounts()
  from public, anon, authenticated;
revoke all on function public.donate_to_current_national_federation(text, numeric)
  from public, anon;
revoke all on function public.execute_national_federation_solidarity(text, integer, numeric)
  from public, anon;
grant execute on function public.initialize_due_national_federation_accounts() to service_role;
grant execute on function public.donate_to_current_national_federation(text, numeric)
  to authenticated, service_role;
grant execute on function public.execute_national_federation_solidarity(text, integer, numeric)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
