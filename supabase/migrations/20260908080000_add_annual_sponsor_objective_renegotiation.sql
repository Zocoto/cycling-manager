begin;

-- A multi-season principal contract keeps its legal identity, but now owns a
-- distinct objective offer for every covered season.  The future offer stays
-- pending until rollover so neither the live objectives nor the live budget
-- can be changed while the current season is still running.
alter table public.sponsor_offers
  add column if not exists continuing_contract_id uuid
    references public.team_sponsor_contracts(id) on delete restrict;

create unique index if not exists
  sponsor_offers_one_continuing_contract_season_idx
on public.sponsor_offers (continuing_contract_id, season_id);

alter table public.team_sponsor_contracts
  add column if not exists pending_sponsor_offer_id uuid
    references public.sponsor_offers(id) on delete restrict,
  add column if not exists objective_season_id uuid
    references public.seasons(id) on delete restrict;

create unique index if not exists
  team_sponsor_contracts_pending_offer_unique_idx
on public.team_sponsor_contracts (pending_sponsor_offer_id)
where pending_sponsor_offer_id is not null;

comment on column public.sponsor_offers.continuing_contract_id is
  'Contrat pluriannuel dont cette offre porte les objectifs d une saison de continuité.';

comment on column public.team_sponsor_contracts.pending_sponsor_offer_id is
  'Offre annuelle négociée qui remplacera les objectifs et le budget du contrat au prochain rollover.';

comment on column public.team_sponsor_contracts.objective_season_id is
  'Saison annuelle actuellement évaluée pour ce contrat pluriannuel; start_season_id reste la date juridique du contrat.';

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
  v_offer_id uuid;
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
    start_season.game_year as start_game_year,
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

  if abs(v_contract.budget_per_season - p_base_budget) > 0.01
     or p_base_budget <= 0 then
    raise exception 'Le budget du contrat a évolué. Rechargez la page.';
  end if;

  if p_budget_ceiling is null or p_budget_ceiling < p_base_budget then
    raise exception 'Le plafond de négociation est invalide.';
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
    raise exception 'La renégociation annuelle des objectifs débute en saison 3.';
  end if;

  if v_contract.end_game_year < v_target_season.game_year then
    raise exception 'Ce contrat ne couvre pas la saison suivante.';
  end if;

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
    'Renégociation annuelle des objectifs d un contrat pluriannuel.',
    p_base_budget,
    p_base_budget,
    p_budget_ceiling,
    'balanced',
    v_contract.currency_code,
    1,
    now(),
    null,
    'accepted',
    8
  )
  on conflict (continuing_contract_id, season_id) do update
  set continuing_contract_id = excluded.continuing_contract_id
  returning id into v_offer_id;

  update public.team_sponsor_contracts
  set pending_sponsor_offer_id = v_offer_id
  where id = v_contract.id;

  return v_offer_id;
end;
$$;

revoke all on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) to service_role;

create or replace function public.negotiate_continuing_sponsor_objectives(
  p_contract_id uuid,
  p_sporting_director_id uuid,
  p_objective_difficulty text,
  p_base_budget numeric,
  p_budget_ceiling numeric
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract record;
  v_offer public.sponsor_offers%rowtype;
  v_active_season record;
  v_target_season record;
  v_adjustment_percent numeric;
  v_negotiated_budget numeric;
begin
  if p_objective_difficulty not in ('accessible', 'balanced', 'ambitious') then
    raise exception 'Le niveau de difficulté sélectionné est invalide.';
  end if;

  select
    contract.id,
    contract.team_id,
    contract.sponsor_id,
    contract.pending_sponsor_offer_id,
    start_season.game_year + contract.contract_duration_seasons - 1
      as end_game_year
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
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
    raise exception 'La renégociation annuelle ouvre au jour 21.';
  end if;

  select season.id, season.game_year
  into v_target_season
  from public.seasons as season
  where season.game_year = v_active_season.game_year + 1
    and season.status = 'planned';

  if not found or v_target_season.game_year < 3 then
    raise exception 'La renégociation annuelle des objectifs débute en saison 3.';
  end if;

  if v_contract.end_game_year < v_target_season.game_year then
    raise exception 'Ce contrat ne couvre pas la saison suivante.';
  end if;

  select offer.*
  into v_offer
  from public.sponsor_offers as offer
  where offer.id = v_contract.pending_sponsor_offer_id
    and offer.continuing_contract_id = v_contract.id
    and offer.sporting_director_id = p_sporting_director_id
    and offer.sponsor_id = v_contract.sponsor_id
    and offer.season_id = v_target_season.id
    and offer.status = 'accepted'
  for update;

  if not found then
    raise exception 'Les objectifs de la saison suivante ne sont pas préparés.';
  end if;

  if abs(v_offer.base_budget_per_season - p_base_budget) > 0.01
     or p_base_budget <= 0 then
    raise exception 'Le budget annuel a évolué. Rechargez la page.';
  end if;

  if p_budget_ceiling is null or p_budget_ceiling < p_base_budget then
    raise exception 'Le plafond de négociation est invalide.';
  end if;

  if exists (
    select 1
    from public.sponsor_objectives as objective
    where objective.sponsor_offer_id = v_offer.id
      and objective.status <> 'draft'
  ) then
    raise exception 'Ces objectifs ne sont plus négociables.';
  end if;

  v_adjustment_percent := case p_objective_difficulty
    when 'accessible' then -10
    when 'ambitious' then 10
    else 0
  end;

  v_negotiated_budget := case
    when v_adjustment_percent = 0 then p_base_budget
    else round(
      p_base_budget * (1 + v_adjustment_percent / 100) / 10000
    ) * 10000
  end;
  v_negotiated_budget := greatest(
    10000,
    least(v_negotiated_budget, p_budget_ceiling)
  );

  update public.sponsor_offers
  set budget_per_season = v_negotiated_budget,
      base_budget_per_season = p_base_budget,
      negotiation_budget_ceiling = p_budget_ceiling,
      objective_difficulty = p_objective_difficulty
  where id = v_offer.id;

  delete from public.sponsor_objectives
  where sponsor_offer_id = v_offer.id
    and season_id = v_target_season.id
    and status = 'draft';

  return v_negotiated_budget;
end;
$$;

revoke all on function public.negotiate_continuing_sponsor_objectives(
  uuid, uuid, text, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.negotiate_continuing_sponsor_objectives(
  uuid, uuid, text, numeric, numeric
) to service_role;

-- Make the historical evaluator season-aware while preserving every gameplay
-- branch added since its creation.  The replacement is guarded so a future
-- schema drift aborts the migration instead of silently changing semantics.
do $patch_legacy_evaluator$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.evaluate_sponsor_objectives_for_contract_legacy_20260813(uuid,boolean)'::regprocedure
  ) into v_definition;

  if position('objective_season_id' in v_definition) = 0 then
    if position('contract.start_season_id,' in v_definition) = 0
       or position('v_contract.start_season_id' in v_definition) = 0 then
      raise exception 'Le moteur historique des objectifs sponsor a changé.';
    end if;

    v_patched := replace(
      v_definition,
      'contract.start_season_id,',
      'coalesce(contract.objective_season_id, contract.start_season_id) as objective_season_id,'
    );
    v_patched := replace(
      v_patched,
      'team_season.season_id = contract.start_season_id',
      'team_season.season_id = coalesce(contract.objective_season_id, contract.start_season_id)'
    );
    v_patched := replace(
      v_patched,
      'join public.seasons as season on season.id = contract.start_season_id',
      'join public.seasons as season on season.id = coalesce(contract.objective_season_id, contract.start_season_id)'
    );
    v_patched := replace(
      v_patched,
      'v_contract.start_season_id',
      'v_contract.objective_season_id'
    );
    execute v_patched;
  end if;
end;
$patch_legacy_evaluator$;

do $patch_current_evaluator$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.evaluate_sponsor_objectives_for_contract(uuid,boolean)'::regprocedure
  ) into v_definition;

  if position('objective_season_id' in v_definition) = 0 then
    if position('contract.start_season_id,' in v_definition) = 0
       or position('v_contract.start_season_id' in v_definition) = 0 then
      raise exception 'Le moteur courant des objectifs sponsor a changé.';
    end if;

    v_patched := replace(
      v_definition,
      'contract.start_season_id,',
      'coalesce(contract.objective_season_id, contract.start_season_id) as objective_season_id,'
    );
    v_patched := replace(
      v_patched,
      'team_season.season_id = contract.start_season_id',
      'team_season.season_id = coalesce(contract.objective_season_id, contract.start_season_id)'
    );
    v_patched := replace(
      v_patched,
      'v_contract.start_season_id',
      'v_contract.objective_season_id'
    );
    execute v_patched;
  end if;
end;
$patch_current_evaluator$;

create or replace function public.evaluate_team_sponsor_objectives(
  p_team_season_id uuid,
  p_finalize boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_season record;
  v_contract record;
begin
  select team_season.*
  into v_team_season
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;

  if v_team_season is null then
    return;
  end if;

  if p_finalize then
    perform public.refresh_uci_rankings(v_team_season.season_id);
  end if;

  for v_contract in
    select contract.id
    from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_season.team_id
      and coalesce(contract.objective_season_id, contract.start_season_id) =
        v_team_season.season_id
      and contract.sponsor_offer_id is not null
      and contract.status in ('active', 'completed')
  loop
    perform public.evaluate_sponsor_objectives_for_contract(
      v_contract.id,
      p_finalize
    );
  end loop;
end;
$$;

create or replace function public.evaluate_sponsor_objectives_after_race()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  for v_contract in
    select contract.id
    from public.team_sponsor_contracts as contract
    where coalesce(contract.objective_season_id, contract.start_season_id) =
        new.season_id
      and contract.sponsor_offer_id is not null
      and contract.status = 'active'
  loop
    perform public.evaluate_sponsor_objectives_for_contract(
      v_contract.id,
      false
    );
  end loop;

  return new;
end;
$$;

-- Apply the accepted annual terms after the source season has been settled,
-- but before the target team budgets and objective progress are initialized.
do $patch_rollover$
declare
  v_definition text;
  v_marker text := '  for v_sponsor in';
  v_position integer;
  v_block text := $block$
  -- Annual sponsor terms prepared during J21-J28 become live atomically.
  update public.team_sponsor_contracts as contract
  set
    sponsor_offer_id = offer.id,
    budget_per_season = offer.budget_per_season,
    objective_season_id = offer.season_id,
    pending_sponsor_offer_id = null
  from public.sponsor_offers as offer
  where contract.pending_sponsor_offer_id = offer.id
    and contract.role = 'principal'
    and contract.status = 'active'
    and offer.continuing_contract_id = contract.id
    and offer.season_id = v_target.id
    and offer.status = 'accepted';

$block$;
begin
  select pg_get_functiondef(
    'public.rollover_game_season(uuid,boolean)'::regprocedure
  ) into v_definition;

  if position('Annual sponsor terms prepared during J21-J28' in v_definition) = 0 then
    v_position := position(v_marker in v_definition);
    if v_position = 0 then
      raise exception 'Le point d insertion du rollover sponsor est introuvable.';
    end if;
    execute overlay(v_definition placing v_block from v_position for 0);
  end if;
end;
$patch_rollover$;

revoke all on function public.evaluate_team_sponsor_objectives(uuid, boolean)
  from public;
revoke all on function public.evaluate_sponsor_objectives_after_race()
  from public;
grant execute on function public.evaluate_team_sponsor_objectives(uuid, boolean)
  to service_role;

comment on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) is 'Prépare sans effet immédiat l offre annuelle d objectifs d un contrat sponsor pluriannuel.';

comment on function public.negotiate_continuing_sponsor_objectives(
  uuid, uuid, text, numeric, numeric
) is 'Renégocie les objectifs et le budget de la seule saison suivante d un contrat sponsor pluriannuel.';

notify pgrst, 'reload schema';

commit;
