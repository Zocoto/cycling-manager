begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';

-- Initial offers remain bounded by the sponsor catalogue. The reward for
-- tougher objectives is calculated on the real, satisfaction-adjusted base.
create function private.sponsor_negotiation_budget_ceiling(p_base numeric, p_catalogue_ceiling numeric)
returns numeric language plpgsql immutable set search_path = '' as $$
begin
  if p_base is null or p_base <= 0 or p_base::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Invalid sponsor negotiation base.';
  end if;
  return greatest(p_base, coalesce(p_catalogue_ceiling, p_base), round(p_base * 1.10 / 10000) * 10000);
end;
$$;
revoke all on function private.sponsor_negotiation_budget_ceiling(numeric,numeric) from public, anon, authenticated;
grant execute on function private.sponsor_negotiation_budget_ceiling(numeric,numeric) to service_role;

-- Patch only budget ceilings. Preserve every ownership, calendar, stale-state,
-- draft-objective and rollover safety check in the deployed functions.
do $patch$
declare
  v_patch record;
  v_definition text;
  v_count integer;
begin
  for v_patch in select * from (values
    ('public.ensure_continuing_sponsor_offer(uuid,uuid,numeric,numeric)',
      $old$v_authoritative_ceiling := greatest(
    v_authoritative_base,
    coalesce(p_budget_ceiling, 0)
  );$old$,
      $new$v_authoritative_ceiling := private.sponsor_negotiation_budget_ceiling(
    v_authoritative_base, coalesce(p_budget_ceiling, 0)
  );$new$),
    ('public.negotiate_sponsor_offer(uuid,uuid,text,numeric,numeric)',
      '  v_adjustment_percent := case p_objective_difficulty',
      E'  p_budget_ceiling := private.sponsor_negotiation_budget_ceiling(p_base_budget, p_budget_ceiling);\n  v_adjustment_percent := case p_objective_difficulty'),
    ('public.negotiate_continuing_sponsor_objectives(uuid,uuid,text,numeric,numeric)',
      '  v_adjustment_percent := case p_objective_difficulty',
      E'  p_budget_ceiling := private.sponsor_negotiation_budget_ceiling(p_base_budget, p_budget_ceiling);\n  v_adjustment_percent := case p_objective_difficulty'),
    ('private.finalize_continuing_sponsor_offer_budget(uuid,uuid)',
      $old$v_budget_ceiling := greatest(
    coalesce(v_context.negotiation_budget_ceiling, v_renewal_base),
    v_renewal_base
  );$old$,
      $new$v_budget_ceiling := private.sponsor_negotiation_budget_ceiling(
    v_renewal_base, v_context.negotiation_budget_ceiling
  );$new$),
    ('private.finalize_planned_sponsor_renewal_budget()',
      'greatest(v_planned.negotiation_budget_ceiling, v_renewal_base)',
      'private.sponsor_negotiation_budget_ceiling(v_renewal_base, v_planned.negotiation_budget_ceiling)'),
    ('private.finalize_planned_sponsor_renewal_budget()',
      'greatest(v_annual.negotiation_budget_ceiling, v_renewal_base)',
      'private.sponsor_negotiation_budget_ceiling(v_renewal_base, v_annual.negotiation_budget_ceiling)'),
    ('private.finalize_planned_sponsor_renewal_budget()',
      $old$negotiation_budget_ceiling = greatest(
          negotiation_budget_ceiling,
          v_renewal_base
        )$old$,
      'negotiation_budget_ceiling = private.sponsor_negotiation_budget_ceiling(v_renewal_base, negotiation_budget_ceiling)'),
    ('private.finalize_planned_sponsor_renewal_budget()',
      'planned_contract.id as contract_id,',
      E'planned_contract.id as contract_id,\n      planned_contract.reputation_budget_bonus_percent,'),
    ('private.finalize_planned_sponsor_renewal_budget()',
      $old$set budget_per_season = v_negotiated_budget
    where id = v_planned.contract_id;$old$,
      $new$set budget_per_season = round(v_negotiated_budget * (1 + coalesce(v_planned.reputation_budget_bonus_percent, 0) / 100.0), 2)
    where id = v_planned.contract_id;$new$),
    ('private.finalize_planned_sponsor_renewal_budget()',
      $old$budget_per_season = v_negotiated_budget
    where id = v_planned.sponsor_offer_id;$old$,
      $new$budget_per_season = v_negotiated_budget,
        negotiation_budget_ceiling = private.sponsor_negotiation_budget_ceiling(v_renewal_base, v_planned.negotiation_budget_ceiling)
    where id = v_planned.sponsor_offer_id;$new$),
    ('public.rollover_game_season(uuid,boolean)',
      $old$greatest(
            annual_budget_base.negotiation_budget_ceiling,
            annual_budget_base.renewal_base
          )$old$,
      $new$private.sponsor_negotiation_budget_ceiling(
            annual_budget_base.renewal_base, annual_budget_base.negotiation_budget_ceiling
          )$new$),
    ('public.rollover_game_season(uuid,boolean)',
      $old$negotiation_budget_ceiling = greatest(
      annual_budget.negotiation_budget_ceiling,
      annual_budget.renewal_base
    )$old$,
      $new$negotiation_budget_ceiling = private.sponsor_negotiation_budget_ceiling(
      annual_budget.renewal_base, annual_budget.negotiation_budget_ceiling
    )$new$)
  ) as patches(signature, old_text, new_text)
  loop
    select replace(pg_get_functiondef(v_patch.signature::regprocedure), chr(13), '') into v_definition;
    v_count := (length(v_definition) - length(replace(v_definition, v_patch.old_text, ''))) / length(v_patch.old_text);
    if v_count <> 1 then raise exception 'Unexpected sponsor budget patch target: % (% matches)', v_patch.signature, v_count; end if;
    execute replace(v_definition, v_patch.old_text, v_patch.new_text);
  end loop;
end;
$patch$;

-- Repair only the next planned season, without changing the selected tier,
-- objective requirements, current contracts, cash or posted transactions.
create temporary table sponsor_ambition_future_terms on commit drop as
select offer.id, offer.budget_per_season as old_budget,
  private.sponsor_negotiation_budget_ceiling(offer.base_budget_per_season, offer.negotiation_budget_ceiling) as ceiling,
  greatest(10000, case offer.objective_difficulty
    when 'accessible' then round(offer.base_budget_per_season * 0.90 / 10000) * 10000
    when 'ambitious' then round(offer.base_budget_per_season * 1.10 / 10000) * 10000
    else offer.base_budget_per_season end) as budget
from public.sponsor_offers as offer
join public.seasons as target on target.id = offer.season_id and target.status = 'planned'
join public.seasons as active on active.status = 'active' and target.game_year = active.game_year + 1
where offer.status in ('open','accepted') and offer.base_budget_per_season > 0;

update public.sponsor_offers as offer
set negotiation_budget_ceiling = terms.ceiling, budget_per_season = terms.budget
from sponsor_ambition_future_terms as terms
where offer.id = terms.id
  and (offer.negotiation_budget_ceiling is distinct from terms.ceiling or offer.budget_per_season is distinct from terms.budget);

-- A reputation investment is a contract supplement, not part of the offer's
-- negotiation base. Preserve it when repairing an already signed future deal.
update public.team_sponsor_contracts as contract
set budget_per_season = round(terms.budget * (1 + coalesce(contract.reputation_budget_bonus_percent, 0) / 100.0), 2)
from sponsor_ambition_future_terms as terms, public.sponsor_offers as offer
where contract.sponsor_offer_id = terms.id and offer.id = terms.id
  and contract.status = 'planned' and contract.role = 'principal'
  and contract.start_season_id = offer.season_id
  and contract.budget_per_season is distinct from round(terms.budget * (1 + coalesce(contract.reputation_budget_bonus_percent, 0) / 100.0), 2);

notify pgrst, 'reload schema';
commit;
