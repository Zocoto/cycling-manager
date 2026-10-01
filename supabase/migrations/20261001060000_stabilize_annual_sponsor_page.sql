begin;

-- Sponsor performance belongs to the objective season currently attached to
-- the contract.  Summing the whole relationship made multi-season contracts
-- drift away from the score displayed by the sponsoring page.
create or replace function public.get_sponsor_performance_satisfaction_score(
  p_contract_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    least(25, coalesce(sum(event.points) filter (
      where event.event_type in ('race_result', 'uci_ranking')
    ), 0))
    + least(8, coalesce(sum(event.points) filter (
      where event.event_type = 'pre_race_commitment'
    ), 0))
  )::integer
  from public.team_sponsor_contracts as contract
  left join public.sponsor_satisfaction_events as event
    on event.team_sponsor_contract_id = contract.id
   and event.season_id = coalesce(
     contract.objective_season_id,
     contract.start_season_id
   )
  where contract.id = p_contract_id;
$$;

-- Reading the sponsoring page is allowed to repair an already prepared
-- annual preview.  The database owns the live satisfaction calculation: a
-- stale value sent by a server render must never make the whole page fail.
create or replace function public.ensure_continuing_sponsor_offer(
  p_contract_id uuid,
  p_sporting_director_id uuid,
  p_base_budget numeric,
  p_budget_ceiling numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract record;
  v_active_season record;
  v_target_season record;
  v_offer record;
  v_offer_id uuid;
  v_objective_score integer;
  v_performance_score integer;
  v_live_satisfaction integer;
  v_adjustment_percent numeric;
  v_authoritative_base numeric;
  v_authoritative_ceiling numeric;
  v_negotiated_budget numeric;
  v_budget_changed boolean := false;
begin
  if p_contract_id is null or p_sporting_director_id is null then
    raise exception 'Le contrat et le Directeur Sportif sont obligatoires.';
  end if;

  select
    contract.id,
    contract.team_id,
    contract.sponsor_id,
    contract.budget_per_season,
    contract.currency_code,
    start_season.game_year + contract.contract_duration_seasons - 1
      as end_game_year,
    sponsor.name as sponsor_name
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.sponsors as sponsor
    on sponsor.id = contract.sponsor_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
   and assignment.sporting_director_id = p_sporting_director_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where contract.id = p_contract_id
    and contract.role = 'principal'
    and contract.status = 'active'
  for update of contract;

  if not found then
    raise exception 'Ce contrat est introuvable ou ne vous appartient pas.';
  end if;

  select season.id, season.game_year, season.current_day_number
  into v_active_season
  from public.seasons as season
  where season.status = 'active';

  if not found or coalesce(v_active_season.current_day_number, 0) < 21 then
    raise exception 'La préparation du sponsor de la saison suivante ouvre au jour 21.';
  end if;

  select season.id, season.game_year
  into v_target_season
  from public.seasons as season
  where season.game_year = v_active_season.game_year + 1
    and season.status = 'planned';

  if not found or v_target_season.game_year < 3 then
    raise exception 'Le cumul satisfaction et ambition débute en saison 3.';
  end if;

  if v_contract.end_game_year < v_target_season.game_year then
    raise exception 'Ce contrat ne couvre pas la saison suivante.';
  end if;

  v_objective_score :=
    public.get_sponsor_objective_satisfaction_score(v_contract.id);
  v_performance_score :=
    public.get_sponsor_performance_satisfaction_score(v_contract.id);
  v_live_satisfaction := least(
    100,
    coalesce(v_objective_score, 0) + coalesce(v_performance_score, 0)
  );
  v_adjustment_percent := case
    when v_live_satisfaction <= 50 then
      (v_live_satisfaction - 50) / 2.0
    else (v_live_satisfaction - 50) / 5.0
  end;
  v_authoritative_base := round(
    v_contract.budget_per_season * (1 + v_adjustment_percent / 100),
    0
  );

  if v_authoritative_base <= 0 then
    raise exception 'Le budget annuel calculé est invalide.';
  end if;

  -- The ceiling comes from the trusted server-side sponsor catalogue.  If a
  -- render started with an older score, never let that stale request lower the
  -- newly authoritative base.
  v_authoritative_ceiling := greatest(
    v_authoritative_base,
    coalesce(p_budget_ceiling, 0)
  );

  select
    offer.id,
    offer.base_budget_per_season,
    offer.negotiation_budget_ceiling,
    offer.objective_difficulty,
    offer.status
  into v_offer
  from public.sponsor_offers as offer
  where offer.continuing_contract_id = v_contract.id
    and offer.season_id = v_target_season.id
  for update;

  if found then
    if v_offer.status <> 'accepted' then
      raise exception 'Cette préparation annuelle n est plus modifiable.';
    end if;

    v_budget_changed :=
      abs(v_offer.base_budget_per_season - v_authoritative_base) > 0.01
      or abs(
        v_offer.negotiation_budget_ceiling - v_authoritative_ceiling
      ) > 0.01;

    v_negotiated_budget := case v_offer.objective_difficulty
      when 'accessible' then
        round(v_authoritative_base * 0.90 / 10000) * 10000
      when 'ambitious' then
        round(v_authoritative_base * 1.10 / 10000) * 10000
      else v_authoritative_base
    end;
    v_negotiated_budget := greatest(
      10000,
      least(v_negotiated_budget, v_authoritative_ceiling)
    );

    update public.sponsor_offers
    set base_budget_per_season = v_authoritative_base,
        budget_per_season = v_negotiated_budget,
        negotiation_budget_ceiling = v_authoritative_ceiling
    where id = v_offer.id;

    v_offer_id := v_offer.id;

    if v_budget_changed then
      delete from public.sponsor_objectives
      where sponsor_offer_id = v_offer_id
        and season_id = v_target_season.id
        and status = 'draft';
    end if;
  else
    insert into public.sponsor_offers (
      sponsor_id,
      season_id,
      sporting_director_id,
      continuing_contract_id,
      title,
      description,
      budget_per_season,
      base_budget_per_season,
      negotiation_budget_ceiling,
      objective_difficulty,
      currency_code,
      contract_duration_seasons,
      available_from,
      available_until,
      status,
      generation_version
    ) values (
      v_contract.sponsor_id,
      v_target_season.id,
      p_sporting_director_id,
      v_contract.id,
      'Objectifs annuels · ' || v_contract.sponsor_name,
      'Renégociation annuelle cumulant satisfaction et niveau d ambition.',
      v_authoritative_base,
      v_authoritative_base,
      v_authoritative_ceiling,
      'balanced',
      v_contract.currency_code,
      1,
      now(),
      null,
      'accepted',
      10
    )
    on conflict (continuing_contract_id, season_id) do update
    set base_budget_per_season = excluded.base_budget_per_season,
        budget_per_season = excluded.budget_per_season,
        negotiation_budget_ceiling = greatest(
          sponsor_offers.negotiation_budget_ceiling,
          excluded.negotiation_budget_ceiling
        )
    returning id into v_offer_id;
  end if;

  update public.team_sponsor_contracts
  set pending_sponsor_offer_id = v_offer_id,
      satisfaction_score = v_live_satisfaction,
      satisfaction_updated_at = now()
  where id = v_contract.id;

  return v_offer_id;
end;
$$;

revoke all on function public.get_sponsor_performance_satisfaction_score(uuid)
  from public;
revoke all on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.get_sponsor_performance_satisfaction_score(uuid)
  to service_role;
grant execute on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) to service_role;

-- Curative pass: the canonical BEFORE trigger recalculates every active score
-- with the season-scoped functions above.  Existing annual previews are then
-- repaired lazily and idempotently on the next page read.
update public.team_sponsor_contracts
set satisfaction_score = satisfaction_score
where role = 'principal'
  and status = 'active'
  and sponsor_offer_id is not null;

comment on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) is
  'Prépare ou répare sans erreur l offre annuelle à partir de la satisfaction canonique de la saison du contrat.';

notify pgrst, 'reload schema';

commit;
