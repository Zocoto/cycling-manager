begin;

insert into public.equipment_catalog_items (
  catalog_key, name, slot_type, status, supplier_key, supplier_name,
  description, price, rarity, image_path, effect_summary, effect_payload,
  acquisition_channel
)
values
  ('partner-altura-aeropeak-helmet', 'AeroPeak Alpine', 'helmet', 'active', 'altura-forge', 'Altura Forge', 'Un casque ultraléger conçu pour rester efficace après plusieurs grands cols.', 0, 'premium', '/images/equipment/products/echelon-altitude-rs.webp', '+3 MON, +2 REC et +1 DES.', '{"ratingBonuses":{"mountain":3,"recovery":2,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-vektor-phase-helmet', 'Phase TT', 'helmet', 'active', 'vektor-aerolab', 'Vektor Aerolab', 'Une coque longue optimisée pour stabiliser la position contre la montre.', 0, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+3 CLM, +2 PLA et +1 PRL.', '{"ratingBonuses":{"timeTrial":3,"flat":2,"prologue":1}}'::jsonb, 'equipment_partner'),
  ('partner-brava-fulgor-shoes', 'Fulgor Launch', 'shoes', 'active', 'brava-sprintworks', 'Brava Sprintworks', 'Des chaussures rigides pour transmettre chaque watt dans le lancement du sprint.', 0, 'premium', '/images/equipment/products/velocita-furia-60-rear.webp', '+3 SPR, +2 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":3,"acceleration":2,"flat":1}}'::jsonb, 'equipment_partner'),
  ('partner-kernwerk-granit-gloves', 'Granit Grip', 'gloves', 'active', 'kernwerk-cycling', 'Kernwerk Cycling', 'Des gants renforcés qui filtrent les vibrations sans sacrifier la prise du guidon.', 0, 'premium', '/images/equipment/products/novaspoke-pave-35.webp', '+3 PAV, +2 RES et +1 END.', '{"ratingBonuses":{"cobbles":3,"resistance":2,"endurance":1}}'::jsonb, 'equipment_partner'),
  ('partner-sylva-apex-glasses', 'Apex Vision', 'glasses', 'active', 'sylva-dynamics', 'Sylva Dynamics', 'Des lunettes panoramiques pensées pour lire les trajectoires et attaquer dans les vallons.', 0, 'premium', '/images/equipment/products/echelon-vitesse-aero.webp', '+3 VAL, +2 ACC et +1 BAR.', '{"ratingBonuses":{"hills":3,"acceleration":2,"breakaway":1}}'::jsonb, 'equipment_partner'),
  ('partner-meridian-distance-bib', 'Distance Pro', 'bib_shorts', 'active', 'meridian-endurance', 'Meridian Endurance', 'Un cuissard de très longue distance qui préserve les réserves et la récupération.', 0, 'premium', '/images/equipment/products/echelon-altitude-rs.webp', '+3 END, +2 REC et +1 RES.', '{"ratingBonuses":{"endurance":3,"recovery":2,"resistance":1}}'::jsonb, 'equipment_partner'),
  ('partner-axiom-union-shoes', 'Union Adapt', 'shoes', 'active', 'axiom-allroad', 'Axiom Allroad', 'Une plateforme équilibrée pour changer de terrain sans point faible marqué.', 0, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+2 PLA, +2 VAL, +1 MON et +1 ACC.', '{"ratingBonuses":{"flat":2,"hills":2,"mountain":1,"acceleration":1}}'::jsonb, 'equipment_partner')
on conflict (catalog_key) do update set
  name = excluded.name,
  slot_type = excluded.slot_type,
  status = excluded.status,
  supplier_key = excluded.supplier_key,
  supplier_name = excluded.supplier_name,
  description = excluded.description,
  price = excluded.price,
  rarity = excluded.rarity,
  image_path = excluded.image_path,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  acquisition_channel = excluded.acquisition_channel,
  updated_at = now();

insert into public.equipment_partner_products (
  supplier_key, equipment_item_id, offer_type, research_rating_key, display_order
)
select mapping.supplier_key, item.id, 'rare', mapping.rating_key, 40
from (values
  ('altura-forge', 'partner-altura-aeropeak-helmet', 'mountain'),
  ('vektor-aerolab', 'partner-vektor-phase-helmet', 'timeTrial'),
  ('brava-sprintworks', 'partner-brava-fulgor-shoes', 'sprint'),
  ('kernwerk-cycling', 'partner-kernwerk-granit-gloves', 'cobbles'),
  ('sylva-dynamics', 'partner-sylva-apex-glasses', 'hills'),
  ('meridian-endurance', 'partner-meridian-distance-bib', 'endurance'),
  ('axiom-allroad', 'partner-axiom-union-shoes', 'flat')
) as mapping(supplier_key, catalog_key, rating_key)
join public.equipment_catalog_items as item on item.catalog_key = mapping.catalog_key
on conflict (supplier_key, equipment_item_id) do update set
  offer_type = excluded.offer_type,
  research_rating_key = excluded.research_rating_key,
  display_order = excluded.display_order;

alter table public.equipment_partner_contracts
  add column if not exists reputation_extra_cost integer not null default 0,
  add column if not exists reputation_extra_item_id uuid
    references public.equipment_catalog_items(id) on delete set null,
  add column if not exists reputation_extra_purchased_at timestamptz;

alter table public.equipment_partner_contracts
  add constraint equipment_partner_reputation_extra_cost_allowed
    check (reputation_extra_cost in (0, 200)),
  add constraint equipment_partner_reputation_extra_consistent check (
    (reputation_extra_cost = 0 and reputation_extra_item_id is null and reputation_extra_purchased_at is null)
    or (reputation_extra_cost = 200 and reputation_extra_item_id is not null and reputation_extra_purchased_at is not null)
  );

create or replace function public.purchase_current_equipment_partner_reputation_extra(
  p_contract_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_product record;
begin
  select director.id as sporting_director_id, director.reputation_points,
    assignment.team_id, season.id as season_id, season.game_year,
    contract.id as contract_id, contract.supplier_key,
    contract.reputation_extra_item_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.equipment_partner_contracts as contract
    on contract.id = p_contract_id
   and contract.team_id = assignment.team_id
   and contract.status = 'active'
  where director.auth_user_id = auth.uid() and director.status = 'active'
  for update of director, contract;

  if not found then raise exception 'Aucun contrat équipementier actif ne correspond à cette équipe.'; end if;
  if v_context.game_year < 4 then raise exception 'La quatrième dotation ouvre en saison 4.'; end if;
  if v_context.reputation_points < 1250 then
    raise exception 'La quatrième dotation exige 1 250 points de réputation.';
  end if;
  if v_context.reputation_extra_item_id is not null then
    raise exception 'La quatrième dotation de ce contrat a déjà été obtenue.';
  end if;

  select product.equipment_item_id, item.effect_payload
  into v_product
  from public.equipment_partner_products as product
  join public.equipment_catalog_items as item on item.id = product.equipment_item_id
  where product.supplier_key = v_context.supplier_key
    and product.offer_type = 'rare'
    and item.slot_type not in ('frame', 'front_wheel', 'rear_wheel')
    and item.status = 'active'
  order by product.display_order, item.id
  limit 1;
  if not found then raise exception 'La quatrième dotation de cet équipementier est indisponible.'; end if;

  perform private.spend_reputation(
    v_context.sporting_director_id, v_context.season_id, 200,
    'equipment-partner-extra:' || v_context.contract_id,
    'Quatrième dotation de l’équipementier',
    jsonb_build_object(
      'contractId', v_context.contract_id,
      'equipmentItemId', v_product.equipment_item_id
    )
  );

  insert into public.equipment_partner_item_effects (
    contract_id, equipment_item_id, effect_payload
  ) values (
    v_context.contract_id, v_product.equipment_item_id, v_product.effect_payload
  ) on conflict (contract_id, equipment_item_id) do nothing;

  update public.equipment_partner_contracts
  set reputation_extra_cost = 200,
      reputation_extra_item_id = v_product.equipment_item_id,
      reputation_extra_purchased_at = now()
  where id = v_context.contract_id;

  return v_product.equipment_item_id;
end;
$$;

revoke all on function public.purchase_current_equipment_partner_reputation_extra(uuid)
from public, anon;
grant execute on function public.purchase_current_equipment_partner_reputation_extra(uuid)
to authenticated;

comment on column public.equipment_partner_contracts.reputation_extra_item_id is
  'Quatrième équipement virtuel obtenu pour 200 points, valable uniquement pendant ce contrat.';

commit;
