-- ============================================================
-- Objectifs de carrière du Directeur Sportif
-- Progression calculée depuis les faits de jeu et gains atomiques.
-- ============================================================

begin;

insert into public.inventory_catalog_items (
  item_key,
  name,
  category,
  rarity,
  description,
  effect_summary,
  effect_payload,
  icon_key,
  is_consumable
)
values
  (
    'medallion-flahute',
    'Médaillon Flahute',
    'special_ability',
    'epic',
    'Un médaillon à attribuer à un coureur pour lui transmettre la capacité Flahute.',
    'Débloque définitivement la capacité Flahute.',
    '{"abilityCode":"flahute"}'::jsonb,
    'medallion',
    true
  ),
  (
    'medallion-bottle-carrier',
    'Médaillon Porteur de bidon',
    'special_ability',
    'epic',
    'Un médaillon à attribuer à un coureur pour lui transmettre la capacité Porteur de bidon.',
    'Débloque définitivement la capacité Porteur de bidon.',
    '{"abilityCode":"bottle_carrier"}'::jsonb,
    'medallion',
    true
  ),
  (
    'medallion-locomotive',
    'Médaillon Locomotive',
    'special_ability',
    'epic',
    'Un médaillon à attribuer à un coureur pour lui transmettre la capacité Locomotive.',
    'Débloque définitivement la capacité Locomotive.',
    '{"abilityCode":"locomotive"}'::jsonb,
    'medallion',
    true
  ),
  (
    'medallion-giclette',
    'Médaillon Giclette',
    'special_ability',
    'epic',
    'Un médaillon à attribuer à un coureur pour lui transmettre la capacité Giclette.',
    'Débloque définitivement la capacité Giclette.',
    '{"abilityCode":"giclette"}'::jsonb,
    'medallion',
    true
  ),
  (
    'medallion-chase-potato',
    'Médaillon Chasse patate',
    'special_ability',
    'epic',
    'Un médaillon à attribuer à un coureur pour lui transmettre la capacité Chasse patate.',
    'Débloque définitivement la capacité Chasse patate.',
    '{"abilityCode":"chase_potato"}'::jsonb,
    'medallion',
    true
  ),
  (
    'potential-spark',
    'Déclic de potentiel',
    'potential_boost',
    'rare',
    'Une intervention ciblée qui repousse légèrement le plafond de progression d’un coureur.',
    '+0,5 potentiel au coureur sélectionné.',
    '{"potentialBonus":0.5}'::jsonb,
    'potential',
    true
  ),
  (
    'sprint-masterclass',
    'Masterclass de sprint',
    'rating_boost',
    'rare',
    'Un programme intensif consacré au placement et à la vitesse de pointe.',
    '+2 SPR au coureur sélectionné.',
    '{"ratingKey":"sprint","ratingBonus":2}'::jsonb,
    'rating',
    true
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
  status = 'active',
  updated_at = now();

create table public.game_objective_definitions (
  objective_key text primary key,
  objective_type text not null,
  objective_group text not null,
  title text not null,
  description text not null,
  metric_key text not null,
  target_value integer not null,
  reward_cash numeric(14, 2) not null default 0,
  reward_experience integer not null default 0,
  reward_reputation numeric(12, 2) not null default 0,
  reward_inventory_item_key text
    references public.inventory_catalog_items(item_key)
    on delete restrict,
  reward_equipment_catalog_key text
    references public.equipment_catalog_items(catalog_key)
    on delete restrict,
  reward_random_special_ability boolean not null default false,
  display_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint game_objective_definitions_type_allowed
    check (objective_type in ('primary', 'secondary')),
  constraint game_objective_definitions_group_not_empty
    check (btrim(objective_group) <> ''),
  constraint game_objective_definitions_title_not_empty
    check (btrim(title) <> ''),
  constraint game_objective_definitions_description_not_empty
    check (btrim(description) <> ''),
  constraint game_objective_definitions_metric_not_empty
    check (btrim(metric_key) <> ''),
  constraint game_objective_definitions_target_positive
    check (target_value > 0),
  constraint game_objective_definitions_rewards_non_negative
    check (
      reward_cash >= 0
      and reward_experience >= 0
      and reward_reputation >= 0
    ),
  constraint game_objective_definitions_single_item_reward
    check (
      num_nonnulls(
        reward_inventory_item_key,
        reward_equipment_catalog_key,
        nullif(reward_random_special_ability, false)
      ) <= 1
    ),
  constraint game_objective_definitions_has_reward
    check (
      reward_cash > 0
      or reward_experience > 0
      or reward_reputation > 0
      or reward_inventory_item_key is not null
      or reward_equipment_catalog_key is not null
      or reward_random_special_ability
    ),
  constraint game_objective_definitions_order_positive
    check (display_order > 0)
);

create table public.game_objective_claims (
  id uuid primary key default gen_random_uuid(),
  objective_key text not null
    references public.game_objective_definitions(objective_key)
    on delete restrict,
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete restrict,
  reward_event_id uuid
    references public.reward_events(id)
    on delete set null,
  reward_inventory_item_id uuid
    references public.inventory_catalog_items(id)
    on delete set null,
  reward_equipment_item_id uuid
    references public.equipment_catalog_items(id)
    on delete set null,
  claimed_at timestamptz not null default now(),

  constraint game_objective_claims_once_per_director
    unique (sporting_director_id, objective_key)
);

create index game_objective_claims_director_idx
  on public.game_objective_claims (sporting_director_id, claimed_at desc);

insert into public.game_objective_definitions (
  objective_key,
  objective_type,
  objective_group,
  title,
  description,
  metric_key,
  target_value,
  reward_cash,
  reward_experience,
  reward_reputation,
  reward_inventory_item_key,
  reward_equipment_catalog_key,
  reward_random_special_ability,
  display_order
)
values
  ('first_steps', 'primary', 'onboarding', 'Premiers pas', 'Finaliser la création du Directeur Sportif en choisissant sa nationalité et son avatar.', 'director_profile_complete', 1, 10000, 20, 1, null, null, false, 10),
  ('beautiful_team', 'primary', 'onboarding', 'Belle équipe', 'Finaliser la création de son équipe amateur et de son maillot fondateur.', 'amateur_team_complete', 1, 5000, 10, 0, null, 'montclair-grip-one', false, 20),
  ('first_registration', 'primary', 'onboarding', 'Engagez-vous qu’ils disaient', 'Inscrire son équipe à une première course du calendrier.', 'race_registrations', 1, 3000, 20, 1, null, null, false, 30),
  ('recruitment_life', 'primary', 'onboarding', 'Recruter, c’est la vie', 'Recruter au moins un membre du staff et un nouveau coureur.', 'staff_and_rider_recruited', 1, 6000, 30, 0, 'acceleration-focus', null, false, 40),

  ('victory_1', 'secondary', 'victories', 'Le goût de la victoire', 'Remporter une première course, un classement général ou une étape de tour.', 'victories', 1, 5000, 20, 1, null, null, false, 100),
  ('victory_5', 'secondary', 'victories', 'Une habitude à prendre', 'Atteindre cinq victoires en carrière.', 'victories', 5, 15000, 60, 2, 'potential-spark', null, false, 110),
  ('victory_10', 'secondary', 'victories', 'Culture de la gagne', 'Atteindre dix victoires en carrière.', 'victories', 10, 30000, 120, 4, null, null, true, 120),

  ('roster_10', 'secondary', 'roster', 'Le groupe s’étoffe', 'Compter dix coureurs sous contrat actif.', 'active_riders', 10, 4000, 15, 0, null, null, false, 200),
  ('roster_15', 'secondary', 'roster', 'Un vrai collectif', 'Compter quinze coureurs sous contrat actif.', 'active_riders', 15, 9000, 35, 0, 'acceleration-focus', null, false, 210),
  ('roster_20', 'secondary', 'roster', 'Profondeur de banc', 'Compter vingt coureurs sous contrat actif.', 'active_riders', 20, 18000, 70, 1, 'potential-spark', null, false, 220),

  ('equipment_1', 'secondary', 'equipment', 'Première amélioration', 'Réaliser un premier achat de matériel commercial.', 'equipment_purchases', 1, 1000, 10, 0, null, null, false, 300),
  ('equipment_5', 'secondary', 'equipment', 'À la pointe', 'Réaliser cinq achats de matériel commercial.', 'equipment_purchases', 5, 4000, 25, 0, 'mountain-focus', null, false, 310),
  ('equipment_15', 'secondary', 'equipment', 'Armurerie cycliste', 'Réaliser quinze achats de matériel commercial.', 'equipment_purchases', 15, 10000, 60, 1, 'sprint-masterclass', null, false, 320),

  ('staff_3', 'secondary', 'staff', 'Bien entouré', 'Réunir trois membres actifs dans le staff de l’équipe.', 'active_staff', 3, 4000, 20, 0, null, null, false, 400),
  ('staff_6', 'secondary', 'staff', 'Structure professionnelle', 'Réunir six membres actifs dans le staff de l’équipe.', 'active_staff', 6, 10000, 50, 1, 'potential-spark', null, false, 410),

  ('level_2', 'secondary', 'progression', 'Prendre ses marques', 'Atteindre le niveau 2 de Directeur Sportif.', 'director_level', 2, 3000, 10, 0, null, null, false, 500),
  ('level_5', 'secondary', 'progression', 'Directeur confirmé', 'Atteindre le niveau 5 de Directeur Sportif.', 'director_level', 5, 10000, 35, 1, 'acceleration-focus', null, false, 510),
  ('level_10', 'secondary', 'progression', 'Maître tacticien', 'Atteindre le niveau 10 de Directeur Sportif.', 'director_level', 10, 25000, 100, 3, 'potential-notebook', null, false, 520),

  ('jersey_1', 'secondary', 'jerseys', 'La couleur du succès', 'Remporter un premier maillot distinctif sur un tour.', 'distinctive_jerseys', 1, 8000, 30, 1, null, null, false, 600),
  ('jersey_3', 'secondary', 'jerseys', 'Collectionneur de maillots', 'Remporter trois maillots distinctifs sur des tours.', 'distinctive_jerseys', 3, 20000, 75, 2, null, null, true, 610),

  ('national_5', 'secondary', 'participations', 'Ancré dans le pays', 'Terminer cinq participations à des courses de catégorie Nationale.', 'participation_national', 5, 5000, 25, 0, null, null, false, 700),
  ('continental_5', 'secondary', 'participations', 'Changer d’échelle', 'Terminer cinq participations à des courses Continentales.', 'participation_continental', 5, 10000, 50, 1, null, null, false, 710),
  ('world_3', 'secondary', 'participations', 'Voir le monde', 'Terminer trois participations à des courses Mondiales.', 'participation_world', 3, 15000, 75, 2, null, null, false, 720),
  ('elite_1', 'secondary', 'participations', 'Dans la cour des grands', 'Terminer une participation à une course Élite.', 'participation_elite', 1, 20000, 100, 3, 'potential-spark', null, false, 730),

  ('wildcard_1', 'secondary', 'wildcards', 'L’invité surprise', 'Obtenir une première wildcard acceptée.', 'accepted_wildcards', 1, 7000, 30, 1, null, null, false, 800),
  ('wildcard_5', 'secondary', 'wildcards', 'Toujours sur la liste', 'Obtenir cinq wildcards acceptées.', 'accepted_wildcards', 5, 20000, 80, 2, null, null, true, 810),

  ('breakaway_5', 'secondary', 'racing', 'Prendre le large', 'Placer cinq fois un coureur dans une échappée ou un groupe de chasse officiel.', 'breakaway_appearances', 5, 5000, 25, 1, null, null, false, 900),
  ('first_sponsor', 'secondary', 'sponsoring', 'Un nom sur le maillot', 'Signer un premier contrat avec un sponsor principal.', 'sponsor_contracts', 1, 5000, 20, 1, null, null, false, 910)
on conflict (objective_key) do update set
  objective_type = excluded.objective_type,
  objective_group = excluded.objective_group,
  title = excluded.title,
  description = excluded.description,
  metric_key = excluded.metric_key,
  target_value = excluded.target_value,
  reward_cash = excluded.reward_cash,
  reward_experience = excluded.reward_experience,
  reward_reputation = excluded.reward_reputation,
  reward_inventory_item_key = excluded.reward_inventory_item_key,
  reward_equipment_catalog_key = excluded.reward_equipment_catalog_key,
  reward_random_special_ability = excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

create or replace function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value integer := 0;
  v_category_code text;
begin
  case p_metric_key
    when 'director_profile_complete' then
      select case when country_id is not null and avatar_key is not null then 1 else 0 end
      into v_value
      from public.sporting_directors
      where id = p_director_id;

    when 'amateur_team_complete' then
      select case when exists (
        select 1
        from public.team_manager_assignments as assignment
        join public.teams as team on team.id = assignment.team_id
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and team.amateur_name is not null
          and team.amateur_identity_configured_at is not null
      ) then 1 else 0 end
      into v_value;

    when 'race_registrations' then
      select count(*)::integer
      into v_value
      from public.race_registrations as registration
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      where registration.status in ('pending', 'accepted')
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'staff_and_rider_recruited' then
      select case when
        exists (
          select 1
          from public.staff_contracts as contract
          where contract.status in ('active', 'completed')
            and exists (
              select 1
              from public.team_manager_assignments as assignment
              where assignment.sporting_director_id = p_director_id
                and assignment.role = 'general_manager'
                and assignment.team_id = contract.team_id
            )
        )
        and exists (
          select 1
          from public.rider_contracts as contract
          where contract.acquisition_type in (
            'daily_auction', 'director_auction', 'free_agent'
          )
            and contract.status in ('active', 'completed', 'terminated')
            and exists (
              select 1
              from public.team_manager_assignments as assignment
              where assignment.sporting_director_id = p_director_id
                and assignment.role = 'general_manager'
                and assignment.team_id = contract.team_id
            )
        )
      then 1 else 0 end
      into v_value;

    when 'victories' then
      select
        (
          select count(*)::integer
          from public.race_results as result
          join public.race_rosters as roster on roster.id = result.race_roster_id
          join public.race_registrations as registration
            on registration.id = roster.race_registration_id
          join public.team_seasons as team_season
            on team_season.id = registration.team_season_id
          where result.final_rank = 1
            and exists (
              select 1
              from public.team_manager_assignments as assignment
              where assignment.sporting_director_id = p_director_id
                and assignment.role = 'general_manager'
                and assignment.team_id = team_season.team_id
            )
        ) + (
          select count(*)::integer
          from public.stage_results as result
          join public.stages as stage on stage.id = result.stage_id
          join public.race_rosters as roster on roster.id = result.race_roster_id
          join public.race_registrations as registration
            on registration.id = roster.race_registration_id
          join public.team_seasons as team_season
            on team_season.id = registration.team_season_id
          where result.rank = 1
            and (
              select count(*)
              from public.stages as edition_stage
              where edition_stage.race_edition_id = stage.race_edition_id
            ) > 1
            and exists (
              select 1
              from public.team_manager_assignments as assignment
              where assignment.sporting_director_id = p_director_id
                and assignment.role = 'general_manager'
                and assignment.team_id = team_season.team_id
            )
        )
      into v_value;

    when 'active_riders' then
      select count(*)::integer
      into v_value
      from public.rider_contracts
      where team_id = p_current_team_id
        and status = 'active';

    when 'equipment_purchases' then
      select count(*)::integer
      into v_value
      from public.team_finance_transactions as transaction
      join public.team_seasons as team_season
        on team_season.id = transaction.team_season_id
      where transaction.category = 'equipment'
        and transaction.status = 'posted'
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'active_staff' then
      select count(*)::integer
      into v_value
      from public.staff_contracts
      where team_id = p_current_team_id
        and status = 'active';

    when 'director_level' then
      v_value := public.calculate_staff_director_level(p_experience_points);

    when 'distinctive_jerseys' then
      select (
        select count(*)::integer
        from public.race_secondary_results as secondary
        where secondary.rank = 1
          and secondary.classification_type in ('mountain', 'sprint', 'youth')
          and (
            (
              secondary.race_roster_id is not null
              and exists (
                select 1
                from public.race_rosters as roster
                join public.race_registrations as registration
                  on registration.id = roster.race_registration_id
                join public.team_seasons as team_season
                  on team_season.id = registration.team_season_id
                join public.team_manager_assignments as assignment
                  on assignment.team_id = team_season.team_id
                where roster.id = secondary.race_roster_id
                  and assignment.sporting_director_id = p_director_id
                  and assignment.role = 'general_manager'
              )
            )
          )
      ) + (
        select count(*)::integer
        from public.race_results as result
        join public.race_editions as edition
          on edition.id = result.race_edition_id
        join public.race_rosters as roster
          on roster.id = result.race_roster_id
        join public.race_registrations as registration
          on registration.id = roster.race_registration_id
        join public.team_seasons as team_season
          on team_season.id = registration.team_season_id
        where result.final_rank = 1
          and (
            select count(*)
            from public.stages as stage
            where stage.race_edition_id = edition.id
          ) > 1
          and exists (
            select 1
            from public.team_manager_assignments as assignment
            where assignment.sporting_director_id = p_director_id
              and assignment.role = 'general_manager'
              and assignment.team_id = team_season.team_id
          )
      )
      into v_value;

    when 'accepted_wildcards' then
      select count(*)::integer
      into v_value
      from public.race_registrations as registration
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      where registration.entry_method = 'invited'
        and registration.status = 'accepted'
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'breakaway_appearances' then
      select count(*)::integer
      into v_value
      from public.stage_attack_participants as participant
      join public.race_rosters as roster
        on roster.id = participant.race_roster_id
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      where exists (
        select 1
        from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = team_season.team_id
      );

    when 'sponsor_contracts' then
      select count(*)::integer
      into v_value
      from public.team_sponsor_contracts as contract
      where contract.role = 'principal'
        and contract.status in ('planned', 'active', 'completed', 'terminated')
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = contract.team_id
        );

    else
      if p_metric_key like 'participation_%' then
        v_category_code := substring(p_metric_key from 15);
        select count(*)::integer
        into v_value
        from public.race_registrations as registration
        join public.team_seasons as team_season
          on team_season.id = registration.team_season_id
        join public.race_editions as edition
          on edition.id = registration.race_edition_id
        join public.race_categories as category
          on category.id = edition.race_category_id
        where registration.status = 'accepted'
          and edition.status = 'completed'
          and category.code = v_category_code
          and exists (
            select 1
            from public.team_manager_assignments as assignment
            where assignment.sporting_director_id = p_director_id
              and assignment.role = 'general_manager'
              and assignment.team_id = team_season.team_id
          );
      else
        raise exception 'La métrique d’objectif % est inconnue.', p_metric_key;
      end if;
  end case;

  return greatest(0, coalesce(v_value, 0));
end;
$$;

create or replace function public.get_current_game_objectives()
returns table (
  objective_key text,
  objective_type text,
  objective_group text,
  title text,
  description text,
  current_value integer,
  target_value integer,
  reward_cash numeric,
  reward_experience integer,
  reward_reputation numeric,
  reward_item_name text,
  reward_item_kind text,
  display_order integer,
  claimed_at timestamptz,
  is_completed boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_context record;
begin
  select
    director.id as director_id,
    director.experience_points,
    assignment.team_id
  into v_context
  from public.sporting_directors as director
  left join lateral (
    select managed.team_id
    from public.team_manager_assignments as managed
    where managed.sporting_director_id = director.id
      and managed.role = 'general_manager'
      and managed.status = 'active'
    order by managed.created_at desc
    limit 1
  ) as assignment on true
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    return;
  end if;

  return query
  select
    definition.objective_key,
    definition.objective_type,
    definition.objective_group,
    definition.title,
    definition.description,
    progress.value,
    definition.target_value,
    definition.reward_cash,
    definition.reward_experience,
    definition.reward_reputation,
    case
      when definition.reward_random_special_ability
        then 'Médaillon de capacité spéciale aléatoire'
      else coalesce(inventory_item.name, equipment_item.name)
    end,
    case
      when definition.reward_random_special_ability then 'special_ability'
      when definition.reward_inventory_item_key is not null then inventory_item.category
      when definition.reward_equipment_catalog_key is not null then 'equipment'
      else null
    end,
    definition.display_order,
    claim.claimed_at,
    progress.value >= definition.target_value
  from public.game_objective_definitions as definition
  cross join lateral (
    select public.calculate_game_objective_progress(
      definition.metric_key,
      v_context.director_id,
      v_context.team_id,
      v_context.experience_points
    ) as value
  ) as progress
  left join public.game_objective_claims as claim
    on claim.objective_key = definition.objective_key
    and claim.sporting_director_id = v_context.director_id
  left join public.inventory_catalog_items as inventory_item
    on inventory_item.item_key = definition.reward_inventory_item_key
  left join public.equipment_catalog_items as equipment_item
    on equipment_item.catalog_key = definition.reward_equipment_catalog_key
  where definition.is_active = true
  order by definition.display_order;
end;
$$;

create or replace function public.claim_current_game_objective(
  p_objective_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_definition public.game_objective_definitions%rowtype;
  v_progress integer;
  v_claim_id uuid;
  v_reward_event_id uuid;
  v_inventory_item_id uuid;
  v_inventory_item_name text;
  v_equipment_item_id uuid;
  v_equipment_item_name text;
  v_reward_item_name text;
begin
  if btrim(coalesce(p_objective_key, '')) = '' then
    raise exception 'L’objectif à récupérer est obligatoire.';
  end if;

  select
    director.id as director_id,
    director.experience_points,
    assignment.team_id,
    season.id as season_id,
    season.current_day_number,
    season_day.id as season_day_id,
    team_season.id as team_season_id
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
  left join public.season_days as season_day
    on season_day.season_id = season.id
    and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1
  for update of team_season;

  if v_context is null then
    raise exception 'Une équipe active est nécessaire pour récupérer cette récompense.';
  end if;

  select *
  into v_definition
  from public.game_objective_definitions
  where objective_key = btrim(p_objective_key)
    and is_active = true;

  if v_definition is null then
    raise exception 'Cet objectif est introuvable.';
  end if;

  v_progress := public.calculate_game_objective_progress(
    v_definition.metric_key,
    v_context.director_id,
    v_context.team_id,
    v_context.experience_points
  );

  if v_progress < v_definition.target_value then
    raise exception 'Cet objectif n’est pas encore terminé (%/%).',
      v_progress,
      v_definition.target_value;
  end if;

  if v_definition.reward_random_special_ability then
    select id, name
    into v_inventory_item_id, v_inventory_item_name
    from public.inventory_catalog_items
    where category = 'special_ability'
      and status = 'active'
    order by random()
    limit 1;
  elsif v_definition.reward_inventory_item_key is not null then
    select id, name
    into v_inventory_item_id, v_inventory_item_name
    from public.inventory_catalog_items
    where item_key = v_definition.reward_inventory_item_key
      and status = 'active';
  elsif v_definition.reward_equipment_catalog_key is not null then
    select id, name
    into v_equipment_item_id, v_equipment_item_name
    from public.equipment_catalog_items
    where catalog_key = v_definition.reward_equipment_catalog_key
      and status = 'active';
  end if;

  if (
    (v_definition.reward_random_special_ability
      or v_definition.reward_inventory_item_key is not null)
    and v_inventory_item_id is null
  ) or (
    v_definition.reward_equipment_catalog_key is not null
    and v_equipment_item_id is null
  ) then
    raise exception 'L’objet prévu par cet objectif est momentanément indisponible.';
  end if;

  begin
    insert into public.game_objective_claims (
      objective_key,
      sporting_director_id,
      team_season_id,
      reward_inventory_item_id,
      reward_equipment_item_id
    )
    values (
      v_definition.objective_key,
      v_context.director_id,
      v_context.team_season_id,
      v_inventory_item_id,
      v_equipment_item_id
    )
    returning id into v_claim_id;
  exception
    when unique_violation then
      raise exception 'La récompense de cet objectif a déjà été récupérée.';
  end;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    reputation_points,
    experience_points,
    cash_prize,
    description
  )
  values (
    'game-objective:' || v_context.director_id::text || ':' || v_definition.objective_key,
    'game_objective',
    v_context.director_id,
    v_context.team_season_id,
    v_definition.reward_reputation,
    v_definition.reward_experience,
    v_definition.reward_cash,
    'Objectif accompli : ' || v_definition.title
  )
  returning id into v_reward_event_id;

  update public.game_objective_claims
  set reward_event_id = v_reward_event_id
  where id = v_claim_id;

  update public.sporting_directors
  set
    experience_points = experience_points + v_definition.reward_experience,
    reputation_points = reputation_points + v_definition.reward_reputation
  where id = v_context.director_id;

  if v_definition.reward_cash > 0 then
    update public.team_seasons
    set cash_balance = cash_balance + v_definition.reward_cash
    where id = v_context.team_season_id;

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
      greatest(1, least(28, v_context.current_day_number)),
      v_definition.reward_cash,
      'other',
      'posted',
      'Récompense d’objectif : ' || v_definition.title,
      'objective:' || v_claim_id::text,
      now()
    );
  end if;

  if v_inventory_item_id is not null then
    insert into public.team_item_inventory (
      team_season_id,
      inventory_item_id,
      quantity,
      acquisition_source
    )
    values (
      v_context.team_season_id,
      v_inventory_item_id,
      1,
      'Objectif : ' || v_definition.title
    )
    on conflict (team_season_id, inventory_item_id) do update set
      quantity = public.team_item_inventory.quantity + 1,
      acquisition_source = excluded.acquisition_source,
      updated_at = now();

    v_reward_item_name := v_inventory_item_name;
  elsif v_equipment_item_id is not null then
    insert into public.team_equipment_inventory (
      team_season_id,
      equipment_item_id,
      quantity,
      last_purchase_price
    )
    values (
      v_context.team_season_id,
      v_equipment_item_id,
      1,
      0
    )
    on conflict (team_season_id, equipment_item_id) do update set
      quantity = public.team_equipment_inventory.quantity + 1,
      updated_at = now();

    v_reward_item_name := v_equipment_item_name;
  end if;

  return jsonb_build_object(
    'objectiveKey', v_definition.objective_key,
    'title', v_definition.title,
    'cash', v_definition.reward_cash,
    'experience', v_definition.reward_experience,
    'reputation', v_definition.reward_reputation,
    'itemName', v_reward_item_name,
    'claimedAt', now()
  );
end;
$$;

alter table public.game_objective_definitions enable row level security;
alter table public.game_objective_claims enable row level security;

create policy game_objective_definitions_read_authenticated
on public.game_objective_definitions
for select
to authenticated
using (is_active = true);

create policy game_objective_claims_read_own
on public.game_objective_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id = game_objective_claims.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

grant select on table public.game_objective_definitions to authenticated, service_role;
grant select on table public.game_objective_claims to authenticated;
grant all privileges on table public.game_objective_claims to service_role;

revoke all on function public.calculate_game_objective_progress(
  text, uuid, uuid, numeric
) from public;

revoke all on function public.get_current_game_objectives() from public;
grant execute on function public.get_current_game_objectives() to authenticated;

revoke all on function public.claim_current_game_objective(text) from public;
grant execute on function public.claim_current_game_objective(text) to authenticated;

comment on table public.game_objective_definitions is
  'Catalogue versionné des objectifs de carrière et de leurs récompenses annoncées.';

comment on table public.game_objective_claims is
  'Récompenses d’objectifs récupérées une seule fois par Directeur Sportif.';

comment on function public.claim_current_game_objective(text) is
  'Vérifie la progression puis attribue de façon atomique argent, XP, réputation et objet.';

notify pgrst, 'reload schema';

commit;
