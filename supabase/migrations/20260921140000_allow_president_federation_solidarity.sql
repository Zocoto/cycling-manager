begin;

-- The president's team follows the same solidarity eligibility rules as every
-- affiliated team. All reputation, budget and per-team caps remain.
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
     or v_amount > 100000 then
    raise exception 'Le fonds est limité à 100 000 € par équipe et par saison.';
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

  with candidate_teams as (
    select
      team_season.id as team_season_id,
      team_season.team_id,
      least(
        v_amount,
        greatest(0::numeric, 100000::numeric - coalesce(received.amount, 0))
      ) as grant_amount
    from public.team_seasons as team_season
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    left join lateral (
      select coalesce(sum(transaction.amount), 0) as amount
      from public.team_finance_transactions as transaction
      where transaction.team_season_id = team_season.id
        and transaction.status = 'posted'
        and transaction.amount > 0
        and transaction.source_reference like 'federation-solidarity:%'
    ) as received on true
    where team_season.season_id = v_season.id
      and team_season.registration_country_id = v_identity.country_id
      and team_season.status in ('planned', 'active')
      and director.reputation_points <= p_reputation_threshold
  )
  select count(*)::integer, coalesce(sum(grant_amount), 0)
  into v_beneficiary_count, v_total
  from candidate_teams
  where grant_amount > 0;

  if v_beneficiary_count = 0 then
    raise exception 'Aucune équipe éligible ne dispose encore d’une enveloppe de solidarité.';
  end if;

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

  with candidate_teams as (
    select
      team_season.id as team_season_id,
      least(
        v_amount,
        greatest(0::numeric, 100000::numeric - coalesce(received.amount, 0))
      ) as grant_amount
    from public.team_seasons as team_season
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    left join lateral (
      select coalesce(sum(transaction.amount), 0) as amount
      from public.team_finance_transactions as transaction
      where transaction.team_season_id = team_season.id
        and transaction.status = 'posted'
        and transaction.amount > 0
        and transaction.source_reference like 'federation-solidarity:%'
    ) as received on true
    where team_season.season_id = v_season.id
      and team_season.registration_country_id = v_identity.country_id
      and team_season.status in ('planned', 'active')
      and director.reputation_points <= p_reputation_threshold
  )
  update public.team_seasons as team_season
  set cash_balance = team_season.cash_balance + candidate.grant_amount
  from candidate_teams as candidate
  where candidate.team_season_id = team_season.id
    and candidate.grant_amount > 0;

  with candidate_teams as (
    select
      team_season.id as team_season_id,
      team_season.team_id,
      least(
        v_amount,
        greatest(0::numeric, 100000::numeric - coalesce(received.amount, 0))
      ) as grant_amount
    from public.team_seasons as team_season
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    left join lateral (
      select coalesce(sum(transaction.amount), 0) as amount
      from public.team_finance_transactions as transaction
      where transaction.team_season_id = team_season.id
        and transaction.status = 'posted'
        and transaction.amount > 0
        and transaction.source_reference like 'federation-solidarity:%'
    ) as received on true
    where team_season.season_id = v_season.id
      and team_season.registration_country_id = v_identity.country_id
      and team_season.status in ('planned', 'active')
      and director.reputation_points <= p_reputation_threshold
  )
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  )
  select
    candidate.team_season_id, season_day.id, v_season.current_day_number,
    candidate.grant_amount, 'other', 'posted',
    'Fonds de solidarité de la fédération nationale',
    'federation-solidarity:' || v_plan_id::text || ':' || candidate.team_id::text,
    now()
  from candidate_teams as candidate
  left join public.season_days as season_day
    on season_day.season_id = v_season.id
   and season_day.day_number = v_season.current_day_number
  where candidate.grant_amount > 0;

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
      'requestedAmountPerTeam', v_amount,
      'perTeamSeasonCap', 100000,
      'reputationThreshold', p_reputation_threshold,
      'seasonLimit', v_limit,
      'distributedBefore', v_distributed,
      'presidentTeamEligible', true
    )
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number, 'finance',
    'Fonds de solidarité versé',
    v_beneficiary_count::text || ' équipe(s) bénéficiaire(s), y compris l’équipe du président si éligible, pour un total de '
      || trim(to_char(v_total, 'FM999G999G999')) || ' €.',
    'federation-solidarity:' || v_plan_id::text
  );

  return jsonb_build_object(
    'beneficiaryCount', v_beneficiary_count,
    'totalAmount', v_total,
    'perTeamSeasonCap', 100000,
    'seasonLimit', v_limit,
    'distributedAmount', v_distributed + v_total,
    'remainingAmount', greatest(0, v_remaining - v_total),
    'presidentTeamEligible', true
  );
end;
$$;

revoke all on function public.execute_national_federation_solidarity(text, integer, numeric)
  from public, anon;
grant execute on function public.execute_national_federation_solidarity(text, integer, numeric)
  to authenticated, service_role;

comment on function public.execute_national_federation_solidarity(text, integer, numeric) is
  'Verse une aide répétable à toutes les équipes éligibles, y compris celle du président, dans les plafonds saisonniers.';

notify pgrst, 'reload schema';

commit;
