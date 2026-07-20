-- ============================================================
-- CYCLING MANAGER
-- Catalogue commercial, inventaire et équipement des coureurs
-- ============================================================

begin;

alter table public.equipment_catalog_items
  drop constraint if exists equipment_catalog_items_slot_allowed;

alter table public.rider_equipment_assignments
  drop constraint if exists rider_equipment_assignments_slot_allowed;

update public.equipment_catalog_items
set slot_type = 'rear_wheel'
where slot_type = 'wheels';

update public.rider_equipment_assignments
set slot_type = 'rear_wheel'
where slot_type = 'wheels';

alter table public.equipment_catalog_items
  add column if not exists supplier_key text not null default 'legacy',
  add column if not exists supplier_name text not null default 'Fournisseur historique',
  add column if not exists description text not null default '',
  add column if not exists price numeric(12, 2) not null default 0,
  add column if not exists rarity text not null default 'common',
  add column if not exists image_path text not null default '/images/equipment/suppliers/echelon-cycles.webp',
  add column if not exists effect_summary text not null default '',
  add column if not exists effect_payload jsonb not null default '{}'::jsonb;

alter table public.equipment_catalog_items
  add constraint equipment_catalog_items_slot_allowed
    check (slot_type in (
      'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
      'front_wheel', 'rear_wheel', 'frame'
    )),
  add constraint equipment_catalog_items_price_non_negative
    check (price >= 0),
  add constraint equipment_catalog_items_rarity_allowed
    check (rarity in ('common', 'performance', 'premium')),
  add constraint equipment_catalog_items_effect_payload_object
    check (jsonb_typeof(effect_payload) = 'object');

alter table public.rider_equipment_assignments
  add constraint rider_equipment_assignments_slot_allowed
    check (slot_type in (
      'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
      'front_wheel', 'rear_wheel', 'frame'
    ));

create table public.team_equipment_inventory (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete restrict,
  quantity integer not null default 1,
  last_purchase_price numeric(12, 2) not null,
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_equipment_inventory_quantity_positive check (quantity > 0),
  constraint team_equipment_inventory_price_non_negative check (last_purchase_price >= 0),
  constraint team_equipment_inventory_unique unique (team_season_id, equipment_item_id)
);

create index team_equipment_inventory_team_idx
  on public.team_equipment_inventory (team_season_id);

create table public.rider_equipment_pending_assignments (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  slot_type text not null,
  equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete restrict,
  requested_at timestamptz not null default now(),
  effective_at timestamptz not null,
  constraint rider_equipment_pending_slot_allowed check (slot_type in (
    'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
    'front_wheel', 'rear_wheel', 'frame'
  )),
  constraint rider_equipment_pending_unique unique (rider_id, slot_type)
);

create index rider_equipment_pending_due_idx
  on public.rider_equipment_pending_assignments (team_season_id, effective_at);

create trigger enforce_pending_equipment_assignment_slot
before insert or update of slot_type, equipment_item_id
on public.rider_equipment_pending_assignments
for each row execute function public.enforce_equipment_assignment_slot();

insert into public.equipment_catalog_items (
  catalog_key, name, slot_type, status, supplier_key, supplier_name,
  description, price, rarity, image_path, effect_summary, effect_payload
)
select * from (values
  ('aerion-stratos-s1', 'Stratos Route S1', 'helmet', 'active', 'aerion-forge', 'Aerion Forge', 'Casque ventilé polyvalent pour les courses en ligne.', 1800, 'common', '/images/equipment/suppliers/aerion-forge.webp', 'Réduit de 6 % le risque de blessure avec abandon après une chute.', '{"injuryRiskReductionPct":6}'::jsonb),
  ('aerion-stratos-pro', 'Stratos Route Pro', 'helmet', 'active', 'aerion-forge', 'Aerion Forge', 'Coque renforcée et canalisation d’air optimisée.', 4800, 'performance', '/images/equipment/suppliers/aerion-forge.webp', 'Réduit de 12 % le risque de blessure avec abandon après une chute.', '{"injuryRiskReductionPct":12}'::jsonb),
  ('aerion-vortex-tt', 'Vortex TT', 'helmet', 'active', 'aerion-forge', 'Aerion Forge', 'Casque long profil exclusivement pensé pour les chronos et prologues.', 9000, 'premium', '/images/equipment/suppliers/aerion-forge.webp', '+2 CLM, +2 PRL, +1 END et +1 ACC pendant les chronos.', '{"injuryRiskReductionPct":4,"timeTrialRatingBonuses":{"timeTrial":2,"prologue":2,"endurance":1,"acceleration":1}}'::jsonb),
  ('aerion-prism-clearline', 'Prism Clearline', 'glasses', 'active', 'aerion-forge', 'Aerion Forge', 'Écran haute définition pour mieux lire les trajectoires.', 900, 'common', '/images/equipment/suppliers/aerion-forge.webp', '+1 DES.', '{"ratingBonuses":{"downhill":1}}'::jsonb),
  ('aerion-prism-horizon', 'Prism Horizon', 'glasses', 'active', 'aerion-forge', 'Aerion Forge', 'Vision périphérique étendue pour les changements de rythme.', 2300, 'performance', '/images/equipment/suppliers/aerion-forge.webp', '+1 DES et +1 ACC.', '{"ratingBonuses":{"downhill":1,"acceleration":1}}'::jsonb),
  ('aerion-prism-aeroshade', 'Prism AeroShade', 'glasses', 'active', 'aerion-forge', 'Aerion Forge', 'Monture carénée et écran photochromique haute vitesse.', 5200, 'premium', '/images/equipment/suppliers/aerion-forge.webp', '+1 PLA, +1 CLM et +1 ACC.', '{"ratingBonuses":{"flat":1,"timeTrial":1,"acceleration":1}}'::jsonb),

  ('montclair-grip-one', 'Grip One', 'gloves', 'active', 'montclair-performance', 'Montclair Performance', 'Gants sobres pour les premières échappées remarquées.', 700, 'common', '/images/equipment/suppliers/montclair-performance.webp', '+0,05 réputation en échappée et lors d’une victoire.', '{"breakawayReputationBonus":0.05,"victoryReputationBonus":0.05}'::jsonb),
  ('montclair-echappee-signature', 'Échappée Signature', 'gloves', 'active', 'montclair-performance', 'Montclair Performance', 'Finition contrastée appréciée des caméras de course.', 1900, 'performance', '/images/equipment/suppliers/montclair-performance.webp', '+0,10 réputation en échappée et lors d’une victoire.', '{"breakawayReputationBonus":0.1,"victoryReputationBonus":0.1}'::jsonb),
  ('montclair-podium-atelier', 'Podium Atelier', 'gloves', 'active', 'montclair-performance', 'Montclair Performance', 'Modèle prestige à forte signature visuelle.', 4200, 'premium', '/images/equipment/suppliers/montclair-performance.webp', '+0,15 réputation en échappée et +0,20 lors d’une victoire.', '{"breakawayReputationBonus":0.15,"victoryReputationBonus":0.2}'::jsonb),
  ('montclair-endurance-core', 'Endurance Core', 'bib_shorts', 'active', 'montclair-performance', 'Montclair Performance', 'Cuissard confortable et discret pour les longues journées.', 1100, 'common', '/images/equipment/suppliers/montclair-performance.webp', '+0,05 réputation en échappée et lors d’une victoire.', '{"breakawayReputationBonus":0.05,"victoryReputationBonus":0.05}'::jsonb),
  ('montclair-panache-race', 'Panache Race', 'bib_shorts', 'active', 'montclair-performance', 'Montclair Performance', 'Coupe course reconnaissable au premier regard.', 3000, 'performance', '/images/equipment/suppliers/montclair-performance.webp', '+0,10 réputation en échappée et +0,15 lors d’une victoire.', '{"breakawayReputationBonus":0.1,"victoryReputationBonus":0.15}'::jsonb),
  ('montclair-victoire-atelier', 'Victoire Atelier', 'bib_shorts', 'active', 'montclair-performance', 'Montclair Performance', 'Pièce premium destinée aux leaders les plus exposés.', 6500, 'premium', '/images/equipment/suppliers/montclair-performance.webp', '+0,20 réputation en échappée et +0,25 lors d’une victoire.', '{"breakawayReputationBonus":0.2,"victoryReputationBonus":0.25}'::jsonb),
  ('montclair-alpine-lace', 'Alpine Lace', 'shoes', 'active', 'montclair-performance', 'Montclair Performance', 'Chaussure légère à semelle souple pour les cols.', 2800, 'common', '/images/equipment/suppliers/montclair-performance.webp', '+1 MON.', '{"ratingBonuses":{"mountain":1}}'::jsonb),
  ('montclair-ardenne-pulse', 'Ardenne Pulse', 'shoes', 'active', 'montclair-performance', 'Montclair Performance', 'Transmission nerveuse pour relancer dans les bosses.', 5200, 'performance', '/images/equipment/suppliers/montclair-performance.webp', '+1 VAL et +1 ACC.', '{"ratingBonuses":{"hills":1,"acceleration":1}}'::jsonb),
  ('montclair-chronos-blade', 'Chronos Blade', 'shoes', 'active', 'montclair-performance', 'Montclair Performance', 'Semelle carbone rigide et empeigne lissée pour l’aérodynamisme.', 9600, 'premium', '/images/equipment/suppliers/montclair-performance.webp', '+2 CLM, +1 PRL et +1 PLA.', '{"ratingBonuses":{"timeTrial":2,"prologue":1,"flat":1}}'::jsonb),

  ('novaspoke-vent-28', 'Vent 28', 'front_wheel', 'active', 'novaspoke-engineering', 'NovaSpoke Engineering', 'Roue avant vive et rassurante sur routes sinueuses.', 5200, 'common', '/images/equipment/suppliers/novaspoke-engineering.webp', '+1 VAL et +1 DES.', '{"ratingBonuses":{"hills":1,"downhill":1}}'::jsonb),
  ('novaspoke-aero-50', 'Aero 50', 'front_wheel', 'active', 'novaspoke-engineering', 'NovaSpoke Engineering', 'Profil médian rapide pour les classiques roulantes.', 11800, 'performance', '/images/equipment/suppliers/novaspoke-engineering.webp', '+2 PLA et +1 CLM.', '{"ratingBonuses":{"flat":2,"timeTrial":1}}'::jsonb),
  ('novaspoke-pave-35', 'Pavé 35', 'front_wheel', 'active', 'novaspoke-engineering', 'NovaSpoke Engineering', 'Montage renforcé pour absorber les secteurs cassants.', 15800, 'premium', '/images/equipment/suppliers/novaspoke-engineering.webp', '+2 PAV et +1 RES.', '{"ratingBonuses":{"cobbles":2,"resistance":1}}'::jsonb),
  ('novaspoke-sprint-65', 'Sprint 65', 'rear_wheel', 'active', 'novaspoke-engineering', 'NovaSpoke Engineering', 'Jante haute pour conserver la vitesse dans les emballages.', 8200, 'common', '/images/equipment/suppliers/novaspoke-engineering.webp', '+1 SPR, +1 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":1,"acceleration":1,"flat":1}}'::jsonb),
  ('novaspoke-disc-vector', 'Disc Vector', 'rear_wheel', 'active', 'novaspoke-engineering', 'NovaSpoke Engineering', 'Roue lenticulaire radicale réservée aux chronos.', 22000, 'premium', '/images/equipment/suppliers/novaspoke-engineering.webp', '+3 CLM, +2 PRL et +1 PLA.', '{"ratingBonuses":{"timeTrial":3,"prologue":2,"flat":1}}'::jsonb),
  ('novaspoke-climb-feather', 'Climb Feather', 'rear_wheel', 'active', 'novaspoke-engineering', 'NovaSpoke Engineering', 'Montage plume pour accélérer dans les pentes.', 15000, 'performance', '/images/equipment/suppliers/novaspoke-engineering.webp', '+2 MON et +1 VAL.', '{"ratingBonuses":{"mountain":2,"hills":1}}'::jsonb),

  ('echelon-altitude-rs', 'Altitude RS', 'frame', 'active', 'echelon-cycles', 'Échelon Cycles', 'Cadre léger et précis pour les parcours verticaux.', 12000, 'common', '/images/equipment/suppliers/echelon-cycles.webp', '+2 MON, +1 VAL et +1 DES.', '{"ratingBonuses":{"mountain":2,"hills":1,"downhill":1}}'::jsonb),
  ('echelon-vitesse-aero', 'Vitesse Aero', 'frame', 'active', 'echelon-cycles', 'Échelon Cycles', 'Plateforme rigide et profilée pour les courses rapides.', 26000, 'performance', '/images/equipment/suppliers/echelon-cycles.webp', '+3 PLA, +2 CLM et +1 SPR.', '{"ratingBonuses":{"flat":3,"timeTrial":2,"sprint":1}}'::jsonb),
  ('echelon-grand-tour-one', 'Grand Tour One', 'frame', 'active', 'echelon-cycles', 'Échelon Cycles', 'Cadre complet conçu pour durer trois semaines sans faiblesse.', 34000, 'premium', '/images/equipment/suppliers/echelon-cycles.webp', '+3 END, +2 REC, +1 MON, +1 VAL et +1 RES.', '{"ratingBonuses":{"endurance":3,"recovery":2,"mountain":1,"hills":1,"resistance":1}}'::jsonb)
) as catalog(
  catalog_key, name, slot_type, status, supplier_key, supplier_name,
  description, price, rarity, image_path, effect_summary, effect_payload
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
  updated_at = now();

create or replace function public.settle_due_equipment_assignments(
  p_team_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending record;
  v_settled integer := 0;
begin
  for v_pending in
    select pending.*
    from public.rider_equipment_pending_assignments as pending
    where pending.team_season_id = p_team_season_id
      and pending.effective_at <= now()
    order by pending.effective_at, pending.requested_at, pending.id
  loop
    insert into public.rider_equipment_assignments (
      rider_id, slot_type, equipment_item_id, equipped_at
    )
    values (
      v_pending.rider_id,
      v_pending.slot_type,
      v_pending.equipment_item_id,
      v_pending.effective_at
    )
    on conflict (rider_id, slot_type) do update set
      equipment_item_id = excluded.equipment_item_id,
      equipped_at = excluded.equipped_at;

    delete from public.rider_equipment_pending_assignments
    where id = v_pending.id;

    v_settled := v_settled + 1;
  end loop;

  return v_settled;
end;
$$;

create or replace function public.settle_current_team_equipment()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_season_id uuid;
begin
  select team_season.id
  into v_team_season_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
    and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
  limit 1;

  if v_team_season_id is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  return public.settle_due_equipment_assignments(v_team_season_id);
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
  for share;

  if v_item is null then
    raise exception 'Cette référence de matériel est indisponible.';
  end if;

  if v_context.cash_balance <= 0 or v_context.cash_balance < v_item.price then
    raise exception 'Trésorerie insuffisante pour acheter ce matériel.';
  end if;

  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
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
    team_season_id, equipment_item_id, quantity, last_purchase_price
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

create or replace function public.equip_current_team_rider(
  p_rider_id uuid,
  p_slot_type text,
  p_equipment_item_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_item record;
  v_owned integer;
  v_used integer;
  v_current_item_id uuid;
  v_effective_at timestamptz;
  v_before_cutoff boolean;
begin
  if p_slot_type not in (
    'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
    'front_wheel', 'rear_wheel', 'frame'
  ) then
    raise exception 'Emplacement de matériel invalide.';
  end if;

  select team_season.id as team_season_id, team_season.team_id
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
  where director.auth_user_id = auth.uid()
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform public.settle_due_equipment_assignments(v_context.team_season_id);

  if not exists (
    select 1
    from public.rider_contracts
    where rider_id = p_rider_id
      and team_id = v_context.team_id
      and status = 'active'
  ) then
    raise exception 'Vous ne pouvez équiper que les coureurs de votre équipe.';
  end if;

  select id, slot_type
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
    where rider_id = p_rider_id and slot_type = p_slot_type;
    return now();
  end if;

  select coalesce(quantity, 0)
  into v_owned
  from public.team_equipment_inventory
  where team_season_id = v_context.team_season_id
    and equipment_item_id = p_equipment_item_id;

  select
    (
      select count(*)
      from public.rider_equipment_assignments as equipped
      join public.rider_contracts as contract
        on contract.rider_id = equipped.rider_id
        and contract.team_id = v_context.team_id
        and contract.status = 'active'
      where equipped.equipment_item_id = p_equipment_item_id
    ) + (
      select count(*)
      from public.rider_equipment_pending_assignments as pending
      where pending.team_season_id = v_context.team_season_id
        and pending.equipment_item_id = p_equipment_item_id
        and not (
          pending.rider_id = p_rider_id
          and pending.slot_type = p_slot_type
        )
    )
  into v_used;

  if coalesce(v_owned, 0) <= coalesce(v_used, 0) then
    raise exception 'Tous les exemplaires de cette référence sont déjà attribués.';
  end if;

  v_before_cutoff := (now() at time zone 'Europe/Paris')::time < time '12:00';

  if v_before_cutoff then
    v_effective_at := now();

    insert into public.rider_equipment_assignments (
      rider_id, slot_type, equipment_item_id, equipped_at
    )
    values (p_rider_id, p_slot_type, p_equipment_item_id, v_effective_at)
    on conflict (rider_id, slot_type) do update set
      equipment_item_id = excluded.equipment_item_id,
      equipped_at = excluded.equipped_at;

    delete from public.rider_equipment_pending_assignments
    where rider_id = p_rider_id and slot_type = p_slot_type;
  else
    v_effective_at := (
      ((now() at time zone 'Europe/Paris')::date + 1) + time '12:00'
    ) at time zone 'Europe/Paris';

    insert into public.rider_equipment_pending_assignments (
      team_season_id, rider_id, slot_type, equipment_item_id, effective_at
    )
    values (
      v_context.team_season_id,
      p_rider_id,
      p_slot_type,
      p_equipment_item_id,
      v_effective_at
    )
    on conflict (rider_id, slot_type) do update set
      team_season_id = excluded.team_season_id,
      equipment_item_id = excluded.equipment_item_id,
      requested_at = now(),
      effective_at = excluded.effective_at;
  end if;

  return v_effective_at;
end;
$$;

alter table public.team_equipment_inventory enable row level security;
alter table public.rider_equipment_pending_assignments enable row level security;

grant select on table
  public.equipment_catalog_items,
  public.rider_equipment_assignments,
  public.team_equipment_inventory,
  public.rider_equipment_pending_assignments
to service_role;

grant all privileges on table
  public.team_equipment_inventory,
  public.rider_equipment_pending_assignments
to service_role;

revoke all on function public.settle_due_equipment_assignments(uuid) from public;
grant execute on function public.settle_due_equipment_assignments(uuid) to service_role;

revoke all on function public.settle_current_team_equipment() from public;
grant execute on function public.settle_current_team_equipment() to authenticated;

revoke all on function public.purchase_current_team_equipment(uuid) from public;
grant execute on function public.purchase_current_team_equipment(uuid) to authenticated;

revoke all on function public.equip_current_team_rider(uuid, text, uuid) from public;
grant execute on function public.equip_current_team_rider(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
