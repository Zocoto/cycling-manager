begin;

-- ============================================================
-- FORMATEUR — MÉTIER ET TALENTS
-- ============================================================

alter table public.staff_members
  drop constraint if exists staff_members_role_allowed;
alter table public.staff_members
  add constraint staff_members_role_allowed check (role in (
    'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
    'nutritionist', 'physiotherapist', 'race_preparer', 'architect',
    'research_engineer', 'educator'
  ));

alter table public.staff_talent_catalog
  drop constraint if exists staff_talent_catalog_role_allowed;
alter table public.staff_talent_catalog
  add constraint staff_talent_catalog_role_allowed check (role in (
    'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
    'nutritionist', 'physiotherapist', 'race_preparer', 'architect',
    'research_engineer', 'educator'
  ));

alter table public.recruitment_alerts
  drop constraint if exists recruitment_alerts_staff_role_allowed;
alter table public.recruitment_alerts
  add constraint recruitment_alerts_staff_role_allowed check (
    staff_role is null
    or staff_role in (
      'trainer', 'scout', 'doctor', 'mechanic', 'nutritionist',
      'physiotherapist', 'race_preparer', 'architect',
      'community_manager', 'research_engineer', 'educator'
    )
  );

insert into public.staff_talent_catalog (
  code,
  role,
  display_name,
  minimum_level
)
values
  (
    'educator_training_time',
    'educator',
    'Pédagogie accélérée',
    1
  ),
  (
    'educator_training_cost',
    'educator',
    'Réseau de formation',
    1
  ),
  (
    'educator_parallel_training',
    'educator',
    'Double cursus',
    3
  ),
  (
    'educator_training_effectiveness',
    'educator',
    'Excellence pédagogique',
    1
  )
on conflict (code) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  minimum_level = excluded.minimum_level,
  is_active = true;

create or replace function public.calculate_staff_salary(
  p_role text,
  p_level integer
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base numeric;
  v_multiplier numeric;
  v_level integer := least(5, greatest(1, coalesce(p_level, 1)));
begin
  v_base := case p_role
    when 'trainer' then 22000
    when 'scout' then 19000
    when 'doctor' then 17000
    when 'mechanic' then 14000
    when 'nutritionist' then 13000
    when 'physiotherapist' then 13000
    when 'race_preparer' then 15000
    when 'architect' then 12000
    when 'community_manager' then 11000
    when 'research_engineer' then 24000
    when 'educator' then 18000
    else null
  end;
  if v_base is null then
    raise exception 'Métier de staff invalide.';
  end if;
  v_multiplier := (
    array[1.00, 1.50, 2.20, 3.30, 5.00]::numeric[]
  )[v_level];
  return round((v_base * v_multiplier) / 500) * 500;
end;
$$;

-- Le marché reste commun à tous les joueurs. Le contrôle du bâtiment est
-- effectué au moment de la signature, côté serveur.
do $migration$
declare
  v_definition text;
  v_marker text :=
    '''nutritionist'', ''physiotherapist'', ''race_preparer'', ''architect'', ''research_engineer''';
begin
  select pg_get_functiondef(
    'public.create_daily_staff_market(date,jsonb)'::regprocedure
  ) into v_definition;

  if position(v_marker in v_definition) = 0 then
    raise exception 'La validation des métiers du marché du staff a changé.';
  end if;

  v_definition := replace(
    v_definition,
    v_marker,
    v_marker || ', ''educator'''
  );
  execute v_definition;
end;
$migration$;

-- Le recrutement standard reste atomique et conserve tous les contrôles
-- budgétaires historiques avant d'ajouter le verrou de l'Académie.
alter function public.hire_current_team_staff(uuid)
  rename to hire_current_team_staff_legacy_20260823;
revoke all on function public.hire_current_team_staff_legacy_20260823(uuid)
  from public, anon, authenticated;

create or replace function public.hire_current_team_staff(
  p_listing_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_role text;
begin
  select assignment.team_id, member.role
  into v_team_id, v_role
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.staff_market_listings as listing
    on listing.id = p_listing_id
  join public.staff_members as member
    on member.id = listing.staff_member_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_role = 'educator' and not exists (
    select 1
    from public.team_infrastructures as infrastructure
    where infrastructure.team_id = v_team_id
      and infrastructure.infrastructure_code = 'staff_academy'
      and infrastructure.level >= 1
  ) then
    raise exception
      'Construisez l’Académie des métiers avant de recruter un formateur.';
  end if;

  return public.hire_current_team_staff_legacy_20260823(p_listing_id);
end;
$$;

-- Le Mandat de recrutement sur mesure suit exactement le même verrou.
do $migration$
declare
  v_definition text;
  v_role_marker text := E'''research_engineer''\n  ) then';
  v_guard_marker text := E'  select count(*)::integer\n  into v_staff_count\n  from public.staff_contracts';
  v_guard text := E'  if p_role = ''educator'' and not exists (\n    select 1\n    from public.team_infrastructures\n    where team_id = v_context.team_id\n      and infrastructure_code = ''staff_academy''\n      and level >= 1\n  ) then\n    raise exception ''Construisez l’Académie des métiers avant de recruter un formateur.'';\n  end if;\n\n';
  v_label_marker text := E'    when ''architect'' then ''Architecte''\n    else ''Ingénieur R&D''';
begin
  select pg_get_functiondef(
    'public.redeem_custom_staff_recruitment_reward(uuid,uuid,uuid,text,text,text,integer,text,text,text)'::regprocedure
  ) into v_definition;

  -- Les migrations historiques ont été appliquées depuis Windows et peuvent
  -- conserver des retours CRLF dans prosrc. Normaliser avant les remplacements
  -- rend l'adaptation indépendante de la plateforme de déploiement.
  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position(v_role_marker in v_definition) = 0
    or position(v_guard_marker in v_definition) = 0
    or position(v_label_marker in v_definition) = 0
  then
    raise exception
      'Le Mandat de recrutement a changé : migration Formateur interrompue.';
  end if;

  v_definition := replace(
    v_definition,
    v_role_marker,
    E'''research_engineer'', ''educator''\n  ) then'
  );
  v_definition := replace(
    v_definition,
    v_guard_marker,
    v_guard || v_guard_marker
  );
  v_definition := replace(
    v_definition,
    v_label_marker,
    E'    when ''architect'' then ''Architecte''\n    when ''research_engineer'' then ''Ingénieur R&D''\n    when ''educator'' then ''Formateur''\n    else ''Staff'''
  );
  execute v_definition;
end;
$migration$;

-- ============================================================
-- EFFETS SUR LES STAGES DE L'ACADÉMIE
-- ============================================================

alter table public.staff_academy_trainings
  add column if not exists educator_cost_reduction_percentage
    numeric(5, 1) not null default 0,
  add column if not exists educator_duration_reduction_percentage
    numeric(5, 1) not null default 0;

alter table public.staff_academy_trainings
  drop constraint if exists staff_academy_trainings_educator_cost_range,
  drop constraint if exists staff_academy_trainings_educator_duration_range,
  drop constraint if exists staff_academy_trainings_duration_range;

alter table public.staff_academy_trainings
  add constraint staff_academy_trainings_educator_cost_range
    check (educator_cost_reduction_percentage between 0 and 50),
  add constraint staff_academy_trainings_educator_duration_range
    check (educator_duration_reduction_percentage between 0 and 50),
  add constraint staff_academy_trainings_duration_range
    check (
      duration_days between 1 and 20
      and completes_game_day_index = starts_game_day_index + duration_days
    );

create or replace function public.get_team_staff_academy_educator_bonuses(
  p_team_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with contributions as (
    select
      contract.id as contract_id,
      member.level,
      talent.talent_code,
      public.get_staff_contract_nationality_multiplier(contract.id)
        as affinity_multiplier
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'educator'
    left join public.staff_member_talents as talent
      on talent.staff_member_id = member.id
    where contract.team_id = p_team_id
      and contract.status = 'active'
  ), reductions as (
    select
      count(distinct contract_id)::integer as active_educator_count,
      coalesce(max(
        case when talent_code = 'educator_training_time'
          then level * 3 * affinity_multiplier else 0 end
      ), 0) as time_specialist,
      coalesce(max(
        case when talent_code = 'educator_training_cost'
          then level * 4 * affinity_multiplier else 0 end
      ), 0) as cost_specialist,
      coalesce(max(
        case when talent_code = 'educator_training_effectiveness'
          then level * 5 * affinity_multiplier else 0 end
      ), 0) as effectiveness,
      coalesce(bool_or(
        talent_code = 'educator_parallel_training' and level >= 3
      ), false) as has_parallel_training
    from contributions
  )
  select jsonb_build_object(
    'activeEducatorCount', active_educator_count,
    'costReductionPercentage', least(
      50::numeric,
      round(cost_specialist + effectiveness, 1)
    ),
    'durationReductionPercentage', least(
      50::numeric,
      round(time_specialist + effectiveness, 1)
    ),
    'extraCapacity', case when has_parallel_training then 1 else 0 end
  )
  from reductions;
$$;

revoke all on function public.get_team_staff_academy_educator_bonuses(uuid)
  from public, anon, authenticated;
grant execute on function public.get_team_staff_academy_educator_bonuses(uuid)
  to service_role;

create or replace function public.start_current_team_staff_academy_training(
  p_staff_contract_id uuid,
  p_improvement_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_member record;
  v_training_id uuid;
  v_academy_level integer;
  v_capacity integer;
  v_active_count integer;
  v_talent_count integer;
  v_available_talent_count integer;
  v_target_slot integer;
  v_cost numeric(14, 2);
  v_duration integer;
  v_current_game_day integer;
  v_description text;
  v_educator_bonuses jsonb;
  v_cost_reduction numeric(5, 1);
  v_duration_reduction numeric(5, 1);
begin
  if p_improvement_type not in ('level', 'talent') then
    raise exception 'Le type de formation est invalide.';
  end if;

  perform public.settle_current_team_finances();
  perform public.settle_due_infrastructure_projects();
  perform public.settle_due_staff_academy_trainings();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    season.current_day_number,
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.currency,
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
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  select coalesce(max(infrastructure.level), 0)
  into v_academy_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = 'staff_academy';

  if v_academy_level <= 0 then
    raise exception 'Construisez d’abord l’Académie des métiers.';
  end if;

  v_educator_bonuses :=
    public.get_team_staff_academy_educator_bonuses(v_context.team_id);
  v_cost_reduction := least(
    50,
    greatest(
      0,
      coalesce(
        (v_educator_bonuses ->> 'costReductionPercentage')::numeric,
        0
      )
    )
  );
  v_duration_reduction := least(
    50,
    greatest(
      0,
      coalesce(
        (v_educator_bonuses ->> 'durationReductionPercentage')::numeric,
        0
      )
    )
  );
  v_capacity := v_academy_level + coalesce(
    (v_educator_bonuses ->> 'extraCapacity')::integer,
    0
  );

  select count(*)::integer
  into v_active_count
  from public.staff_academy_trainings as training
  where training.team_id = v_context.team_id
    and training.status = 'active';

  if v_active_count >= v_capacity then
    raise exception
      'Les % emplacement(s) de formation de l’Académie sont déjà occupés.',
      v_capacity;
  end if;

  select
    member.id,
    member.first_name,
    member.last_name,
    member.role,
    member.level,
    member.trainer_specialty
  into v_member
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
  where contract.id = p_staff_contract_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update of member;

  if v_member is null then
    raise exception
      'Ce membre du staff ne fait pas partie de votre équipe active.';
  end if;

  if exists (
    select 1
    from public.staff_academy_trainings as training
    where training.staff_member_id = v_member.id
      and training.status = 'active'
  ) then
    raise exception 'Ce membre du staff suit déjà une formation.';
  end if;

  select count(*)::integer
  into v_talent_count
  from public.staff_member_talents as talent
  where talent.staff_member_id = v_member.id;

  if p_improvement_type = 'level' then
    if v_member.level >= 5 then
      raise exception 'Ce membre du staff a déjà atteint cinq étoiles.';
    end if;

    v_cost := round((
      200000
      + v_member.level * 200000
      + v_talent_count * 125000
    ) / 25000.0) * 25000;
    v_duration := least(
      20,
      5
        + (v_member.level - 1) * 3
        + greatest(0, v_talent_count - 1) * 2
    );
    v_description :=
      'Académie · ' || v_member.first_name || ' ' || v_member.last_name ||
      ' · passage au niveau ' || (v_member.level + 1)::text;
  else
    if v_talent_count >= 3 then
      raise exception
        'Ce membre du staff possède déjà trois lignes de bonus.';
    end if;

    select count(*)::integer
    into v_available_talent_count
    from public.staff_talent_catalog as talent
    where talent.role = v_member.role
      and talent.is_active
      and talent.minimum_level <= v_member.level
      and not exists (
        select 1
        from public.staff_member_talents as owned
        where owned.staff_member_id = v_member.id
          and owned.talent_code = talent.code
      )
      and not (
        v_member.role = 'trainer'
        and v_member.trainer_specialty is not null
        and talent.code = 'trainer_' || v_member.trainer_specialty
      );

    if v_available_talent_count <= 0 then
      raise exception 'Aucune nouvelle ligne de bonus n’est disponible.';
    end if;

    select slot.slot_number
    into v_target_slot
    from generate_series(1, 3) as slot(slot_number)
    where not exists (
      select 1
      from public.staff_member_talents as owned
      where owned.staff_member_id = v_member.id
        and owned.slot_number = slot.slot_number
    )
    order by slot.slot_number
    limit 1;

    v_cost := round((
      250000
      + v_member.level * 150000
      + (v_talent_count + 1) * 250000
    ) / 25000.0) * 25000;
    v_duration := least(
      20,
      6 + (v_member.level - 1) * 2 + v_talent_count * 3
    );
    v_description :=
      'Académie · ' || v_member.first_name || ' ' || v_member.last_name ||
      ' · nouvelle ligne de bonus';
  end if;

  v_cost := greatest(
    25000,
    round((v_cost * (1 - v_cost_reduction / 100.0)) / 25000.0) * 25000
  );
  v_duration := greatest(
    1,
    ceil(v_duration * (1 - v_duration_reduction / 100.0))::integer
  );

  if v_context.cash_balance < v_cost then
    raise exception 'Trésorerie insuffisante pour financer cette formation.';
  end if;

  v_current_game_day :=
    v_context.game_year * 28 + v_context.current_day_number - 1;

  insert into public.staff_academy_trainings (
    team_id,
    team_season_id,
    started_season_id,
    staff_contract_id,
    staff_member_id,
    improvement_type,
    previous_level,
    previous_talent_count,
    target_slot,
    cost,
    duration_days,
    started_day_number,
    starts_game_day_index,
    completes_game_day_index,
    educator_cost_reduction_percentage,
    educator_duration_reduction_percentage
  ) values (
    v_context.team_id,
    v_context.team_season_id,
    v_context.season_id,
    p_staff_contract_id,
    v_member.id,
    p_improvement_type,
    v_member.level,
    v_talent_count,
    v_target_slot,
    v_cost,
    v_duration,
    v_context.current_day_number,
    v_current_game_day,
    v_current_game_day + v_duration,
    v_cost_reduction,
    v_duration_reduction
  )
  returning id into v_training_id;

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
  ) values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -v_cost,
    'training',
    'posted',
    v_description,
    'staff-academy-training:' || v_training_id::text,
    now()
  );

  update public.team_seasons
  set cash_balance = cash_balance - v_cost
  where id = v_context.team_season_id;

  return v_training_id;
end;
$$;

-- L'objectif historique suit désormais la totalité des onze métiers. Les
-- joueurs l'ayant déjà réclamé conservent naturellement leur récompense.
update public.game_objective_definitions
set
  target_value = 11,
  description =
    'Réunir simultanément les onze métiers de staff. Récompense : un Mandat de recrutement sur mesure.'
where objective_key = 'staff_all_roles';

revoke all on function public.hire_current_team_staff(uuid)
  from public, anon;
grant execute on function public.hire_current_team_staff(uuid)
  to authenticated, service_role;

revoke all on function public.start_current_team_staff_academy_training(uuid, text)
  from public, anon;
grant execute on function public.start_current_team_staff_academy_training(uuid, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
