begin;

-- Une offre fédérale est un paquet commercial indivisible. Le contrat en
-- conserve une copie immuable afin qu'une évolution future du catalogue ne
-- modifie jamais rétroactivement une saison déjà commencée.
create table public.national_federation_equipment_offers (
  offer_key text primary key,
  supplier_key text not null
    references public.equipment_suppliers(supplier_key) on delete restrict,
  name text not null,
  description text not null,
  season_price numeric(14, 2) not null check (season_price > 0),
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_federation_equipment_offers_text_present check (
    btrim(offer_key) <> '' and btrim(name) <> '' and btrim(description) <> ''
  )
);

create table public.national_federation_equipment_offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_key text not null
    references public.national_federation_equipment_offers(offer_key)
    on delete cascade,
  slot_type text not null check (
    slot_type in (
      'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
      'front_wheel', 'rear_wheel', 'frame'
    )
  ),
  equipment_name text not null,
  effect_summary text not null,
  effect_payload jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  constraint national_federation_equipment_offer_items_slot_unique
    unique (offer_key, slot_type),
  constraint national_federation_equipment_offer_items_text_present check (
    btrim(equipment_name) <> '' and btrim(effect_summary) <> ''
  ),
  constraint national_federation_equipment_offer_items_payload_object check (
    jsonb_typeof(effect_payload) = 'object'
  )
);

create table public.national_federation_equipment_contracts (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  offer_key text not null
    references public.national_federation_equipment_offers(offer_key)
    on delete restrict,
  supplier_key text not null
    references public.equipment_suppliers(supplier_key) on delete restrict,
  offer_name text not null,
  price_paid numeric(14, 2) not null check (price_paid > 0),
  signed_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  signed_at timestamptz not null default now(),
  constraint national_federation_equipment_contracts_country_season_unique
    unique (country_id, season_id)
);

create table public.national_federation_equipment_contract_items (
  contract_id uuid not null
    references public.national_federation_equipment_contracts(id)
    on delete cascade,
  slot_type text not null,
  equipment_name text not null,
  effect_summary text not null,
  effect_payload jsonb not null,
  display_order integer not null default 0,
  primary key (contract_id, slot_type),
  constraint national_federation_equipment_contract_items_payload_object check (
    jsonb_typeof(effect_payload) = 'object'
  )
);

create index national_federation_equipment_contracts_season_country_idx
  on public.national_federation_equipment_contracts (season_id, country_id);

alter table public.national_federation_equipment_offers enable row level security;
alter table public.national_federation_equipment_offer_items enable row level security;
alter table public.national_federation_equipment_contracts enable row level security;
alter table public.national_federation_equipment_contract_items enable row level security;

create policy national_federation_equipment_offers_select_authenticated
  on public.national_federation_equipment_offers
  for select to authenticated using (true);
create policy national_federation_equipment_offer_items_select_authenticated
  on public.national_federation_equipment_offer_items
  for select to authenticated using (true);
create policy national_federation_equipment_contracts_select_authenticated
  on public.national_federation_equipment_contracts
  for select to authenticated using (true);
create policy national_federation_equipment_contract_items_select_authenticated
  on public.national_federation_equipment_contract_items
  for select to authenticated using (true);

grant select on public.national_federation_equipment_offers,
  public.national_federation_equipment_offer_items,
  public.national_federation_equipment_contracts,
  public.national_federation_equipment_contract_items to authenticated;
grant all on public.national_federation_equipment_offers,
  public.national_federation_equipment_offer_items,
  public.national_federation_equipment_contracts,
  public.national_federation_equipment_contract_items to service_role;

insert into public.national_federation_equipment_offers (
  offer_key, supplier_key, name, description, season_price, display_order
) values
  ('axiom-union-national', 'axiom-allroad', 'Union National',
    'La dotation polyvalente et financièrement prudente pour couvrir tous les rendez-vous internationaux.', 600000, 10),
  ('meridian-horizon-national', 'meridian-endurance', 'Horizon Endurance',
    'Un ensemble régulier pour les longues distances et les championnats disputés sur plusieurs fronts.', 760000, 20),
  ('sylva-canopy-national', 'sylva-dynamics', 'Canopy Offensive',
    'Une offre vive pour les parcours vallonnés, les relances et les sélections qui aiment prendre la course en main.', 880000, 30),
  ('kernwerk-granit-national', 'kernwerk-cycling', 'Granit Classiques',
    'Une dotation robuste destinée aux secteurs cassants, aux pavés et aux courses d’usure.', 1020000, 40),
  ('brava-fulgor-national', 'brava-sprintworks', 'Fulgor Vitesse',
    'Un package très nerveux pour structurer un train national et convertir les finales rapides.', 1180000, 50),
  ('altura-summit-national', 'altura-forge', 'Summit Altitude',
    'Une offre premium taillée pour les grands cols, les descentes techniques et la répétition des efforts.', 1390000, 60),
  ('vektor-vector-national', 'vektor-aerolab', 'Vector Chrono',
    'La proposition la plus exclusive du marché, construite autour du rendement aérodynamique et des contre-la-montre.', 1650000, 70)
on conflict (offer_key) do update set
  supplier_key = excluded.supplier_key,
  name = excluded.name,
  description = excluded.description,
  season_price = excluded.season_price,
  display_order = excluded.display_order,
  status = 'active',
  updated_at = now();

insert into public.national_federation_equipment_offer_items (
  offer_key, slot_type, equipment_name, effect_summary, effect_payload, display_order
) values
  ('axiom-union-national', 'frame', 'Union Allroad National', '+1 PLA, +1 VAL et +1 END.', '{"ratingBonuses":{"flat":1,"hills":1,"endurance":1}}', 10),
  ('axiom-union-national', 'front_wheel', 'Union 42 avant', '+1 MON, +1 DES et +1 PAV.', '{"ratingBonuses":{"mountain":1,"downhill":1,"cobbles":1}}', 20),
  ('axiom-union-national', 'rear_wheel', 'Union 45 arrière', '+1 SPR, +1 ACC et +1 BAR.', '{"ratingBonuses":{"sprint":1,"acceleration":1,"breakaway":1}}', 30),
  ('axiom-union-national', 'gloves', 'Union Grip', '+1 RES.', '{"ratingBonuses":{"resistance":1}}', 40),

  ('meridian-horizon-national', 'frame', 'Horizon Ultra National', '+2 END, +1 REC et +1 RES.', '{"ratingBonuses":{"endurance":2,"recovery":1,"resistance":1}}', 10),
  ('meridian-horizon-national', 'front_wheel', 'Horizon 45 avant', '+1 END, +1 RES et +1 DES.', '{"ratingBonuses":{"endurance":1,"resistance":1,"downhill":1}}', 20),
  ('meridian-horizon-national', 'rear_wheel', 'Horizon 48 arrière', '+1 REC, +1 RES et +1 PLA.', '{"ratingBonuses":{"recovery":1,"resistance":1,"flat":1}}', 30),
  ('meridian-horizon-national', 'bib_shorts', 'Horizon Long Range', '+1 END.', '{"ratingBonuses":{"endurance":1}}', 40),

  ('sylva-canopy-national', 'frame', 'Canopy Attack National', '+2 VAL, +1 BAR et +1 ACC.', '{"ratingBonuses":{"hills":2,"breakaway":1,"acceleration":1}}', 10),
  ('sylva-canopy-national', 'front_wheel', 'Canopy 40 avant', '+1 VAL, +1 DES et +1 PLA.', '{"ratingBonuses":{"hills":1,"downhill":1,"flat":1}}', 20),
  ('sylva-canopy-national', 'rear_wheel', 'Canopy 44 arrière', '+1 VAL, +1 ACC et +1 BAR.', '{"ratingBonuses":{"hills":1,"acceleration":1,"breakaway":1}}', 30),
  ('sylva-canopy-national', 'glasses', 'Canopy Vision', '+1 BAR.', '{"ratingBonuses":{"breakaway":1}}', 40),

  ('kernwerk-granit-national', 'frame', 'Granit CX National', '+2 PAV, +1 RES et +1 END.', '{"ratingBonuses":{"cobbles":2,"resistance":1,"endurance":1}}', 10),
  ('kernwerk-granit-national', 'front_wheel', 'Granit 37 avant', '+1 PAV, +1 PLA et +1 DES.', '{"ratingBonuses":{"cobbles":1,"flat":1,"downhill":1}}', 20),
  ('kernwerk-granit-national', 'rear_wheel', 'Granit 39 arrière', '+1 PAV, +1 RES et +1 ACC.', '{"ratingBonuses":{"cobbles":1,"resistance":1,"acceleration":1}}', 30),
  ('kernwerk-granit-national', 'gloves', 'Granit Control', '+1 PAV.', '{"ratingBonuses":{"cobbles":1}}', 40),

  ('brava-fulgor-national', 'frame', 'Fulgor RS National', '+2 SPR, +1 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":2,"acceleration":1,"flat":1}}', 10),
  ('brava-fulgor-national', 'front_wheel', 'Fulgor 58 avant', '+1 SPR, +1 PLA et +1 DES.', '{"ratingBonuses":{"sprint":1,"flat":1,"downhill":1}}', 20),
  ('brava-fulgor-national', 'rear_wheel', 'Fulgor 68 arrière', '+1 SPR, +2 ACC.', '{"ratingBonuses":{"sprint":1,"acceleration":2}}', 30),
  ('brava-fulgor-national', 'shoes', 'Fulgor Launch', '+1 SPR.', '{"ratingBonuses":{"sprint":1}}', 40),

  ('altura-summit-national', 'frame', 'Summit SL National', '+2 MON, +1 END et +1 REC.', '{"ratingBonuses":{"mountain":2,"endurance":1,"recovery":1}}', 10),
  ('altura-summit-national', 'front_wheel', 'Summit 28 avant', '+1 MON, +1 DES et +1 VAL.', '{"ratingBonuses":{"mountain":1,"downhill":1,"hills":1}}', 20),
  ('altura-summit-national', 'rear_wheel', 'Summit 31 arrière', '+1 MON, +1 REC et +1 ACC.', '{"ratingBonuses":{"mountain":1,"recovery":1,"acceleration":1}}', 30),
  ('altura-summit-national', 'shoes', 'Summit Climb', '+1 MON.', '{"ratingBonuses":{"mountain":1}}', 40),

  ('vektor-vector-national', 'frame', 'Vector TT-X National', '+2 CLM, +1 PLA et +1 PRL.', '{"ratingBonuses":{"timeTrial":2,"flat":1,"prologue":1}}', 10),
  ('vektor-vector-national', 'front_wheel', 'Vector 64 avant', '+1 CLM, +1 PLA et +1 DES.', '{"ratingBonuses":{"timeTrial":1,"flat":1,"downhill":1}}', 20),
  ('vektor-vector-national', 'rear_wheel', 'Vector Disc arrière', '+2 CLM, +1 PLA et +1 END.', '{"ratingBonuses":{"timeTrial":2,"flat":1,"endurance":1}}', 30),
  ('vektor-vector-national', 'helmet', 'Vector Aero Helmet', '+1 CLM sur les chronos.', '{"timeTrialRatingBonuses":{"timeTrial":1}}', 40)
on conflict (offer_key, slot_type) do update set
  equipment_name = excluded.equipment_name,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  display_order = excluded.display_order;

alter table public.national_federation_transactions
  drop constraint if exists national_federation_transactions_category_allowed;
alter table public.national_federation_transactions
  add constraint national_federation_transactions_category_allowed check (
    category in (
      'opening_grant', 'race_revenue', 'objective_bonus', 'donation',
      'solidarity', 'infrastructure', 'refund', 'hosting',
      'race_creation', 'race_maintenance', 'equipment'
    )
  );

create or replace function public.choose_national_federation_equipment_offer(
  p_country_code text,
  p_offer_key text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_context record;
  v_offer public.national_federation_equipment_offers%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_contract_id uuid;
begin
  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as day_number,
    team_season.registration_country_id as country_id,
    country.iso_alpha2 as country_code
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
  join public.countries as country
    on country.id = team_season.registration_country_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null or upper(v_context.country_code) <> upper(btrim(p_country_code)) then
    raise exception 'Cette fédération ne correspond pas à votre équipe.';
  end if;
  if v_context.game_year < 3 then
    raise exception 'Les contrats fédéraux ouvrent à partir de la saison 3.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_context.country_id
      and term.start_game_year <= v_context.game_year
      and term.end_game_year >= v_context.game_year
      and term.president_director_id = v_context.director_id
  ) then
    raise exception 'Seul le président de la fédération peut engager ce budget.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-equipment:' || v_context.country_id::text || ':' || v_context.season_id::text,
      0
    )
  );

  if exists (
    select 1 from public.national_federation_equipment_contracts
    where country_id = v_context.country_id and season_id = v_context.season_id
  ) then
    raise exception 'L’équipementier de cette saison a déjà été choisi et ne peut plus être remplacé.';
  end if;

  select * into v_offer
  from public.national_federation_equipment_offers
  where offer_key = p_offer_key and status = 'active';
  if v_offer.offer_key is null then
    raise exception 'Cette offre équipementier n’est plus disponible.';
  end if;

  select * into v_account
  from public.national_federation_accounts
  where country_id = v_context.country_id and season_id = v_context.season_id
  for update;
  if v_account.id is null then
    raise exception 'La trésorerie fédérale de la saison n’est pas initialisée.';
  end if;
  if v_account.balance < v_offer.season_price then
    raise exception 'La trésorerie fédérale ne permet pas de financer cette offre.';
  end if;

  insert into public.national_federation_equipment_contracts (
    country_id, season_id, offer_key, supplier_key, offer_name,
    price_paid, signed_by_director_id
  ) values (
    v_context.country_id, v_context.season_id, v_offer.offer_key,
    v_offer.supplier_key, v_offer.name, v_offer.season_price,
    v_context.director_id
  ) returning id into v_contract_id;

  insert into public.national_federation_equipment_contract_items (
    contract_id, slot_type, equipment_name, effect_summary,
    effect_payload, display_order
  )
  select v_contract_id, item.slot_type, item.equipment_name,
    item.effect_summary, item.effect_payload, item.display_order
  from public.national_federation_equipment_offer_items as item
  where item.offer_key = v_offer.offer_key
  order by item.display_order, item.id;

  update public.national_federation_accounts
  set balance = balance - v_offer.season_price, updated_at = now()
  where id = v_account.id;

  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description,
    source_reference, metadata
  ) values (
    v_account.id, v_context.day_number, -v_offer.season_price, 'equipment',
    'Contrat équipementier international · ' || v_offer.name,
    'federation-equipment-contract:' || v_contract_id::text,
    jsonb_build_object(
      'contractId', v_contract_id,
      'offerKey', v_offer.offer_key,
      'supplierKey', v_offer.supplier_key
    )
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference, metadata
  ) values (
    v_context.country_id, v_context.season_id, v_context.day_number,
    'finance', 'Équipementier national choisi',
    v_offer.name || ' équipera toutes les sélections internationales professionnelles et juniors cette saison.',
    'federation-equipment-contract:' || v_contract_id::text,
    jsonb_build_object('offerKey', v_offer.offer_key, 'price', v_offer.season_price)
  );

  return v_contract_id;
end;
$$;

revoke all on function public.choose_national_federation_equipment_offer(text, text)
from public, anon;
grant execute on function public.choose_national_federation_equipment_offer(text, text)
to authenticated, service_role;

create or replace function public.get_current_federation_equipment_alert()
returns table (selection_required boolean, country_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    season.game_year >= 3
      and term.president_director_id = director.id
      and contract.id is null as selection_required,
    country.iso_alpha2::text as country_code
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.countries as country
    on country.id = team_season.registration_country_id
  left join public.national_federation_terms as term
    on term.country_id = country.id
   and term.start_game_year <= season.game_year
   and term.end_game_year >= season.game_year
  left join public.national_federation_equipment_contracts as contract
    on contract.country_id = country.id and contract.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1
$$;

revoke all on function public.get_current_federation_equipment_alert()
from public, anon;
grant execute on function public.get_current_federation_equipment_alert()
to authenticated, service_role;

-- Les tables tactiques existantes deviennent compatibles avec une inscription
-- fédérale (team_season_id nul). L'identité tactique utilisée par le moteur est
-- alors l'identifiant du pays, comme pour les coureurs en sélection.
alter table public.race_stage_strategies
  drop constraint if exists race_stage_strategies_team_id_fkey;
alter table public.race_time_trial_rider_plans
  drop constraint if exists race_time_trial_rider_plans_team_id_fkey;

create or replace function public.enforce_race_stage_strategy_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_edition_id uuid;
  v_stage_edition_id uuid;
  v_team_or_country_id uuid;
begin
  select
    registration.race_edition_id,
    stage.race_edition_id,
    coalesce(team_season.team_id, selection_list.country_id)
  into v_registration_edition_id, v_stage_edition_id, v_team_or_country_id
  from public.race_registrations as registration
  left join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  left join public.national_federation_selection_race_links as link
    on link.race_registration_id = registration.id
  left join public.national_federation_selection_lists as selection_list
    on selection_list.id = link.selection_list_id
  cross join public.stages as stage
  where registration.id = new.race_registration_id
    and stage.id = new.stage_id;

  if not found
    or v_registration_edition_id is distinct from v_stage_edition_id
    or v_team_or_country_id is null
  then
    raise exception using errcode = '23514',
      message = 'La stratégie doit appartenir à la même course que l’inscription.';
  end if;

  new.team_id := v_team_or_country_id;
  return new;
end;
$$;

create or replace function public.enforce_time_trial_rider_plan_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_edition_id uuid;
  v_stage_edition_id uuid;
  v_stage_type text;
  v_competition_type text;
  v_is_club_registration boolean;
  v_team_or_country_id uuid;
begin
  select
    registration.race_edition_id,
    stage.race_edition_id,
    stage.stage_type,
    race.competition_type,
    registration.team_season_id is not null,
    coalesce(team_season.team_id, selection_list.country_id)
  into v_registration_edition_id, v_stage_edition_id, v_stage_type,
    v_competition_type, v_is_club_registration, v_team_or_country_id
  from public.race_registrations as registration
  left join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  left join public.national_federation_selection_race_links as link
    on link.race_registration_id = registration.id
  left join public.national_federation_selection_lists as selection_list
    on selection_list.id = link.selection_list_id
  cross join public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.races as race on race.id = edition.race_id
  where registration.id = new.race_registration_id
    and stage.id = new.stage_id;

  if not found
    or v_registration_edition_id is distinct from v_stage_edition_id
    or v_team_or_country_id is null
  then
    raise exception using errcode = '23514',
      message = 'La consigne chrono doit appartenir à la même course que l’inscription.';
  end if;
  if v_stage_type not in ('individual_time_trial', 'team_time_trial', 'prologue') then
    raise exception using errcode = '23514',
      message = 'Une consigne chrono ne peut viser qu’un contre-la-montre.';
  end if;
  if v_is_club_registration and v_competition_type in (
    'continental_championship', 'world_championship', 'nations_cup'
  ) then
    raise exception using errcode = 'P0001',
      message = 'Ce contre-la-montre international est préparé par la sélection nationale.';
  end if;

  new.team_id := v_team_or_country_id;
  if v_stage_type <> 'team_time_trial' then new.relay_share_pct := null; end if;
  return new;
end;
$$;

create or replace function public.get_current_national_federation_race_preparation(
  p_country_code text
)
returns table (
  race_edition_id uuid,
  race_registration_id uuid,
  team_id uuid,
  stage_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
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
  general_role text,
  stage_role text,
  time_trial_effort text,
  relay_share_pct numeric,
  time_trial_updated_at timestamptz,
  objective text,
  collective_posture text,
  breakaway_policy text,
  chase_policy text,
  lieutenant_rider_id uuid,
  danger_pacer_rider_id uuid,
  protector_rider_id uuid,
  breakaway_rider_id uuid,
  attack_orders jsonb,
  strategy_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
  v_season_id uuid;
  v_game_year integer;
begin
  select country.id, season.id, season.game_year
  into v_country_id, v_season_id, v_game_year
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.countries as country
    on country.id = team_season.registration_country_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
    and country.iso_alpha2 = upper(btrim(p_country_code))
  limit 1;

  if v_country_id is null or v_game_year < 3 then return; end if;

  return query
  select
    link.race_edition_id,
    link.race_registration_id,
    v_country_id,
    stage.id,
    rider.id,
    rider.first_name,
    rider.last_name,
    rating.mountain::integer,
    rating.hills::integer,
    rating.flat::integer,
    rating.time_trial::integer,
    rating.cobbles::integer,
    rating.sprint::integer,
    rating.acceleration::integer,
    rating.downhill::integer,
    rating.endurance::integer,
    rating.resistance::integer,
    rating.recovery::integer,
    rating.breakaway::integer,
    rating.prologue::integer,
    roster.race_role,
    stage_role.race_role,
    time_plan.effort_mode,
    time_plan.relay_share_pct,
    time_plan.updated_at,
    coalesce(strategy.objective, 'balanced'),
    coalesce(strategy.collective_posture, 'balanced'),
    coalesce(strategy.breakaway_policy, 'opportunistic'),
    coalesce(strategy.chase_policy, 'dangerous_breakaway'),
    strategy.lieutenant_rider_id,
    strategy.danger_pacer_rider_id,
    strategy.protector_rider_id,
    strategy.breakaway_rider_id,
    coalesce(strategy.attack_orders, '[]'::jsonb),
    strategy.updated_at
  from public.national_federation_selection_lists as selection_list
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
   and slot.rider_category = 'professional'
  join public.national_federation_selection_race_links as link
    on link.selection_list_id = selection_list.id
  join public.race_editions as edition
    on edition.id = link.race_edition_id
   and edition.season_id = v_season_id
   and edition.status <> 'cancelled'
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in (
     'continental_championship', 'world_championship', 'nations_cup'
   )
  join public.stages as stage on stage.race_edition_id = edition.id
  join public.race_rosters as roster
    on roster.race_registration_id = link.race_registration_id
   and roster.status in ('selected', 'confirmed')
  join public.riders as rider on rider.id = roster.rider_id
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id and rating.season_id = v_season_id
  left join public.race_roster_stage_roles as stage_role
    on stage_role.race_registration_id = link.race_registration_id
   and stage_role.stage_id = stage.id
   and stage_role.rider_id = rider.id
  left join public.race_time_trial_rider_plans as time_plan
    on time_plan.race_registration_id = link.race_registration_id
   and time_plan.stage_id = stage.id
   and time_plan.rider_id = rider.id
  left join public.race_stage_strategies as strategy
    on strategy.race_registration_id = link.race_registration_id
   and strategy.stage_id = stage.id
  where selection_list.country_id = v_country_id
    and selection_list.season_id = v_season_id
    and selection_list.status in ('pending_confirmation', 'finalized')
    and (
      (slot.profile_label = 'Chrono'
        and stage.stage_type in ('individual_time_trial', 'team_time_trial', 'prologue'))
      or (slot.profile_label <> 'Chrono' and stage.stage_type = 'road')
      or slot.competition_code = 'nations_cup'
    )
  order by stage.departure_at, rider.last_name, rider.first_name, rider.id;
end;
$$;

revoke all
on function public.get_current_national_federation_race_preparation(text)
from public, anon;
grant execute
on function public.get_current_national_federation_race_preparation(text)
to authenticated, service_role;

create or replace function private.assert_federation_race_preparation_context(
  p_country_code text,
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_expect_time_trial boolean
)
returns table (
  director_id uuid,
  country_id uuid,
  season_id uuid,
  registration_id uuid,
  stage_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_context record;
begin
  select
    director.id as director_id,
    country.id as country_id,
    season.id as season_id,
    season.game_year,
    link.race_registration_id as registration_id,
    stage.stage_type,
    stage.departure_at,
    race.competition_type
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
  join public.countries as country
    on country.id = team_season.registration_country_id
   and country.iso_alpha2 = upper(btrim(p_country_code))
  join public.national_federation_terms as term
    on term.country_id = country.id
   and term.start_game_year <= season.game_year
   and term.end_game_year >= season.game_year
   and term.president_director_id = director.id
  join public.national_federation_selection_lists as selection_list
    on selection_list.country_id = country.id
   and selection_list.season_id = season.id
   and selection_list.status in ('pending_confirmation', 'finalized')
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
   and slot.rider_category = 'professional'
  join public.national_federation_selection_race_links as link
    on link.selection_list_id = selection_list.id
   and link.race_edition_id = p_race_edition_id
  join public.stages as stage
    on stage.id = p_stage_id
   and stage.race_edition_id = link.race_edition_id
  join public.race_editions as edition on edition.id = link.race_edition_id
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in (
     'continental_championship', 'world_championship', 'nations_cup'
   )
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  order by selection_list.updated_at desc
  limit 1;

  if v_context is null then
    raise exception 'Cette sélection internationale ne peut pas être préparée par ce compte.';
  end if;
  if v_context.game_year < 3 then
    raise exception 'La préparation fédérale ouvre à partir de la saison 3.';
  end if;
  if v_context.departure_at <= now() then
    raise exception 'Le départ est passé : les consignes sont verrouillées.';
  end if;
  if p_expect_time_trial is distinct from (
    v_context.stage_type in ('individual_time_trial', 'team_time_trial', 'prologue')
  ) then
    raise exception 'Le type de préparation ne correspond pas à cette épreuve.';
  end if;

  return query select v_context.director_id, v_context.country_id,
    v_context.season_id, v_context.registration_id, v_context.stage_type;
end;
$$;

revoke all
on function private.assert_federation_race_preparation_context(text, uuid, uuid, boolean)
from public, anon, authenticated;
grant execute
on function private.assert_federation_race_preparation_context(text, uuid, uuid, boolean)
to service_role;

create or replace function public.save_national_federation_race_preparation(
  p_country_code text,
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_roles jsonb,
  p_strategy jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_roster_count integer;
  v_role_count integer;
begin
  select * into v_context
  from private.assert_federation_race_preparation_context(
    p_country_code, p_race_edition_id, p_stage_id, false
  );

  if jsonb_typeof(p_roles) <> 'array' or jsonb_typeof(p_strategy) <> 'object' then
    raise exception 'Le plan de course transmis est invalide.';
  end if;

  select count(*)::integer into v_roster_count
  from public.race_rosters
  where race_registration_id = v_context.registration_id
    and status in ('selected', 'confirmed');

  select count(*)::integer into v_role_count
  from jsonb_array_elements(p_roles) as role(value)
  join public.race_rosters as roster
    on roster.race_registration_id = v_context.registration_id
   and roster.rider_id = (role.value->>'riderId')::uuid
   and roster.status in ('selected', 'confirmed')
  where role.value->>'role' in (
    'auto', 'leader', 'sprinter', 'leader_sprinter', 'protected_rider',
    'leadout', 'free_agent', 'domestique', 'mountain_classification'
  );
  if v_role_count <> v_roster_count
    or v_role_count <> jsonb_array_length(p_roles)
  then
    raise exception 'Chaque coureur convoqué doit recevoir exactement un rôle valide.';
  end if;

  delete from public.race_roster_stage_roles
  where race_registration_id = v_context.registration_id
    and stage_id = p_stage_id;

  insert into public.race_roster_stage_roles (
    race_registration_id, stage_id, rider_id, race_role
  )
  select v_context.registration_id, p_stage_id,
    (role.value->>'riderId')::uuid, role.value->>'role'
  from jsonb_array_elements(p_roles) as role(value);

  insert into public.race_stage_strategies (
    race_registration_id, stage_id, team_id, objective,
    collective_posture, breakaway_policy, chase_policy,
    lieutenant_rider_id, danger_pacer_rider_id, protector_rider_id,
    breakaway_rider_id, attack_orders, updated_at
  ) values (
    v_context.registration_id, p_stage_id, v_context.country_id,
    coalesce(p_strategy->>'objective', 'balanced'),
    coalesce(p_strategy->>'collectivePosture', 'balanced'),
    coalesce(p_strategy->>'breakawayPolicy', 'opportunistic'),
    coalesce(p_strategy->>'chasePolicy', 'dangerous_breakaway'),
    nullif(p_strategy->>'lieutenantRiderId', '')::uuid,
    nullif(p_strategy->>'dangerPacerRiderId', '')::uuid,
    nullif(p_strategy->>'protectorRiderId', '')::uuid,
    nullif(p_strategy->>'breakawayRiderId', '')::uuid,
    coalesce(p_strategy->'attackOrders', '[]'::jsonb),
    now()
  )
  on conflict on constraint race_stage_strategies_pkey do update set
    objective = excluded.objective,
    collective_posture = excluded.collective_posture,
    breakaway_policy = excluded.breakaway_policy,
    chase_policy = excluded.chase_policy,
    lieutenant_rider_id = excluded.lieutenant_rider_id,
    danger_pacer_rider_id = excluded.danger_pacer_rider_id,
    protector_rider_id = excluded.protector_rider_id,
    breakaway_rider_id = excluded.breakaway_rider_id,
    attack_orders = excluded.attack_orders,
    updated_at = excluded.updated_at;
end;
$$;

revoke all
on function public.save_national_federation_race_preparation(text, uuid, uuid, jsonb, jsonb)
from public, anon;
grant execute
on function public.save_national_federation_race_preparation(text, uuid, uuid, jsonb, jsonb)
to authenticated, service_role;

create or replace function public.save_national_federation_time_trial_preparation(
  p_country_code text,
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_plan jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_roster_count integer;
  v_plan_count integer;
  v_relay_total numeric;
begin
  select * into v_context
  from private.assert_federation_race_preparation_context(
    p_country_code, p_race_edition_id, p_stage_id, true
  );
  if jsonb_typeof(p_plan) <> 'array' then
    raise exception 'Le plan du contre-la-montre est invalide.';
  end if;

  select count(*)::integer into v_roster_count
  from public.race_rosters
  where race_registration_id = v_context.registration_id
    and status in ('selected', 'confirmed');

  select count(*)::integer,
    sum(coalesce((plan.value->>'relaySharePct')::numeric, 0))
  into v_plan_count, v_relay_total
  from jsonb_array_elements(p_plan) as plan(value)
  join public.race_rosters as roster
    on roster.race_registration_id = v_context.registration_id
   and roster.rider_id = (plan.value->>'riderId')::uuid
   and roster.status in ('selected', 'confirmed')
  where plan.value->>'effortMode' in ('conserve', 'normal', 'all_in')
    and (
      plan.value->'relaySharePct' = 'null'::jsonb
      or (plan.value->>'relaySharePct')::numeric between 0 and 100
    );

  if v_plan_count <> v_roster_count
    or v_plan_count <> jsonb_array_length(p_plan)
  then
    raise exception 'Chaque coureur convoqué doit recevoir une consigne chrono valide.';
  end if;
  if v_context.stage_type = 'team_time_trial'
    and abs(coalesce(v_relay_total, 0) - 100) > .001
  then
    raise exception 'La somme des relais doit être exactement égale à 100 %%.';
  end if;

  delete from public.race_time_trial_rider_plans
  where race_registration_id = v_context.registration_id
    and stage_id = p_stage_id;

  insert into public.race_time_trial_rider_plans (
    race_registration_id, stage_id, rider_id, team_id,
    effort_mode, relay_share_pct, updated_at
  )
  select v_context.registration_id, p_stage_id,
    (plan.value->>'riderId')::uuid,
    v_context.country_id, plan.value->>'effortMode',
    case when v_context.stage_type = 'team_time_trial'
      then (plan.value->>'relaySharePct')::numeric else null end,
    now()
  from jsonb_array_elements(p_plan) as plan(value);
end;
$$;

revoke all
on function public.save_national_federation_time_trial_preparation(text, uuid, uuid, jsonb)
from public, anon;
grant execute
on function public.save_national_federation_time_trial_preparation(text, uuid, uuid, jsonb)
to authenticated, service_role;

create or replace function public.get_national_federation_equipment_rating_bonus(
  p_country_id uuid,
  p_season_id uuid,
  p_rating_key text,
  p_is_time_trial boolean default false
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    coalesce((item.effect_payload->'ratingBonuses'->>p_rating_key)::numeric, 0)
    + case when p_is_time_trial then
        coalesce((item.effect_payload->'timeTrialRatingBonuses'->>p_rating_key)::numeric, 0)
      else 0 end
  ), 0)::numeric
  from public.national_federation_equipment_contracts as contract
  join public.national_federation_equipment_contract_items as item
    on item.contract_id = contract.id
  where contract.country_id = p_country_id
    and contract.season_id = p_season_id
$$;

create or replace function public.get_national_federation_equipment_junior_stage_bonus(
  p_country_id uuid,
  p_season_id uuid,
  p_profile_type text,
  p_stage_type text
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case p_profile_type
    when 'flat' then
      public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'flat') * .34
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'sprint') * .26
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'acceleration') * .18
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'endurance') * .12
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'resistance') * .10
    when 'sprint' then
      public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'sprint') * .34
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'acceleration') * .24
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'flat') * .18
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'resistance') * .13
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'endurance') * .11
    when 'hilly' then
      public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'hills') * .36
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'acceleration') * .18
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'endurance') * .17
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'resistance') * .14
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'mountain') * .10
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'sprint') * .05
    when 'mountain' then
      public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'mountain') * .42
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'recovery') * .18
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'endurance') * .17
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'resistance') * .13
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'downhill') * .10
    when 'cobbles' then
      public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'cobbles') * .39
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'flat') * .19
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'resistance') * .18
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'endurance') * .14
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'acceleration') * .10
    when 'time_trial' then
      public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'timeTrial', true) * .52
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'prologue', true) * .16
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'flat', true) * .14
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'endurance', true) * .10
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'resistance', true) * .08
    else
      public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'hills') * .18
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'mountain') * .16
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'flat') * .14
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'timeTrial', p_stage_type in ('individual_time_trial', 'team_time_trial', 'prologue')) * .14
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'endurance') * .13
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'resistance') * .10
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'acceleration') * .08
      + public.get_national_federation_equipment_rating_bonus(p_country_id, p_season_id, 'recovery') * .07
  end
$$;

revoke all
on function public.get_national_federation_equipment_rating_bonus(uuid, uuid, text, boolean)
from public, anon;
revoke all
on function public.get_national_federation_equipment_junior_stage_bonus(uuid, uuid, text, text)
from public, anon;
grant execute
on function public.get_national_federation_equipment_rating_bonus(uuid, uuid, text, boolean)
to authenticated, service_role;
grant execute
on function public.get_national_federation_equipment_junior_stage_bonus(uuid, uuid, text, text)
to authenticated, service_role;

-- Ajoute le matériel national au score des vrais juniors sélectionnés, sans
-- toucher à leurs notes persistées ni à leurs courses d'équipe.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.simulate_development_race(uuid)'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_needle constant text :=
    '      end' || chr(10) ||
    '      + (public.development_hash_unit(';
  v_replacement constant text :=
    '      end' || chr(10) ||
    '      + public.get_national_federation_equipment_junior_stage_bonus(' || chr(10) ||
    '          registration.country_id, v_edition.season_id,' || chr(10) ||
    '          stage.profile_type, stage.stage_type' || chr(10) ||
    '        )' || chr(10) ||
    '      + (public.development_hash_unit(';
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
  into v_definition;

  if position('get_national_federation_equipment_junior_stage_bonus' in v_definition) = 0 then
    if position(v_needle in v_definition) = 0 then
      raise exception 'La simulation junior fédérale a une définition inattendue.';
    end if;
    v_patched_definition := replace(v_definition, v_needle, v_replacement);
    execute v_patched_definition;
  end if;
end;
$migration$;

-- La console de club ne doit plus exposer aucun chrono international. Les
-- plans nationaux passent exclusivement par les RPC fédéraux ci-dessus.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_current_team_race_preparation()'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_filter constant text :=
    '    and (' || chr(10) ||
    '      race.competition_type not in (' || chr(10) ||
    '        ''continental_championship'', ''world_championship''' || chr(10) ||
    '      )' || chr(10) ||
    '      or stage.stage_type in (' || chr(10) ||
    '        ''individual_time_trial'', ''team_time_trial'', ''prologue''' || chr(10) ||
    '      )' || chr(10) ||
    '    )';
  v_new_filter constant text :=
    '    and race.competition_type not in (' || chr(10) ||
    '      ''continental_championship'', ''world_championship'', ''nations_cup''' || chr(10) ||
    '    )';
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
  into v_definition;
  if position(v_old_filter in v_definition) > 0 then
    v_patched_definition := replace(v_definition, v_old_filter, v_new_filter);
    execute v_patched_definition;
  elsif position('''nations_cup''' in v_definition) = 0 then
    raise exception 'La lecture des préparations de club a une définition inattendue.';
  end if;
end;
$migration$;

do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_current_dashboard_assistant_summary()'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_filter constant text :=
    '    where (' || chr(10) ||
    '      stage.stage_type in (' || chr(10) ||
    '        ''individual_time_trial'', ''team_time_trial'', ''prologue''' || chr(10) ||
    '      )' || chr(10) ||
    '      or race.competition_type not in (' || chr(10) ||
    '        ''continental_championship'', ''world_championship''' || chr(10) ||
    '      )' || chr(10) ||
    '    )' || chr(10) ||
    '    and case';
  v_new_filter constant text :=
    '    where race.competition_type not in (' || chr(10) ||
    '      ''continental_championship'', ''world_championship'', ''nations_cup''' || chr(10) ||
    '    )' || chr(10) ||
    '    and case';
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
  into v_definition;
  if position(v_old_filter in v_definition) > 0 then
    v_patched_definition := replace(v_definition, v_old_filter, v_new_filter);
    execute v_patched_definition;
  end if;
end;
$migration$;

delete from public.race_time_trial_rider_plans as plan
using public.race_registrations as registration,
      public.race_editions as edition,
      public.races as race
where registration.id = plan.race_registration_id
  and registration.team_season_id is not null
  and edition.id = registration.race_edition_id
  and race.id = edition.race_id
  and race.competition_type in (
    'continental_championship', 'world_championship', 'nations_cup'
  );

delete from public.race_roster_stage_roles as stage_role
using public.race_registrations as registration,
      public.race_editions as edition,
      public.races as race
where registration.id = stage_role.race_registration_id
  and registration.team_season_id is not null
  and edition.id = registration.race_edition_id
  and race.id = edition.race_id
  and race.competition_type in (
    'continental_championship', 'world_championship', 'nations_cup'
  );

delete from public.race_stage_strategies as strategy
using public.race_registrations as registration,
      public.race_editions as edition,
      public.races as race
where registration.id = strategy.race_registration_id
  and registration.team_season_id is not null
  and edition.id = registration.race_edition_id
  and race.id = edition.race_id
  and race.competition_type in (
    'continental_championship', 'world_championship', 'nations_cup'
  );

comment on table public.national_federation_equipment_contracts is
  'Contrat équipementier national immuable pour une fédération et une saison.';
comment on function public.choose_national_federation_equipment_offer(text, text) is
  'Permet au président de choisir une offre indivisible, la paie sur la trésorerie fédérale et la verrouille pour la saison.';
comment on function public.get_current_national_federation_race_preparation(text) is
  'Charge les sélections professionnelles confirmées et leurs plans nationaux pour la console fédérale.';

notify pgrst, 'reload schema';

commit;
