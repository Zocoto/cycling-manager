-- ============================================================
-- CYCLING MANAGER
-- Fondations des fiches publiques de coureurs
-- ============================================================

begin;

-- La forme et la fatigue sont historisées par journée afin que le futur
-- moteur d'entraînement et de courses puisse reconstruire leur évolution.
create table public.rider_condition_states (
  id uuid primary key default gen_random_uuid(),

  rider_id uuid not null
    references public.riders(id)
    on delete cascade,

  season_day_id uuid not null
    references public.season_days(id)
    on delete cascade,

  form smallint not null default 75,
  fatigue smallint not null default 0,
  source text not null default 'initialization',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rider_condition_states_unique
    unique (rider_id, season_day_id),

  constraint rider_condition_states_form_range
    check (form between 0 and 100),

  constraint rider_condition_states_fatigue_range
    check (fatigue between 0 and 100),

  constraint rider_condition_states_source_not_empty
    check (btrim(source) <> '')
);

create index rider_condition_states_rider_id_idx
  on public.rider_condition_states (rider_id);

create index rider_condition_states_season_day_id_idx
  on public.rider_condition_states (season_day_id);

-- Cette table porte les indicateurs historiques affichés saison par saison.
-- Elle sera alimentée par le futur moteur de résultats et de classements.
create table public.rider_season_summaries (
  id uuid primary key default gen_random_uuid(),

  rider_id uuid not null
    references public.riders(id)
    on delete cascade,

  season_id uuid not null
    references public.seasons(id)
    on delete cascade,

  victories integer,
  points integer,
  uci_rank integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rider_season_summaries_unique
    unique (rider_id, season_id),

  constraint rider_season_summaries_victories_non_negative
    check (victories is null or victories >= 0),

  constraint rider_season_summaries_points_non_negative
    check (points is null or points >= 0),

  constraint rider_season_summaries_uci_rank_positive
    check (uci_rank is null or uci_rank > 0)
);

create index rider_season_summaries_rider_id_idx
  on public.rider_season_summaries (rider_id);

create index rider_season_summaries_season_id_idx
  on public.rider_season_summaries (season_id);

-- Le catalogue reste vide pour cette livraison. La structure fixe les six
-- emplacements avant de définir acquisition, rareté et bonus des objets.
create table public.equipment_catalog_items (
  id uuid primary key default gen_random_uuid(),

  catalog_key text not null,
  name text not null,
  slot_type text not null,
  status text not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint equipment_catalog_items_catalog_key_not_empty
    check (btrim(catalog_key) <> ''),

  constraint equipment_catalog_items_name_not_empty
    check (btrim(name) <> ''),

  constraint equipment_catalog_items_slot_allowed
    check (
      slot_type in (
        'helmet',
        'gloves',
        'bib_shorts',
        'shoes',
        'frame',
        'wheels'
      )
    ),

  constraint equipment_catalog_items_status_allowed
    check (status in ('draft', 'active', 'retired')),

  constraint equipment_catalog_items_catalog_key_unique
    unique (catalog_key)
);

create table public.rider_equipment_assignments (
  id uuid primary key default gen_random_uuid(),

  rider_id uuid not null
    references public.riders(id)
    on delete cascade,

  slot_type text not null,

  equipment_item_id uuid not null
    references public.equipment_catalog_items(id)
    on delete restrict,

  equipped_at timestamptz not null default now(),

  constraint rider_equipment_assignments_slot_allowed
    check (
      slot_type in (
        'helmet',
        'gloves',
        'bib_shorts',
        'shoes',
        'frame',
        'wheels'
      )
    ),

  constraint rider_equipment_assignments_rider_slot_unique
    unique (rider_id, slot_type)
);

create index rider_equipment_assignments_rider_id_idx
  on public.rider_equipment_assignments (rider_id);

create or replace function public.enforce_equipment_assignment_slot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_catalog_slot text;
begin
  select item.slot_type
  into v_catalog_slot
  from public.equipment_catalog_items as item
  where item.id = new.equipment_item_id;

  if v_catalog_slot is null then
    raise exception 'L objet d équipement demandé est introuvable.';
  end if;

  if v_catalog_slot <> new.slot_type then
    raise exception
      'L objet d équipement ne correspond pas à l emplacement demandé.';
  end if;

  return new;
end;
$$;

create trigger enforce_equipment_assignment_slot
before insert or update of slot_type, equipment_item_id
on public.rider_equipment_assignments
for each row
execute function public.enforce_equipment_assignment_slot();

-- Tout canal de création de coureur reçoit les mêmes valeurs initiales.
create or replace function public.initialize_rider_profile_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_season_id uuid;
  v_current_season_day_id uuid;
begin
  select season.id
  into v_active_season_id
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_active_season_id is null then
    return new;
  end if;

  insert into public.rider_season_summaries (
    rider_id,
    season_id
  )
  values (
    new.id,
    v_active_season_id
  )
  on conflict (rider_id, season_id) do nothing;

  select day.id
  into v_current_season_day_id
  from public.season_days as day
  join public.seasons as season
    on season.id = day.season_id
  where day.season_id = v_active_season_id
    and day.day_number = coalesce(season.current_day_number, 1)
  limit 1;

  if v_current_season_day_id is not null then
    insert into public.rider_condition_states (
      rider_id,
      season_day_id,
      form,
      fatigue,
      source
    )
    values (
      new.id,
      v_current_season_day_id,
      75,
      0,
      'initialization'
    )
    on conflict (rider_id, season_day_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger initialize_rider_profile_state
after insert on public.riders
for each row
execute function public.initialize_rider_profile_state();

-- Les coureurs existants démarrent avec les valeurs de gameplay validées.
insert into public.rider_season_summaries (
  rider_id,
  season_id
)
select
  rider.id,
  season.id
from public.riders as rider
cross join public.seasons as season
where season.status = 'active'
on conflict (rider_id, season_id) do nothing;

insert into public.rider_condition_states (
  rider_id,
  season_day_id,
  form,
  fatigue,
  source
)
select
  rider.id,
  day.id,
  75,
  0,
  'initialization'
from public.riders as rider
cross join public.seasons as season
join public.season_days as day
  on day.season_id = season.id
 and day.day_number = coalesce(season.current_day_number, 1)
where season.status = 'active'
on conflict (rider_id, season_day_id) do nothing;

alter table public.rider_condition_states enable row level security;
alter table public.rider_season_summaries enable row level security;
alter table public.equipment_catalog_items enable row level security;
alter table public.rider_equipment_assignments enable row level security;

comment on table public.rider_condition_states is
  'Historique quotidien de la forme et de la fatigue des coureurs.';

comment on table public.rider_season_summaries is
  'Synthèse saisonnière des victoires, points et classements individuels.';

comment on table public.equipment_catalog_items is
  'Catalogue futur des équipements compatibles avec les six emplacements d un coureur.';

comment on table public.rider_equipment_assignments is
  'Équipements actuellement portés par un coureur, un objet par emplacement.';

comment on function public.initialize_rider_profile_state() is
  'Initialise automatiquement le résumé saisonnier, la forme et la fatigue de tout nouveau coureur.';

commit;
