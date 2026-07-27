begin;

-- ============================================================
-- ACADÉMIE DES MÉTIERS — BÂTIMENT
-- ============================================================

alter table public.team_infrastructures
  drop constraint if exists team_infrastructures_code_allowed,
  drop constraint if exists team_infrastructures_level_range;

alter table public.team_infrastructures
  add constraint team_infrastructures_code_allowed check (
    infrastructure_code in ('recruitment_data_room', 'staff_academy')
  ),
  add constraint team_infrastructures_level_range check (
    (infrastructure_code = 'recruitment_data_room' and level between 1 and 3)
    or (infrastructure_code = 'staff_academy' and level between 1 and 5)
  );

alter table public.infrastructure_projects
  drop constraint if exists infrastructure_projects_code_allowed,
  drop constraint if exists infrastructure_projects_country_shape,
  drop constraint if exists infrastructure_projects_target_level_range,
  drop constraint if exists infrastructure_projects_durations_valid;

alter table public.infrastructure_projects
  add constraint infrastructure_projects_code_allowed check (
    infrastructure_code in (
      'recruitment_data_room',
      'staff_academy',
      'international_youth_center'
    )
  ),
  add constraint infrastructure_projects_country_shape check (
    (infrastructure_code = 'international_youth_center' and country_id is not null)
    or (infrastructure_code <> 'international_youth_center' and country_id is null)
  ),
  add constraint infrastructure_projects_target_level_range check (
    (infrastructure_code = 'recruitment_data_room' and target_level between 1 and 3)
    or (infrastructure_code = 'staff_academy' and target_level between 1 and 5)
    or (infrastructure_code = 'international_youth_center' and target_level between 1 and 5)
  ),
  add constraint infrastructure_projects_durations_valid check (
    base_duration_days between 1 and 84
    and final_duration_days between 1 and base_duration_days
    and completes_game_day_index =
      starts_game_day_index + final_duration_days
  );

create or replace function public.settle_due_infrastructure_projects()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_game_day integer;
  v_project record;
  v_completed integer := 0;
  v_country_name text;
  v_notification_title text;
  v_notification_message text;
begin
  perform public.sync_active_season_day();

  select season.game_year * 28 + season.current_day_number - 1
  into v_current_game_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_current_game_day is null then
    return 0;
  end if;

  for v_project in
    select project.*
    from public.infrastructure_projects as project
    where project.status = 'active'
      and project.completes_game_day_index <= v_current_game_day
    order by project.completes_game_day_index, project.created_at
    for update skip locked
  loop
    if v_project.infrastructure_code in (
      'recruitment_data_room',
      'staff_academy'
    ) then
      insert into public.team_infrastructures (
        team_id,
        infrastructure_code,
        level,
        completed_project_id,
        completed_at,
        updated_at
      ) values (
        v_project.team_id,
        v_project.infrastructure_code,
        v_project.target_level,
        v_project.id,
        now(),
        now()
      )
      on conflict (team_id, infrastructure_code) do update
      set
        level = greatest(
          public.team_infrastructures.level,
          excluded.level
        ),
        completed_project_id = excluded.completed_project_id,
        completed_at = excluded.completed_at,
        updated_at = now();

      if v_project.infrastructure_code = 'staff_academy' then
        v_notification_title := 'Académie des métiers agrandie';
        v_notification_message :=
          'Le niveau ' || v_project.target_level::text ||
          ' permet désormais de former jusqu’à ' ||
          v_project.target_level::text || ' membre(s) du staff simultanément.';
      else
        v_notification_title := 'Data Room opérationnelle';
        v_notification_message :=
          'Le niveau ' || v_project.target_level::text ||
          ' de la Data Room améliore désormais les rapports du marché des transferts.';
      end if;

      insert into public.infrastructure_notifications (
        team_id,
        project_id,
        title,
        message
      ) values (
        v_project.team_id,
        v_project.id,
        v_notification_title,
        v_notification_message
      )
      on conflict (team_id, project_id) do nothing;
    else
      select country.name into v_country_name
      from public.countries as country
      where country.id = v_project.country_id;

      insert into public.international_youth_centers (
        team_id,
        country_id,
        quality_level,
        completed_project_id,
        completed_at,
        updated_at
      ) values (
        v_project.team_id,
        v_project.country_id,
        v_project.target_level,
        v_project.id,
        now(),
        now()
      )
      on conflict (team_id, country_id) do update
      set
        quality_level = greatest(
          public.international_youth_centers.quality_level,
          excluded.quality_level
        ),
        completed_project_id = excluded.completed_project_id,
        completed_at = excluded.completed_at,
        updated_at = now();

      insert into public.infrastructure_notifications (
        team_id,
        project_id,
        title,
        message
      ) values (
        v_project.team_id,
        v_project.id,
        'Centre international terminé',
        'Le centre de ' || coalesce(v_country_name, 'formation') ||
          ' atteint désormais ' || v_project.target_level::text ||
          ' étoile(s) de qualité et profite à tous les Directeurs Sportifs.'
      )
      on conflict (team_id, project_id) do nothing;
    end if;

    update public.infrastructure_projects
    set status = 'completed', completed_at = now(), updated_at = now()
    where id = v_project.id;

    v_completed := v_completed + 1;
  end loop;

  return v_completed;
end;
$$;

create or replace function public.start_current_team_infrastructure_project(
  p_infrastructure_code text,
  p_country_id uuid default null,
  p_architect_contract_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_architect record;
  v_project_id uuid;
  v_director_level integer;
  v_current_level integer := 0;
  v_target_level integer;
  v_base_cost numeric(14, 2);
  v_final_cost numeric(14, 2);
  v_base_duration integer;
  v_final_duration integer;
  v_cost_reduction integer := 0;
  v_duration_reduction integer := 0;
  v_architect_specialty text;
  v_current_game_day integer;
  v_description text;
begin
  if p_infrastructure_code not in (
    'recruitment_data_room',
    'staff_academy',
    'international_youth_center'
  ) then
    raise exception 'Cette infrastructure n’existe pas.';
  end if;

  perform public.settle_current_team_finances();
  perform public.settle_due_infrastructure_projects();

  select
    director.id as director_id,
    director.experience_points,
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

  v_director_level :=
    public.calculate_staff_director_level(v_context.experience_points);
  if v_director_level < 10 then
    raise exception 'Les infrastructures sont accessibles à partir du niveau 10.';
  end if;
  if p_infrastructure_code = 'staff_academy'
    and v_director_level < 20 then
    raise exception 'L’Académie des métiers est accessible à partir du niveau 20.';
  end if;

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  if exists (
    select 1
    from public.infrastructure_projects
    where team_id = v_context.team_id
      and status = 'active'
  ) then
    raise exception 'Votre équipe possède déjà un chantier actif.';
  end if;

  if p_infrastructure_code in (
    'recruitment_data_room',
    'staff_academy'
  ) then
    if p_country_id is not null then
      raise exception 'Cette infrastructure n’est pas liée à un pays.';
    end if;

    select coalesce(max(infrastructure.level), 0)
    into v_current_level
    from public.team_infrastructures as infrastructure
    where infrastructure.team_id = v_context.team_id
      and infrastructure.infrastructure_code = p_infrastructure_code;

    if p_infrastructure_code = 'recruitment_data_room' then
      if v_current_level >= 3 then
        raise exception 'La Data Room a déjà atteint son niveau maximal.';
      end if;
      v_target_level := v_current_level + 1;
      v_base_cost :=
        (array[350000, 700000, 1200000]::numeric[])[v_target_level];
      v_base_duration :=
        (array[14, 28, 42]::integer[])[v_target_level];
      v_description :=
        'Construction Data Room — niveau ' || v_target_level::text;
    else
      if v_current_level >= 5 then
        raise exception 'L’Académie des métiers a déjà atteint son niveau maximal.';
      end if;
      v_target_level := v_current_level + 1;
      v_base_cost := (
        array[1500000, 2250000, 3250000, 4500000, 6000000]::numeric[]
      )[v_target_level];
      v_base_duration := (
        array[42, 49, 56, 70, 84]::integer[]
      )[v_target_level];
      v_description :=
        'Académie des métiers — niveau ' || v_target_level::text;
    end if;
  else
    if p_country_id is null or not exists (
      select 1 from public.countries
      where id = p_country_id and is_active
    ) then
      raise exception 'Le pays du centre international est invalide.';
    end if;

    select coalesce(max(center.quality_level), 0)
    into v_current_level
    from public.international_youth_centers as center
    where center.team_id = v_context.team_id
      and center.country_id = p_country_id;

    if v_current_level >= 5 then
      raise exception 'Votre centre a déjà atteint cinq étoiles.';
    end if;

    v_target_level := v_current_level + 1;
    v_base_cost := (
      array[500000, 750000, 1000000, 1350000, 1800000]::numeric[]
    )[v_target_level];
    v_base_duration := (
      array[28, 35, 42, 49, 56]::integer[]
    )[v_target_level];
    v_description :=
      'Centre international — niveau ' || v_target_level::text;
  end if;

  if p_architect_contract_id is not null then
    select
      contract.id,
      member.level,
      member.architect_specialty
    into v_architect
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
    where contract.id = p_architect_contract_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active'
      and member.role = 'architect';

    if v_architect is null then
      raise exception 'Cet architecte ne fait pas partie du staff actif de votre équipe.';
    end if;

    v_architect_specialty :=
      coalesce(v_architect.architect_specialty, 'balanced');

    if v_architect_specialty = 'economist' then
      v_cost_reduction := v_architect.level * 6;
      v_duration_reduction := v_architect.level * 2;
    elsif v_architect_specialty = 'foreman' then
      v_cost_reduction := v_architect.level * 2;
      v_duration_reduction := v_architect.level * 6;
    else
      v_cost_reduction := v_architect.level * 4;
      v_duration_reduction := v_architect.level * 4;
    end if;
  end if;

  v_cost_reduction := public.get_architect_adjusted_reduction(
    p_architect_contract_id,
    v_cost_reduction,
    'cost'
  );
  v_duration_reduction := public.get_architect_adjusted_reduction(
    p_architect_contract_id,
    v_duration_reduction,
    'duration'
  );

  v_final_cost := round(v_base_cost * (1 - v_cost_reduction / 100.0));
  v_final_duration := greatest(
    1,
    ceil(v_base_duration * (1 - v_duration_reduction / 100.0))::integer
  );

  if v_context.cash_balance < v_final_cost then
    raise exception 'Trésorerie insuffisante pour lancer ce chantier.';
  end if;

  v_current_game_day :=
    v_context.game_year * 28 + v_context.current_day_number - 1;

  insert into public.infrastructure_projects (
    team_id,
    infrastructure_code,
    country_id,
    target_level,
    architect_contract_id,
    architect_specialty,
    architect_level,
    base_cost,
    final_cost,
    base_duration_days,
    final_duration_days,
    cost_reduction_percentage,
    duration_reduction_percentage,
    started_season_id,
    started_day_number,
    starts_game_day_index,
    completes_game_day_index
  ) values (
    v_context.team_id,
    p_infrastructure_code,
    p_country_id,
    v_target_level,
    p_architect_contract_id,
    case
      when p_architect_contract_id is null then null
      else v_architect_specialty
    end,
    case
      when p_architect_contract_id is null then null
      else v_architect.level
    end,
    v_base_cost,
    v_final_cost,
    v_base_duration,
    v_final_duration,
    v_cost_reduction,
    v_duration_reduction,
    v_context.season_id,
    v_context.current_day_number,
    v_current_game_day,
    v_current_game_day + v_final_duration
  )
  returning id into v_project_id;

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
    -v_final_cost,
    'building',
    'posted',
    v_description,
    'infrastructure-project:' || v_project_id::text,
    now()
  );

  update public.team_seasons
  set cash_balance = cash_balance - v_final_cost
  where id = v_context.team_season_id;

  return v_project_id;
end;
$$;

-- ============================================================
-- ACADÉMIE DES MÉTIERS — STAGES
-- ============================================================

create table public.staff_academy_trainings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  started_season_id uuid not null
    references public.seasons(id) on delete restrict,
  staff_contract_id uuid not null
    references public.staff_contracts(id) on delete restrict,
  staff_member_id uuid not null
    references public.staff_members(id) on delete restrict,
  improvement_type text not null,
  previous_level smallint not null,
  previous_talent_count smallint not null,
  target_slot smallint,
  cost numeric(14, 2) not null,
  duration_days smallint not null,
  started_day_number smallint not null,
  starts_game_day_index integer not null,
  completes_game_day_index integer not null,
  status text not null default 'active',
  awarded_talent_code text
    references public.staff_talent_catalog(code) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_academy_trainings_type_allowed
    check (improvement_type in ('level', 'talent')),
  constraint staff_academy_trainings_previous_level_range
    check (previous_level between 1 and 5),
  constraint staff_academy_trainings_talent_count_range
    check (previous_talent_count between 0 and 3),
  constraint staff_academy_trainings_slot_shape check (
    (improvement_type = 'talent' and target_slot between 1 and 3)
    or (improvement_type = 'level' and target_slot is null)
  ),
  constraint staff_academy_trainings_cost_positive check (cost > 0),
  constraint staff_academy_trainings_duration_range
    check (
      duration_days between 5 and 20
      and completes_game_day_index =
        starts_game_day_index + duration_days
    ),
  constraint staff_academy_trainings_start_day_range
    check (started_day_number between 1 and 28),
  constraint staff_academy_trainings_status_allowed
    check (status in ('active', 'completed', 'cancelled')),
  constraint staff_academy_trainings_completion_shape check (
    (
      status = 'completed'
      and completed_at is not null
      and (
        (improvement_type = 'talent' and awarded_talent_code is not null)
        or (improvement_type = 'level' and awarded_talent_code is null)
      )
    )
    or (
      status <> 'completed'
      and completed_at is null
      and awarded_talent_code is null
    )
  )
);

create unique index staff_academy_one_active_training_per_member_idx
  on public.staff_academy_trainings (staff_member_id)
  where status = 'active';

create index staff_academy_trainings_team_status_idx
  on public.staff_academy_trainings (
    team_id,
    status,
    completes_game_day_index
  );

create index staff_academy_trainings_due_idx
  on public.staff_academy_trainings (
    status,
    completes_game_day_index
  );

alter table public.staff_academy_trainings enable row level security;

create policy staff_academy_trainings_read_managed
on public.staff_academy_trainings
for select
to authenticated
using (public.current_user_manages_team(team_id));

create or replace function public.settle_due_staff_academy_trainings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_game_day integer;
  v_training record;
  v_member record;
  v_talent_code text;
  v_completed integer := 0;
begin
  perform public.sync_active_season_day();

  select season.game_year * 28 + season.current_day_number - 1
  into v_current_game_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_current_game_day is null then
    return 0;
  end if;

  for v_training in
    select training.*
    from public.staff_academy_trainings as training
    where training.status = 'active'
      and training.completes_game_day_index <= v_current_game_day
    order by training.completes_game_day_index, training.created_at
    for update skip locked
  loop
    select member.*
    into v_member
    from public.staff_members as member
    where member.id = v_training.staff_member_id
    for update;

    if v_member is null then
      raise exception 'Le membre du staff à former est introuvable.';
    end if;

    if v_training.improvement_type = 'level' then
      if v_member.level >= 5 then
        raise exception 'Ce membre du staff a déjà atteint cinq étoiles.';
      end if;

      update public.staff_members
      set level = level + 1
      where id = v_member.id;
    else
      select talent.code
      into v_talent_code
      from public.staff_talent_catalog as talent
      where talent.role = v_member.role
        and talent.is_active
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
        )
      order by random()
      limit 1;

      if v_talent_code is null then
        raise exception 'Aucun nouveau talent compatible n’est disponible.';
      end if;

      insert into public.staff_member_talents (
        staff_member_id,
        slot_number,
        talent_code,
        unlocked_by
      ) values (
        v_member.id,
        v_training.target_slot,
        v_talent_code,
        'professions_building'
      );
    end if;

    update public.staff_academy_trainings
    set
      status = 'completed',
      awarded_talent_code = case
        when improvement_type = 'talent' then v_talent_code
        else null
      end,
      completed_at = now(),
      updated_at = now()
    where id = v_training.id;

    v_talent_code := null;
    v_completed := v_completed + 1;
  end loop;

  return v_completed;
end;
$$;

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
  v_active_count integer;
  v_talent_count integer;
  v_available_talent_count integer;
  v_target_slot integer;
  v_cost numeric(14, 2);
  v_duration integer;
  v_current_game_day integer;
  v_description text;
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

  select count(*)::integer
  into v_active_count
  from public.staff_academy_trainings as training
  where training.team_id = v_context.team_id
    and training.status = 'active';

  if v_active_count >= v_academy_level then
    raise exception
      'Les % emplacement(s) de formation de l’Académie sont déjà occupés.',
      v_academy_level;
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
    raise exception 'Ce membre du staff ne fait pas partie de votre équipe active.';
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
      raise exception 'Ce membre du staff possède déjà trois lignes de bonus.';
    end if;

    select count(*)::integer
    into v_available_talent_count
    from public.staff_talent_catalog as talent
    where talent.role = v_member.role
      and talent.is_active
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
    completes_game_day_index
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
    v_current_game_day + v_duration
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

grant select on table public.staff_academy_trainings to authenticated;
grant all privileges on table public.staff_academy_trainings to service_role;

revoke all on function public.settle_due_staff_academy_trainings()
  from public, anon;
grant execute on function public.settle_due_staff_academy_trainings()
  to authenticated, service_role;

revoke all on function public.start_current_team_staff_academy_training(uuid, text)
  from public, anon;
grant execute on function public.start_current_team_staff_academy_training(uuid, text)
  to authenticated, service_role;

comment on table public.staff_academy_trainings is
  'Stages payants et non bloquants qui améliorent les étoiles ou ajoutent un talent aléatoire au staff.';

notify pgrst, 'reload schema';

commit;
