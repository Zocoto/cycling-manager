-- ============================================================
-- CYCLING MANAGER
-- Contrats équipementiers, dotation partenaire et recherche R&D.
-- ============================================================

begin;

alter table public.equipment_catalog_items
  add column if not exists acquisition_channel text not null default 'commercial';

alter table public.equipment_catalog_items
  drop constraint if exists equipment_catalog_items_acquisition_channel_allowed;

alter table public.equipment_catalog_items
  add constraint equipment_catalog_items_acquisition_channel_allowed
    check (acquisition_channel in ('commercial', 'equipment_partner'));

alter table public.equipment_suppliers
  add column if not exists supports_team_contract boolean not null default false;

update public.equipment_suppliers
set supports_team_contract = supplier_key in (
  'dacatlon-velo',
  'echelon-cycles',
  'velocita-corse',
  'andes-endurance',
  'kaze-dynamics',
  'radian-raceworks'
);

drop index if exists public.equipment_catalog_active_effect_unique_idx;
create unique index equipment_catalog_active_commercial_effect_unique_idx
  on public.equipment_catalog_items (slot_type, md5(effect_payload::text))
  where status = 'active' and acquisition_channel = 'commercial';

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
select * from (values
  ('partner-dacatlon-rcx-frame', 'RCX Team Lab', 'frame', 'active', 'dacatlon-velo', 'Dacatlon Velo', 'Le cadre de dotation RCX, livré avec son groupe de compétition et réservé aux équipes partenaires.', 0, 'premium', '/images/equipment/products/echelon-altitude-rs.webp', '+2 PLA, +2 END et +2 RES.', '{"ratingBonuses":{"flat":2,"endurance":2,"resistance":2}}'::jsonb, 'equipment_partner'),
  ('partner-dacatlon-rcx-front', 'RCX Team 42 avant', 'front_wheel', 'active', 'dacatlon-velo', 'Dacatlon Velo', 'Une roue avant polyvalente développée pour la dotation complète RCX.', 0, 'premium', '/images/equipment/products/novaspoke-vent-28.webp', '+2 PLA, +1 VAL et +1 DES.', '{"ratingBonuses":{"flat":2,"hills":1,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-dacatlon-rcx-rear', 'RCX Team 42 arrière', 'rear_wheel', 'active', 'dacatlon-velo', 'Dacatlon Velo', 'La roue arrière de la dotation RCX, fiable sur tous les terrains.', 0, 'premium', '/images/equipment/products/novaspoke-pave-35.webp', '+2 PLA, +1 ACC et +1 REC.', '{"ratingBonuses":{"flat":2,"acceleration":1,"recovery":1}}'::jsonb, 'equipment_partner'),
  ('partner-dacatlon-vento-helmet', 'Vento Team Air', 'helmet', 'active', 'dacatlon-velo', 'Dacatlon Velo', 'Une proposition ponctuelle du bureau d’études Dacatlon, hors dotation principale.', 0, 'premium', '/images/equipment/products/aerion-stratos-pro.webp', 'Réduit de 10 % le risque de blessure et +1 END.', '{"injuryRiskReductionPct":10,"ratingBonuses":{"endurance":1}}'::jsonb, 'equipment_partner'),
  ('partner-dacatlon-rcx-shoes', 'RCX Team Shoes', 'shoes', 'active', 'dacatlon-velo', 'Dacatlon Velo', 'Une chaussure partenaire équilibrée, proposée seulement lors de séries limitées.', 0, 'premium', '/images/equipment/products/montclair-alpine-lace.webp', '+2 ACC, +1 PLA et +1 RES.', '{"ratingBonuses":{"acceleration":2,"flat":1,"resistance":1}}'::jsonb, 'equipment_partner'),

  ('partner-echelon-orbit-frame', 'Orbit Factory', 'frame', 'active', 'echelon-cycles', 'Echelon Cycles', 'Un châssis usine intégrant le groupe Orbit, plus affûté que la gamme commerciale.', 0, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+3 CLM, +2 PLA et +2 PRL.', '{"ratingBonuses":{"timeTrial":3,"flat":2,"prologue":2}}'::jsonb, 'equipment_partner'),
  ('partner-echelon-orbit-front', 'Orbit 55 Factory avant', 'front_wheel', 'active', 'echelon-cycles', 'Echelon Cycles', 'Une roue avant haute développée avec l’équipe partenaire.', 0, 'premium', '/images/equipment/products/velocita-lampo-45-front.webp', '+2 CLM, +2 PLA et +1 ACC.', '{"ratingBonuses":{"timeTrial":2,"flat":2,"acceleration":1}}'::jsonb, 'equipment_partner'),
  ('partner-echelon-orbit-rear', 'Orbit 65 Factory arrière', 'rear_wheel', 'active', 'echelon-cycles', 'Echelon Cycles', 'La roue motrice du programme Orbit, pensée pour maintenir une vitesse élevée.', 0, 'premium', '/images/equipment/products/novaspoke-disc-vector.webp', '+3 CLM, +1 PLA et +1 END.', '{"ratingBonuses":{"timeTrial":3,"flat":1,"endurance":1}}'::jsonb, 'equipment_partner'),
  ('partner-echelon-orbit-visor', 'Orbit Visor', 'glasses', 'active', 'echelon-cycles', 'Echelon Cycles', 'Une optique expérimentale issue du programme aéro Orbit.', 0, 'premium', '/images/equipment/products/aerion-prism-aeroshade.webp', '+2 CLM, +1 PLA et +1 DES.', '{"ratingBonuses":{"timeTrial":2,"flat":1,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-echelon-orbit-skinsuit', 'Orbit Endurance Bib', 'bib_shorts', 'active', 'echelon-cycles', 'Echelon Cycles', 'Une série textile rare conçue pour soutenir les longues poursuites.', 0, 'premium', '/images/equipment/products/montclair-victoire-atelier.webp', '+2 END, +2 REC et +1 CLM.', '{"ratingBonuses":{"endurance":2,"recovery":2,"timeTrial":1}}'::jsonb, 'equipment_partner'),

  ('partner-velocita-fulmine-frame', 'Fulmine Squadra', 'frame', 'active', 'velocita-corse', 'Velocità Corse', 'Le vélo complet Fulmine, groupe inclus, destiné aux trains de sprinteurs partenaires.', 0, 'premium', '/images/equipment/products/echelon-vitesse-aero.webp', '+3 SPR, +2 ACC et +2 PLA.', '{"ratingBonuses":{"sprint":3,"acceleration":2,"flat":2}}'::jsonb, 'equipment_partner'),
  ('partner-velocita-fulmine-front', 'Fulmine 58 Squadra avant', 'front_wheel', 'active', 'velocita-corse', 'Velocità Corse', 'Une roue avant rapide mais suffisamment stable pour frotter dans le final.', 0, 'premium', '/images/equipment/products/velocita-lampo-45-front.webp', '+2 SPR, +2 PLA et +1 DES.', '{"ratingBonuses":{"sprint":2,"flat":2,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-velocita-fulmine-rear', 'Fulmine 68 Squadra arrière', 'rear_wheel', 'active', 'velocita-corse', 'Velocità Corse', 'Une roue arrière explosive, réservée à la dotation usine.', 0, 'premium', '/images/equipment/products/velocita-furia-60-rear.webp', '+2 SPR, +2 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":2,"acceleration":2,"flat":1}}'::jsonb, 'equipment_partner'),
  ('partner-velocita-scatto-team', 'Scatto Squadra', 'shoes', 'active', 'velocita-corse', 'Velocità Corse', 'Une chaussure prototype proposée en quantité limitée aux équipes sous contrat.', 0, 'premium', '/images/equipment/products/velocita-scatto.webp', '+3 ACC et +2 SPR.', '{"ratingBonuses":{"acceleration":3,"sprint":2}}'::jsonb, 'equipment_partner'),
  ('partner-velocita-finale-grip', 'Finale Grip', 'gloves', 'active', 'velocita-corse', 'Velocità Corse', 'Des gants signature qui valorisent les attaques et les victoires de prestige.', 0, 'premium', '/images/equipment/products/montclair-podium-atelier.webp', '+1 ACC, +0,16 réputation en échappée et +0,18 lors d’une victoire.', '{"ratingBonuses":{"acceleration":1},"breakawayReputationBonus":0.16,"victoryReputationBonus":0.18}'::jsonb, 'equipment_partner'),

  ('partner-andes-apu-frame', 'Apu Factory', 'frame', 'active', 'andes-endurance', 'Andes Endurance', 'Le cadre Apu avec groupe montagne, développé pour les équipes qui visent les cols.', 0, 'premium', '/images/equipment/products/echelon-altitude-rs.webp', '+3 MON, +2 END et +2 REC.', '{"ratingBonuses":{"mountain":3,"endurance":2,"recovery":2}}'::jsonb, 'equipment_partner'),
  ('partner-andes-apu-front', 'Apu 30 Factory avant', 'front_wheel', 'active', 'andes-endurance', 'Andes Endurance', 'Une roue avant légère et précise dans les descentes de cols.', 0, 'premium', '/images/equipment/products/novaspoke-vent-28.webp', '+2 MON, +2 DES et +1 VAL.', '{"ratingBonuses":{"mountain":2,"downhill":2,"hills":1}}'::jsonb, 'equipment_partner'),
  ('partner-andes-apu-rear', 'Apu 33 Factory arrière', 'rear_wheel', 'active', 'andes-endurance', 'Andes Endurance', 'Une roue arrière conçue pour répéter les efforts en altitude.', 0, 'premium', '/images/equipment/products/novaspoke-climb-feather.webp', '+2 MON, +2 REC et +1 ACC.', '{"ratingBonuses":{"mountain":2,"recovery":2,"acceleration":1}}'::jsonb, 'equipment_partner'),
  ('partner-andes-condor-lab', 'Condor Lab', 'helmet', 'active', 'andes-endurance', 'Andes Endurance', 'Un casque de laboratoire qui sécurise les trajectoires rapides en montagne.', 0, 'premium', '/images/equipment/products/aerion-stratos-s1.webp', 'Réduit de 9 % le risque de blessure, +2 DES et +1 MON.', '{"injuryRiskReductionPct":9,"ratingBonuses":{"downhill":2,"mountain":1}}'::jsonb, 'equipment_partner'),
  ('partner-andes-cumbre-lab', 'Cumbre Lab', 'shoes', 'active', 'andes-endurance', 'Andes Endurance', 'Une chaussure très légère proposée ponctuellement hors de la dotation vélo.', 0, 'premium', '/images/equipment/products/montclair-chronos-blade.webp', '+2 MON, +2 VAL et +1 ACC.', '{"ratingBonuses":{"mountain":2,"hills":2,"acceleration":1}}'::jsonb, 'equipment_partner'),

  ('partner-kaze-ryu-frame', 'Ryū Factory', 'frame', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Le vélo Ryū et son groupe électronique, nés en soufflerie pour l’équipe partenaire.', 0, 'premium', '/images/equipment/products/echelon-vitesse-aero.webp', '+3 PLA, +2 ACC, +1 CLM et +1 SPR.', '{"ratingBonuses":{"flat":3,"acceleration":2,"timeTrial":1,"sprint":1}}'::jsonb, 'equipment_partner'),
  ('partner-kaze-ryu-front', 'Ryū 62 Factory avant', 'front_wheel', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Une roue avant de soufflerie, rapide dans les changements d’allure.', 0, 'premium', '/images/equipment/products/velocita-lampo-45-front.webp', '+2 PLA, +2 ACC et +1 CLM.', '{"ratingBonuses":{"flat":2,"acceleration":2,"timeTrial":1}}'::jsonb, 'equipment_partner'),
  ('partner-kaze-ryu-rear', 'Ryū 72 Factory arrière', 'rear_wheel', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'La roue arrière profonde du programme Ryū.', 0, 'premium', '/images/equipment/products/velocita-furia-60-rear.webp', '+2 PLA, +2 SPR et +1 CLM.', '{"ratingBonuses":{"flat":2,"sprint":2,"timeTrial":1}}'::jsonb, 'equipment_partner'),
  ('partner-kaze-fujin-lab', 'Fūjin Lab', 'helmet', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Un prototype rare qui conjugue canalisation de l’air et protection.', 0, 'premium', '/images/equipment/products/aerion-vortex-tt.webp', 'Réduit de 8 % le risque de blessure, +2 PLA et +1 CLM.', '{"injuryRiskReductionPct":8,"ratingBonuses":{"flat":2,"timeTrial":1}}'::jsonb, 'equipment_partner'),
  ('partner-kaze-shiden-lab', 'Shiden Lab', 'glasses', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Un écran expérimental pour lire plus tôt les trajectoires à haute vitesse.', 0, 'premium', '/images/equipment/products/aerion-prism-horizon.webp', '+2 ACC, +2 DES et +1 PLA.', '{"ratingBonuses":{"acceleration":2,"downhill":2,"flat":1}}'::jsonb, 'equipment_partner'),

  ('partner-radian-vertex-frame', 'Vertex Works', 'frame', 'active', 'radian-raceworks', 'Radian Raceworks', 'Le châssis Vertex, son groupe et ses périphériques usine pour les grands objectifs.', 0, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+3 MON, +2 VAL, +2 DES et +1 RES.', '{"ratingBonuses":{"mountain":3,"hills":2,"downhill":2,"resistance":1}}'::jsonb, 'equipment_partner'),
  ('partner-radian-vertex-front', 'Vertex 45 Works avant', 'front_wheel', 'active', 'radian-raceworks', 'Radian Raceworks', 'Une roue avant usine performante sur les terrains les plus sélectifs.', 0, 'premium', '/images/equipment/products/novaspoke-pave-35.webp', '+2 VAL, +2 DES, +1 MON et +1 RES.', '{"ratingBonuses":{"hills":2,"downhill":2,"mountain":1,"resistance":1}}'::jsonb, 'equipment_partner'),
  ('partner-radian-vertex-rear', 'Vertex 48 Works arrière', 'rear_wheel', 'active', 'radian-raceworks', 'Radian Raceworks', 'Une roue arrière de compétition qui combine rendement et relance.', 0, 'premium', '/images/equipment/products/novaspoke-disc-vector.webp', '+2 MON, +2 ACC, +1 VAL et +1 REC.', '{"ratingBonuses":{"mountain":2,"acceleration":2,"hills":1,"recovery":1}}'::jsonb, 'equipment_partner'),
  ('partner-radian-sentinel-works', 'Sentinel Works', 'helmet', 'active', 'radian-raceworks', 'Radian Raceworks', 'La protection la plus avancée du laboratoire Radian, proposée en série très limitée.', 0, 'premium', '/images/equipment/products/aerion-stratos-pro.webp', 'Réduit de 16 % le risque de blessure, +1 RES et +1 DES.', '{"injuryRiskReductionPct":16,"ratingBonuses":{"resistance":1,"downhill":1}}'::jsonb, 'equipment_partner'),
  ('partner-radian-grand-tour-works', 'Grand Tour Works Bib', 'bib_shorts', 'active', 'radian-raceworks', 'Radian Raceworks', 'Un cuissard prototype conçu pour préserver la fraîcheur sur les courses par étapes.', 0, 'premium', '/images/equipment/products/montclair-victoire-atelier.webp', '+3 END, +2 REC et +1 RES.', '{"ratingBonuses":{"endurance":3,"recovery":2,"resistance":1}}'::jsonb, 'equipment_partner')
) as catalog(
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

create table public.equipment_partner_contracts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  supplier_key text not null references public.equipment_suppliers(supplier_key) on delete restrict,
  start_season_id uuid not null references public.seasons(id) on delete restrict,
  end_season_id uuid not null references public.seasons(id) on delete restrict,
  status text not null default 'active',
  signed_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint equipment_partner_contract_status_allowed
    check (status in ('active', 'completed')),
  constraint equipment_partner_contract_seasons_distinct
    check (start_season_id <> end_season_id),
  constraint equipment_partner_contract_supplier_once
    unique (team_id, supplier_key)
);

create unique index equipment_partner_one_active_contract_per_team_idx
  on public.equipment_partner_contracts (team_id)
  where status = 'active';

create table public.equipment_partner_products (
  supplier_key text not null references public.equipment_suppliers(supplier_key) on delete cascade,
  equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete cascade,
  offer_type text not null,
  research_rating_key text not null,
  display_order integer not null default 100,
  constraint equipment_partner_product_offer_type_allowed
    check (offer_type in ('core', 'rare')),
  constraint equipment_partner_product_rating_key_allowed
    check (research_rating_key in (
      'mountain', 'hills', 'flat', 'timeTrial', 'cobbles', 'sprint',
      'acceleration', 'downhill', 'endurance', 'resistance', 'recovery',
      'breakaway', 'prologue'
    )),
  primary key (supplier_key, equipment_item_id)
);

insert into public.equipment_partner_products (
  supplier_key,
  equipment_item_id,
  offer_type,
  research_rating_key,
  display_order
)
select
  item.supplier_key,
  item.id,
  case when item.slot_type in ('frame', 'front_wheel', 'rear_wheel')
    then 'core'
    else 'rare'
  end,
  mapping.research_rating_key,
  mapping.display_order
from (
  values
    ('partner-dacatlon-rcx-frame', 'resistance', 10),
    ('partner-dacatlon-rcx-front', 'flat', 20),
    ('partner-dacatlon-rcx-rear', 'recovery', 30),
    ('partner-dacatlon-vento-helmet', 'endurance', 110),
    ('partner-dacatlon-rcx-shoes', 'acceleration', 120),
    ('partner-echelon-orbit-frame', 'timeTrial', 10),
    ('partner-echelon-orbit-front', 'flat', 20),
    ('partner-echelon-orbit-rear', 'timeTrial', 30),
    ('partner-echelon-orbit-visor', 'timeTrial', 110),
    ('partner-echelon-orbit-skinsuit', 'endurance', 120),
    ('partner-velocita-fulmine-frame', 'sprint', 10),
    ('partner-velocita-fulmine-front', 'flat', 20),
    ('partner-velocita-fulmine-rear', 'acceleration', 30),
    ('partner-velocita-scatto-team', 'acceleration', 110),
    ('partner-velocita-finale-grip', 'acceleration', 120),
    ('partner-andes-apu-frame', 'mountain', 10),
    ('partner-andes-apu-front', 'downhill', 20),
    ('partner-andes-apu-rear', 'recovery', 30),
    ('partner-andes-condor-lab', 'downhill', 110),
    ('partner-andes-cumbre-lab', 'mountain', 120),
    ('partner-kaze-ryu-frame', 'flat', 10),
    ('partner-kaze-ryu-front', 'acceleration', 20),
    ('partner-kaze-ryu-rear', 'sprint', 30),
    ('partner-kaze-fujin-lab', 'flat', 110),
    ('partner-kaze-shiden-lab', 'acceleration', 120),
    ('partner-radian-vertex-frame', 'mountain', 10),
    ('partner-radian-vertex-front', 'hills', 20),
    ('partner-radian-vertex-rear', 'acceleration', 30),
    ('partner-radian-sentinel-works', 'resistance', 110),
    ('partner-radian-grand-tour-works', 'endurance', 120)
) as mapping(catalog_key, research_rating_key, display_order)
join public.equipment_catalog_items as item
  on item.catalog_key = mapping.catalog_key
on conflict (supplier_key, equipment_item_id) do update set
  offer_type = excluded.offer_type,
  research_rating_key = excluded.research_rating_key,
  display_order = excluded.display_order;

create table public.equipment_partner_item_effects (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.equipment_partner_contracts(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete cascade,
  effect_payload jsonb not null,
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint equipment_partner_item_effect_payload_object
    check (jsonb_typeof(effect_payload) = 'object'),
  constraint equipment_partner_item_revision_non_negative
    check (revision >= 0),
  constraint equipment_partner_item_effect_unique
    unique (contract_id, equipment_item_id)
);

create table public.equipment_partner_rnd_projects (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.equipment_partner_contracts(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete cascade,
  research_rating_key text not null,
  status text not null default 'in_progress',
  started_on date not null,
  completes_on date not null,
  outcome text,
  delta integer,
  before_effect_payload jsonb not null,
  after_effect_payload jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint equipment_partner_rnd_status_allowed
    check (status in ('in_progress', 'completed')),
  constraint equipment_partner_rnd_outcome_allowed
    check (outcome is null or outcome in ('improvement', 'setback')),
  constraint equipment_partner_rnd_delta_allowed
    check (delta is null or delta in (-1, 1)),
  constraint equipment_partner_rnd_duration_positive
    check (completes_on > started_on)
);

create unique index equipment_partner_one_active_rnd_per_contract_idx
  on public.equipment_partner_rnd_projects (contract_id)
  where status = 'in_progress';

create table public.equipment_partner_offers (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.equipment_partner_contracts(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete cascade,
  offered_on date not null,
  expires_on date not null,
  status text not null default 'open',
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint equipment_partner_offer_status_allowed
    check (status in ('open', 'claimed', 'expired')),
  constraint equipment_partner_offer_duration_positive
    check (expires_on >= offered_on),
  constraint equipment_partner_offer_item_once
    unique (contract_id, equipment_item_id)
);

create table public.equipment_partner_offer_rolls (
  contract_id uuid not null references public.equipment_partner_contracts(id) on delete cascade,
  rolled_on date not null,
  offer_id uuid references public.equipment_partner_offers(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (contract_id, rolled_on)
);

create index equipment_partner_contract_team_idx
  on public.equipment_partner_contracts (team_id, status);
create index equipment_partner_effect_contract_idx
  on public.equipment_partner_item_effects (contract_id);
create index equipment_partner_rnd_due_idx
  on public.equipment_partner_rnd_projects (status, completes_on);
create index equipment_partner_offer_open_idx
  on public.equipment_partner_offers (contract_id, status, expires_on);

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
    season.id as season_id,
    season.game_year,
    team_season.id as team_season_id
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

  if coalesce(v_context.reputation_points, 0) <= 2 then
    raise exception 'Une réputation strictement supérieure à 2 est nécessaire pour signer.';
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
  where product.supplier_key = p_supplier_key;

  insert into public.team_equipment_inventory (
    team_season_id,
    equipment_item_id,
    quantity,
    last_purchase_price
  )
  select
    v_context.team_season_id,
    product.equipment_item_id,
    35,
    0
  from public.equipment_partner_products as product
  where product.supplier_key = p_supplier_key
    and product.offer_type = 'core'
  on conflict (team_season_id, equipment_item_id) do update set
    quantity = greatest(public.team_equipment_inventory.quantity, 35),
    last_purchase_price = 0,
    updated_at = now();

  return v_contract_id;
end;
$$;

create or replace function public.sync_current_team_equipment_partner()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_contract record;
  v_project record;
  v_effect record;
  v_before jsonb;
  v_after jsonb;
  v_delta integer;
  v_outcome text;
  v_current_rating integer;
  v_offer_item_id uuid;
  v_offer_id uuid;
begin
  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    team_season.id as team_season_id,
    season_day.calendar_date
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
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
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

  select
    contract.id,
    contract.supplier_key
  into v_contract
  from public.equipment_partner_contracts as contract
  join public.seasons as start_season on start_season.id = contract.start_season_id
  join public.seasons as end_season on end_season.id = contract.end_season_id
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and v_context.game_year between start_season.game_year and end_season.game_year
  limit 1;

  if v_contract is null then
    return;
  end if;

  insert into public.team_equipment_inventory (
    team_season_id,
    equipment_item_id,
    quantity,
    last_purchase_price
  )
  select
    v_context.team_season_id,
    product.equipment_item_id,
    35,
    0
  from public.equipment_partner_products as product
  where product.supplier_key = v_contract.supplier_key
    and (
      product.offer_type = 'core'
      or exists (
        select 1
        from public.equipment_partner_offers as offer
        where offer.contract_id = v_contract.id
          and offer.equipment_item_id = product.equipment_item_id
          and offer.status = 'claimed'
      )
    )
  on conflict (team_season_id, equipment_item_id) do update set
    quantity = greatest(public.team_equipment_inventory.quantity, 35),
    last_purchase_price = 0,
    updated_at = now();

  for v_project in
    select
      project.id,
      project.equipment_item_id,
      project.research_rating_key
    from public.equipment_partner_rnd_projects as project
    where project.contract_id = v_contract.id
      and project.status = 'in_progress'
      and project.completes_on <= v_context.calendar_date
    order by project.started_at
    for update
  loop
    select effect.*
    into v_effect
    from public.equipment_partner_item_effects as effect
    where effect.contract_id = v_contract.id
      and effect.equipment_item_id = v_project.equipment_item_id
    for update;

    v_before := coalesce(v_effect.effect_payload, '{}'::jsonb);
    if not (v_before ? 'ratingBonuses') then
      v_before := jsonb_set(v_before, '{ratingBonuses}', '{}'::jsonb, true);
    end if;

    v_outcome := case when random() < 0.5 then 'improvement' else 'setback' end;
    v_delta := case when v_outcome = 'improvement' then 1 else -1 end;
    v_current_rating := coalesce(
      (v_before -> 'ratingBonuses' ->> v_project.research_rating_key)::integer,
      0
    );
    v_after := jsonb_set(
      v_before,
      array['ratingBonuses', v_project.research_rating_key],
      to_jsonb(greatest(0, v_current_rating + v_delta)),
      true
    );

    update public.equipment_partner_item_effects
    set
      effect_payload = v_after,
      revision = revision + 1,
      updated_at = now()
    where id = v_effect.id;

    update public.equipment_partner_rnd_projects
    set
      status = 'completed',
      outcome = v_outcome,
      delta = v_delta,
      before_effect_payload = v_before,
      after_effect_payload = v_after,
      completed_at = now()
    where id = v_project.id;
  end loop;

  update public.equipment_partner_offers
  set status = 'expired'
  where contract_id = v_contract.id
    and status = 'open'
    and expires_on < v_context.calendar_date;

  if not exists (
    select 1
    from public.equipment_partner_offer_rolls
    where contract_id = v_contract.id
      and rolled_on = v_context.calendar_date
  ) then
    v_offer_id := null;
    v_offer_item_id := null;

    if random() < 0.1 then
      select product.equipment_item_id
      into v_offer_item_id
      from public.equipment_partner_products as product
      where product.supplier_key = v_contract.supplier_key
        and product.offer_type = 'rare'
        and not exists (
          select 1
          from public.equipment_partner_offers as previous_offer
          where previous_offer.contract_id = v_contract.id
            and previous_offer.equipment_item_id = product.equipment_item_id
        )
      order by random()
      limit 1;
    end if;

    if v_offer_item_id is not null then
      insert into public.equipment_partner_offers (
        contract_id,
        equipment_item_id,
        offered_on,
        expires_on
      )
      values (
        v_contract.id,
        v_offer_item_id,
        v_context.calendar_date,
        v_context.calendar_date + 3
      )
      returning id into v_offer_id;
    end if;

    insert into public.equipment_partner_offer_rolls (
      contract_id,
      rolled_on,
      offer_id
    )
    values (
      v_contract.id,
      v_context.calendar_date,
      v_offer_id
    )
    on conflict (contract_id, rolled_on) do nothing;
  end if;
end;
$$;

create or replace function public.start_equipment_partner_rnd(
  p_equipment_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_contract record;
  v_product record;
  v_effect record;
  v_project_id uuid;
begin
  perform public.sync_current_team_equipment_partner();

  select
    assignment.team_id,
    season.game_year,
    team_season.id as team_season_id,
    season_day.calendar_date
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  select contract.id, contract.supplier_key, end_season.ends_on as contract_ends_on
  into v_contract
  from public.equipment_partner_contracts as contract
  join public.seasons as start_season on start_season.id = contract.start_season_id
  join public.seasons as end_season on end_season.id = contract.end_season_id
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and v_context.game_year between start_season.game_year and end_season.game_year
  limit 1
  for update of contract;

  if v_contract is null then
    raise exception 'Aucun contrat équipementier actif ne permet de lancer une recherche.';
  end if;

  select product.research_rating_key
  into v_product
  from public.equipment_partner_products as product
  where product.supplier_key = v_contract.supplier_key
    and product.equipment_item_id = p_equipment_item_id;

  if v_product is null then
    raise exception 'Ce matériel ne fait pas partie de la gamme de votre équipementier.';
  end if;


  if not exists (
    select 1
    from public.team_equipment_inventory as inventory
    where inventory.team_season_id = v_context.team_season_id
      and inventory.equipment_item_id = p_equipment_item_id
      and inventory.quantity > 0
  ) then
    raise exception 'Ce prototype doit être reçu avant de pouvoir entrer en R&D.';
  end if;
  select effect.*
  into v_effect
  from public.equipment_partner_item_effects as effect
  where effect.contract_id = v_contract.id
    and effect.equipment_item_id = p_equipment_item_id;

  if v_effect is null then
    raise exception 'Les données de recherche de ce matériel sont indisponibles.';
  end if;

  if exists (
    select 1
    from public.equipment_partner_rnd_projects
    where contract_id = v_contract.id
      and status = 'in_progress'
  ) then
    raise exception 'Un seul projet R&D peut être mené à la fois.';
  end if;
  if v_context.calendar_date + 3 > v_contract.contract_ends_on then
    raise exception 'Le contrat se termine avant la fin de ce cycle R&D.';
  end if;


  insert into public.equipment_partner_rnd_projects (
    contract_id,
    equipment_item_id,
    research_rating_key,
    started_on,
    completes_on,
    before_effect_payload
  )
  values (
    v_contract.id,
    p_equipment_item_id,
    v_product.research_rating_key,
    v_context.calendar_date,
    v_context.calendar_date + 3,
    v_effect.effect_payload
  )
  returning id into v_project_id;

  return v_project_id;
end;
$$;

create or replace function public.claim_equipment_partner_offer(
  p_offer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_offer record;
  v_inventory_id uuid;
begin
  perform public.sync_current_team_equipment_partner();

  select
    assignment.team_id,
    team_season.id as team_season_id,
    season_day.calendar_date
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  select offer.*
  into v_offer
  from public.equipment_partner_offers as offer
  join public.equipment_partner_contracts as contract
    on contract.id = offer.contract_id
   and contract.team_id = v_context.team_id
   and contract.status = 'active'
  where offer.id = p_offer_id
  for update of offer;

  if v_offer is null then
    raise exception 'Cette proposition de matériel est introuvable.';
  end if;

  if v_offer.status <> 'open' or v_offer.expires_on < v_context.calendar_date then
    raise exception 'Cette proposition n’est plus disponible.';
  end if;

  update public.equipment_partner_offers
  set
    status = 'claimed',
    claimed_at = now()
  where id = v_offer.id;

  insert into public.team_equipment_inventory (
    team_season_id,
    equipment_item_id,
    quantity,
    last_purchase_price
  )
  values (
    v_context.team_season_id,
    v_offer.equipment_item_id,
    35,
    0
  )
  on conflict (team_season_id, equipment_item_id) do update set
    quantity = greatest(public.team_equipment_inventory.quantity, 35),
    last_purchase_price = 0,
    updated_at = now()
  returning id into v_inventory_id;

  return v_inventory_id;
end;
$$;

create or replace function public.purchase_current_team_equipment(
  p_equipment_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_item record;
  v_inventory_id uuid;
  v_purchase_id uuid := gen_random_uuid();
begin
  perform public.settle_current_team_finances();

  select
    team_season.id as team_season_id,
    team_season.cash_balance,
    season.current_day_number,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
  limit 1
  for update of team_season;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select id, name, price
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active'
    and acquisition_channel = 'commercial'
  for share;

  if v_item is null then
    raise exception 'Cette référence de matériel est indisponible à l’achat.';
  end if;

  if v_context.cash_balance <= 0 or v_context.cash_balance < v_item.price then
    raise exception 'Trésorerie insuffisante pour acheter ce matériel.';
  end if;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  )
  values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -v_item.price,
    'equipment',
    'posted',
    'Achat matériel : ' || v_item.name,
    'equipment-purchase:' || v_purchase_id::text,
    now()
  );

  update public.team_seasons
  set cash_balance = cash_balance - v_item.price
  where id = v_context.team_season_id;

  insert into public.team_equipment_inventory (
    team_season_id,
    equipment_item_id,
    quantity,
    last_purchase_price
  )
  values (v_context.team_season_id, v_item.id, 1, v_item.price)
  on conflict (team_season_id, equipment_item_id) do update set
    quantity = public.team_equipment_inventory.quantity + 1,
    last_purchase_price = excluded.last_purchase_price,
    updated_at = now()
  returning id into v_inventory_id;

  return v_inventory_id;
end;
$$;

drop function if exists public.get_race_edition_engaged_riders(uuid);
create function public.get_race_edition_engaged_riders(
  p_race_edition_id uuid
)
returns table (
  race_edition_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_id uuid,
  team_name text,
  team_primary_color text,
  team_secondary_color text,
  age integer,
  form integer,
  race_role text,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer,
  equipment_effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    rider.id,
    rider.first_name,
    rider.last_name,
    team.id,
    team_season.display_name,
    coalesce(team.amateur_jersey_primary_color, '#176951'),
    coalesce(team.amateur_jersey_secondary_color, '#FFFDF4'),
    coalesce(rating.age, 25)::integer,
    coalesce(roster.starting_form, condition.form, 75)::integer,
    roster.race_role,
    coalesce(rating.mountain, 50)::integer,
    coalesce(rating.hills, 50)::integer,
    coalesce(rating.flat, 50)::integer,
    coalesce(rating.time_trial, 50)::integer,
    coalesce(rating.cobbles, 50)::integer,
    coalesce(rating.sprint, 50)::integer,
    coalesce(rating.acceleration, 50)::integer,
    coalesce(rating.downhill, 50)::integer,
    coalesce(rating.endurance, 50)::integer,
    coalesce(rating.resistance, 50)::integer,
    coalesce(rating.recovery, 50)::integer,
    coalesce(rating.breakaway, 50)::integer,
    coalesce(rating.prologue, 50)::integer,
    coalesce(equipment.effects, '[]'::jsonb)
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.teams as team
    on team.id = team_season.team_id
  join public.riders as rider
    on rider.id = roster.rider_id
  left join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = edition.season_id
  left join lateral (
    select state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
     and condition_day.season_id = edition.season_id
    where state.rider_id = rider.id
      and condition_day.day_number <= coalesce(season.current_day_number, 28)
    order by condition_day.day_number desc
    limit 1
  ) as condition on true
  left join lateral (
    select jsonb_agg(resolved.effect_payload order by resolved.slot_type) as effects
    from (
      select
        assignment.slot_type,
        case
          when item.acquisition_channel = 'commercial' then item.effect_payload
          else partner_effect.effect_payload
        end as effect_payload
      from public.rider_equipment_assignments as assignment
      join public.equipment_catalog_items as item
        on item.id = assignment.equipment_item_id
       and item.status = 'active'
      left join lateral (
        select effect.effect_payload
        from public.equipment_partner_item_effects as effect
        join public.equipment_partner_contracts as contract
          on contract.id = effect.contract_id
         and contract.team_id = team.id
         and contract.supplier_key = item.supplier_key
         and contract.status = 'active'
        join public.seasons as contract_start
          on contract_start.id = contract.start_season_id
        join public.seasons as contract_end
          on contract_end.id = contract.end_season_id
        where effect.equipment_item_id = item.id
          and season.game_year between contract_start.game_year and contract_end.game_year
        limit 1
      ) as partner_effect on true
      where assignment.rider_id = rider.id
        and (
          item.acquisition_channel = 'commercial'
          or partner_effect.effect_payload is not null
        )
    ) as resolved
  ) as equipment on true
  where edition.id = p_race_edition_id
    and edition.status <> 'cancelled'
  order by
    team_season.display_name,
    roster.bib_number nulls last,
    rider.last_name,
    rider.first_name;
$$;

alter table public.equipment_partner_contracts enable row level security;
alter table public.equipment_partner_products enable row level security;
alter table public.equipment_partner_item_effects enable row level security;
alter table public.equipment_partner_rnd_projects enable row level security;
alter table public.equipment_partner_offers enable row level security;
alter table public.equipment_partner_offer_rolls enable row level security;

grant select on table
  public.equipment_partner_contracts,
  public.equipment_partner_products,
  public.equipment_partner_item_effects,
  public.equipment_partner_rnd_projects,
  public.equipment_partner_offers,
  public.equipment_partner_offer_rolls
to service_role;

revoke all on function public.sign_equipment_partner_contract(text) from public, anon;
revoke all on function public.sync_current_team_equipment_partner() from public, anon;
revoke all on function public.start_equipment_partner_rnd(uuid) from public, anon;
revoke all on function public.claim_equipment_partner_offer(uuid) from public, anon;
revoke all on function public.get_race_edition_engaged_riders(uuid) from public, anon;

grant execute on function public.sign_equipment_partner_contract(text) to authenticated, service_role;
grant execute on function public.sync_current_team_equipment_partner() to authenticated, service_role;
grant execute on function public.start_equipment_partner_rnd(uuid) to authenticated, service_role;
grant execute on function public.claim_equipment_partner_offer(uuid) to authenticated, service_role;
grant execute on function public.get_race_edition_engaged_riders(uuid) to authenticated, service_role;

comment on table public.equipment_partner_contracts is
  'Contrats équipementiers irrévocables de deux saisons, sans prolongation avec la même marque.';
comment on table public.equipment_partner_item_effects is
  'Effets personnalisés de la gamme partenaire ; les avancées R&D restent attachées au contrat.';
comment on table public.equipment_partner_rnd_projects is
  'Recherches R&D séquentielles avec une chance sur deux d’améliorer ou de dégrader la pièce.';
comment on table public.equipment_partner_offers is
  'Propositions rares de matériel partenaire hors cadre et roues de la dotation principale.';

commit;
