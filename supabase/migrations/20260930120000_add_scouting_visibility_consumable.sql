begin;

alter table public.team_seasons
  add column if not exists scouting_reports_revealed_until timestamptz;

comment on column public.team_seasons.scouting_reports_revealed_until is
  'Instant jusqu’auquel les rapports des coureurs libres et des juniors affichent leurs valeurs exactes.';

create index if not exists team_seasons_scouting_reveal_active_idx
  on public.team_seasons (scouting_reports_revealed_until)
  where scouting_reports_revealed_until is not null;

alter table public.daily_reward_catalog
  drop constraint if exists daily_reward_catalog_effect_allowed;
alter table public.daily_reward_catalog
  add constraint daily_reward_catalog_effect_allowed check (
    effect_kind in (
      'form_boost', 'rider_experience', 'rating_boost',
      'training_multiplier', 'scouting_boost', 'equipment',
      'special_ability', 'naturalization', 'wildcard',
      'instant_youth_promotion', 'custom_staff_recruitment',
      'construction_time_reduction', 'staff_level_boost',
      'injury_care', 'scouting_visibility'
    )
  );

insert into public.daily_reward_catalog (
  reward_key,
  name,
  description,
  effect_summary,
  importance,
  effect_kind,
  effect_payload,
  icon_key,
  is_active
)
values (
  'scouting-clarity-pass',
  'Loupe du recruteur',
  'Une fenêtre d’observation privilégiée pour examiner sans approximation les talents disponibles.',
  'Révèle pendant 24 h toutes les notes et le potentiel des coureurs libres et des juniors repérés',
  6,
  'scouting_visibility',
  '{"durationHours":24}'::jsonb,
  'scouting-clarity',
  true
)
on conflict (reward_key) do update set
  name = excluded.name,
  description = excluded.description,
  effect_summary = excluded.effect_summary,
  importance = excluded.importance,
  effect_kind = excluded.effect_kind,
  effect_payload = excluded.effect_payload,
  icon_key = excluded.icon_key,
  is_active = excluded.is_active;

insert into public.inventory_catalog_items (
  item_key,
  name,
  category,
  rarity,
  description,
  effect_summary,
  effect_payload,
  icon_key,
  is_consumable,
  status
)
values (
  'scouting-clarity-pass',
  'Loupe du recruteur',
  'other',
  'rare',
  'Une fenêtre d’observation privilégiée pour examiner sans approximation les talents disponibles.',
  'Révèle pendant 24 h toutes les notes et le potentiel des coureurs libres et des juniors repérés',
  '{"effectKind":"scouting_visibility","durationHours":24,"level":6}'::jsonb,
  'scouting-clarity',
  true,
  'active'
)
on conflict (item_key) do update set
  name = excluded.name,
  category = excluded.category,
  rarity = excluded.rarity,
  description = excluded.description,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  icon_key = excluded.icon_key,
  is_consumable = excluded.is_consumable,
  status = excluded.status,
  updated_at = now();

create table if not exists public.team_scouting_visibility_activations (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  source_type text not null,
  inventory_item_id uuid
    references public.inventory_catalog_items(id) on delete restrict,
  daily_reward_inventory_id uuid
    references public.daily_reward_inventory(id) on delete restrict,
  activated_at timestamptz not null default now(),
  active_until timestamptz not null,
  constraint team_scouting_visibility_source_allowed
    check (source_type in ('team_item', 'daily_reward')),
  constraint team_scouting_visibility_source_present check (
    (source_type = 'team_item'
      and inventory_item_id is not null
      and daily_reward_inventory_id is null)
    or
    (source_type = 'daily_reward'
      and inventory_item_id is null
      and daily_reward_inventory_id is not null)
  ),
  constraint team_scouting_visibility_duration_positive
    check (active_until > activated_at)
);

create index if not exists team_scouting_visibility_team_idx
  on public.team_scouting_visibility_activations
    (team_season_id, activated_at desc);

alter table public.team_scouting_visibility_activations enable row level security;
grant select on table public.team_scouting_visibility_activations to service_role;

create or replace function public.get_current_scouting_visibility_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_until timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  select team_season.scouting_reports_revealed_until
  into v_active_until
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
   and team_season.status in ('planned', 'active')
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  return jsonb_build_object(
    'active', coalesce(v_active_until > now(), false),
    'activeUntil', case when v_active_until > now() then v_active_until else null end,
    'remainingSeconds', case
      when v_active_until > now()
        then greatest(0, ceil(extract(epoch from (v_active_until - now())))::integer)
      else 0
    end
  );
end;
$$;

create or replace function public.activate_scouting_visibility_reward(
  p_inventory_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_reward record;
  v_reward_source text := 'daily_reward';
  v_duration_hours integer;
  v_active_until timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if p_inventory_id is null then
    raise exception 'Sélectionnez une Loupe du recruteur valide.';
  end if;

  select
    director.id as director_id,
    assignment.team_id,
    team_season.id as team_season_id,
    team_season.scouting_reports_revealed_until,
    season.game_year
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
   and team_season.status in ('planned', 'active')
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  select scouting_reports_revealed_until
  into v_context.scouting_reports_revealed_until
  from public.team_seasons
  where id = v_context.team_season_id;

  if v_context.scouting_reports_revealed_until > now() then
    raise exception 'La vision complète est déjà active. Conservez cet objet pour plus tard.';
  end if;

  select
    inventory.id as daily_inventory_id,
    inventory.status,
    inventory.expires_after_game_year,
    1::integer as quantity,
    catalog.effect_kind,
    catalog.effect_payload,
    catalog.name as reward_name,
    null::uuid as team_inventory_id,
    null::uuid as inventory_item_id
  into v_reward
  from public.daily_reward_inventory as inventory
  join public.daily_reward_catalog as catalog
    on catalog.reward_key = inventory.reward_key
   and catalog.is_active
  where inventory.id = p_inventory_id
    and inventory.sporting_director_id = v_context.director_id
  for update of inventory;

  if not found then
    v_reward_source := 'team_item';
    select
      null::uuid as daily_inventory_id,
      'available'::text as status,
      2147483647::integer as expires_after_game_year,
      inventory.quantity,
      catalog.effect_payload ->> 'effectKind' as effect_kind,
      catalog.effect_payload,
      catalog.name as reward_name,
      inventory.id as team_inventory_id,
      catalog.id as inventory_item_id
    into v_reward
    from public.team_item_inventory as inventory
    join public.inventory_catalog_items as catalog
      on catalog.id = inventory.inventory_item_id
     and catalog.status = 'active'
     and catalog.is_consumable
    where inventory.team_season_id = v_context.team_season_id
      and inventory.inventory_item_id = p_inventory_id
      and inventory.quantity > 0
    for update of inventory;
  end if;

  if not found
    or v_reward.status <> 'available'
    or v_reward.effect_kind <> 'scouting_visibility'
  then
    raise exception 'Cette Loupe du recruteur n’est plus disponible.';
  end if;
  if v_reward.expires_after_game_year < v_context.game_year then
    raise exception 'Ce cadeau a expiré à la fin de la saison précédente.';
  end if;

  v_duration_hours := coalesce(
    (v_reward.effect_payload ->> 'durationHours')::integer,
    24
  );
  if v_duration_hours <> 24 then
    raise exception 'La durée portée par cet objet est invalide.';
  end if;

  v_active_until := now() + make_interval(hours => v_duration_hours);

  update public.team_seasons
  set scouting_reports_revealed_until = v_active_until
  where id = v_context.team_season_id;

  insert into public.team_scouting_visibility_activations (
    team_season_id,
    source_type,
    inventory_item_id,
    daily_reward_inventory_id,
    active_until
  ) values (
    v_context.team_season_id,
    v_reward_source,
    case when v_reward_source = 'team_item' then v_reward.inventory_item_id else null end,
    case when v_reward_source = 'daily_reward' then v_reward.daily_inventory_id else null end,
    v_active_until
  );

  if v_reward_source = 'daily_reward' then
    update public.daily_reward_inventory
    set
      status = 'used',
      used_at = now(),
      usage_payload = jsonb_build_object(
        'effectKind', 'scouting_visibility',
        'activeUntil', v_active_until
      )
    where id = v_reward.daily_inventory_id;
  elsif v_reward.quantity = 1 then
    delete from public.team_item_inventory
    where id = v_reward.team_inventory_id;
  else
    update public.team_item_inventory
    set quantity = quantity - 1, updated_at = now()
    where id = v_reward.team_inventory_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'activeUntil', v_active_until,
    'message', 'Loupe du recruteur activée : notes exactes des coureurs libres et des juniors pendant 24 h.'
  );
end;
$$;

revoke all on function public.get_current_scouting_visibility_status() from public;
grant execute on function public.get_current_scouting_visibility_status() to authenticated;
grant execute on function public.get_current_scouting_visibility_status() to service_role;

revoke all on function public.activate_scouting_visibility_reward(uuid) from public;
grant execute on function public.activate_scouting_visibility_reward(uuid) to authenticated;
grant execute on function public.activate_scouting_visibility_reward(uuid) to service_role;

commit;
