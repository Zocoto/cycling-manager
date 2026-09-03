begin;

alter table public.sponsor_offers
  add column if not exists base_budget_per_season numeric(14, 2),
  add column if not exists negotiation_budget_ceiling numeric(14, 2),
  add column if not exists objective_difficulty text not null default 'balanced';

update public.sponsor_offers
set base_budget_per_season = coalesce(
      base_budget_per_season,
      budget_per_season
    ),
    negotiation_budget_ceiling = greatest(
      coalesce(negotiation_budget_ceiling, budget_per_season),
      coalesce(base_budget_per_season, budget_per_season)
    );

create or replace function private.prepare_sponsor_offer_negotiation_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.base_budget_per_season := coalesce(
    new.base_budget_per_season,
    new.budget_per_season
  );
  new.negotiation_budget_ceiling := greatest(
    coalesce(
      new.negotiation_budget_ceiling,
      new.base_budget_per_season
    ),
    new.base_budget_per_season
  );
  new.objective_difficulty := coalesce(
    nullif(btrim(new.objective_difficulty), ''),
    'balanced'
  );

  return new;
end;
$$;

drop trigger if exists prepare_sponsor_offer_negotiation_fields
on public.sponsor_offers;

create trigger prepare_sponsor_offer_negotiation_fields
before insert or update of
  base_budget_per_season,
  negotiation_budget_ceiling,
  objective_difficulty
on public.sponsor_offers
for each row
execute function private.prepare_sponsor_offer_negotiation_fields();

alter table public.sponsor_offers
  alter column base_budget_per_season set not null,
  alter column negotiation_budget_ceiling set not null;

alter table public.sponsor_offers
  drop constraint if exists sponsor_offers_base_budget_positive,
  add constraint sponsor_offers_base_budget_positive
    check (base_budget_per_season > 0),
  drop constraint if exists sponsor_offers_negotiation_ceiling_valid,
  add constraint sponsor_offers_negotiation_ceiling_valid
    check (negotiation_budget_ceiling >= base_budget_per_season),
  drop constraint if exists sponsor_offers_objective_difficulty_allowed,
  add constraint sponsor_offers_objective_difficulty_allowed
    check (
      objective_difficulty in ('accessible', 'balanced', 'ambitious')
    );

create or replace function public.negotiate_sponsor_offer(
  p_offer_id uuid,
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
  v_offer public.sponsor_offers%rowtype;
  v_target_season record;
  v_active_season record;
  v_adjustment_percent numeric;
  v_negotiated_budget numeric;
begin
  if p_offer_id is null or p_sporting_director_id is null then
    raise exception 'L’offre et le Directeur Sportif sont obligatoires.';
  end if;

  if p_objective_difficulty not in (
    'accessible',
    'balanced',
    'ambitious'
  ) then
    raise exception 'Le niveau de difficulté sélectionné est invalide.';
  end if;

  if p_base_budget is null or p_base_budget <= 0 then
    raise exception 'Le budget de base doit être strictement positif.';
  end if;

  if p_budget_ceiling is null or p_budget_ceiling < p_base_budget then
    raise exception 'Le plafond de négociation est invalide.';
  end if;

  select offer.*
  into v_offer
  from public.sponsor_offers as offer
  where offer.id = p_offer_id
    and offer.sporting_director_id = p_sporting_director_id
  for update;

  if not found or v_offer.status <> 'open' then
    raise exception 'Cette offre est introuvable ou n’est plus négociable.';
  end if;

  if abs(v_offer.base_budget_per_season - p_base_budget) > 0.01 then
    raise exception 'L’offre a évolué. Rechargez la page avant de négocier.';
  end if;

  select season.id, season.game_year, season.status
  into v_target_season
  from public.seasons as season
  where season.id = v_offer.season_id;

  if not found then
    raise exception 'La saison de cette offre est introuvable.';
  end if;

  select season.id, season.game_year, season.current_day_number
  into v_active_season
  from public.seasons as season
  where season.status = 'active';

  if not found or v_active_season.current_day_number is null then
    raise exception 'La saison active est indisponible.';
  end if;

  if v_target_season.status <> 'planned'
     or v_target_season.game_year < 3
     or v_target_season.game_year <> v_active_season.game_year + 1 then
    raise exception
      'La négociation des objectifs est réservée aux offres de la saison 3 ou ultérieure.';
  end if;

  if v_active_season.current_day_number < 21 then
    raise exception 'La négociation des offres ouvre au jour 21.';
  end if;

  if exists (
    select 1
    from public.sponsor_objectives as objective
    where objective.sponsor_offer_id = v_offer.id
      and objective.status <> 'draft'
  ) then
    raise exception 'Les objectifs de cette offre ne sont plus négociables.';
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
  where sponsor_offer_id = v_offer.id;

  return v_negotiated_budget;
end;
$$;

revoke all on function public.negotiate_sponsor_offer(
  uuid,
  uuid,
  text,
  numeric,
  numeric
) from public, anon, authenticated;

grant execute on function public.negotiate_sponsor_offer(
  uuid,
  uuid,
  text,
  numeric,
  numeric
) to service_role;

create or replace function private.finalize_planned_sponsor_renewal_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_planned record;
  v_renewal_base numeric;
  v_negotiated_budget numeric;
begin
  if new.role <> 'principal' then
    return new;
  end if;

  for v_planned in
    select
      planned_contract.id as contract_id,
      planned_contract.sponsor_offer_id,
      offer.objective_difficulty,
      offer.negotiation_budget_ceiling
    from public.team_sponsor_contracts as planned_contract
    join public.seasons as old_start_season
      on old_start_season.id = new.start_season_id
    join public.seasons as planned_start_season
      on planned_start_season.id = planned_contract.start_season_id
    join public.sponsor_offers as offer
      on offer.id = planned_contract.sponsor_offer_id
    where planned_contract.id <> new.id
      and planned_contract.team_id = new.team_id
      and planned_contract.sponsor_id = new.sponsor_id
      and planned_contract.role = 'principal'
      and planned_contract.status = 'planned'
      and planned_start_season.game_year =
        old_start_season.game_year + new.contract_duration_seasons
    for update of planned_contract, offer
  loop
    v_renewal_base := round(
      new.budget_per_season
        * (1 + new.renewal_budget_adjustment_percent / 100),
      2
    );

    v_negotiated_budget := case v_planned.objective_difficulty
      when 'accessible' then
        round(v_renewal_base * 0.90 / 10000) * 10000
      when 'ambitious' then
        round(v_renewal_base * 1.10 / 10000) * 10000
      else v_renewal_base
    end;
    v_negotiated_budget := greatest(
      10000,
      least(
        v_negotiated_budget,
        greatest(v_planned.negotiation_budget_ceiling, v_renewal_base)
      )
    );

    update public.team_sponsor_contracts
    set budget_per_season = v_negotiated_budget
    where id = v_planned.contract_id;

    update public.sponsor_offers
    set base_budget_per_season = v_renewal_base,
        budget_per_season = v_negotiated_budget
    where id = v_planned.sponsor_offer_id;
  end loop;

  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;
