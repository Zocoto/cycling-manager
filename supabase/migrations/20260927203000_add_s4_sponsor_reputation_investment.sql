begin;

alter table public.team_sponsor_contracts
  add column if not exists reputation_investment_cost integer not null default 0,
  add column if not exists reputation_budget_bonus_percent smallint not null default 0;

alter table public.team_sponsor_contracts
  add constraint team_sponsor_contracts_reputation_investment_allowed
    check (reputation_investment_cost in (0, 50, 100)),
  add constraint team_sponsor_contracts_reputation_budget_bonus_allowed
    check (reputation_budget_bonus_percent in (0, 5, 10));

alter function public.sign_sponsor_offer(uuid)
  rename to sign_sponsor_offer_before_s4_reputation;
revoke all on function public.sign_sponsor_offer_before_s4_reputation(uuid)
  from public, anon, authenticated;
grant execute on function public.sign_sponsor_offer_before_s4_reputation(uuid)
  to service_role;

create function public.sign_sponsor_offer(
  p_offer_id uuid,
  p_reputation_cost integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_director record;
  v_offer record;
  v_contract public.team_sponsor_contracts%rowtype;
  v_contract_id uuid;
  v_bonus_percent smallint := case p_reputation_cost
    when 50 then 5 when 100 then 10 else 0 end;
begin
  if coalesce(p_reputation_cost, 0) not in (0, 50, 100) then
    raise exception 'Investissement de réputation sponsor invalide.';
  end if;

  select director.id, director.reputation_points
  into v_director
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid() and director.status = 'active'
  for update;
  if not found then raise exception 'Le profil du Directeur Sportif est indisponible.'; end if;

  select offer.season_id, offer.budget_per_season, season.game_year
  into v_offer
  from public.sponsor_offers as offer
  join public.seasons as season on season.id = offer.season_id
  where offer.id = p_offer_id
    and offer.sporting_director_id = v_director.id;
  if not found then raise exception 'Cette offre est introuvable ou ne vous appartient pas.'; end if;

  if p_reputation_cost > 0 and v_offer.game_year < 4 then
    raise exception 'L’investissement de réputation sponsor ouvre pour la saison 4.';
  end if;
  if p_reputation_cost > 0 and v_director.reputation_points < 1000 then
    raise exception 'L’investissement sponsor exige 1 000 points de réputation.';
  end if;

  v_contract_id := public.sign_sponsor_offer_before_s4_reputation(p_offer_id);

  select * into v_contract
  from public.team_sponsor_contracts
  where id = v_contract_id
  for update;

  if v_contract.reputation_investment_cost > 0 then
    if v_contract.reputation_investment_cost <> p_reputation_cost then
      raise exception 'Ce contrat a déjà été signé avec un autre niveau d’investissement.';
    end if;
    return v_contract_id;
  end if;

  if p_reputation_cost > 0 then
    perform private.spend_reputation(
      v_director.id, v_offer.season_id, p_reputation_cost,
      'sponsor-investment:' || v_contract_id,
      'Investissement de réputation dans le contrat sponsor',
      jsonb_build_object(
        'contractId', v_contract_id,
        'offerId', p_offer_id,
        'budgetBonusPercent', v_bonus_percent
      )
    );
  end if;

  update public.team_sponsor_contracts
  set reputation_investment_cost = p_reputation_cost,
      reputation_budget_bonus_percent = v_bonus_percent,
      budget_per_season = round(
        v_offer.budget_per_season * (1 + v_bonus_percent / 100.0),
        2
      )
  where id = v_contract_id;

  return v_contract_id;
end;
$$;

revoke all on function public.sign_sponsor_offer(uuid, integer)
from public, anon;
grant execute on function public.sign_sponsor_offer(uuid, integer)
to authenticated;

comment on column public.team_sponsor_contracts.reputation_investment_cost is
  'Dépense définitive choisie à la signature du contrat à partir de la saison 4.';
comment on column public.team_sponsor_contracts.reputation_budget_bonus_percent is
  'Majoration annuelle du budget obtenue par l’investissement de réputation.';

commit;
