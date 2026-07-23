-- ============================================================
-- CYCLO STRATÈGE — Infrastructures et écoles internationales
-- ============================================================

begin;

alter table public.staff_members
  add column if not exists architect_specialty text;

update public.staff_members
set architect_specialty = 'balanced'
where role = 'architect'
  and architect_specialty is null;

alter table public.staff_members
  drop constraint if exists staff_members_architect_specialty_allowed,
  drop constraint if exists staff_members_architect_specialty_shape;

alter table public.staff_members
  add constraint staff_members_architect_specialty_allowed check (
    architect_specialty is null
    or architect_specialty in ('economist', 'foreman', 'balanced')
  ),
  add constraint staff_members_architect_specialty_shape check (
    (role = 'architect' and architect_specialty is not null)
    or (role <> 'architect' and architect_specialty is null)
  );

create table public.team_infrastructures (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  infrastructure_code text not null,
  level smallint not null,
  completed_project_id uuid,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_infrastructures_unique
    unique (team_id, infrastructure_code),
  constraint team_infrastructures_code_allowed
    check (infrastructure_code in ('recruitment_data_room')),
  constraint team_infrastructures_level_range
    check (level between 1 and 3)
);

create table public.international_youth_centers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete restrict,
  quality_level smallint not null,
  completed_project_id uuid,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint international_youth_centers_team_country_unique
    unique (team_id, country_id),
  constraint international_youth_centers_quality_range
    check (quality_level between 1 and 5)
);

create index international_youth_centers_country_quality_idx
  on public.international_youth_centers (country_id, quality_level desc);

alter table public.youth_scouting_candidates
  add column if not exists international_center_bonus_applied boolean
    not null default false,
  add column if not exists international_center_bonus_percentage smallint
    not null default 0;

alter table public.youth_scouting_candidates
  drop constraint if exists youth_candidates_center_bonus_range;

alter table public.youth_scouting_candidates
  add constraint youth_candidates_center_bonus_range check (
    international_center_bonus_percentage between 0 and 90
  );

create table public.infrastructure_projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  infrastructure_code text not null,
  country_id uuid references public.countries(id) on delete restrict,
  target_level smallint not null,
  architect_contract_id uuid
    references public.staff_contracts(id) on delete set null,
  architect_specialty text,
  architect_level smallint,
  base_cost numeric(14, 2) not null,
  final_cost numeric(14, 2) not null,
  base_duration_days smallint not null,
  final_duration_days smallint not null,
  cost_reduction_percentage smallint not null default 0,
  duration_reduction_percentage smallint not null default 0,
  started_season_id uuid not null references public.seasons(id) on delete restrict,
  started_day_number smallint not null,
  starts_game_day_index integer not null,
  completes_game_day_index integer not null,
  status text not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint infrastructure_projects_code_allowed check (
    infrastructure_code in (
      'recruitment_data_room',
      'international_youth_center'
    )
  ),
  constraint infrastructure_projects_country_shape check (
    (infrastructure_code = 'international_youth_center' and country_id is not null)
    or (infrastructure_code <> 'international_youth_center' and country_id is null)
  ),
  constraint infrastructure_projects_target_level_range check (
    (infrastructure_code = 'recruitment_data_room' and target_level between 1 and 3)
    or (infrastructure_code = 'international_youth_center' and target_level between 1 and 5)
  ),
  constraint infrastructure_projects_architect_shape check (
    (architect_contract_id is null
      and architect_specialty is null
      and architect_level is null
      and cost_reduction_percentage = 0
      and duration_reduction_percentage = 0)
    or
    (architect_contract_id is not null
      and architect_specialty in ('economist', 'foreman', 'balanced')
      and architect_level between 1 and 5)
  ),
  constraint infrastructure_projects_costs_valid check (
    base_cost > 0 and final_cost > 0 and final_cost <= base_cost
  ),
  constraint infrastructure_projects_durations_valid check (
    base_duration_days between 1 and 56
    and final_duration_days between 1 and base_duration_days
    and completes_game_day_index =
      starts_game_day_index + final_duration_days
  ),
  constraint infrastructure_projects_reductions_valid check (
    cost_reduction_percentage between 0 and 30
    and duration_reduction_percentage between 0 and 30
  ),
  constraint infrastructure_projects_start_day_range
    check (started_day_number between 1 and 28),
  constraint infrastructure_projects_status_allowed
    check (status in ('active', 'completed', 'cancelled')),
  constraint infrastructure_projects_completion_shape check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  )
);

create unique index infrastructure_projects_one_active_per_team_idx
  on public.infrastructure_projects (team_id)
  where status = 'active';

create index infrastructure_projects_due_idx
  on public.infrastructure_projects (status, completes_game_day_index);

alter table public.team_infrastructures
  add constraint team_infrastructures_completed_project_fk
  foreign key (completed_project_id)
  references public.infrastructure_projects(id)
  on delete set null;

alter table public.international_youth_centers
  add constraint international_youth_centers_completed_project_fk
  foreign key (completed_project_id)
  references public.infrastructure_projects(id)
  on delete set null;

create table public.infrastructure_notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid not null references public.infrastructure_projects(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint infrastructure_notifications_project_unique
    unique (team_id, project_id),
  constraint infrastructure_notifications_text_not_empty
    check (btrim(title) <> '' and btrim(message) <> '')
);

create index infrastructure_notifications_team_unread_idx
  on public.infrastructure_notifications (team_id, read_at, created_at desc);

alter table public.team_infrastructures enable row level security;
alter table public.international_youth_centers enable row level security;
alter table public.infrastructure_projects enable row level security;
alter table public.infrastructure_notifications enable row level security;

create policy team_infrastructures_read_managed
on public.team_infrastructures for select to authenticated
using (public.current_user_manages_team(team_id));

create policy international_youth_centers_read_authenticated
on public.international_youth_centers for select to authenticated
using (true);

create policy infrastructure_projects_read_managed
on public.infrastructure_projects for select to authenticated
using (public.current_user_manages_team(team_id));

create policy infrastructure_notifications_read_managed
on public.infrastructure_notifications for select to authenticated
using (public.current_user_manages_team(team_id));

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
    if v_project.infrastructure_code = 'recruitment_data_room' then
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

      insert into public.infrastructure_notifications (
        team_id,
        project_id,
        title,
        message
      ) values (
        v_project.team_id,
        v_project.id,
        'Data Room opérationnelle',
        'Le niveau ' || v_project.target_level::text ||
          ' de la Data Room améliore désormais les rapports du marché des transferts.'
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

  if public.calculate_staff_director_level(v_context.experience_points) < 10 then
    raise exception 'Les infrastructures sont accessibles à partir du niveau 10.';
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

  if p_infrastructure_code = 'recruitment_data_room' then
    if p_country_id is not null then
      raise exception 'La Data Room n’est pas liée à un pays.';
    end if;

    select coalesce(max(infrastructure.level), 0)
    into v_current_level
    from public.team_infrastructures as infrastructure
    where infrastructure.team_id = v_context.team_id
      and infrastructure.infrastructure_code = p_infrastructure_code;

    if v_current_level >= 3 then
      raise exception 'La Data Room a déjà atteint son niveau maximal.';
    end if;

    v_target_level := v_current_level + 1;
    v_base_cost := (array[350000, 700000, 1200000]::numeric[])[v_target_level];
    v_base_duration := (array[14, 28, 42]::integer[])[v_target_level];
    v_description := 'Construction Data Room — niveau ' || v_target_level::text;
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
    v_description := 'Centre international — niveau ' || v_target_level::text;
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

    v_architect_specialty := coalesce(
      v_architect.architect_specialty,
      'balanced'
    );

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
    case when p_architect_contract_id is null then null else v_architect_specialty end,
    case when p_architect_contract_id is null then null else v_architect.level end,
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

create or replace function public.mark_current_infrastructure_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.infrastructure_notifications as notification
  set read_at = coalesce(notification.read_at, now())
  where public.current_user_manages_team(notification.team_id)
    and notification.read_at is null;
$$;

create or replace function public.create_daily_staff_market(
  p_market_date date,
  p_candidates jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_date date := coalesce(
    p_market_date,
    (now() at time zone 'Europe/Paris')::date
  );
  v_batch_id uuid;
  v_candidate jsonb;
  v_staff_member_id uuid;
  v_slot integer := 0;
  v_role text;
  v_level integer;
  v_trainer_specialty text;
  v_architect_specialty text;
  v_country_id uuid;
begin
  if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) <> 25 then
    raise exception 'Le marché du staff exige exactement 25 profils.';
  end if;

  insert into public.staff_market_batches (market_date)
  values (v_market_date)
  on conflict (market_date) do nothing
  returning id into v_batch_id;

  if v_batch_id is null then
    return 0;
  end if;

  update public.staff_market_listings as listing
  set status = 'expired'
  from public.staff_market_batches as batch
  where listing.batch_id = batch.id
    and batch.market_date < v_market_date
    and listing.status = 'available';

  for v_candidate in select value from jsonb_array_elements(p_candidates)
  loop
    v_slot := v_slot + 1;
    v_role := btrim(v_candidate ->> 'role');
    v_level := (v_candidate ->> 'level')::integer;
    v_trainer_specialty :=
      nullif(btrim(v_candidate ->> 'trainer_specialty'), '');
    v_architect_specialty :=
      nullif(btrim(v_candidate ->> 'architect_specialty'), '');
    v_country_id := (v_candidate ->> 'country_id')::uuid;

    if v_role not in (
      'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
      'nutritionist', 'physiotherapist', 'race_preparer', 'architect'
    ) then
      raise exception 'Métier de staff invalide à la position %.', v_slot;
    end if;

    if v_level not between 1 and 5 then
      raise exception 'Niveau de staff invalide à la position %.', v_slot;
    end if;

    if (v_role = 'trainer' and v_trainer_specialty not in (
      'mountain', 'hills', 'flat', 'sprint', 'time_trial', 'cobbles', 'endurance'
    )) or (v_role <> 'trainer' and v_trainer_specialty is not null) then
      raise exception 'Spécialité d’entraîneur invalide à la position %.', v_slot;
    end if;

    if (v_role = 'architect' and v_architect_specialty not in (
      'economist', 'foreman', 'balanced'
    )) or (v_role <> 'architect' and v_architect_specialty is not null) then
      raise exception 'Spécialité d’architecte invalide à la position %.', v_slot;
    end if;

    if not exists (
      select 1 from public.countries
      where id = v_country_id and is_active = true
    ) then
      raise exception 'Nationalité de staff invalide à la position %.', v_slot;
    end if;

    insert into public.staff_members (
      country_id,
      first_name,
      last_name,
      role,
      level,
      trainer_specialty,
      architect_specialty
    ) values (
      v_country_id,
      btrim(v_candidate ->> 'first_name'),
      btrim(v_candidate ->> 'last_name'),
      v_role,
      v_level,
      v_trainer_specialty,
      v_architect_specialty
    )
    returning id into v_staff_member_id;

    insert into public.staff_market_listings (
      batch_id,
      staff_member_id,
      daily_slot,
      signing_fee,
      salary_per_season
    ) values (
      v_batch_id,
      v_staff_member_id,
      v_slot,
      public.calculate_staff_signing_fee(v_role, v_level),
      public.calculate_staff_salary(v_role, v_level)
    );
  end loop;

  return v_slot;
end;
$$;

-- Les architectes déjà présents sur le marché reçoivent un profil équilibré.
update public.staff_members
set architect_specialty = 'balanced'
where role = 'architect'
  and architect_specialty is null;

grant select on table public.team_infrastructures to authenticated;
grant select on table public.international_youth_centers to authenticated;
grant select on table public.infrastructure_projects to authenticated;
grant select on table public.infrastructure_notifications to authenticated;

grant all privileges on table public.team_infrastructures to service_role;
grant all privileges on table public.international_youth_centers to service_role;
grant all privileges on table public.infrastructure_projects to service_role;
grant all privileges on table public.infrastructure_notifications to service_role;

revoke all on function public.settle_due_infrastructure_projects()
  from public, anon;
grant execute on function public.settle_due_infrastructure_projects()
  to authenticated, service_role;

revoke all on function public.start_current_team_infrastructure_project(text, uuid, uuid)
  from public, anon;
grant execute on function public.start_current_team_infrastructure_project(text, uuid, uuid)
  to authenticated, service_role;

revoke all on function public.mark_current_infrastructure_notifications_read()
  from public, anon;
grant execute on function public.mark_current_infrastructure_notifications_read()
  to authenticated, service_role;

commit;
