-- ============================================================
-- Objets de soin des blessures, niveaux 1 a 5.
-- Ils peuvent provenir des cadeaux quotidiens ou de l'inventaire d'equipe.
-- Les blessures de fatigue conservent leurs trois jours incompressibles.
-- ============================================================

begin;

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
      'injury_care'
    )
  );

alter table public.inventory_catalog_items
  drop constraint if exists inventory_catalog_items_category_allowed;
alter table public.inventory_catalog_items
  add constraint inventory_catalog_items_category_allowed check (
    category in (
      'special_ability',
      'potential_boost',
      'rating_boost',
      'injury_care',
      'other'
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
values
  (
    'injury-care-compressive-dressing',
    'Pansement compressif',
    'Un premier soin immédiatement disponible pour gagner quelques heures sur une blessure en cours.',
    'Réduit la convalescence de 2 h.',
    1,
    'injury_care',
    '{"recoveryHours":2,"level":1}'::jsonb,
    'medical',
    true
  ),
  (
    'injury-care-cryotherapy-pack',
    'Pack de cryothérapie',
    'Un traitement par le froid qui accélère la première phase de récupération.',
    'Réduit la convalescence de 6 h.',
    2,
    'injury_care',
    '{"recoveryHours":6,"level":2}'::jsonb,
    'medical',
    true
  ),
  (
    'injury-care-recovery-kit',
    'Trousse de récupération',
    'Une sélection complète de soins légers pour raccourcir une indisponibilité.',
    'Réduit la convalescence de 12 h.',
    3,
    'injury_care',
    '{"recoveryHours":12,"level":3}'::jsonb,
    'medical',
    true
  ),
  (
    'injury-care-physiotherapy-session',
    'Session de physiothérapie',
    'Une prise en charge individuelle destinée à faire gagner une journée de récupération.',
    'Réduit la convalescence de 1 jour.',
    4,
    'injury_care',
    '{"recoveryHours":24,"level":4}'::jsonb,
    'medical',
    true
  ),
  (
    'injury-care-anti-inflammatory-protocol',
    'Protocole anti-inflammatoire',
    'Un protocole renforcé qui agit sur les traumatismes compatibles avec une reprise accélérée.',
    'Réduit la convalescence de 2 jours.',
    5,
    'injury_care',
    '{"recoveryHours":48,"level":5}'::jsonb,
    'medical',
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
select
  reward.reward_key,
  reward.name,
  'injury_care',
  case
    when reward.importance >= 9 then 'epic'
    when reward.importance >= 6 then 'rare'
    when reward.importance >= 3 then 'uncommon'
    else 'common'
  end,
  reward.description,
  reward.effect_summary,
  reward.effect_payload || jsonb_build_object('effectKind', 'injury_care'),
  reward.icon_key,
  true,
  'active'
from public.daily_reward_catalog as reward
where reward.effect_kind = 'injury_care'
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

create table public.rider_injury_care_item_applications (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete restrict,
  rider_injury_id uuid not null
    references public.rider_injuries(id) on delete restrict,
  team_season_id uuid not null
    references public.team_seasons(id) on delete restrict,
  source_type text not null,
  inventory_item_id uuid
    references public.inventory_catalog_items(id) on delete restrict,
  daily_reward_inventory_id uuid
    references public.daily_reward_inventory(id) on delete restrict,
  item_name text not null,
  requested_recovery_hours smallint not null,
  recovery_seconds_reduced integer not null,
  previous_expected_recovery_at timestamptz not null,
  adjusted_expected_recovery_at timestamptz not null,
  completed_injury boolean not null default false,
  applied_at timestamptz not null default now(),
  constraint rider_injury_care_source_allowed
    check (source_type in ('team_item', 'daily_reward')),
  constraint rider_injury_care_source_consistent check (
    (
      source_type = 'team_item'
      and inventory_item_id is not null
      and daily_reward_inventory_id is null
    )
    or (
      source_type = 'daily_reward'
      and inventory_item_id is null
      and daily_reward_inventory_id is not null
    )
  ),
  constraint rider_injury_care_name_not_empty
    check (btrim(item_name) <> ''),
  constraint rider_injury_care_requested_hours_range
    check (requested_recovery_hours between 1 and 48),
  constraint rider_injury_care_reduction_positive
    check (recovery_seconds_reduced > 0),
  constraint rider_injury_care_adjusted_date
    check (adjusted_expected_recovery_at <= previous_expected_recovery_at)
);

create index rider_injury_care_item_applications_rider_idx
  on public.rider_injury_care_item_applications (rider_id, applied_at desc);
create index rider_injury_care_item_applications_injury_idx
  on public.rider_injury_care_item_applications (rider_injury_id, applied_at);
create unique index rider_injury_care_daily_reward_unique_idx
  on public.rider_injury_care_item_applications (daily_reward_inventory_id)
  where daily_reward_inventory_id is not null;

alter table public.rider_injury_care_item_applications enable row level security;
grant select on table public.rider_injury_care_item_applications to service_role;

create or replace function public.redeem_injury_care_reward(
  p_inventory_id uuid,
  p_rider_id uuid
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
  v_injury record;
  v_recovery_hours integer;
  v_previous_recovery timestamptz;
  v_adjusted_recovery timestamptz;
  v_recovery_seconds integer;
  v_remaining_seconds integer;
  v_effect_label text;
  v_message text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if p_inventory_id is null or p_rider_id is null then
    raise exception 'Sélectionnez un objet de soin et un coureur blessé.';
  end if;

  perform public.sync_active_season_day();
  perform public.settle_current_health_and_form();

  select
    director.id as director_id,
    assignment.team_id,
    team_season.id as team_season_id,
    season.id as season_id,
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

  if v_reward is null then
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

  if v_reward is null
    or v_reward.status <> 'available'
    or v_reward.effect_kind <> 'injury_care'
  then
    raise exception 'Cet objet de soin n’est plus disponible.';
  end if;
  if v_reward.expires_after_game_year < v_context.game_year then
    raise exception 'Ce cadeau a expiré à la fin de la saison précédente.';
  end if;

  v_recovery_hours := (v_reward.effect_payload ->> 'recoveryHours')::integer;
  if v_recovery_hours not between 1 and 48 then
    raise exception 'La durée portée par cet objet de soin est invalide.';
  end if;

  select
    injury.*,
    rider.first_name,
    rider.last_name
  into v_injury
  from public.rider_contracts as contract
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
   and start_season.game_year <= v_context.game_year
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= v_context.game_year
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.status = 'active'
  join public.rider_injuries as injury
    on injury.rider_id = rider.id
   and injury.status = 'active'
   and injury.expected_recovery_at > now()
  where contract.team_id = v_context.team_id
    and contract.rider_id = p_rider_id
    and contract.status = 'active'
  order by injury.expected_recovery_at desc
  limit 1
  for update of injury;

  if v_injury is null then
    raise exception 'Ce coureur ne présente aucune blessure active.';
  end if;
  if v_injury.diagnosis_code = 'fatigue_exhaustion' then
    raise exception 'Une blessure de fatigue impose trois jours de repos fixes et ne peut pas être raccourcie.';
  end if;

  v_previous_recovery := v_injury.expected_recovery_at;
  v_adjusted_recovery := greatest(
    now(),
    v_previous_recovery - make_interval(hours => v_recovery_hours)
  );
  v_recovery_seconds := greatest(
    1,
    round(extract(epoch from (v_previous_recovery - v_adjusted_recovery)))::integer
  );
  v_remaining_seconds := greatest(
    0,
    ceil(extract(epoch from (v_adjusted_recovery - now())))::integer
  );

  update public.rider_injuries
  set
    expected_recovery_at = v_adjusted_recovery,
    status = case
      when v_adjusted_recovery <= now() then 'recovered'
      else 'active'
    end,
    recovered_at = case
      when v_adjusted_recovery <= now() then coalesce(recovered_at, now())
      else recovered_at
    end,
    updated_at = now()
  where id = v_injury.id;

  insert into public.rider_injury_care_item_applications (
    rider_id,
    rider_injury_id,
    team_season_id,
    source_type,
    inventory_item_id,
    daily_reward_inventory_id,
    item_name,
    requested_recovery_hours,
    recovery_seconds_reduced,
    previous_expected_recovery_at,
    adjusted_expected_recovery_at,
    completed_injury
  ) values (
    p_rider_id,
    v_injury.id,
    v_context.team_season_id,
    v_reward_source,
    case when v_reward_source = 'team_item' then v_reward.inventory_item_id else null end,
    case when v_reward_source = 'daily_reward' then v_reward.daily_inventory_id else null end,
    v_reward.reward_name,
    v_recovery_hours,
    v_recovery_seconds,
    v_previous_recovery,
    v_adjusted_recovery,
    v_adjusted_recovery <= now()
  );

  if v_reward_source = 'daily_reward' then
    update public.daily_reward_inventory
    set
      status = 'used',
      used_at = now(),
      usage_payload = jsonb_build_object(
        'riderId', p_rider_id,
        'injuryId', v_injury.id,
        'recoverySecondsReduced', v_recovery_seconds
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

  v_effect_label := case
    when v_recovery_seconds % 86400 = 0 then
      (v_recovery_seconds / 86400)::text || ' jour'
        || case when v_recovery_seconds / 86400 > 1 then 's' else '' end
    when v_recovery_seconds % 3600 = 0 then
      (v_recovery_seconds / 3600)::text || ' h'
    else
      ceil(v_recovery_seconds / 60.0)::integer::text || ' min'
  end;

  if v_adjusted_recovery <= now() then
    v_message := v_reward.reward_name || ' utilisé sur '
      || v_injury.first_name || ' ' || v_injury.last_name || ' : '
      || v_effect_label || ' gagnées, la convalescence est terminée.';
  else
    v_message := v_reward.reward_name || ' utilisé sur '
      || v_injury.first_name || ' ' || v_injury.last_name || ' : '
      || v_effect_label || ' gagnées, '
      || ceil(v_remaining_seconds / 3600.0)::integer::text
      || ' h de convalescence restantes.';
  end if;

  return jsonb_build_object(
    'inventoryId', p_inventory_id,
    'riderId', p_rider_id,
    'injuryId', v_injury.id,
    'recoverySecondsReduced', v_recovery_seconds,
    'completedInjury', v_adjusted_recovery <= now(),
    'message', v_message
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Les données de cet objet de soin sont invalides.';
end;
$$;

revoke all on function public.redeem_injury_care_reward(uuid, uuid)
  from public, anon;
grant execute on function public.redeem_injury_care_reward(uuid, uuid)
  to authenticated;

comment on table public.rider_injury_care_item_applications is
  'Historique auditable des objets ayant raccourci une blessure.';
comment on function public.redeem_injury_care_reward(uuid, uuid) is
  'Consomme un objet de soin quotidien ou générique et raccourcit atomiquement une blessure compatible.';

-- Enrichit le sélecteur commun sans ajouter de requête applicative : l'effectif
-- reste chargé en une fois et la recherche de blessure utilise l'index actif.
create or replace function public.get_current_team_item_target_values()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with current_context as (
    select
      assignment.team_id,
      season.id as season_id,
      season.game_year
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
    limit 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rider.id,
        'firstName', rider.first_name,
        'lastName', rider.last_name,
        'name', rider.first_name || ' ' || rider.last_name,
        'countryName', country.name,
        'form', coalesce(current_condition.form, 75),
        'experienceDays', coalesce(rider.career_race_days, 0),
        'potentialSteps', rider.potential_steps,
        'ratings', jsonb_build_object(
          'mountain', rating.mountain,
          'hills', rating.hills,
          'flat', rating.flat,
          'time_trial', rating.time_trial,
          'cobbles', rating.cobbles,
          'sprint', rating.sprint,
          'acceleration', rating.acceleration,
          'downhill', rating.downhill,
          'endurance', rating.endurance,
          'resistance', rating.resistance,
          'recovery', rating.recovery,
          'breakaway', rating.breakaway,
          'prologue', rating.prologue
        ),
        'abilityCodes', coalesce(abilities.codes, '[]'::jsonb),
        'injury', case
          when active_injury.id is null then null
          else jsonb_build_object(
            'id', active_injury.id,
            'diagnosisCode', active_injury.diagnosis_code,
            'label', case active_injury.diagnosis_code
              when 'rib_fracture' then 'Fracture des côtes'
              when 'wrist_fracture' then 'Fracture du poignet'
              when 'clavicle_fracture' then 'Fracture de la clavicule'
              when 'fatigue_exhaustion' then 'Blessure de fatigue'
              else 'Blessure en cours'
            end,
            'remainingHours', greatest(
              1,
              ceil(extract(epoch from (active_injury.expected_recovery_at - now())) / 3600.0)::integer
            ),
            'expectedRecoveryAt', active_injury.expected_recovery_at,
            'canShorten', active_injury.diagnosis_code <> 'fatigue_exhaustion'
          )
        end
      )
      order by rider.last_name, rider.first_name
    ),
    '[]'::jsonb
  )
  from current_context as context
  join public.rider_contracts as contract
    on contract.team_id = context.team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
   and start_season.game_year <= context.game_year
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= context.game_year
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.status = 'active'
  join public.countries as country
    on country.id = rider.country_id
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = context.season_id
  left join lateral (
    select condition.form
    from public.rider_condition_states as condition
    join public.season_days as condition_day
      on condition_day.id = condition.season_day_id
     and condition_day.season_id = context.season_id
    where condition.rider_id = rider.id
    order by condition_day.day_number desc, condition.updated_at desc
    limit 1
  ) as current_condition on true
  left join lateral (
    select jsonb_agg(ability.ability_code order by ability.ability_code) as codes
    from public.rider_special_abilities as ability
    where ability.rider_id = rider.id
  ) as abilities on true
  left join lateral (
    select
      injury.id,
      injury.diagnosis_code,
      injury.expected_recovery_at
    from public.rider_injuries as injury
    where injury.rider_id = rider.id
      and injury.status = 'active'
      and injury.expected_recovery_at > now()
    order by injury.expected_recovery_at desc
    limit 1
  ) as active_injury on true;
$$;

notify pgrst, 'reload schema';

commit;
