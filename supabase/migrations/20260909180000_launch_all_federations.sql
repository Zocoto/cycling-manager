begin;

-- The federation space is now available to every affiliated team. Remove the
-- last country-specific guards from preselection and infrastructure mutations.
do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.save_national_federation_preselection(text,text,uuid[])'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'upper(btrim(coalesce(p_country_code, ''''))) <> ''BE''',
    'false'
  );
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'public.publish_national_federation_preselection(text,text)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'upper(btrim(coalesce(p_country_code, ''''))) <> ''BE''',
    'false'
  );
  v_definition := replace(v_definition, '''Fédération belge''', '''Fédération nationale''');
  v_definition := replace(
    v_definition,
    '''/jeu/federations/be?onglet=selections''',
    '''/jeu/federations/'' || lower(btrim(p_country_code)) || ''?onglet=selections'''
  );
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'public.start_national_federation_infrastructure_project(text,text,text)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'upper(btrim(coalesce(p_country_code, ''''))) <> ''BE''',
    'false'
  );
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'public.open_exceptional_federation_election(uuid,uuid,uuid)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'Un changement de nationalité d’équipe a mis fin au mandat du président. Votre fédération ouvre immédiatement une élection exceptionnelle : 48 heures de candidatures, puis 48 heures de vote.',
    'La présidence est vacante. Votre fédération ouvre une élection exceptionnelle : 48 heures de candidatures, puis 48 heures de vote.'
  );
  execute v_definition;
end;
$migration$;

-- A selection response resolves the member's actual federation instead of
-- assuming Belgium.
create or replace function public.respond_to_national_federation_preselection(
  p_member_id uuid,
  p_accept boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_member public.national_federation_selection_members%rowtype;
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_country_code text;
  v_rider_name text;
  v_president_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

  select * into v_member
  from public.national_federation_selection_members
  where id = p_member_id
  for update;
  select * into v_list
  from public.national_federation_selection_lists
  where id = v_member.selection_list_id;
  select country.iso_alpha2 into v_country_code
  from public.countries as country
  where country.id = v_list.country_id;
  select * into v_identity
  from public.get_current_federation_identity(v_country_code);
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;

  if v_member.id is null
     or v_identity.team_id is null
     or v_member.owner_team_id <> v_identity.team_id
     or v_member.owner_director_id <> v_identity.sporting_director_id then
    raise exception 'Cette demande ne concerne pas votre équipe.';
  end if;
  if v_member.response_status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;

  update public.national_federation_selection_members
  set
    response_status = case when p_accept then 'confirmed' else 'declined' end,
    responded_at = now()
  where id = v_member.id;

  select coalesce(
    (
      select rider.first_name || ' ' || rider.last_name
      from public.riders as rider
      where rider.id = v_member.professional_rider_id
    ),
    (
      select rider.first_name || ' ' || rider.last_name
      from public.youth_academy_riders as rider
      where rider.id = v_member.junior_rider_id
    ),
    'Le coureur'
  ) into v_rider_name;

  select term.president_director_id into v_president_id
  from public.national_federation_terms as term
  where term.country_id = v_list.country_id
    and term.start_game_year <= v_season.game_year
    and term.end_game_year >= v_season.game_year
  limit 1;

  if v_president_id is not null
     and v_president_id <> v_identity.sporting_director_id then
    insert into public.sporting_director_messages (
      sporting_director_id, season_id, message_type, sender_name, subject,
      preview, body, action_href, action_label, source_reference, is_important
    ) values (
      v_president_id, v_season.id, 'international_selection',
      v_identity.team_name,
      case when p_accept then 'Présélection confirmée' else 'Présélection refusée' end,
      v_rider_name || case when p_accept then ' sera disponible.' else ' ne sera pas disponible.' end,
      case when p_accept
        then 'La participation du coureur est confirmée par son DS.'
        else 'La liste doit être revue ou un remplaçant doit être appelé.' end,
      '/jeu/federations/' || lower(v_country_code) || '?onglet=selections',
      'Voir la sélection',
      'federation-selection:' || v_member.id::text || ':response',
      not p_accept
    ) on conflict (sporting_director_id, source_reference) do nothing;
  end if;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_list.country_id, v_season.id, v_season.current_day_number, 'selection',
    case when p_accept then 'Disponibilité confirmée' else 'Disponibilité refusée' end,
    v_identity.team_name || ' · ' || v_rider_name || ' · ' || v_slot.label || '.',
    'federation-selection:' || v_member.id::text || ':response'
  ) on conflict (source_reference) do nothing;

  if not exists (
    select 1
    from public.national_federation_selection_members
    where selection_list_id = v_list.id
      and response_status = 'pending'
  ) then
    update public.national_federation_selection_lists
    set status = 'finalized', updated_at = now()
    where id = v_list.id;
  end if;

  return case when p_accept then 'confirmed' else 'declined' end;
end;
$$;

-- Open a treasury for every federation that actually contains at least one
-- active player team in the current season.
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
  v_country record;
  v_rank integer;
  v_division integer;
  v_completed_days integer;
  v_completed_editions integer;
  v_starters integer;
  v_average_starters integer;
  v_course_fill_rate numeric;
  v_uci_performance numeric;
  v_uci_grant numeric;
  v_nations_grant numeric;
  v_race_revenue numeric;
  v_opening_balance numeric;
  v_account_id uuid;
  v_inserted integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  if v_season.id is null or v_season.game_year < 3 then
    return 0;
  end if;

  select id into v_previous_season_id
  from public.seasons
  where game_year = v_season.game_year - 1
  limit 1;

  for v_country in
    select distinct country.id, country.iso_alpha2
    from public.team_seasons as team_season
    join public.teams as team
      on team.id = team_season.team_id
     and team.status = 'active'
    join public.team_manager_assignments as assignment
      on assignment.team_id = team.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    join public.countries as country
      on country.id = team_season.registration_country_id
     and country.is_active = true
    where team_season.season_id = v_season.id
      and team_season.status in ('planned', 'active')
    order by country.iso_alpha2
  loop
    if exists (
      select 1
      from public.national_federation_accounts as account
      where account.country_id = v_country.id
        and account.season_id = v_season.id
    ) then
      continue;
    end if;

    v_rank := 173;
    v_completed_days := 0;
    v_completed_editions := 0;
    v_starters := 0;
    v_account_id := null;

    if v_previous_season_id is not null then
      with country_points as (
        select ranking.country_id, sum(ranking.uci_points)::bigint as points
        from public.get_national_championship_country_rankings(
          v_previous_season_id
        ) as ranking
        group by ranking.country_id
      ), ranked as (
        select
          country_id,
          row_number() over (order by points desc, country_id)::integer as rank
        from country_points
      )
      select ranked.rank into v_rank
      from ranked
      where ranked.country_id = v_country.id;
      v_rank := coalesce(v_rank, 173);

      select
        count(stage.id)::integer,
        count(distinct edition.id)::integer
      into v_completed_days, v_completed_editions
      from public.races as race
      join public.race_editions as edition
        on edition.race_id = race.id
       and edition.season_id = v_previous_season_id
      join public.stages as stage
        on stage.race_edition_id = edition.id
       and stage.status = 'completed'
      where race.country_id = v_country.id
        and race.status = 'active';

      select count(roster.id)::integer into v_starters
      from public.races as race
      join public.race_editions as edition
        on edition.race_id = race.id
       and edition.season_id = v_previous_season_id
      join public.race_registrations as registration
        on registration.race_edition_id = edition.id
       and registration.status = 'accepted'
      join public.race_rosters as roster
        on roster.race_registration_id = registration.id
       and roster.status in ('selected', 'confirmed')
      where race.country_id = v_country.id
        and race.status = 'active';
    end if;

    v_division := case
      when v_rank <= 20 then 1
      when v_rank <= 60 then 2
      when v_rank <= 100 then 3
      else 4
    end;
    v_average_starters := case
      when v_completed_editions > 0
        then round(v_starters::numeric / v_completed_editions)::integer
      else 0
    end;
    v_course_fill_rate := least(1, v_average_starters::numeric / 160);
    v_uci_performance :=
      1 - (least(173, greatest(1, v_rank)) - 1)::numeric / 172;
    v_uci_grant :=
      round((150000 + 850000 * sqrt(v_uci_performance)) / 5000) * 5000;
    v_nations_grant := case v_division
      when 1 then 450000
      when 2 then 300000
      when 3 then 200000
      else 120000
    end;
    v_race_revenue := round(
      (
        least(40, v_completed_days)
        * (5000 + 12000 * v_course_fill_rate)
      ) / 1000
    ) * 1000;
    v_opening_balance :=
      1200000 + v_uci_grant + v_nations_grant + v_race_revenue;

    insert into public.national_federation_accounts (
      country_id, season_id, opening_balance, balance, source_game_year,
      uci_rank, nations_cup_division
    ) values (
      v_country.id, v_season.id, v_opening_balance, v_opening_balance,
      v_season.game_year - 1, v_rank, v_division
    )
    on conflict (country_id, season_id) do nothing
    returning id into v_account_id;

    if v_account_id is null then
      continue;
    end if;

    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description,
      source_reference, metadata
    ) values (
      v_account_id, 1, v_opening_balance, 'opening_grant',
      'Dotation d’ouverture calculée depuis la saison précédente.',
      'federation-account:' || v_account_id::text || ':opening',
      jsonb_build_object(
        'commonGrant', 1200000,
        'uciGrant', v_uci_grant,
        'nationsCupGrant', v_nations_grant,
        'raceRevenue', v_race_revenue,
        'completedRaceDays', v_completed_days,
        'averageStarters', v_average_starters
      )
    );
    insert into public.national_federation_journal_entries (
      country_id, season_id, day_number, category, title, detail,
      source_reference
    ) values (
      v_country.id, v_season.id, 1, 'finance', 'Budget fédéral ouvert',
      'La dotation de la fédération a été calculée depuis les résultats de la saison précédente.',
      'federation-account:' || v_account_id::text || ':journal'
    ) on conflict (source_reference) do nothing;

    v_inserted := v_inserted + 1;
  end loop;

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
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;
  if v_amount < 25000 or v_amount > 5000000 then
    raise exception 'Le don doit être compris entre 25 000 € et 5 000 000 €.';
  end if;

  perform public.initialize_due_national_federation_accounts();
  perform public.settle_current_team_finances();
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  if v_season.game_year < 3 or v_identity.team_id is null then
    raise exception 'Les dons fédéraux seront disponibles à partir de la Saison 3.';
  end if;

  select * into v_team_season
  from public.team_seasons
  where team_id = v_identity.team_id
    and season_id = v_season.id
    and status in ('planned', 'active')
  for update;
  select * into v_account
  from public.national_federation_accounts
  where country_id = v_identity.country_id
    and season_id = v_season.id
  for update;
  if v_account.id is null then
    raise exception 'Le budget fédéral n’est pas initialisé.';
  end if;
  if v_team_season.cash_balance < v_amount then
    raise exception 'La trésorerie de votre équipe est insuffisante.';
  end if;

  select id into v_day_id
  from public.season_days
  where season_id = v_season.id
    and day_number = v_season.current_day_number
  limit 1;

  update public.team_seasons
  set cash_balance = cash_balance - v_amount
  where id = v_team_season.id;
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  ) values (
    v_team_season.id, v_day_id, v_season.current_day_number, -v_amount,
    'other', 'posted', 'Don à la fédération nationale',
    'federation-donation:' || v_operation_id::text, now()
  );
  update public.national_federation_accounts
  set balance = balance + v_amount, updated_at = now()
  where id = v_account.id;
  insert into public.national_federation_transactions (
    account_id, team_id, day_number, amount, category, description,
    source_reference
  ) values (
    v_account.id, v_identity.team_id, v_season.current_day_number, v_amount,
    'donation', 'Don de ' || v_identity.team_name,
    'federation-donation:' || v_operation_id::text
  );
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number, 'finance',
    'Contribution d’une équipe',
    v_identity.team_name || ' verse '
      || trim(to_char(v_amount, 'FM999G999G999')) || ' € à la fédération.',
    'federation-donation:' || v_operation_id::text
  );

  return v_amount;
end;
$$;

alter table public.national_federation_solidarity_plans
  drop constraint if exists national_federation_solidarity_plans_account_id_key;

create index if not exists national_federation_solidarity_plans_account_date_idx
  on public.national_federation_solidarity_plans (
    account_id,
    executed_at desc,
    id desc
  );

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
  v_limit numeric;
  v_distributed numeric;
  v_remaining numeric;
  v_amount numeric := round(coalesce(p_amount_per_team, 0) / 5000) * 5000;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;
  if p_reputation_threshold not between 0 and 500
     or v_amount < 25000
     or v_amount > 500000 then
    raise exception 'Les paramètres du fonds de solidarité sont invalides.';
  end if;

  perform public.initialize_due_national_federation_accounts();
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  if v_season.game_year < 3 or v_identity.team_id is null then
    raise exception 'Le fonds de solidarité sera disponible à partir de la Saison 3.';
  end if;
  if not exists (
    select 1
    from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut valider ce fonds.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_identity.country_id::text || ':' || v_season.id::text || ':solidarity',
      0
    )
  );
  select * into v_account
  from public.national_federation_accounts
  where country_id = v_identity.country_id
    and season_id = v_season.id
  for update;
  if v_account.id is null then
    raise exception 'Le budget fédéral n’est pas initialisé.';
  end if;

  select count(*)::integer into v_beneficiary_count
  from public.team_seasons as team_season
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where team_season.season_id = v_season.id
    and team_season.registration_country_id = v_identity.country_id
    and team_season.status in ('planned', 'active')
    and director.reputation_points <= p_reputation_threshold;
  if v_beneficiary_count = 0 then
    raise exception 'Aucune équipe ne correspond au seuil de réputation choisi.';
  end if;

  v_total := v_beneficiary_count * v_amount;
  v_limit := round(v_account.opening_balance * 0.10, 2);
  select coalesce(sum(plan.total_amount), 0)
  into v_distributed
  from public.national_federation_solidarity_plans as plan
  where plan.account_id = v_account.id;
  v_remaining := greatest(0, v_limit - v_distributed);

  if v_total > v_account.balance then
    raise exception 'Budget insuffisant : la dépense dépasse la trésorerie fédérale.';
  end if;
  if v_total > v_remaining then
    raise exception
      'Plafond saisonnier dépassé : il ne reste que % € disponibles sur les 10 %% autorisés.',
      trim(to_char(v_remaining, 'FM999G999G999'));
  end if;

  insert into public.national_federation_solidarity_plans (
    account_id, reputation_threshold, amount_per_team, beneficiary_count,
    total_amount, executed_by_director_id
  ) values (
    v_account.id, p_reputation_threshold, v_amount, v_beneficiary_count,
    v_total, v_identity.sporting_director_id
  ) returning id into v_plan_id;

  update public.team_seasons as team_season
  set cash_balance = team_season.cash_balance + v_amount
  from public.team_manager_assignments as assignment,
       public.sporting_directors as director
  where assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
    and director.id = assignment.sporting_director_id
    and director.status = 'active'
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
    'other', 'posted', 'Fonds de solidarité de la fédération nationale',
    'federation-solidarity:' || v_plan_id::text || ':'
      || team_season.team_id::text,
    now()
  from public.team_seasons as team_season
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  left join public.season_days as season_day
    on season_day.season_id = v_season.id
   and season_day.day_number = v_season.current_day_number
  where team_season.season_id = v_season.id
    and team_season.registration_country_id = v_identity.country_id
    and team_season.status in ('planned', 'active')
    and director.reputation_points <= p_reputation_threshold;

  update public.national_federation_accounts
  set balance = balance - v_total, updated_at = now()
  where id = v_account.id;
  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description, source_reference,
    metadata
  ) values (
    v_account.id, v_season.current_day_number, -v_total, 'solidarity',
    'Versement du fonds de solidarité',
    'federation-solidarity:' || v_plan_id::text,
    jsonb_build_object(
      'beneficiaryCount', v_beneficiary_count,
      'amountPerTeam', v_amount,
      'reputationThreshold', p_reputation_threshold,
      'seasonLimit', v_limit,
      'distributedBefore', v_distributed
    )
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number, 'finance',
    'Fonds de solidarité versé',
    v_beneficiary_count::text || ' équipe(s) bénéficiaire(s) pour un total de '
      || trim(to_char(v_total, 'FM999G999G999')) || ' €.',
    'federation-solidarity:' || v_plan_id::text
  );

  return jsonb_build_object(
    'beneficiaryCount', v_beneficiary_count,
    'totalAmount', v_total,
    'seasonLimit', v_limit,
    'distributedAmount', v_distributed + v_total,
    'remainingAmount', greatest(0, v_remaining - v_total)
  );
end;
$$;

-- At S3 J1, settle the ordinary election first. Federations still without a
-- president then receive either their sole player automatically or a 48 h +
-- 48 h exceptional election. The current S3 team nationality is authoritative,
-- so sponsor changes already applied during rollover are naturally included.
create or replace function public.initialize_due_federation_presidencies()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_federation record;
  v_solo record;
  v_term_id uuid;
  v_election_id uuid;
  v_automatic integer := 0;
  v_exceptional integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season.id is null
     or v_season.game_year <> 3
     or coalesce(v_season.current_day_number, 1) <> 1 then
    return jsonb_build_object('automatic', 0, 'exceptional', 0);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('federation-presidencies:s3', 0)
  );

  for v_federation in
    select
      country.id as country_id,
      country.iso_alpha2 as country_code,
      country.name as country_name,
      count(distinct assignment.sporting_director_id)::integer as player_count
    from public.team_seasons as team_season
    join public.teams as team
      on team.id = team_season.team_id
     and team.status = 'active'
    join public.team_manager_assignments as assignment
      on assignment.team_id = team.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    join public.countries as country
      on country.id = team_season.registration_country_id
     and country.is_active = true
    where team_season.season_id = v_season.id
      and team_season.status in ('planned', 'active')
    group by country.id, country.iso_alpha2, country.name
    order by country.iso_alpha2
  loop
    v_term_id := null;
    select term.id into v_term_id
    from public.national_federation_terms as term
    where term.country_id = v_federation.country_id
      and v_season.game_year between term.start_game_year and term.end_game_year
    limit 1;

    if v_term_id is null then
      insert into public.national_federation_terms (
        country_id, start_game_year, end_game_year, governance_mode,
        president_director_id
      ) values (
        v_federation.country_id, 3, 4, 'automatic', null
      )
      on conflict (country_id, start_game_year) do update set
        end_game_year = excluded.end_game_year
      returning id into v_term_id;
    end if;

    if exists (
      select 1
      from public.national_federation_terms as term
      where term.id = v_term_id
        and term.president_director_id is not null
    ) then
      continue;
    end if;

    if v_federation.player_count = 1 then
      select
        team_season.id as team_season_id,
        team_season.team_id,
        assignment.sporting_director_id,
        coalesce(
          nullif(btrim(team_season.display_name), ''),
          nullif(btrim(team.amateur_name), ''),
          team.internal_name
        ) as team_name
      into v_solo
      from public.team_seasons as team_season
      join public.teams as team
        on team.id = team_season.team_id
       and team.status = 'active'
      join public.team_manager_assignments as assignment
        on assignment.team_id = team.id
       and assignment.role = 'general_manager'
       and assignment.status = 'active'
      join public.sporting_directors as director
        on director.id = assignment.sporting_director_id
       and director.status = 'active'
      where team_season.season_id = v_season.id
        and team_season.registration_country_id = v_federation.country_id
        and team_season.status in ('planned', 'active')
      order by assignment.created_at desc, assignment.id desc
      limit 1;

      insert into public.national_federation_elections (
        country_id, election_season_id, term_start_game_year,
        term_end_game_year, status, election_type, elected_director_id,
        finalized_at
      ) values (
        v_federation.country_id, v_season.id, 3, 4, 'finalized', 'regular',
        v_solo.sporting_director_id, now()
      )
      on conflict (country_id, term_start_game_year)
        where election_type = 'regular'
      do update set
        status = 'finalized',
        elected_director_id = excluded.elected_director_id,
        finalized_at = now()
      returning id into v_election_id;

      insert into public.national_federation_electorate (
        election_id, team_season_id, team_id, sporting_director_id
      ) values (
        v_election_id, v_solo.team_season_id, v_solo.team_id,
        v_solo.sporting_director_id
      ) on conflict do nothing;

      update public.national_federation_terms
      set
        election_id = v_election_id,
        governance_mode = 'elected',
        president_director_id = v_solo.sporting_director_id
      where id = v_term_id;

      insert into public.national_federation_journal_entries (
        country_id, season_id, day_number, category, title, detail,
        source_reference, metadata
      ) values (
        v_federation.country_id, v_season.id, 1, 'governance',
        'Présidence attribuée automatiquement',
        'La fédération ne compte qu’une équipe joueuse : son DS devient automatiquement président pour les Saisons 3 et 4.',
        'federation-presidency:s3:' || v_federation.country_id::text || ':automatic',
        jsonb_build_object(
          'presidentDirectorId', v_solo.sporting_director_id,
          'teamId', v_solo.team_id,
          'playerCount', 1
        )
      ) on conflict (source_reference) do nothing;

      insert into public.sporting_director_messages (
        sporting_director_id, season_id, team_season_id, message_type,
        sender_name, subject, preview, body, action_href, action_label,
        source_reference, is_important
      ) values (
        v_solo.sporting_director_id, v_season.id, v_solo.team_season_id,
        'system', 'Fédération de ' || v_federation.country_name,
        'Vous devenez président de votre fédération',
        'Votre équipe est l’unique équipe joueuse affiliée en Saison 3.',
        'À J1, la présidence vous est attribuée automatiquement pour les Saisons 3 et 4. Vous pouvez dès maintenant piloter les sélections, le budget et les projets fédéraux.',
        '/jeu/federations/' || lower(v_federation.country_code)
          || '?onglet=governance',
        'Ouvrir la fédération',
        'federation-presidency:s3:' || v_federation.country_id::text
          || ':automatic-message',
        true
      ) on conflict (sporting_director_id, source_reference) do nothing;

      v_automatic := v_automatic + 1;
    elsif v_federation.player_count > 1 then
      v_election_id := public.open_exceptional_federation_election(
        v_federation.country_id,
        v_term_id,
        v_season.id
      );
      if v_election_id is not null then
        v_exceptional := v_exceptional + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'automatic', v_automatic,
    'exceptional', v_exceptional
  );
end;
$$;

revoke all on function public.respond_to_national_federation_preselection(uuid, boolean)
  from public, anon;
revoke all on function public.initialize_due_national_federation_accounts()
  from public, anon, authenticated;
revoke all on function public.donate_to_current_national_federation(text, numeric)
  from public, anon;
revoke all on function public.execute_national_federation_solidarity(text, integer, numeric)
  from public, anon;
revoke all on function public.initialize_due_federation_presidencies()
  from public, anon, authenticated;

grant execute on function public.respond_to_national_federation_preselection(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.initialize_due_national_federation_accounts()
  to service_role;
grant execute on function public.donate_to_current_national_federation(text, numeric)
  to authenticated, service_role;
grant execute on function public.execute_national_federation_solidarity(text, integer, numeric)
  to authenticated, service_role;
grant execute on function public.initialize_due_federation_presidencies()
  to service_role;

comment on function public.initialize_due_federation_presidencies() is
  'À J1 de la S3, nomme l’unique DS ou ouvre un scrutin exceptionnel dans les fédérations sans président.';
comment on function public.execute_national_federation_solidarity(text, integer, numeric) is
  'Verse une aide répétable dans la limite cumulée de 10 % du budget fédéral d’ouverture de la saison.';

notify pgrst, 'reload schema';

commit;
