-- Rend constructibles le Centre d’entraînement et les bâtiments du Fan Club.

begin;

alter table public.team_infrastructures
  drop constraint if exists team_infrastructures_code_allowed,
  drop constraint if exists team_infrastructures_level_range;

alter table public.team_infrastructures
  add constraint team_infrastructures_code_allowed check (
    infrastructure_code in (
      'recruitment_data_room',
      'staff_academy',
      'training_center',
      'fan_club_headquarters',
      'club_shop'
    )
  ),
  add constraint team_infrastructures_level_range check (
    (infrastructure_code = 'recruitment_data_room' and level between 1 and 3)
    or (infrastructure_code = 'staff_academy' and level between 1 and 5)
    or (infrastructure_code = 'training_center' and level between 1 and 5)
    or (infrastructure_code = 'fan_club_headquarters' and level between 1 and 5)
    or (infrastructure_code = 'club_shop' and level between 1 and 5)
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
      'training_center',
      'fan_club_headquarters',
      'club_shop',
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
    or (infrastructure_code = 'training_center' and target_level between 1 and 5)
    or (infrastructure_code = 'fan_club_headquarters' and target_level between 1 and 5)
    or (infrastructure_code = 'club_shop' and target_level between 1 and 5)
    or (infrastructure_code = 'international_youth_center' and target_level between 1 and 5)
  ),
  add constraint infrastructure_projects_durations_valid check (
    base_duration_days between 1 and 84
    and final_duration_days between 1 and base_duration_days
    and completes_game_day_index =
      starts_game_day_index + final_duration_days
  );

alter function public.settle_due_infrastructure_projects()
  rename to settle_due_infrastructure_projects_legacy_20260811;

alter function public.start_current_team_infrastructure_project(text, uuid, uuid)
  rename to start_current_team_infrastructure_project_legacy_20260811;

revoke all on function public.settle_due_infrastructure_projects_legacy_20260811()
  from public, anon, authenticated;
revoke all on function public.start_current_team_infrastructure_project_legacy_20260811(text, uuid, uuid)
  from public, anon, authenticated;

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
  v_notification_title text;
  v_notification_message text;
begin
  perform public.sync_active_season_day();

  select season.game_year * 28 + season.current_day_number - 1
  into v_current_game_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_current_game_day is not null then
    for v_project in
      select project.*
      from public.infrastructure_projects as project
      where project.status = 'active'
        and project.infrastructure_code in (
          'training_center',
          'fan_club_headquarters',
          'club_shop'
        )
        and project.completes_game_day_index <= v_current_game_day
      order by project.completes_game_day_index, project.created_at
      for update skip locked
    loop
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
        level = greatest(public.team_infrastructures.level, excluded.level),
        completed_project_id = excluded.completed_project_id,
        completed_at = excluded.completed_at,
        updated_at = now();

      if v_project.infrastructure_code = 'training_center' then
        v_notification_title := 'Centre d’entraînement amélioré';
        v_notification_message :=
          'Le niveau ' || v_project.target_level::text ||
          ' accorde désormais +' || (v_project.target_level * 2)::text ||
          ' % de progression à chaque entraînement professionnel.';
      elsif v_project.infrastructure_code = 'fan_club_headquarters' then
        v_notification_title := 'Siège social du Fan Club amélioré';
        v_notification_message :=
          'Le siège social du Fan Club atteint désormais le niveau ' ||
          v_project.target_level::text || '.';
      else
        v_notification_title := 'Boutique du club améliorée';
        v_notification_message :=
          'La boutique du club atteint désormais le niveau ' ||
          v_project.target_level::text || '.';
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

      update public.infrastructure_projects
      set status = 'completed', completed_at = now(), updated_at = now()
      where id = v_project.id;

      v_completed := v_completed + 1;
    end loop;
  end if;

  return v_completed +
    public.settle_due_infrastructure_projects_legacy_20260811();
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
  if p_infrastructure_code in (
    'recruitment_data_room',
    'staff_academy',
    'international_youth_center'
  ) then
    return public.start_current_team_infrastructure_project_legacy_20260811(
      p_infrastructure_code,
      p_country_id,
      p_architect_contract_id
    );
  end if;

  if p_infrastructure_code not in (
    'training_center',
    'fan_club_headquarters',
    'club_shop'
  ) then
    raise exception 'Cette infrastructure n’existe pas.';
  end if;

  if p_country_id is not null then
    raise exception 'Cette infrastructure n’est pas liée à un pays.';
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

  if p_infrastructure_code = 'club_shop'
    and not exists (
      select 1
      from public.team_infrastructures
      where team_id = v_context.team_id
        and infrastructure_code = 'fan_club_headquarters'
        and level >= 1
    )
  then
    raise exception 'Construisez d’abord le siège social du Fan Club.';
  end if;

  select coalesce(max(infrastructure.level), 0)
  into v_current_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = p_infrastructure_code;

  if v_current_level >= 5 then
    raise exception 'Cette infrastructure a déjà atteint son niveau maximal.';
  end if;

  v_target_level := v_current_level + 1;

  if p_infrastructure_code = 'training_center' then
    v_base_cost := (
      array[100000, 250000, 500000, 900000, 1500000]::numeric[]
    )[v_target_level];
    v_base_duration := (
      array[7, 14, 24, 35, 49]::integer[]
    )[v_target_level];
    v_description :=
      'Centre d’entraînement — niveau ' || v_target_level::text;
  elsif p_infrastructure_code = 'fan_club_headquarters' then
    v_base_cost := (
      array[200000, 450000, 850000, 1400000, 2200000]::numeric[]
    )[v_target_level];
    v_base_duration := (
      array[10, 18, 28, 40, 56]::integer[]
    )[v_target_level];
    v_description :=
      'Siège social du Fan Club — niveau ' || v_target_level::text;
  else
    v_base_cost := (
      array[150000, 350000, 650000, 1050000, 1600000]::numeric[]
    )[v_target_level];
    v_base_duration := (
      array[8, 16, 24, 34, 46]::integer[]
    )[v_target_level];
    v_description :=
      'Boutique du club — niveau ' || v_target_level::text;
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
    null,
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

create or replace function public.get_team_training_center_progress_multiplier(
  p_team_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select 1 + coalesce(max(infrastructure.level), 0) * 0.02
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = p_team_id
    and infrastructure.infrastructure_code = 'training_center';
$$;

do $migration$
declare
  v_definition text;
  v_needle text :=
    'public.get_daily_reward_training_multiplier_for_session(v_rider.team_id, v_day.id)';
begin
  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  )
  into v_definition;

  if position(
    'get_team_training_center_progress_multiplier' in v_definition
  ) = 0 then
    if position(v_needle in v_definition) = 0 then
      raise exception 'Point d’intégration du Centre d’entraînement introuvable.';
    end if;

    v_definition := replace(
      v_definition,
      v_needle,
      v_needle ||
        ' * public.get_team_training_center_progress_multiplier(v_rider.team_id)'
    );
    execute v_definition;
  end if;
end;
$migration$;

revoke all on function public.settle_due_infrastructure_projects()
  from public, anon;
revoke all on function public.start_current_team_infrastructure_project(text, uuid, uuid)
  from public, anon;
revoke all on function public.get_team_training_center_progress_multiplier(uuid)
  from public, anon, authenticated;

grant execute on function public.settle_due_infrastructure_projects()
  to authenticated, service_role;
grant execute on function public.start_current_team_infrastructure_project(text, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.get_team_training_center_progress_multiplier(uuid)
  to service_role;

comment on function public.get_team_training_center_progress_multiplier(uuid) is
  'Applique +2 % de progression par niveau du Centre d’entraînement.';

notify pgrst, 'reload schema';

commit;
