-- ============================================================
-- Capacités spéciales, attaques officielles et demi-points de réputation
-- ============================================================

begin;

create table public.special_ability_catalog (
  code text primary key,
  name text not null,
  effect_description text not null,
  icon_key text not null,
  medallion_tone text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint special_ability_catalog_code_allowed check (
    code in (
      'flahute',
      'panache',
      'bottle_carrier',
      'locomotive',
      'giclette',
      'chase_potato',
      'sandwich_man'
    )
  ),
  constraint special_ability_catalog_name_not_empty check (btrim(name) <> ''),
  constraint special_ability_catalog_effect_not_empty check (btrim(effect_description) <> '')
);

insert into public.special_ability_catalog (
  code,
  name,
  effect_description,
  icon_key,
  medallion_tone
)
values
  ('flahute', 'Flahute', 'Réduit la dépense d’énergie dans la seconde moitié de course et sur les secteurs exigeants.', 'thigh', 'silver'),
  ('panache', 'Panache', 'Augmente les chances de prendre l’échappée et favorise les contre-attaques.', 'fireworks', 'gold'),
  ('bottle_carrier', 'Porteur de bidon', 'Réduit la dépense d’énergie des équipiers présents dans le même groupe.', 'bottle', 'copper'),
  ('locomotive', 'Locomotive', 'Réduit la dépense d’énergie lorsque le coureur travaille pour son groupe.', 'locomotive', 'anthracite'),
  ('giclette', 'Giclette', 'Améliore les attaques décisives lors des arrivées non groupées.', 'pump', 'red'),
  ('chase_potato', 'Chasse patate', 'Permet de sortir seul du peloton pour tenter de rejoindre une échappée.', 'potato', 'purple'),
  ('sandwich_man', 'Homme Sandwich', 'Accorde +0,5 réputation après une échappée ou une victoire.', 'sandwich', 'green')
on conflict (code) do update set
  name = excluded.name,
  effect_description = excluded.effect_description,
  icon_key = excluded.icon_key,
  medallion_tone = excluded.medallion_tone,
  is_active = true;

create table public.rider_special_abilities (
  rider_id uuid not null
    references public.riders(id)
    on delete cascade,
  ability_code text not null
    references public.special_ability_catalog(code)
    on delete restrict,
  unlocked_at timestamptz not null default now(),
  source_type text,
  source_reference text,

  primary key (rider_id, ability_code),
  constraint rider_special_abilities_source_not_empty check (
    source_type is null or btrim(source_type) <> ''
  ),
  constraint rider_special_abilities_reference_not_empty check (
    source_reference is null or btrim(source_reference) <> ''
  )
);

create index rider_special_abilities_code_idx
  on public.rider_special_abilities (ability_code, rider_id);

create table public.stage_attack_participants (
  stage_id uuid not null
    references public.stages(id)
    on delete cascade,
  race_roster_id uuid not null
    references public.race_rosters(id)
    on delete cascade,
  participation_type text not null,
  first_segment_number smallint not null,
  created_at timestamptz not null default now(),

  primary key (stage_id, race_roster_id),
  constraint stage_attack_participants_type_allowed check (
    participation_type in ('breakaway', 'chase')
  ),
  constraint stage_attack_participants_segment_positive check (
    first_segment_number > 0
  )
);

create index stage_attack_participants_roster_idx
  on public.stage_attack_participants (race_roster_id, stage_id);

-- La réputation accepte désormais les bonus fins des capacités et du matériel.
alter table public.sporting_directors
  alter column reputation_points type numeric(12, 2)
  using reputation_points::numeric(12, 2);

alter table public.reward_events
  alter column reputation_points type numeric(12, 2)
  using reputation_points::numeric(12, 2);

alter table public.reward_events
  drop constraint if exists reward_events_source_type_allowed;

alter table public.reward_events
  add constraint reward_events_source_type_allowed check (
    source_type in (
      'race_result',
      'stage_result',
      'mountain_prime',
      'intermediate_sprint',
      'secondary_classification',
      'game_objective',
      'sponsor_objective',
      'division_bonus',
      'special_ability'
    )
  );

create or replace function public.apply_race_roster_reputation_bonus(
  p_source_reference text,
  p_race_roster_id uuid,
  p_stage_id uuid,
  p_reputation_points numeric,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_reward_id uuid;
begin
  if btrim(coalesce(p_source_reference, '')) = '' then
    raise exception 'La référence du bonus est obligatoire.';
  end if;

  if coalesce(p_reputation_points, 0) <= 0 then
    raise exception 'Le bonus de réputation doit être positif.';
  end if;

  select
    roster.rider_id,
    rider.country_id,
    registration.team_season_id,
    sporting_director.id as sporting_director_id
  into v_context
  from public.race_rosters as roster
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
  join public.stages as stage
    on stage.id = p_stage_id
   and stage.race_edition_id = registration.race_edition_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  left join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  left join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  where roster.id = p_race_roster_id
  limit 1;

  if v_context is null then
    raise exception 'Le coureur ne possède pas de contexte de course valide.';
  end if;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    rider_id,
    country_id,
    reputation_points,
    description
  )
  values (
    btrim(p_source_reference),
    'special_ability',
    v_context.sporting_director_id,
    v_context.team_season_id,
    v_context.rider_id,
    v_context.country_id,
    round(p_reputation_points, 2),
    btrim(p_description)
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    select id into v_reward_id
    from public.reward_events
    where source_reference = btrim(p_source_reference);
    return v_reward_id;
  end if;

  update public.sporting_directors
  set reputation_points = reputation_points + round(p_reputation_points, 2)
  where id = v_context.sporting_director_id;

  return v_reward_id;
end;
$$;

alter table public.special_ability_catalog enable row level security;
alter table public.rider_special_abilities enable row level security;
alter table public.stage_attack_participants enable row level security;

create policy special_ability_catalog_read_authenticated
on public.special_ability_catalog
for select
to authenticated
using (is_active = true);

create policy rider_special_abilities_read_authenticated
on public.rider_special_abilities
for select
to authenticated
using (true);

create policy stage_attack_participants_read_authenticated
on public.stage_attack_participants
for select
to authenticated
using (true);

grant select on table public.special_ability_catalog to authenticated, service_role;
grant select on table public.rider_special_abilities to authenticated;
grant all privileges on table public.rider_special_abilities to service_role;
grant select on table public.stage_attack_participants to authenticated;
grant all privileges on table public.stage_attack_participants to service_role;

revoke all on function public.apply_race_roster_reputation_bonus(
  text, uuid, uuid, numeric, text
) from public;
grant execute on function public.apply_race_roster_reputation_bonus(
  text, uuid, uuid, numeric, text
) to service_role;

comment on table public.rider_special_abilities is
  'Capacités spéciales effectivement débloquées par chaque coureur.';
comment on table public.stage_attack_participants is
  'Coureurs ayant figuré dans une échappée ou un groupe de chasse pendant une étape officielle.';
comment on function public.apply_race_roster_reputation_bonus(
  text, uuid, uuid, numeric, text
) is
  'Applique un bonus fin et idempotent de réputation depuis une startlist historique.';

notify pgrst, 'reload schema';

commit;
