-- Ramène le niveau 1 de la Data Room à 200 k€.
-- Les niveaux 2 et 3 conservent le barème commun des améliorations :
-- 60 % puis 70 % du prix d'entrée, soit 120 k€ et 140 k€.

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
  v_required_director_level integer;
  v_current_level integer := 0;
  v_target_level integer;
  v_max_level integer;
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
    'training_center',
    'fan_club_headquarters',
    'club_shop',
    'international_youth_center',
    'indoor_track',
    'cryotherapy_center',
    'wind_tunnel',
    'research_lab',
    'international_welcome_center',
    'weather_center',
    'media_center'
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
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
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

  if p_infrastructure_code = 'international_youth_center' then
    if p_country_id is null or not exists (
      select 1
      from public.countries
      where id = p_country_id
        and is_active
    ) then
      raise exception 'Le pays du centre international est invalide.';
    end if;

    select coalesce(max(center.quality_level), 0)
    into v_current_level
    from public.international_youth_centers as center
    where center.team_id = v_context.team_id
      and center.country_id = p_country_id;
  else
    if p_country_id is not null then
      raise exception 'Cette infrastructure n’est pas liée à un pays.';
    end if;

    select coalesce(max(infrastructure.level), 0)
    into v_current_level
    from public.team_infrastructures as infrastructure
    where infrastructure.team_id = v_context.team_id
      and infrastructure.infrastructure_code = p_infrastructure_code;
  end if;

  v_max_level := case
    when p_infrastructure_code = 'recruitment_data_room' then 3
    when p_infrastructure_code = 'research_lab' then 7
    else 5
  end;

  if v_current_level >= v_max_level then
    raise exception 'Cette infrastructure a déjà atteint son niveau maximal.';
  end if;

  v_target_level := v_current_level + 1;
  v_director_level :=
    public.calculate_staff_director_level(v_context.experience_points);
  v_required_director_level := least(v_target_level, 5) * 10;

  if v_director_level < v_required_director_level then
    raise exception 'Le niveau % de Directeur Sportif est requis pour construire le niveau %.',
      v_required_director_level,
      v_target_level;
  end if;

  perform public.assert_team_infrastructure_construction_slot(
    v_context.team_id,
    p_infrastructure_code,
    p_country_id,
    p_architect_contract_id
  );

  case p_infrastructure_code
    when 'recruitment_data_room' then
      v_base_cost := 200000;
      v_base_duration := (array[14, 28, 42]::integer[])[v_target_level];
      v_description := 'Construction Data Room';
    when 'staff_academy' then
      v_base_cost := 1500000;
      v_base_duration := (array[42, 49, 56, 70, 84]::integer[])[v_target_level];
      v_description := 'Académie des métiers';
    when 'training_center' then
      v_base_cost := 100000;
      v_base_duration := (array[7, 14, 24, 35, 49]::integer[])[v_target_level];
      v_description := 'Centre d’entraînement';
    when 'fan_club_headquarters' then
      v_base_cost := 200000;
      v_base_duration := (array[10, 18, 28, 40, 56]::integer[])[v_target_level];
      v_description := 'Siège social du Fan Club';
    when 'club_shop' then
      v_base_cost := 150000;
      v_base_duration := (array[8, 16, 24, 34, 46]::integer[])[v_target_level];
      v_description := 'Boutique du club';
    when 'international_youth_center' then
      v_base_cost := 500000;
      v_base_duration := (array[28, 35, 42, 49, 56]::integer[])[v_target_level];
      v_description := 'Centre international';
    when 'indoor_track' then
      v_base_cost := 180000;
      v_base_duration := (array[10, 18, 28, 40, 55]::integer[])[v_target_level];
      v_description := 'Piste indoor';
    when 'cryotherapy_center' then
      v_base_cost := 250000;
      v_base_duration := (array[12, 22, 34, 48, 64]::integer[])[v_target_level];
      v_description := 'Centre de cryothérapie';
    when 'wind_tunnel' then
      v_base_cost := 400000;
      v_base_duration := (array[16, 28, 42, 58, 76]::integer[])[v_target_level];
      v_description := 'Soufflerie';
    when 'weather_center' then
      v_base_cost := 500000;
      v_base_duration := (array[14, 24, 36, 50, 66]::integer[])[v_target_level];
      v_description := 'Centre météo';
    when 'media_center' then
      v_base_cost := 650000;
      v_base_duration := (array[18, 30, 44, 60, 78]::integer[])[v_target_level];
      v_description := 'Média Center';
    when 'international_welcome_center' then
      v_base_cost := 800000;
      v_base_duration := (array[24, 38, 54, 72, 84]::integer[])[v_target_level];
      v_description := 'Centre d’accueil international';
    else
      v_base_cost := 1200000;
      v_base_duration := (array[28, 42, 56, 70, 84, 84, 84]::integer[])[v_target_level];
      v_description := 'Laboratoire R&D';
  end case;

  v_base_cost := round(
    v_base_cost * case v_target_level
      when 1 then 1.0
      when 2 then 0.6
      when 3 then 0.7
      when 4 then 0.8
      else 0.9
    end
  );

  if p_architect_contract_id is not null then
    select
      contract.id,
      member.level,
      coalesce(member.architect_specialty, 'balanced') as specialty
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

    v_architect_specialty := v_architect.specialty;
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
    v_description || ' — niveau ' || v_target_level::text,
    'infrastructure-project:' || v_project_id::text,
    now()
  );

  update public.team_seasons
  set cash_balance = cash_balance - v_final_cost
  where id = v_context.team_season_id;

  return v_project_id;
end;
$$;

