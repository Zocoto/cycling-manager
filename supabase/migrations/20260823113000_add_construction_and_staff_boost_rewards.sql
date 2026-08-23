begin;

-- Trois objets de gestion, équilibrés sur la grille quotidienne existante :
-- N4 / peu courant, N7 / rare et N10 / exceptionnel.
alter table public.daily_reward_catalog
  drop constraint if exists daily_reward_catalog_effect_allowed;
alter table public.daily_reward_catalog
  add constraint daily_reward_catalog_effect_allowed check (
    effect_kind in (
      'form_boost', 'rider_experience', 'rating_boost',
      'training_multiplier', 'scouting_boost', 'equipment',
      'special_ability', 'naturalization', 'wildcard',
      'instant_youth_promotion', 'custom_staff_recruitment',
      'construction_time_reduction', 'staff_level_boost'
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
    'construction-square',
    'Équerre de chantier',
    'Un outil de contrôle qui permet de corriger rapidement le planning d’un bâtiment déjà en construction.',
    'Retire 2 jours à un chantier actif · 1 jour minimum restant',
    4,
    'construction_time_reduction',
    '{"days":2}'::jsonb,
    'architect',
    true
  ),
  (
    'precision-architect-tee',
    'Té d’architecte de précision',
    'Un instrument rare réservé aux grands chantiers, capable de raccourcir nettement un calendrier de construction en cours.',
    'Retire 7 jours à un chantier actif · 1 jour minimum restant',
    7,
    'construction_time_reduction',
    '{"days":7}'::jsonb,
    'architect',
    true
  ),
  (
    'staff-expertise-badge',
    'Insigne d’expertise',
    'Récompense un membre actif du staff par une progression immédiate de son niveau professionnel.',
    '+1 étoile au membre du staff choisi · maximum 5★',
    10,
    'staff_level_boost',
    '{}'::jsonb,
    'staff',
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
values
  (
    'construction-square',
    'Équerre de chantier',
    'other',
    'uncommon',
    'Un outil de contrôle qui permet de corriger rapidement le planning d’un bâtiment déjà en construction.',
    'Retire 2 jours à un chantier actif · 1 jour minimum restant',
    '{"effectKind":"construction_time_reduction","days":2,"level":4}'::jsonb,
    'architect',
    true,
    'active'
  ),
  (
    'precision-architect-tee',
    'Té d’architecte de précision',
    'other',
    'rare',
    'Un instrument rare réservé aux grands chantiers, capable de raccourcir nettement un calendrier de construction en cours.',
    'Retire 7 jours à un chantier actif · 1 jour minimum restant',
    '{"effectKind":"construction_time_reduction","days":7,"level":7}'::jsonb,
    'architect',
    true,
    'active'
  ),
  (
    'staff-expertise-badge',
    'Insigne d’expertise',
    'other',
    'epic',
    'Récompense un membre actif du staff par une progression immédiate de son niveau professionnel.',
    '+1 étoile au membre du staff choisi · maximum 5★',
    '{"effectKind":"staff_level_boost","level":10,"maximumLevel":5}'::jsonb,
    'staff',
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

create or replace function public.get_current_management_reward_targets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_current_game_day integer;
  v_projects jsonb := '[]'::jsonb;
  v_staff jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  select
    assignment.team_id,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as current_day_number
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    return jsonb_build_object(
      'constructionProjects', '[]'::jsonb,
      'staffMembers', '[]'::jsonb
    );
  end if;

  v_current_game_day :=
    v_context.game_year * 28 + v_context.current_day_number - 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', project.id,
    'name', case project.infrastructure_code
      when 'recruitment_data_room' then 'Data Room du recrutement'
      when 'staff_academy' then 'Académie des métiers'
      when 'training_center' then 'Centre d’entraînement'
      when 'indoor_track' then 'Piste indoor'
      when 'cryotherapy_center' then 'Centre de cryothérapie'
      when 'wind_tunnel' then 'Soufflerie'
      when 'research_lab' then 'Laboratoire R&D'
      when 'international_welcome_center' then 'Centre d’accueil international'
      when 'international_youth_center' then
        'Centre international' || coalesce(' · ' || country.name, '')
      when 'weather_center' then 'Centre météo'
      when 'media_center' then 'Média Center'
      when 'fan_club_headquarters' then 'Siège du Fan Club'
      when 'club_shop' then 'Boutique du club'
      else project.infrastructure_code
    end,
    'targetLevel', project.target_level,
    'remainingDays', greatest(
      0,
      project.completes_game_day_index - v_current_game_day
    )
  ) order by project.completes_game_day_index, project.created_at), '[]'::jsonb)
  into v_projects
  from public.infrastructure_projects as project
  left join public.countries as country on country.id = project.country_id
  where project.team_id = v_context.team_id
    and project.status = 'active'
    and project.completes_game_day_index > v_current_game_day;

  select coalesce(jsonb_agg(jsonb_build_object(
    'contractId', contract.id,
    'name', concat_ws(' ', member.first_name, member.last_name),
    'roleLabel', case member.role
      when 'trainer' then 'Entraîneur'
      when 'scout' then 'Scout'
      when 'doctor' then 'Médecin'
      when 'mechanic' then 'Mécanicien'
      when 'community_manager' then 'Community manager'
      when 'nutritionist' then 'Nutritionniste'
      when 'physiotherapist' then 'Kiné'
      when 'race_preparer' then 'Préparateur de parcours'
      when 'architect' then 'Architecte'
      when 'research_engineer' then 'Ingénieur R&D'
      else member.role
    end,
    'level', member.level
  ) order by member.level desc, member.last_name, member.first_name), '[]'::jsonb)
  into v_staff
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and member.level < 5;

  return jsonb_build_object(
    'constructionProjects', v_projects,
    'staffMembers', v_staff
  );
end;
$$;

create or replace function public.redeem_construction_time_reward(
  p_inventory_id uuid,
  p_project_id uuid
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
  v_project record;
  v_current_game_day integer;
  v_reduction_days integer;
  v_remaining_days integer;
  v_applied_days integer;
  v_project_name text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if p_inventory_id is null or p_project_id is null then
    raise exception 'Sélectionnez un objet et un chantier valides.';
  end if;

  perform public.sync_active_season_day();
  perform public.settle_due_infrastructure_projects();

  select
    director.id as director_id,
    assignment.team_id,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as current_day_number,
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
   and team_season.status in ('planned', 'active')
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select
    inventory.*,
    catalog.effect_kind,
    catalog.effect_payload,
    catalog.name as reward_name
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
      inventory.id as team_inventory_id,
      inventory.quantity,
      'available'::text as status,
      2147483647::integer as expires_after_game_year,
      catalog.effect_payload ->> 'effectKind' as effect_kind,
      catalog.effect_payload,
      catalog.name as reward_name
    into v_reward
    from public.team_item_inventory as inventory
    join public.inventory_catalog_items as catalog
      on catalog.id = inventory.inventory_item_id
     and catalog.status = 'active'
    where inventory.team_season_id = v_context.team_season_id
      and inventory.inventory_item_id = p_inventory_id
      and inventory.quantity > 0
    for update of inventory;
  end if;

  if v_reward is null
    or v_reward.status <> 'available'
    or v_reward.effect_kind <> 'construction_time_reduction'
  then
    raise exception 'Cet outil d’architecte n’est plus disponible.';
  end if;
  if v_reward.expires_after_game_year < v_context.game_year then
    update public.daily_reward_inventory
    set status = 'expired'
    where id = p_inventory_id;
    raise exception 'Ce cadeau a expiré à la fin de la saison précédente.';
  end if;

  v_reduction_days := greatest(
    1,
    least(28, coalesce((v_reward.effect_payload ->> 'days')::integer, 1))
  );
  v_current_game_day :=
    v_context.game_year * 28 + v_context.current_day_number - 1;

  select project.*
  into v_project
  from public.infrastructure_projects as project
  where project.id = p_project_id
    and project.team_id = v_context.team_id
    and project.status = 'active'
  for update of project;

  if v_project is null then
    raise exception 'Ce chantier n’est plus actif.';
  end if;

  v_remaining_days :=
    v_project.completes_game_day_index - v_current_game_day;
  if v_remaining_days <= 1 then
    raise exception 'Ce chantier se termine déjà dans un jour : aucun accélérateur n’est nécessaire.';
  end if;

  v_applied_days := least(v_reduction_days, v_remaining_days - 1);
  update public.infrastructure_projects
  set
    final_duration_days = final_duration_days - v_applied_days,
    completes_game_day_index = completes_game_day_index - v_applied_days,
    updated_at = now()
  where id = v_project.id;

  if v_reward_source = 'daily_reward' then
    update public.daily_reward_inventory
    set
      status = 'used',
      used_at = now(),
      usage_payload = jsonb_build_object(
        'projectId', v_project.id,
        'daysRemoved', v_applied_days
      )
    where id = p_inventory_id;
  elsif v_reward.quantity = 1 then
    delete from public.team_item_inventory
    where id = v_reward.team_inventory_id;
  else
    update public.team_item_inventory
    set quantity = quantity - 1, updated_at = now()
    where id = v_reward.team_inventory_id;
  end if;

  v_project_name := case v_project.infrastructure_code
    when 'recruitment_data_room' then 'Data Room du recrutement'
    when 'staff_academy' then 'Académie des métiers'
    when 'training_center' then 'Centre d’entraînement'
    when 'indoor_track' then 'Piste indoor'
    when 'cryotherapy_center' then 'Centre de cryothérapie'
    when 'wind_tunnel' then 'Soufflerie'
    when 'research_lab' then 'Laboratoire R&D'
    when 'international_welcome_center' then 'Centre d’accueil international'
    when 'international_youth_center' then 'Centre international'
    when 'weather_center' then 'Centre météo'
    when 'media_center' then 'Média Center'
    when 'fan_club_headquarters' then 'Siège du Fan Club'
    when 'club_shop' then 'Boutique du club'
    else v_project.infrastructure_code
  end;

  return jsonb_build_object(
    'inventoryId', p_inventory_id,
    'projectId', v_project.id,
    'daysRemoved', v_applied_days,
    'remainingDays', v_remaining_days - v_applied_days,
    'message', v_reward.reward_name || ' utilisé sur ' || v_project_name
      || ' : ' || v_applied_days::text || ' jour(s) retiré(s), '
      || (v_remaining_days - v_applied_days)::text || ' restant(s).'
  );
end;
$$;

create or replace function public.redeem_staff_level_boost_reward(
  p_inventory_id uuid,
  p_staff_contract_id uuid
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
  v_staff record;
  v_new_level integer;
  v_role_label text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if p_inventory_id is null or p_staff_contract_id is null then
    raise exception 'Sélectionnez un objet et un membre du staff valides.';
  end if;

  perform public.sync_active_season_day();

  select
    director.id as director_id,
    assignment.team_id,
    season.game_year,
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
   and team_season.status in ('planned', 'active')
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select
    inventory.*,
    catalog.effect_kind,
    catalog.name as reward_name
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
      inventory.id as team_inventory_id,
      inventory.quantity,
      'available'::text as status,
      2147483647::integer as expires_after_game_year,
      catalog.effect_payload ->> 'effectKind' as effect_kind,
      catalog.name as reward_name
    into v_reward
    from public.team_item_inventory as inventory
    join public.inventory_catalog_items as catalog
      on catalog.id = inventory.inventory_item_id
     and catalog.status = 'active'
    where inventory.team_season_id = v_context.team_season_id
      and inventory.inventory_item_id = p_inventory_id
      and inventory.quantity > 0
    for update of inventory;
  end if;

  if v_reward is null
    or v_reward.status <> 'available'
    or v_reward.effect_kind <> 'staff_level_boost'
  then
    raise exception 'Cet Insigne d’expertise n’est plus disponible.';
  end if;
  if v_reward.expires_after_game_year < v_context.game_year then
    update public.daily_reward_inventory
    set status = 'expired'
    where id = p_inventory_id;
    raise exception 'Ce cadeau a expiré à la fin de la saison précédente.';
  end if;

  select
    contract.id as contract_id,
    member.id as staff_member_id,
    member.first_name,
    member.last_name,
    member.role,
    member.level
  into v_staff
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  where contract.id = p_staff_contract_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update of contract, member;

  if v_staff is null then
    raise exception 'Ce membre ne fait plus partie de votre staff actif.';
  end if;
  if v_staff.level >= 5 then
    raise exception 'Ce membre du staff possède déjà cinq étoiles.';
  end if;

  v_new_level := v_staff.level + 1;
  update public.staff_members
  set level = v_new_level
  where id = v_staff.staff_member_id;

  if v_reward_source = 'daily_reward' then
    update public.daily_reward_inventory
    set
      status = 'used',
      used_at = now(),
      usage_payload = jsonb_build_object(
        'staffContractId', v_staff.contract_id,
        'staffMemberId', v_staff.staff_member_id,
        'previousLevel', v_staff.level,
        'newLevel', v_new_level
      )
    where id = p_inventory_id;
  elsif v_reward.quantity = 1 then
    delete from public.team_item_inventory
    where id = v_reward.team_inventory_id;
  else
    update public.team_item_inventory
    set quantity = quantity - 1, updated_at = now()
    where id = v_reward.team_inventory_id;
  end if;

  v_role_label := case v_staff.role
    when 'trainer' then 'Entraîneur'
    when 'scout' then 'Scout'
    when 'doctor' then 'Médecin'
    when 'mechanic' then 'Mécanicien'
    when 'community_manager' then 'Community manager'
    when 'nutritionist' then 'Nutritionniste'
    when 'physiotherapist' then 'Kiné'
    when 'race_preparer' then 'Préparateur de parcours'
    when 'architect' then 'Architecte'
    else 'Ingénieur R&D'
  end;

  return jsonb_build_object(
    'inventoryId', p_inventory_id,
    'staffContractId', v_staff.contract_id,
    'staffMemberId', v_staff.staff_member_id,
    'previousLevel', v_staff.level,
    'newLevel', v_new_level,
    'message', concat_ws(' ', v_staff.first_name, v_staff.last_name)
      || ' progresse au niveau ' || v_new_level::text || '★ ('
      || v_role_label || ').'
  );
end;
$$;

-- Récompenses thématiques sur des objectifs déjà présents.
update public.game_objective_definitions
set
  description = 'Construire une première infrastructure de performance parmi les sept nouvelles installations. Récompense : une Équerre de chantier.',
  reward_inventory_item_key = 'construction-square',
  reward_equipment_catalog_key = null,
  reward_random_special_ability = false,
  updated_at = now()
where objective_key = 'infrastructure_first_performance';

update public.game_objective_definitions
set
  description = 'Construire les sept infrastructures de performance : piste, cryothérapie, soufflerie, R&D, accueil international, météo et Média Center. Récompense : un Té d’architecte de précision.',
  reward_inventory_item_key = 'precision-architect-tee',
  reward_equipment_catalog_key = null,
  reward_random_special_ability = false,
  updated_at = now()
where objective_key = 'infrastructure_performance_network';

update public.game_objective_definitions
set
  description = 'Réunir trois membres actifs du staff ayant la nationalité de l’équipe, définie par son sponsor. Récompense : un Insigne d’expertise.',
  reward_inventory_item_key = 'staff-expertise-badge',
  reward_equipment_catalog_key = null,
  reward_random_special_ability = false,
  updated_at = now()
where objective_key = 'staff_team_nationality_3';

-- Les objectifs déjà récupérés donnent également accès au nouvel objet.
insert into public.team_item_inventory (
  team_season_id,
  inventory_item_id,
  quantity,
  acquisition_source
)
select
  claim.team_season_id,
  item.id,
  count(*)::integer,
  'Mise à niveau des récompenses d’objectifs'
from public.game_objective_claims as claim
join (values
  ('infrastructure_first_performance', 'construction-square'),
  ('infrastructure_performance_network', 'precision-architect-tee'),
  ('staff_team_nationality_3', 'staff-expertise-badge')
) as mapping(objective_key, item_key)
  on mapping.objective_key = claim.objective_key
join public.inventory_catalog_items as item
  on item.item_key = mapping.item_key
group by claim.team_season_id, item.id
on conflict (team_season_id, inventory_item_id) do update set
  quantity = public.team_item_inventory.quantity + excluded.quantity,
  acquisition_source = excluded.acquisition_source,
  updated_at = now();

revoke all on function public.get_current_management_reward_targets()
from public, anon;
grant execute on function public.get_current_management_reward_targets()
to authenticated, service_role;

revoke all on function public.redeem_construction_time_reward(uuid, uuid)
from public, anon;
grant execute on function public.redeem_construction_time_reward(uuid, uuid)
to authenticated, service_role;

revoke all on function public.redeem_staff_level_boost_reward(uuid, uuid)
from public, anon;
grant execute on function public.redeem_staff_level_boost_reward(uuid, uuid)
to authenticated, service_role;

comment on function public.redeem_construction_time_reward(uuid, uuid) is
  'Consomme un outil d’architecte et raccourcit atomiquement un chantier actif sans le faire descendre sous un jour restant.';

comment on function public.redeem_staff_level_boost_reward(uuid, uuid) is
  'Consomme un Insigne d’expertise et augmente atomiquement de 1 le niveau d’un membre actif du staff, avec un plafond de 5.';

notify pgrst, 'reload schema';

commit;
