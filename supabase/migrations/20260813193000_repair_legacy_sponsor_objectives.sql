begin;

-- La modernisation des offres S2 remplace les anciens lots provisoires de
-- sept objectifs par un portefeuille complet de dix objectifs pondérés.
grant delete
on table public.sponsor_objectives
to service_role;

-- Les trois objectifs ajoutés aux contrats de la saison déjà en cours sont
-- purement informatifs : ils complètent l'affichage sans modifier la note de
-- satisfaction, le bonus de renouvellement ou la réputation du DS.
alter table public.sponsor_objectives
  drop constraint if exists sponsor_objectives_satisfaction_points_allowed;

alter table public.sponsor_objectives
  add constraint sponsor_objectives_satisfaction_points_allowed
  check (satisfaction_points between 0 and 100);

with active_legacy_offers as (
  select distinct
    contract.sponsor_offer_id,
    contract.start_season_id
  from public.team_sponsor_contracts as contract
  join public.seasons as season
    on season.id = contract.start_season_id
    and season.status = 'active'
  where contract.status in ('planned', 'active', 'terminated')
    and contract.sponsor_offer_id is not null
    and (
      select count(*)
      from public.sponsor_objectives as counted_objective
      where counted_objective.sponsor_offer_id = contract.sponsor_offer_id
        and counted_objective.season_id = contract.start_season_id
    ) = 7
), missing_orders as (
  select
    legacy_offer.sponsor_offer_id,
    legacy_offer.start_season_id,
    candidate.display_order
  from active_legacy_offers as legacy_offer
  cross join generate_series(1, 10) as candidate(display_order)
  where not exists (
    select 1
    from public.sponsor_objectives as existing_objective
    where existing_objective.sponsor_offer_id = legacy_offer.sponsor_offer_id
      and existing_objective.season_id = legacy_offer.start_season_id
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
  'Transition S1 · engagement neutralisé ' || missing_order.missing_rank,
  'Objectif ajouté rétroactivement pour harmoniser les contrats. Il est neutralisé et ne compte ni dans la satisfaction du sponsor, ni dans les récompenses ou pénalités.',
  'season_wins',
  'optional',
  'season_end',
  null,
  'cancelled',
  missing_order.display_order,
  0,
  0,
  false,
  jsonb_build_object(
    'kind', 'season_wins',
    'minimumWinCount', 0,
    'winScope', 'all',
    'legacyNeutralized', true
  )
from ranked_missing_orders as missing_order
where missing_order.missing_rank <= 3
on conflict (sponsor_offer_id, display_order) do nothing;

-- Un objectif neutralisé ne doit jamais recevoir de ligne de progression :
-- le moteur d'évaluation l'ignore alors naturellement et ne peut ni le
-- valider, ni le sanctionner.
create or replace function public.skip_cancelled_sponsor_objective_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.sponsor_objectives as objective
    where objective.id = new.sponsor_objective_id
      and objective.status = 'cancelled'
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists skip_cancelled_sponsor_objective_progress
  on public.objective_progress;

create trigger skip_cancelled_sponsor_objective_progress
before insert on public.objective_progress
for each row execute function public.skip_cancelled_sponsor_objective_progress();

delete from public.objective_progress as progress
using public.sponsor_objectives as objective
where progress.sponsor_objective_id = objective.id
  and objective.status = 'cancelled';

revoke all on function public.skip_cancelled_sponsor_objective_progress()
  from public;

notify pgrst, 'reload schema';

commit;
