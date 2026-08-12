-- Refonte des équipementiers : sept marques partenaires exclusives, dotations
-- virtuelles fixes et R&D exclusivement portée par le laboratoire de l'équipe.

begin;

insert into public.equipment_suppliers (
  supplier_key,
  name,
  positioning,
  logo_path,
  primary_color,
  secondary_color,
  accent_color,
  display_order,
  status,
  supports_team_contract
)
values
  (
    'altura-forge',
    'Altura Forge',
    'Une maison alpine obsédée par la légèreté, la précision en descente et la répétition des grands cols.',
    '/images/equipment/partner-brands/altura-forge.svg',
    '#1B4332', '#B77A20', '#E9C46A', 210, 'active', true
  ),
  (
    'vektor-aerolab',
    'Vektor Aerolab',
    'Un bureau aérodynamique radical, conçu autour du chrono, des hautes vitesses et des efforts parfaitement mesurés.',
    '/images/equipment/partner-brands/vektor-aerolab.svg',
    '#102A43', '#178F86', '#FFB703', 220, 'active', true
  ),
  (
    'brava-sprintworks',
    'Brava Sprintworks',
    'Une signature nerveuse et explosive pour les trains rapides, les relances franches et les sprints lancés.',
    '/images/equipment/partner-brands/brava-sprintworks.svg',
    '#631322', '#C27A16', '#F4B942', 230, 'active', true
  ),
  (
    'kernwerk-cycling',
    'Kernwerk Cycling',
    'Une manufacture du Nord qui privilégie la motricité, la résistance et la stabilité sur les secteurs pavés.',
    '/images/equipment/partner-brands/kernwerk-cycling.svg',
    '#202C33', '#8A5B34', '#F2C14E', 240, 'active', true
  ),
  (
    'sylva-dynamics',
    'Sylva Dynamics',
    'Une marque vive et joueuse, pensée pour les vallons, les changements de rythme et les coureurs offensifs.',
    '/images/equipment/partner-brands/sylva-dynamics.svg',
    '#22543D', '#648C25', '#9BC53D', 250, 'active', true
  ),
  (
    'meridian-endurance',
    'Meridian Endurance',
    'Une approche méthodique des longues distances, avec une attention particulière portée à l’endurance et à la récupération.',
    '/images/equipment/partner-brands/meridian-endurance.svg',
    '#103F52', '#C65339', '#F4A261', 260, 'active', true
  ),
  (
    'axiom-allroad',
    'Axiom Allroad',
    'Une plateforme équilibrée et adaptable pour les équipes qui préfèrent la polyvalence à une spécialisation extrême.',
    '/images/equipment/partner-brands/axiom-allroad.svg',
    '#372B59', '#287D69', '#F2C94C', 270, 'active', true
  )
on conflict (supplier_key) do update set
  name = excluded.name,
  positioning = excluded.positioning,
  logo_path = excluded.logo_path,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  display_order = excluded.display_order,
  status = excluded.status,
  supports_team_contract = excluded.supports_team_contract,
  updated_at = now();

-- Les marques de la boutique restent commerciales. Elles ne peuvent plus être
-- sélectionnées lors d'un nouveau contrat partenaire.
update public.equipment_suppliers
set
  supports_team_contract = false,
  updated_at = now()
where supports_team_contract
  and supplier_key not in (
    'altura-forge',
    'vektor-aerolab',
    'brava-sprintworks',
    'kernwerk-cycling',
    'sylva-dynamics',
    'meridian-endurance',
    'axiom-allroad'
  );

insert into public.equipment_catalog_items (
  catalog_key,
  name,
  slot_type,
  status,
  supplier_key,
  supplier_name,
  description,
  price,
  rarity,
  image_path,
  effect_summary,
  effect_payload,
  acquisition_channel
)
values
  ('partner-altura-summit-frame', 'Summit SL Factory', 'frame', 'active', 'altura-forge', 'Altura Forge', 'Le cadre de dotation complet d’Altura Forge, affûté pour les longues ascensions.', 0, 'premium', '/images/equipment/products/echelon-altitude-rs.webp', '+3 MON, +2 END et +1 REC.', '{"ratingBonuses":{"mountain":3,"endurance":2,"recovery":1}}'::jsonb, 'equipment_partner'),
  ('partner-altura-summit-front', 'Summit 28 avant', 'front_wheel', 'active', 'altura-forge', 'Altura Forge', 'Une roue avant légère et précise pour les cols techniques.', 0, 'premium', '/images/equipment/products/novaspoke-vent-28.webp', '+2 MON, +2 DES et +1 VAL.', '{"ratingBonuses":{"mountain":2,"downhill":2,"hills":1}}'::jsonb, 'equipment_partner'),
  ('partner-altura-summit-rear', 'Summit 31 arrière', 'rear_wheel', 'active', 'altura-forge', 'Altura Forge', 'Une roue arrière réactive pour répéter les efforts en altitude.', 0, 'premium', '/images/equipment/products/novaspoke-climb-feather.webp', '+2 MON, +2 REC et +1 ACC.', '{"ratingBonuses":{"mountain":2,"recovery":2,"acceleration":1}}'::jsonb, 'equipment_partner'),

  ('partner-vektor-vector-frame', 'Vector TT-X', 'frame', 'active', 'vektor-aerolab', 'Vektor Aerolab', 'Une plateforme de dotation sculptée pour réduire la traînée à haute vitesse.', 0, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+3 CLM, +2 PLA et +1 PRL.', '{"ratingBonuses":{"timeTrial":3,"flat":2,"prologue":1}}'::jsonb, 'equipment_partner'),
  ('partner-vektor-vector-front', 'Vector 64 avant', 'front_wheel', 'active', 'vektor-aerolab', 'Vektor Aerolab', 'Une roue avant haute, stable et directe dans les portions rapides.', 0, 'premium', '/images/equipment/products/velocita-lampo-45-front.webp', '+2 CLM, +2 PLA et +1 DES.', '{"ratingBonuses":{"timeTrial":2,"flat":2,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-vektor-vector-rear', 'Vector Disc arrière', 'rear_wheel', 'active', 'vektor-aerolab', 'Vektor Aerolab', 'La roue motrice pleine du programme chrono Vektor.', 0, 'premium', '/images/equipment/products/novaspoke-disc-vector.webp', '+3 CLM, +1 PLA et +1 END.', '{"ratingBonuses":{"timeTrial":3,"flat":1,"endurance":1}}'::jsonb, 'equipment_partner'),

  ('partner-brava-fulgor-frame', 'Fulgor RS', 'frame', 'active', 'brava-sprintworks', 'Brava Sprintworks', 'Un vélo complet rigide et nerveux pour les trains de sprinteurs.', 0, 'premium', '/images/equipment/products/echelon-vitesse-aero.webp', '+3 SPR, +2 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":3,"acceleration":2,"flat":1}}'::jsonb, 'equipment_partner'),
  ('partner-brava-fulgor-front', 'Fulgor 58 avant', 'front_wheel', 'active', 'brava-sprintworks', 'Brava Sprintworks', 'Une roue avant rapide qui garde sa ligne dans les finales agitées.', 0, 'premium', '/images/equipment/products/velocita-lampo-45-front.webp', '+2 SPR, +2 PLA et +1 DES.', '{"ratingBonuses":{"sprint":2,"flat":2,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-brava-fulgor-rear', 'Fulgor 68 arrière', 'rear_wheel', 'active', 'brava-sprintworks', 'Brava Sprintworks', 'Une roue arrière explosive pour transformer la relance en vitesse.', 0, 'premium', '/images/equipment/products/velocita-furia-60-rear.webp', '+2 SPR, +2 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":2,"acceleration":2,"flat":1}}'::jsonb, 'equipment_partner'),

  ('partner-kernwerk-granit-frame', 'Granit CX', 'frame', 'active', 'kernwerk-cycling', 'Kernwerk Cycling', 'Un châssis de dotation stable lorsque la route devient cassante.', 0, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+3 PAV, +2 RES et +1 END.', '{"ratingBonuses":{"cobbles":3,"resistance":2,"endurance":1}}'::jsonb, 'equipment_partner'),
  ('partner-kernwerk-granit-front', 'Granit 37 avant', 'front_wheel', 'active', 'kernwerk-cycling', 'Kernwerk Cycling', 'Une roue avant précise pour tenir la trajectoire sur les pavés.', 0, 'premium', '/images/equipment/products/novaspoke-pave-35.webp', '+2 PAV, +2 PLA et +1 DES.', '{"ratingBonuses":{"cobbles":2,"flat":2,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-kernwerk-granit-rear', 'Granit 39 arrière', 'rear_wheel', 'active', 'kernwerk-cycling', 'Kernwerk Cycling', 'Une roue arrière robuste qui conserve la motricité sous les relances.', 0, 'premium', '/images/equipment/products/novaspoke-pave-35.webp', '+2 PAV, +2 RES et +1 ACC.', '{"ratingBonuses":{"cobbles":2,"resistance":2,"acceleration":1}}'::jsonb, 'equipment_partner'),

  ('partner-sylva-canopy-frame', 'Canopy Attack', 'frame', 'active', 'sylva-dynamics', 'Sylva Dynamics', 'Un vélo de dotation incisif pour provoquer la sélection dans les vallons.', 0, 'premium', '/images/equipment/products/echelon-altitude-rs.webp', '+3 VAL, +2 BAR et +1 ACC.', '{"ratingBonuses":{"hills":3,"breakaway":2,"acceleration":1}}'::jsonb, 'equipment_partner'),
  ('partner-sylva-canopy-front', 'Canopy 40 avant', 'front_wheel', 'active', 'sylva-dynamics', 'Sylva Dynamics', 'Une roue avant agile dans les enchaînements et les descentes courtes.', 0, 'premium', '/images/equipment/products/novaspoke-vent-28.webp', '+2 VAL, +2 DES et +1 PLA.', '{"ratingBonuses":{"hills":2,"downhill":2,"flat":1}}'::jsonb, 'equipment_partner'),
  ('partner-sylva-canopy-rear', 'Canopy 44 arrière', 'rear_wheel', 'active', 'sylva-dynamics', 'Sylva Dynamics', 'Une roue arrière vive pour attaquer et relancer sur les bosses.', 0, 'premium', '/images/equipment/products/velocita-furia-60-rear.webp', '+2 VAL, +2 ACC et +1 BAR.', '{"ratingBonuses":{"hills":2,"acceleration":2,"breakaway":1}}'::jsonb, 'equipment_partner'),

  ('partner-meridian-horizon-frame', 'Horizon Ultra', 'frame', 'active', 'meridian-endurance', 'Meridian Endurance', 'Un vélo complet conçu pour conserver du rendement au fil des heures.', 0, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+3 END, +2 REC et +1 RES.', '{"ratingBonuses":{"endurance":3,"recovery":2,"resistance":1}}'::jsonb, 'equipment_partner'),
  ('partner-meridian-horizon-front', 'Horizon 45 avant', 'front_wheel', 'active', 'meridian-endurance', 'Meridian Endurance', 'Une roue avant rassurante pour les longues journées de course.', 0, 'premium', '/images/equipment/products/novaspoke-vent-28.webp', '+2 END, +2 RES et +1 DES.', '{"ratingBonuses":{"endurance":2,"resistance":2,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-meridian-horizon-rear', 'Horizon 48 arrière', 'rear_wheel', 'active', 'meridian-endurance', 'Meridian Endurance', 'Une roue arrière qui préserve la fraîcheur sans sacrifier le rendement.', 0, 'premium', '/images/equipment/products/novaspoke-climb-feather.webp', '+2 REC, +2 RES et +1 PLA.', '{"ratingBonuses":{"recovery":2,"resistance":2,"flat":1}}'::jsonb, 'equipment_partner'),

  ('partner-axiom-union-frame', 'Union Allroad', 'frame', 'active', 'axiom-allroad', 'Axiom Allroad', 'Une base équilibrée qui accompagne tous les profils de coureurs.', 0, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+2 PLA, +2 VAL, +1 END et +1 RES.', '{"ratingBonuses":{"flat":2,"hills":2,"endurance":1,"resistance":1}}'::jsonb, 'equipment_partner'),
  ('partner-axiom-union-front', 'Union 42 avant', 'front_wheel', 'active', 'axiom-allroad', 'Axiom Allroad', 'Une roue avant polyvalente pour garder de la précision sur tous les terrains.', 0, 'premium', '/images/equipment/products/velocita-lampo-45-front.webp', '+1 MON, +1 VAL, +1 DES, +1 PAV et +1 PLA.', '{"ratingBonuses":{"mountain":1,"hills":1,"downhill":1,"cobbles":1,"flat":1}}'::jsonb, 'equipment_partner'),
  ('partner-axiom-union-rear', 'Union 45 arrière', 'rear_wheel', 'active', 'axiom-allroad', 'Axiom Allroad', 'Une roue arrière adaptable aux accélérations, au sprint et aux échappées.', 0, 'premium', '/images/equipment/products/velocita-furia-60-rear.webp', '+1 SPR, +1 ACC, +1 REC, +1 PLA et +1 BAR.', '{"ratingBonuses":{"sprint":1,"acceleration":1,"recovery":1,"flat":1,"breakaway":1}}'::jsonb, 'equipment_partner')
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
  owner_team_id = null,
  updated_at = now();

insert into public.equipment_partner_products (
  supplier_key,
  equipment_item_id,
  offer_type,
  research_rating_key,
  display_order
)
select
  mapping.supplier_key,
  item.id,
  'core',
  mapping.rating_key,
  mapping.display_order
from (
  values
    ('altura-forge', 'partner-altura-summit-frame', 'mountain', 10),
    ('altura-forge', 'partner-altura-summit-front', 'downhill', 20),
    ('altura-forge', 'partner-altura-summit-rear', 'recovery', 30),
    ('vektor-aerolab', 'partner-vektor-vector-frame', 'timeTrial', 10),
    ('vektor-aerolab', 'partner-vektor-vector-front', 'flat', 20),
    ('vektor-aerolab', 'partner-vektor-vector-rear', 'timeTrial', 30),
    ('brava-sprintworks', 'partner-brava-fulgor-frame', 'sprint', 10),
    ('brava-sprintworks', 'partner-brava-fulgor-front', 'flat', 20),
    ('brava-sprintworks', 'partner-brava-fulgor-rear', 'acceleration', 30),
    ('kernwerk-cycling', 'partner-kernwerk-granit-frame', 'cobbles', 10),
    ('kernwerk-cycling', 'partner-kernwerk-granit-front', 'flat', 20),
    ('kernwerk-cycling', 'partner-kernwerk-granit-rear', 'resistance', 30),
    ('sylva-dynamics', 'partner-sylva-canopy-frame', 'hills', 10),
    ('sylva-dynamics', 'partner-sylva-canopy-front', 'downhill', 20),
    ('sylva-dynamics', 'partner-sylva-canopy-rear', 'acceleration', 30),
    ('meridian-endurance', 'partner-meridian-horizon-frame', 'endurance', 10),
    ('meridian-endurance', 'partner-meridian-horizon-front', 'resistance', 20),
    ('meridian-endurance', 'partner-meridian-horizon-rear', 'recovery', 30),
    ('axiom-allroad', 'partner-axiom-union-frame', 'flat', 10),
    ('axiom-allroad', 'partner-axiom-union-front', 'hills', 20),
    ('axiom-allroad', 'partner-axiom-union-rear', 'acceleration', 30)
) as mapping(supplier_key, catalog_key, rating_key, display_order)
join public.equipment_catalog_items as item
  on item.catalog_key = mapping.catalog_key
on conflict (supplier_key, equipment_item_id) do update set
  offer_type = excluded.offer_type,
  research_rating_key = excluded.research_rating_key,
  display_order = excluded.display_order;

-- Un contrat crée uniquement le droit d'usage virtuel et la copie immuable des
-- effets de la dotation. Aucun objet partenaire n'entre dans l'inventaire.
create or replace function public.sign_equipment_partner_contract(
  p_supplier_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_end_season_id uuid;
  v_contract_id uuid;
begin
  select
    director.reputation_points,
    assignment.team_id,
    season.id as season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_context.team_id::text));

  if coalesce(v_context.reputation_points, 0) < 200 then
    raise exception 'Une réputation d’au moins 200 points est nécessaire pour signer.';
  end if;

  if not exists (
    select 1
    from public.equipment_suppliers as supplier
    where supplier.supplier_key = p_supplier_key
      and supplier.status = 'active'
      and supplier.supports_team_contract
  ) then
    raise exception 'Cet équipementier ne propose pas de contrat d’équipe.';
  end if;

  if exists (
    select 1
    from public.equipment_partner_contracts as contract
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
  ) then
    raise exception 'Un contrat équipementier est déjà en cours et ne peut pas être rompu.';
  end if;

  if exists (
    select 1
    from public.equipment_partner_contracts as contract
    where contract.team_id = v_context.team_id
      and contract.supplier_key = p_supplier_key
  ) then
    raise exception 'Un contrat équipementier arrivé à son terme ne peut pas être prolongé.';
  end if;

  v_end_season_id := public.ensure_transfer_next_season(v_context.season_id);

  insert into public.equipment_partner_contracts (
    team_id,
    supplier_key,
    start_season_id,
    end_season_id
  )
  values (
    v_context.team_id,
    p_supplier_key,
    v_context.season_id,
    v_end_season_id
  )
  returning id into v_contract_id;

  insert into public.equipment_partner_item_effects (
    contract_id,
    equipment_item_id,
    effect_payload
  )
  select
    v_contract_id,
    product.equipment_item_id,
    item.effect_payload
  from public.equipment_partner_products as product
  join public.equipment_catalog_items as item
    on item.id = product.equipment_item_id
  where product.supplier_key = p_supplier_key
    and product.offer_type = 'core';

  return v_contract_id;
end;
$$;

-- La synchronisation ne simule plus de recherche ni d'offre aléatoire. Elle
-- clôt le contrat arrivé à terme et retire alors les droits d'usage associés.
create or replace function public.sync_current_team_equipment_partner()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
begin
  select
    assignment.team_id,
    season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_context.team_id::text));

  update public.equipment_partner_contracts as contract
  set
    status = 'completed',
    completed_at = coalesce(contract.completed_at, now())
  from public.seasons as end_season
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and end_season.id = contract.end_season_id
    and end_season.game_year < v_context.game_year;

  delete from public.rider_equipment_pending_assignments as pending
  using public.rider_contracts as rider_contract,
        public.equipment_partner_products as product,
        public.equipment_partner_contracts as partner_contract
  where rider_contract.rider_id = pending.rider_id
    and rider_contract.team_id = v_context.team_id
    and rider_contract.status = 'active'
    and product.equipment_item_id = pending.equipment_item_id
    and partner_contract.supplier_key = product.supplier_key
    and partner_contract.team_id = v_context.team_id
    and partner_contract.status = 'completed';

  delete from public.rider_equipment_assignments as equipment
  using public.rider_contracts as rider_contract,
        public.equipment_partner_products as product,
        public.equipment_partner_contracts as partner_contract
  where rider_contract.rider_id = equipment.rider_id
    and rider_contract.team_id = v_context.team_id
    and rider_contract.status = 'active'
    and product.equipment_item_id = equipment.equipment_item_id
    and partner_contract.supplier_key = product.supplier_key
    and partner_contract.team_id = v_context.team_id
    and partner_contract.status = 'completed';

  delete from public.team_equipment_inventory as inventory
  using public.team_seasons as team_season,
        public.equipment_catalog_items as item
  where inventory.team_season_id = team_season.id
    and team_season.team_id = v_context.team_id
    and item.id = inventory.equipment_item_id
    and item.acquisition_channel = 'equipment_partner';
end;
$$;

-- La dernière version de la fonction d'affectation avait réintroduit un
-- contrôle de stock physique pour toutes les références. Les dotations actives
-- contournent ce contrôle, tout en conservant les validations d'équipe et de slot.
create or replace function public.equip_current_team_rider(
  p_rider_id uuid,
  p_slot_type text,
  p_equipment_item_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_item record;
  v_owned integer;
  v_used integer;
  v_current_item_id uuid;
  v_partner_available boolean := false;
  v_effective_at timestamptz := now();
begin
  if p_slot_type not in (
    'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
    'front_wheel', 'rear_wheel', 'frame'
  ) then
    raise exception 'Emplacement de matériel invalide.';
  end if;

  select
    team_season.id as team_season_id,
    team_season.team_id,
    season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  if not exists (
    select 1
    from public.rider_contracts
    where rider_id = p_rider_id
      and team_id = v_context.team_id
      and status = 'active'
  ) then
    raise exception 'Vous ne pouvez équiper que les coureurs de votre équipe.';
  end if;

  select id, slot_type, acquisition_channel, supplier_key
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active';

  if v_item is null or v_item.slot_type <> p_slot_type then
    raise exception 'Ce matériel ne correspond pas à cet emplacement.';
  end if;

  select equipment_item_id
  into v_current_item_id
  from public.rider_equipment_assignments
  where rider_id = p_rider_id
    and slot_type = p_slot_type;

  if v_current_item_id = p_equipment_item_id then
    delete from public.rider_equipment_pending_assignments
    where rider_id = p_rider_id
      and slot_type = p_slot_type;
    return v_effective_at;
  end if;

  if v_item.acquisition_channel = 'equipment_partner' then
    select exists (
      select 1
      from public.equipment_partner_contracts as partner_contract
      join public.seasons as start_season
        on start_season.id = partner_contract.start_season_id
      join public.seasons as end_season
        on end_season.id = partner_contract.end_season_id
      join public.equipment_partner_products as product
        on product.supplier_key = partner_contract.supplier_key
       and product.equipment_item_id = p_equipment_item_id
       and product.offer_type = 'core'
      where partner_contract.team_id = v_context.team_id
        and partner_contract.status = 'active'
        and partner_contract.supplier_key = v_item.supplier_key
        and v_context.game_year between start_season.game_year and end_season.game_year
    ) into v_partner_available;

    if not v_partner_available then
      raise exception 'Cette référence partenaire n’est pas disponible pour votre équipe.';
    end if;
  else
    select coalesce(quantity, 0)
    into v_owned
    from public.team_equipment_inventory
    where team_season_id = v_context.team_season_id
      and equipment_item_id = p_equipment_item_id;

    select count(*)
    into v_used
    from public.rider_equipment_assignments as equipped
    join public.rider_contracts as contract
      on contract.rider_id = equipped.rider_id
     and contract.team_id = v_context.team_id
     and contract.status = 'active'
    where equipped.equipment_item_id = p_equipment_item_id
      and not (
        equipped.rider_id = p_rider_id
        and equipped.slot_type = p_slot_type
      );

    if coalesce(v_owned, 0) <= coalesce(v_used, 0) then
      raise exception 'Tous les exemplaires de cette référence sont déjà attribués.';
    end if;
  end if;

  insert into public.rider_equipment_assignments (
    rider_id,
    slot_type,
    equipment_item_id,
    equipped_at
  )
  values (
    p_rider_id,
    p_slot_type,
    p_equipment_item_id,
    v_effective_at
  )
  on conflict (rider_id, slot_type) do update set
    equipment_item_id = excluded.equipment_item_id,
    equipped_at = excluded.equipped_at;

  delete from public.rider_equipment_pending_assignments
  where rider_id = p_rider_id
    and slot_type = p_slot_type;

  return v_effective_at;
end;
$$;

comment on function public.equip_current_team_rider(uuid, text, uuid) is
  'Équipe immédiatement un coureur ; les dotations partenaires actives sont virtuelles et illimitées.';
-- Les anciens RPC restent dans le schéma pour préserver l'historique des
-- migrations, mais aucun membre ni service applicatif ne peut plus les lancer.
revoke all on function public.start_equipment_partner_rnd(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_equipment_partner_offer(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.sign_equipment_partner_contract(text)
  from public, anon;
grant execute on function public.sign_equipment_partner_contract(text)
  to authenticated, service_role;
revoke all on function public.sync_current_team_equipment_partner()
  from public, anon;
grant execute on function public.sync_current_team_equipment_partner()
  to authenticated, service_role;

comment on table public.equipment_partner_item_effects is
  'Copie immuable des effets de la dotation partenaire pendant un contrat.';
comment on table public.equipment_partner_rnd_projects is
  'Historique obsolète de l’ancienne R&D équipementier ; aucune nouvelle entrée autorisée.';
comment on table public.equipment_partner_offers is
  'Historique obsolète des anciennes offres aléatoires équipementier ; aucune nouvelle entrée autorisée.';

-- Remise à zéro ciblée du seul compte déjà débloqué : retrait des dotations
-- équipées ou programmées, suppression du contrat et nettoyage de tout stock
-- partenaire hérité. Les achats commerciaux et prototypes ne sont pas touchés.
create temporary table reset_equipment_partner_teams
on commit drop
as
select distinct assignment.team_id
from auth.users as user_account
join public.sporting_directors as director
  on director.auth_user_id = user_account.id
join public.team_manager_assignments as assignment
  on assignment.sporting_director_id = director.id
 and assignment.role = 'general_manager'
 and assignment.status = 'active'
where lower(user_account.email) = lower('Paul.leblanc22@gmail.com')
  and director.status = 'active';

delete from public.rider_equipment_pending_assignments as pending
using public.team_seasons as team_season,
      public.equipment_catalog_items as item,
      reset_equipment_partner_teams as reset_team
where pending.team_season_id = team_season.id
  and team_season.team_id = reset_team.team_id
  and item.id = pending.equipment_item_id
  and item.acquisition_channel = 'equipment_partner';

delete from public.rider_equipment_assignments as equipment
using public.rider_contracts as rider_contract,
      public.equipment_catalog_items as item,
      reset_equipment_partner_teams as reset_team
where rider_contract.rider_id = equipment.rider_id
  and rider_contract.team_id = reset_team.team_id
  and rider_contract.status = 'active'
  and item.id = equipment.equipment_item_id
  and item.acquisition_channel = 'equipment_partner';

delete from public.team_equipment_inventory as inventory
using public.team_seasons as team_season,
      public.equipment_catalog_items as item,
      reset_equipment_partner_teams as reset_team
where inventory.team_season_id = team_season.id
  and team_season.team_id = reset_team.team_id
  and item.id = inventory.equipment_item_id
  and item.acquisition_channel = 'equipment_partner';

delete from public.equipment_partner_contracts as contract
using reset_equipment_partner_teams as reset_team
where contract.team_id = reset_team.team_id;

commit;
