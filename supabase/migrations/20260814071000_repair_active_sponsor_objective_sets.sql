begin;

-- Neutralized transition objectives are intentionally worth zero. Keep them
-- compatible with the provisional objective reader used by the sponsoring UI.
update public.sponsor_objectives
set
  is_provisional = true,
  updated_at = now()
where status = 'cancelled'
  and satisfaction_points = 0
  and not is_provisional;

-- Some contracts became active during the S1 -> S2 rollover while their
-- legacy offer still contained fewer than the ten objectives expected by the
-- current UI. Complete only active/terminated contracts with neutral rows so
-- no satisfaction, reward or penalty is created retroactively.
with active_contract_offers as (
  select distinct
    contract.sponsor_offer_id,
    contract.start_season_id
  from public.team_sponsor_contracts as contract
  join public.seasons as season
    on season.id = contract.start_season_id
   and season.status = 'active'
  where contract.status in ('active', 'terminated')
    and contract.sponsor_offer_id is not null
    and (
      select count(*)
      from public.sponsor_objectives as counted_objective
      where counted_objective.sponsor_offer_id = contract.sponsor_offer_id
        and counted_objective.season_id = contract.start_season_id
    ) < 10
), missing_orders as (
  select
    active_offer.sponsor_offer_id,
    active_offer.start_season_id,
    candidate.display_order
  from active_contract_offers as active_offer
  cross join generate_series(1, 10) as candidate(display_order)
  where not exists (
    select 1
    from public.sponsor_objectives as existing_objective
    where existing_objective.sponsor_offer_id = active_offer.sponsor_offer_id
      and existing_objective.season_id = active_offer.start_season_id
      and existing_objective.display_order = candidate.display_order
  )
), ranked_missing_orders as (
  select
    missing_order.*,
    row_number() over (
      partition by
        missing_order.sponsor_offer_id,
        missing_order.start_season_id
      order by missing_order.display_order
    ) as missing_rank
  from missing_orders as missing_order
)
insert into public.sponsor_objectives (
  sponsor_offer_id,
  season_id,
  name,
  description,
  objective_type,
  priority,
  evaluation_timing,
  evaluation_day_number,
  status,
  display_order,
  renewal_bonus_percent,
  satisfaction_points,
  is_provisional,
  target_details
)
select
  missing_order.sponsor_offer_id,
  missing_order.start_season_id,
  'Transition de saison · engagement neutralisé ' || missing_order.missing_rank,
  'Objectif technique ajouté pour compléter un ancien contrat. Il ne compte ni dans la satisfaction, ni dans les récompenses ou pénalités.',
  'season_wins',
  'optional',
  'season_end',
  null,
  'cancelled',
  missing_order.display_order,
  0,
  0,
  true,
  jsonb_build_object(
    'kind', 'season_wins',
    'minimumWinCount', 0,
    'winScope', 'all',
    'legacyNeutralized', true
  )
from ranked_missing_orders as missing_order
on conflict (sponsor_offer_id, display_order) do nothing;

commit;
