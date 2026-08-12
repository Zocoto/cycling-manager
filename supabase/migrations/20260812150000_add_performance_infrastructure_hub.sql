-- Performance, recovery, international, weather, media and material facilities.

begin;

-- ---------------------------------------------------------------------------
-- Construction catalogue
-- ---------------------------------------------------------------------------

alter table public.team_infrastructures
  drop constraint if exists team_infrastructures_code_allowed,
  drop constraint if exists team_infrastructures_level_range;

alter table public.team_infrastructures
  add constraint team_infrastructures_code_allowed check (infrastructure_code in (
    'recruitment_data_room', 'staff_academy', 'training_center',
    'fan_club_headquarters', 'club_shop', 'indoor_track',
    'cryotherapy_center', 'wind_tunnel', 'research_lab',
    'international_welcome_center', 'weather_center', 'media_center'
  )),
  add constraint team_infrastructures_level_range check (
    (infrastructure_code = 'recruitment_data_room' and level between 1 and 3)
    or (infrastructure_code = 'research_lab' and level between 1 and 7)
    or (infrastructure_code <> 'recruitment_data_room'
        and infrastructure_code <> 'research_lab' and level between 1 and 5)
  );

alter table public.infrastructure_projects
  drop constraint if exists infrastructure_projects_code_allowed,
  drop constraint if exists infrastructure_projects_country_shape,
  drop constraint if exists infrastructure_projects_target_level_range;

alter table public.infrastructure_projects
  add constraint infrastructure_projects_code_allowed check (infrastructure_code in (
    'recruitment_data_room', 'staff_academy', 'training_center',
    'fan_club_headquarters', 'club_shop', 'international_youth_center',
    'indoor_track', 'cryotherapy_center', 'wind_tunnel', 'research_lab',
    'international_welcome_center', 'weather_center', 'media_center'
  )),
  add constraint infrastructure_projects_country_shape check (
    (infrastructure_code = 'international_youth_center' and country_id is not null)
    or (infrastructure_code <> 'international_youth_center' and country_id is null)
  ),
  add constraint infrastructure_projects_target_level_range check (
    (infrastructure_code = 'recruitment_data_room' and target_level between 1 and 3)
    or (infrastructure_code = 'research_lab' and target_level between 1 and 7)
    or (infrastructure_code = 'international_youth_center' and target_level between 1 and 5)
    or (infrastructure_code not in ('recruitment_data_room', 'research_lab', 'international_youth_center')
        and target_level between 1 and 5)
  );

alter function public.settle_due_infrastructure_projects()
  rename to settle_due_infrastructure_projects_legacy_20260812;
alter function public.start_current_team_infrastructure_project(text, uuid, uuid)
  rename to start_current_team_infrastructure_project_legacy_20260812;

revoke all on function public.settle_due_infrastructure_projects_legacy_20260812()
  from public, anon, authenticated;
revoke all on function public.start_current_team_infrastructure_project_legacy_20260812(text, uuid, uuid)
  from public, anon, authenticated;

create or replace function public.settle_due_infrastructure_projects()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_game_day integer;
  v_project record;
  v_completed integer := 0;
  v_name text;
begin
  perform public.sync_active_season_day();
  select game_year * 28 + current_day_number - 1 into v_game_day
  from public.seasons where status = 'active' limit 1;

  for v_project in
    select * from public.infrastructure_projects
    where status = 'active'
      and infrastructure_code in (
        'indoor_track', 'cryotherapy_center', 'wind_tunnel', 'research_lab',
        'international_welcome_center', 'weather_center', 'media_center'
      )
      and completes_game_day_index <= v_game_day
    order by completes_game_day_index, created_at for update skip locked
  loop
    insert into public.team_infrastructures (
      team_id, infrastructure_code, level, completed_project_id, completed_at, updated_at
    ) values (
      v_project.team_id, v_project.infrastructure_code, v_project.target_level,
      v_project.id, now(), now()
    ) on conflict (team_id, infrastructure_code) do update set
      level = greatest(public.team_infrastructures.level, excluded.level),
      completed_project_id = excluded.completed_project_id,
      completed_at = excluded.completed_at,
      updated_at = now();

    v_name := case v_project.infrastructure_code
      when 'indoor_track' then 'Piste indoor'
      when 'cryotherapy_center' then 'Centre de cryothérapie'
      when 'wind_tunnel' then 'Soufflerie'
      when 'research_lab' then 'Laboratoire R&D'
      when 'international_welcome_center' then 'Centre d’accueil international'
      when 'weather_center' then 'Centre météo'
      else 'Média Center' end;
    insert into public.infrastructure_notifications (team_id, project_id, title, message)
    values (
      v_project.team_id, v_project.id, v_name || ' amélioré',
      v_name || ' atteint désormais le niveau ' || v_project.target_level::text || '.'
    ) on conflict (team_id, project_id) do nothing;
    update public.infrastructure_projects
    set status = 'completed', completed_at = now(), updated_at = now()
    where id = v_project.id;
    v_completed := v_completed + 1;
  end loop;

  return v_completed + public.settle_due_infrastructure_projects_legacy_20260812();
end;
$$;

create or replace function public.start_current_team_infrastructure_project(
  p_infrastructure_code text,
  p_country_id uuid default null,
  p_architect_contract_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_context record;
  v_architect record;
  v_project_id uuid;
  v_current_level integer := 0;
  v_target_level integer;
  v_max_level integer;
  v_base_cost numeric(14,2);
  v_final_cost numeric(14,2);
  v_base_duration integer;
  v_final_duration integer;
  v_cost_reduction integer := 0;
  v_duration_reduction integer := 0;
  v_specialty text;
  v_game_day integer;
  v_name text;
begin
  if p_infrastructure_code in (
    'recruitment_data_room', 'staff_academy', 'international_youth_center',
    'training_center', 'fan_club_headquarters', 'club_shop'
  ) then
    return public.start_current_team_infrastructure_project_legacy_20260812(
      p_infrastructure_code, p_country_id, p_architect_contract_id
    );
  end if;
  if p_infrastructure_code not in (
    'indoor_track', 'cryotherapy_center', 'wind_tunnel', 'research_lab',
    'international_welcome_center', 'weather_center', 'media_center'
  ) then raise exception 'Cette infrastructure n’existe pas.'; end if;
  if p_country_id is not null then raise exception 'Cette infrastructure n’est pas liée à un pays.'; end if;

  perform public.settle_current_team_finances();
  perform public.settle_due_infrastructure_projects();
  select director.experience_points, assignment.team_id, season.id season_id,
    season.game_year, season.current_day_number, team_season.id team_season_id,
    team_season.cash_balance, season_day.id season_day_id
  into v_context
  from public.sporting_directors director
  join public.team_manager_assignments assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons season on season.status = 'active'
  join public.team_seasons team_season on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  join public.season_days season_day on season_day.season_id = season.id and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid() and director.status = 'active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;
  if public.calculate_staff_director_level(v_context.experience_points) < 10 then
    raise exception 'Les infrastructures sont accessibles à partir du niveau 10.';
  end if;
  perform 1 from public.team_seasons where id = v_context.team_season_id for update;
  if exists (select 1 from public.infrastructure_projects where team_id = v_context.team_id and status = 'active') then
    raise exception 'Votre équipe possède déjà un chantier actif.';
  end if;
  select coalesce(max(level),0) into v_current_level from public.team_infrastructures
  where team_id = v_context.team_id and infrastructure_code = p_infrastructure_code;
  v_max_level := case when p_infrastructure_code = 'research_lab' then 7 else 5 end;
  if v_current_level >= v_max_level then raise exception 'Cette infrastructure a déjà atteint son niveau maximal.'; end if;
  v_target_level := v_current_level + 1;

  case p_infrastructure_code
    when 'indoor_track' then
      v_base_cost := (array[180000,450000,900000,1550000,2400000]::numeric[])[v_target_level];
      v_base_duration := (array[10,18,28,40,55]::integer[])[v_target_level]; v_name := 'Piste indoor';
    when 'cryotherapy_center' then
      v_base_cost := (array[250000,600000,1100000,1800000,2800000]::numeric[])[v_target_level];
      v_base_duration := (array[12,22,34,48,64]::integer[])[v_target_level]; v_name := 'Centre de cryothérapie';
    when 'wind_tunnel' then
      v_base_cost := (array[400000,850000,1500000,2400000,3600000]::numeric[])[v_target_level];
      v_base_duration := (array[16,28,42,58,76]::integer[])[v_target_level]; v_name := 'Soufflerie';
    when 'weather_center' then
      v_base_cost := (array[500000,900000,1500000,2300000,3300000]::numeric[])[v_target_level];
      v_base_duration := (array[14,24,36,50,66]::integer[])[v_target_level]; v_name := 'Centre météo';
    when 'media_center' then
      v_base_cost := (array[650000,1200000,2000000,3000000,4300000]::numeric[])[v_target_level];
      v_base_duration := (array[18,30,44,60,78]::integer[])[v_target_level]; v_name := 'Média Center';
    when 'international_welcome_center' then
      v_base_cost := (array[800000,1500000,2500000,3800000,5500000]::numeric[])[v_target_level];
      v_base_duration := (array[24,38,54,72,84]::integer[])[v_target_level]; v_name := 'Centre d’accueil international';
    else
      v_base_cost := (array[1200000,2000000,3000000,4200000,5600000,7200000,9000000]::numeric[])[v_target_level];
      v_base_duration := (array[28,42,56,70,84,84,84]::integer[])[v_target_level]; v_name := 'Laboratoire R&D';
  end case;

  if p_architect_contract_id is not null then
    select contract.id, member.level, coalesce(member.architect_specialty,'balanced') specialty
    into v_architect from public.staff_contracts contract
    join public.staff_members member on member.id = contract.staff_member_id
    where contract.id = p_architect_contract_id and contract.team_id = v_context.team_id
      and contract.status = 'active' and member.role = 'architect';
    if v_architect is null then raise exception 'Cet architecte ne fait pas partie du staff actif de votre équipe.'; end if;
    v_specialty := v_architect.specialty;
    if v_specialty = 'economist' then v_cost_reduction := v_architect.level*6; v_duration_reduction := v_architect.level*2;
    elsif v_specialty = 'foreman' then v_cost_reduction := v_architect.level*2; v_duration_reduction := v_architect.level*6;
    else v_cost_reduction := v_architect.level*4; v_duration_reduction := v_architect.level*4; end if;
  end if;
  v_cost_reduction := public.get_architect_adjusted_reduction(p_architect_contract_id,v_cost_reduction,'cost');
  v_duration_reduction := public.get_architect_adjusted_reduction(p_architect_contract_id,v_duration_reduction,'duration');
  v_final_cost := round(v_base_cost*(1-v_cost_reduction/100.0));
  v_final_duration := greatest(1,ceil(v_base_duration*(1-v_duration_reduction/100.0))::integer);
  if v_context.cash_balance < v_final_cost then raise exception 'Trésorerie insuffisante pour lancer ce chantier.'; end if;
  v_game_day := v_context.game_year*28+v_context.current_day_number-1;
  insert into public.infrastructure_projects (
    team_id,infrastructure_code,country_id,target_level,architect_contract_id,
    architect_specialty,architect_level,base_cost,final_cost,base_duration_days,
    final_duration_days,cost_reduction_percentage,duration_reduction_percentage,
    started_season_id,started_day_number,starts_game_day_index,completes_game_day_index
  ) values (
    v_context.team_id,p_infrastructure_code,null,v_target_level,p_architect_contract_id,
    case when p_architect_contract_id is null then null else v_specialty end,
    case when p_architect_contract_id is null then null else v_architect.level end,
    v_base_cost,v_final_cost,v_base_duration,v_final_duration,v_cost_reduction,
    v_duration_reduction,v_context.season_id,v_context.current_day_number,v_game_day,v_game_day+v_final_duration
  ) returning id into v_project_id;
  insert into public.team_finance_transactions (
    team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at
  ) values (
    v_context.team_season_id,v_context.season_day_id,v_context.current_day_number,-v_final_cost,
    'building','posted',v_name||' — niveau '||v_target_level::text,'infrastructure-project:'||v_project_id::text,now()
  );
  update public.team_seasons set cash_balance=cash_balance-v_final_cost where id=v_context.team_season_id;
  return v_project_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Indoor track and wind tunnel preparations
-- ---------------------------------------------------------------------------

alter table public.rider_form_camps drop constraint if exists rider_form_camps_type_allowed;
alter table public.rider_form_camps drop constraint if exists rider_form_camps_gain_allowed;
alter table public.rider_form_camps add constraint rider_form_camps_type_allowed
  check (camp_type in ('classic','premium','reconnaissance','indoor_preparation','wind_tunnel_preparation'));
alter table public.rider_form_camps add constraint rider_form_camps_gain_allowed check (
  (camp_type='classic' and form_gain_per_day=5) or
  (camp_type='premium' and form_gain_per_day=10) or
  (camp_type in ('reconnaissance','indoor_preparation','wind_tunnel_preparation') and form_gain_per_day=0)
);

create table public.rider_performance_preparations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  form_camp_id uuid not null references public.rider_form_camps(id) on delete cascade,
  preparation_type text not null check (preparation_type in ('indoor_track','wind_tunnel')),
  building_level smallint not null check (building_level between 1 and 5),
  preparation_start_game_day integer not null,
  preparation_end_game_day integer not null,
  bonus_start_game_day integer not null,
  bonus_end_game_day integer not null,
  rating_bonus smallint not null check (rating_bonus between 1 and 3),
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  created_at timestamptz not null default now(),
  constraint rider_performance_preparation_timeline check (
    preparation_end_game_day=preparation_start_game_day+1 and
    bonus_start_game_day=preparation_end_game_day+1 and bonus_end_game_day>=bonus_start_game_day
  )
);
create index rider_performance_preparations_rider_bonus_idx
  on public.rider_performance_preparations(rider_id,bonus_start_game_day,bonus_end_game_day) where status<>'cancelled';
create unique index rider_performance_preparations_facility_active_idx
  on public.rider_performance_preparations(team_id,preparation_type) where status='planned';
alter table public.rider_performance_preparations enable row level security;
create policy rider_performance_preparations_read_own on public.rider_performance_preparations
for select to authenticated using (team_id=public.current_fan_club_team_id());
grant select on public.rider_performance_preparations to authenticated;
grant all on public.rider_performance_preparations to service_role;

create or replace function public.settle_due_rider_performance_preparations()
returns integer language plpgsql security definer set search_path=public as $$
declare v_game_day integer; v_count integer;
begin
  perform public.sync_active_season_day();
  select game_year*28+current_day_number-1 into v_game_day from public.seasons where status='active' limit 1;
  update public.rider_performance_preparations set status='completed'
  where status='planned' and preparation_end_game_day<v_game_day;
  get diagnostics v_count=row_count; return v_count;
end; $$;

create or replace function public.start_current_team_rider_performance_preparation(
  p_rider_id uuid,p_preparation_type text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_context record; v_level integer; v_game_day integer; v_bonus integer; v_days integer; v_camp uuid; v_id uuid;
begin
  if p_preparation_type not in ('indoor_track','wind_tunnel') then raise exception 'Type de préparation invalide.'; end if;
  perform public.settle_due_rider_performance_preparations();
  select assignment.team_id,season.id season_id,season.game_year,season.current_day_number,
    team_season.id team_season_id
  into v_context from public.sporting_directors director
  join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id and assignment.role='general_manager' and assignment.status='active'
  join public.seasons season on season.status='active'
  join public.team_seasons team_season on team_season.team_id=assignment.team_id and team_season.season_id=season.id
  where director.auth_user_id=auth.uid() and director.status='active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active.'; end if;
  select coalesce(max(level),0) into v_level from public.team_infrastructures
  where team_id=v_context.team_id and infrastructure_code=p_preparation_type;
  if v_level<1 and p_preparation_type='indoor_track' then
    raise exception 'Construisez d’abord la Piste indoor.';
  elsif v_level<1 then
    raise exception 'Construisez d’abord la Soufflerie.';
  end if;
  if v_context.current_day_number>26 then raise exception 'Cette préparation de deux jours doit commencer avant la fin de la saison.'; end if;
  if not exists (select 1 from public.rider_contracts where rider_id=p_rider_id and team_id=v_context.team_id and status='active') then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;
  if exists (select 1 from public.rider_injuries where rider_id=p_rider_id and status<>'recovered') then raise exception 'Ce coureur est actuellement blessé.'; end if;
  if exists (select 1 from public.rider_form_camps where rider_id=p_rider_id and season_id=v_context.season_id and status<>'cancelled'
    and start_day_number<=v_context.current_day_number+2 and end_day_number>=v_context.current_day_number+1) then
    raise exception 'Ce coureur est déjà indisponible pendant cette période.';
  end if;
  if exists (
    select 1 from public.race_rosters roster
    join public.race_registrations registration on registration.id=roster.race_registration_id and registration.status='accepted'
    join public.stages stage on stage.race_edition_id=registration.race_edition_id
    join public.season_days day on day.id=stage.season_day_id
    where roster.rider_id=p_rider_id and day.season_id=v_context.season_id
      and day.day_number between v_context.current_day_number+1 and v_context.current_day_number+2
  ) then raise exception 'Ce coureur est engagé en course pendant cette préparation.'; end if;
  if exists (select 1 from public.rider_performance_preparations where team_id=v_context.team_id and preparation_type=p_preparation_type and status='planned') then
    raise exception 'Cette installation accueille déjà un coureur.';
  end if;
  v_bonus:=case when v_level<=2 then 1 when v_level<=4 then 2 else 3 end;
  v_days:=case when v_level in (2,4) then 3 else 2 end;
  v_game_day:=v_context.game_year*28+v_context.current_day_number-1;
  insert into public.rider_form_camps(rider_id,team_season_id,season_id,camp_type,start_day_number,end_day_number,form_gain_per_day,price_per_day,total_price)
  values(p_rider_id,v_context.team_season_id,v_context.season_id,
    case when p_preparation_type='indoor_track' then 'indoor_preparation' else 'wind_tunnel_preparation' end,
    v_context.current_day_number+1,v_context.current_day_number+2,0,0,0) returning id into v_camp;
  insert into public.rider_performance_preparations(
    team_id,team_season_id,season_id,rider_id,form_camp_id,preparation_type,building_level,
    preparation_start_game_day,preparation_end_game_day,bonus_start_game_day,bonus_end_game_day,rating_bonus
  ) values(v_context.team_id,v_context.team_season_id,v_context.season_id,p_rider_id,v_camp,p_preparation_type,v_level,
    v_game_day+1,v_game_day+2,v_game_day+3,v_game_day+2+v_days,v_bonus) returning id into v_id;
  return v_id;
end; $$;

do $migration$ declare v_definition text; begin
  select pg_get_functiondef('public.get_current_team_race_roster_options_before_reconnaissance(uuid)'::regprocedure) into v_definition;
  if position('when ''premium'' then ''Stage de forme premium''' in v_definition)=0 then
    raise exception 'Le libellé des indisponibilités a changé : migration des préparations interrompue.';
  end if;
  v_definition:=replace(
    v_definition,
    'when ''premium'' then ''Stage de forme premium''',
    'when ''premium'' then ''Stage de forme premium''
        when ''reconnaissance'' then ''Reconnaissance de parcours''
        when ''indoor_preparation'' then U&''Pr\00E9paration indoor''
        when ''wind_tunnel_preparation'' then U&''Pr\00E9paration en soufflerie'''
  );
  v_definition:=replace(
    v_definition,
    'case form_camp.camp_type
        when ''premium'' then ''Stage de forme premium''
        else ''Stage de forme classique''
      end',
    'case form_camp.camp_type
        when ''premium'' then ''Stage de forme premium''
        when ''reconnaissance'' then ''Reconnaissance de parcours''
        when ''indoor_preparation'' then ''Préparation indoor''
        when ''wind_tunnel_preparation'' then ''Préparation en soufflerie''
        else ''Stage de forme classique''
      end'
  );
  if position('indoor_preparation' in v_definition)=0 then
    raise exception 'Le libellé indoor n’a pas été injecté dans les indisponibilités.';
  end if;
  execute v_definition;
end $migration$;

-- ---------------------------------------------------------------------------
-- Cryotherapy, after the rider-specific physiotherapist protection
-- ---------------------------------------------------------------------------

alter table public.stage_rider_condition_effects
  add column if not exists cryotherapy_form_protection numeric(5,2) not null default 0;

create or replace function public.apply_assigned_physio_to_race_condition()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_team_id uuid; v_physio_level integer; v_physio integer:=0; v_cryo integer:=0; v_after_physio numeric; v_original numeric:=new.form_delta;
begin
  new.physiotherapist_level:=0; new.physiotherapist_form_protection:=0; new.cryotherapy_form_protection:=0;
  select team_season.team_id into v_team_id from public.stages stage
  join public.race_registrations registration on registration.race_edition_id=stage.race_edition_id and registration.status='accepted'
  join public.race_rosters roster on roster.race_registration_id=registration.id and roster.rider_id=new.rider_id
  join public.team_seasons team_season on team_season.id=registration.team_season_id
  where stage.id=new.stage_id limit 1;
  if v_team_id is null then return new; end if;
  v_physio_level:=public.get_active_rider_physiotherapist_level(v_team_id,new.rider_id);
  if v_physio_level>0 then v_physio:=public.get_rider_physio_form_protection(v_team_id,new.rider_id,'race'); end if;
  new.form_delta:=least(-1,new.form_delta+v_physio); v_after_physio:=new.form_delta;
  select coalesce(max(level),0)*10 into v_cryo from public.team_infrastructures
  where team_id=v_team_id and infrastructure_code='cryotherapy_center';
  if v_cryo>0 then new.form_delta:=-round(abs(new.form_delta)*(1-v_cryo/100.0),2); end if;
  new.form_after:=greatest(0,new.form_before+new.form_delta);
  new.physiotherapist_level:=least(5,greatest(0,v_physio_level));
  new.physiotherapist_form_protection:=greatest(0,v_after_physio-v_original);
  new.cryotherapy_form_protection:=greatest(0,new.form_delta-v_after_physio);
  return new;
end; $$;

-- ---------------------------------------------------------------------------
-- R&D engineer and unique equipment prototypes
-- ---------------------------------------------------------------------------

alter table public.staff_members drop constraint if exists staff_members_role_allowed;
alter table public.staff_members add constraint staff_members_role_allowed check (role in (
  'trainer','scout','doctor','mechanic','community_manager','nutritionist',
  'physiotherapist','race_preparer','architect','research_engineer'
));
alter table public.staff_talent_catalog drop constraint if exists staff_talent_catalog_role_allowed;
alter table public.staff_talent_catalog add constraint staff_talent_catalog_role_allowed check (role in (
  'trainer','scout','doctor','mechanic','community_manager','nutritionist',
  'physiotherapist','race_preparer','architect','research_engineer'
));
insert into public.staff_talent_catalog(code,role,display_name) values
  ('research_time','research_engineer','Protocoles accélérés'),
  ('research_cost','research_engineer','Optimisation budgétaire'),
  ('research_success','research_engineer','Validation expérimentale')
on conflict(code) do update set role=excluded.role,display_name=excluded.display_name;

create or replace function public.calculate_staff_salary(p_role text,p_level integer)
returns numeric language plpgsql immutable set search_path=public as $$
declare v_base numeric; v_multiplier numeric; v_level integer:=least(5,greatest(1,coalesce(p_level,1)));
begin
  v_base:=case p_role when 'trainer' then 22000 when 'scout' then 19000 when 'doctor' then 17000 when 'mechanic' then 14000 when 'nutritionist' then 13000 when 'physiotherapist' then 13000 when 'race_preparer' then 15000 when 'architect' then 12000 when 'community_manager' then 11000 when 'research_engineer' then 24000 else null end;
  if v_base is null then raise exception 'Métier de staff invalide.'; end if;
  v_multiplier:=(array[1.00,1.50,2.20,3.30,5.00]::numeric[])[v_level];
  return round((v_base*v_multiplier)/500)*500;
end; $$;

do $migration$ declare v_definition text; begin
  select pg_get_functiondef('public.create_daily_staff_market(date,jsonb)'::regprocedure) into v_definition;
  if position('''nutritionist'', ''physiotherapist'', ''race_preparer'', ''architect''' in v_definition)=0 then
    raise exception 'La validation des mÃ©tiers du marchÃ© du staff a changÃ© : migration R&D interrompue.';
  end if;
  v_definition:=replace(v_definition,
    '''nutritionist'', ''physiotherapist'', ''race_preparer'', ''architect''',
    '''nutritionist'', ''physiotherapist'', ''race_preparer'', ''architect'', ''research_engineer''');
  if position('research_engineer' in v_definition)=0 then
    raise exception 'Le métier ingénieur R&D n’a pas été injecté dans le marché.';
  end if;
  execute v_definition;
end $migration$;

alter function public.hire_current_team_staff(uuid) rename to hire_current_team_staff_legacy_20260812;
revoke all on function public.hire_current_team_staff_legacy_20260812(uuid) from public,anon,authenticated;
create or replace function public.hire_current_team_staff(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_team uuid; v_role text;
begin
  select assignment.team_id,member.role into v_team,v_role
  from public.sporting_directors director
  join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id and assignment.role='general_manager' and assignment.status='active'
  join public.staff_market_listings listing on listing.id=p_listing_id
  join public.staff_members member on member.id=listing.staff_member_id
  where director.auth_user_id=auth.uid() and director.status='active' limit 1;
  if v_role='research_engineer' and not exists(select 1 from public.team_infrastructures where team_id=v_team and infrastructure_code='research_lab' and level>=1) then
    raise exception 'Construisez le Laboratoire R&D avant de recruter un ingénieur R&D.';
  end if;
  return public.hire_current_team_staff_legacy_20260812(p_listing_id);
end; $$;

alter table public.equipment_catalog_items drop constraint if exists equipment_catalog_items_acquisition_channel_allowed;
alter table public.equipment_catalog_items add column if not exists owner_team_id uuid references public.teams(id) on delete cascade;
alter table public.equipment_catalog_items add constraint equipment_catalog_items_acquisition_channel_allowed
  check(acquisition_channel in ('commercial','equipment_partner','research_prototype'));
alter table public.equipment_catalog_items add constraint equipment_catalog_items_prototype_owner_shape check(
  (acquisition_channel='research_prototype' and owner_team_id is not null) or
  (acquisition_channel<>'research_prototype' and owner_team_id is null)
);

create table public.equipment_rnd_projects(
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  started_team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  input_equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete restrict,
  prototype_equipment_item_id uuid references public.equipment_catalog_items(id) on delete set null,
  engineer_contract_id uuid references public.staff_contracts(id) on delete set null,
  lab_level smallint not null check(lab_level between 1 and 7), rating_key text,
  success_rate smallint not null check(success_rate between 0 and 100), outcome text check(outcome in ('improvement','setback')),
  rating_delta smallint check(rating_delta between -1 and 2), research_cost numeric(14,2) not null check(research_cost>=0),
  starts_game_day_index integer not null, completes_game_day_index integer not null,
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  created_at timestamptz not null default now(),completed_at timestamptz,
  constraint equipment_rnd_duration_positive check(completes_game_day_index>starts_game_day_index)
);
create unique index equipment_rnd_one_active_idx on public.equipment_rnd_projects(team_id) where status='active';
alter table public.equipment_rnd_projects enable row level security;
create policy equipment_rnd_projects_read_own on public.equipment_rnd_projects for select to authenticated
  using(team_id=public.current_fan_club_team_id());
grant select on public.equipment_rnd_projects to authenticated; grant all on public.equipment_rnd_projects to service_role;

create or replace function public.settle_due_equipment_rnd_projects()
returns integer language plpgsql security definer set search_path=public as $$
declare v_game_day integer; v_project record; v_item record; v_key text; v_delta integer; v_payload jsonb; v_current numeric; v_new_item uuid; v_team_season uuid; v_count integer:=0;
begin
  perform public.sync_active_season_day();
  select game_year*28+current_day_number-1 into v_game_day from public.seasons where status='active' limit 1;
  for v_project in select * from public.equipment_rnd_projects where status='active' and completes_game_day_index<=v_game_day order by completes_game_day_index for update skip locked loop
    select * into v_item from public.equipment_catalog_items where id=v_project.input_equipment_item_id;
    select team_season.id into v_team_season from public.seasons season join public.team_seasons team_season on team_season.season_id=season.id
      where season.status='active' and team_season.team_id=v_project.team_id limit 1;
    v_key:=(array['mountain','hills','flat','timeTrial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'])[1+floor(random()*13)::integer];
    if floor(random()*100)<v_project.success_rate then v_delta:=case when v_project.lab_level>=6 and random()<0.12 then 2 else 1 end; else v_delta:=-1; end if;
    v_current:=coalesce((v_item.effect_payload->'ratingBonuses'->>v_key)::numeric,0);
    v_payload:=v_item.effect_payload||jsonb_build_object('ratingBonuses',coalesce(v_item.effect_payload->'ratingBonuses','{}'::jsonb)||jsonb_build_object(v_key,v_current+v_delta));
    insert into public.equipment_catalog_items(catalog_key,name,slot_type,status,supplier_key,supplier_name,description,price,rarity,image_path,effect_summary,effect_payload,acquisition_channel,owner_team_id)
    values('rnd-'||v_project.id::text,v_item.name||' · Prototype '||upper(substr(v_project.id::text,1,4)),v_item.slot_type,'active',v_item.supplier_key,v_item.supplier_name,
      'Prototype unique issu du Laboratoire R&D.',0,'premium',v_item.image_path,
      v_item.effect_summary||' · R&D '||case when v_delta>0 then '+' else '' end||v_delta::text||' '||v_key,v_payload,'research_prototype',v_project.team_id)
    returning id into v_new_item;
    insert into public.team_equipment_inventory(team_season_id,equipment_item_id,quantity,last_purchase_price)
    values(v_team_season,v_new_item,1,0);
    update public.equipment_rnd_projects set prototype_equipment_item_id=v_new_item,rating_key=v_key,
      outcome=case when v_delta>0 then 'improvement' else 'setback' end,rating_delta=v_delta,status='completed',completed_at=now()
    where id=v_project.id;
    v_count:=v_count+1;
  end loop; return v_count;
end; $$;

create or replace function public.start_current_team_equipment_rnd(p_equipment_item_id uuid,p_engineer_contract_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_context record; v_item record; v_level integer; v_required integer; v_owned integer; v_used integer; v_pending integer; v_specialty text; v_engineer_level integer:=0;
  v_success integer; v_duration integer; v_cost numeric; v_game_day integer; v_id uuid;
begin
  perform public.settle_current_team_finances(); perform public.settle_due_equipment_rnd_projects();
  select assignment.team_id,season.id season_id,season.game_year,season.current_day_number,team_season.id team_season_id,team_season.cash_balance,season_day.id season_day_id
  into v_context from public.sporting_directors director
  join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id and assignment.role='general_manager' and assignment.status='active'
  join public.seasons season on season.status='active' join public.team_seasons team_season on team_season.team_id=assignment.team_id and team_season.season_id=season.id
  join public.season_days season_day on season_day.season_id=season.id and season_day.day_number=season.current_day_number
  where director.auth_user_id=auth.uid() and director.status='active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active.'; end if;
  select coalesce(max(level),0) into v_level from public.team_infrastructures where team_id=v_context.team_id and infrastructure_code='research_lab';
  if v_level<1 then raise exception 'Construisez d’abord le Laboratoire R&D.'; end if;
  select * into v_item from public.equipment_catalog_items where id=p_equipment_item_id and status='active' and acquisition_channel<>'equipment_partner'
    and (owner_team_id is null or owner_team_id=v_context.team_id);
  if v_item is null then raise exception 'Cet équipement ne peut pas être soumis à la R&D.'; end if;
  v_required:=case v_item.slot_type when 'frame' then 1 when 'front_wheel' then 2 when 'rear_wheel' then 2 when 'helmet' then 3 when 'shoes' then 4 when 'bib_shorts' then 5 when 'gloves' then 6 when 'glasses' then 7 else 99 end;
  if v_level<v_required then raise exception 'Le niveau du laboratoire ne débloque pas encore cette catégorie.'; end if;
  if exists(select 1 from public.equipment_rnd_projects where team_id=v_context.team_id and status='active') then raise exception 'Une recherche R&D est déjà en cours.'; end if;
  select coalesce(quantity,0) into v_owned from public.team_equipment_inventory where team_season_id=v_context.team_season_id and equipment_item_id=p_equipment_item_id;
  select count(*) into v_used from public.rider_equipment_assignments assignment join public.rider_contracts contract on contract.rider_id=assignment.rider_id and contract.team_id=v_context.team_id and contract.status='active' where assignment.equipment_item_id=p_equipment_item_id;
  select count(*) into v_pending from public.rider_equipment_pending_assignments pending where pending.team_season_id=v_context.team_season_id and pending.equipment_item_id=p_equipment_item_id;
  if coalesce(v_owned,0)<=coalesce(v_used,0)+coalesce(v_pending,0) then raise exception 'Aucun exemplaire libre de cette référence n’est disponible.'; end if;
  if p_engineer_contract_id is not null then
    select member.level,talent.talent_code into v_engineer_level,v_specialty from public.staff_contracts contract
    join public.staff_members member on member.id=contract.staff_member_id and member.role='research_engineer'
    left join public.staff_member_talents talent on talent.staff_member_id=member.id
    where contract.id=p_engineer_contract_id and contract.team_id=v_context.team_id and contract.status='active' limit 1;
    if v_engineer_level=0 then raise exception 'Cet ingénieur R&D n’appartient pas à votre équipe.'; end if;
  end if;
  v_success:=least(95,45+v_level*5+case when v_specialty='research_success' then v_engineer_level*3 else 0 end);
  v_duration:=greatest(4,(array[18,16,14,12,10,9,8]::integer[])[v_level]-case when v_specialty='research_time' then v_engineer_level else 0 end);
  v_cost:=round((100000+v_level*50000+greatest(v_item.price,1000)*12)*(1-case when v_specialty='research_cost' then v_engineer_level*0.05 else 0 end));
  if v_context.cash_balance<v_cost then raise exception 'Trésorerie insuffisante pour cette recherche.'; end if;
  update public.team_equipment_inventory set quantity=quantity-1 where team_season_id=v_context.team_season_id and equipment_item_id=p_equipment_item_id and quantity>1;
  if not found then delete from public.team_equipment_inventory where team_season_id=v_context.team_season_id and equipment_item_id=p_equipment_item_id; end if;
  v_game_day:=v_context.game_year*28+v_context.current_day_number-1;
  insert into public.equipment_rnd_projects(team_id,started_team_season_id,input_equipment_item_id,engineer_contract_id,lab_level,success_rate,research_cost,starts_game_day_index,completes_game_day_index)
  values(v_context.team_id,v_context.team_season_id,p_equipment_item_id,p_engineer_contract_id,v_level,v_success,v_cost,v_game_day,v_game_day+v_duration) returning id into v_id;
  insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at)
  values(v_context.team_season_id,v_context.season_day_id,v_context.current_day_number,-v_cost,'equipment','posted','Recherche R&D · '||v_item.name,'equipment-rnd:'||v_id::text,now());
  update public.team_seasons set cash_balance=cash_balance-v_cost where id=v_context.team_season_id; return v_id;
end; $$;

revoke all on function public.start_equipment_partner_rnd(uuid) from authenticated,service_role;

-- ---------------------------------------------------------------------------
-- International welcome centre
-- ---------------------------------------------------------------------------

create table public.country_adjacencies(country_id uuid not null references public.countries(id) on delete cascade,adjacent_country_id uuid not null references public.countries(id) on delete cascade,primary key(country_id,adjacent_country_id),check(country_id<>adjacent_country_id));
insert into public.country_adjacencies(country_id,adjacent_country_id)
select left_country.id,right_country.id from public.countries left_country join public.countries right_country on (
  (left_country.iso_alpha2||':'||right_country.iso_alpha2) = any(array[
    'FR:BE','FR:DE','FR:CH','FR:IT','FR:ES','FR:LU','FR:MC','BE:NL','BE:DE','BE:LU','NL:DE','DE:DK','DE:PL','DE:CZ','DE:AT','DE:CH','DE:LU',
    'ES:PT','ES:AD','IT:CH','IT:AT','IT:SI','IT:SM','IT:VA','AT:CH','AT:CZ','AT:SK','AT:HU','AT:SI','PL:CZ','PL:SK','PL:UA','PL:BY','PL:LT','PL:RU',
    'CZ:SK','SK:HU','SK:UA','HU:SI','HU:HR','HU:RS','HU:RO','HU:UA','SI:HR','HR:RS','HR:BA','HR:ME','RS:BA','RS:ME','RS:AL','RS:MK','RS:BG','RS:RO',
    'RO:BG','RO:MD','RO:UA','BG:GR','BG:TR','BG:MK','GR:TR','GR:AL','GR:MK','AL:ME','AL:MK','NO:SE','NO:FI','SE:FI','FI:RU','EE:LV','LV:LT','LT:BY','LT:RU',
    'IE:GB','US:CA','US:MX','MX:GT','GT:BZ','GT:HN','HN:SV','HN:NI','NI:CR','CR:PA','CO:PA','CO:VE','CO:BR','CO:PE','CO:EC','PE:EC','PE:BR','PE:BO','BO:BR','BO:PY','BO:AR','BO:CL','CL:AR','AR:UY','AR:BR','AR:PY','BR:UY','BR:PY','BR:VE','BR:GY','BR:SR',
    'MA:DZ','DZ:TN','DZ:LY','DZ:NE','DZ:ML','DZ:MR','ZA:NA','ZA:BW','ZA:ZW','ZA:MZ','ZA:SZ','ZA:LS','KE:UG','KE:TZ','KE:ET','KE:SO','KE:SS',
    'CN:MN','CN:RU','CN:KZ','CN:KG','CN:TJ','CN:AF','CN:PK','CN:IN','CN:NP','CN:BT','CN:MM','CN:LA','CN:VN','IN:PK','IN:NP','IN:BT','IN:BD','IN:MM','TH:MM','TH:LA','TH:KH','TH:MY','VN:LA','VN:KH','MY:SG','MY:ID','AU:NZ'
  ]) or (right_country.iso_alpha2||':'||left_country.iso_alpha2)=any(array[
    'FR:BE','FR:DE','FR:CH','FR:IT','FR:ES','FR:LU','FR:MC','BE:NL','BE:DE','BE:LU','NL:DE','DE:DK','DE:PL','DE:CZ','DE:AT','DE:CH','DE:LU',
    'ES:PT','ES:AD','IT:CH','IT:AT','IT:SI','IT:SM','IT:VA','AT:CH','AT:CZ','AT:SK','AT:HU','AT:SI','PL:CZ','PL:SK','PL:UA','PL:BY','PL:LT','PL:RU',
    'CZ:SK','SK:HU','SK:UA','HU:SI','HU:HR','HU:RS','HU:RO','HU:UA','SI:HR','HR:RS','HR:BA','HR:ME','RS:BA','RS:ME','RS:AL','RS:MK','RS:BG','RS:RO',
    'RO:BG','RO:MD','RO:UA','BG:GR','BG:TR','BG:MK','GR:TR','GR:AL','GR:MK','AL:ME','AL:MK','NO:SE','NO:FI','SE:FI','FI:RU','EE:LV','LV:LT','LT:BY','LT:RU',
    'IE:GB','US:CA','US:MX','MX:GT','GT:BZ','GT:HN','HN:SV','HN:NI','NI:CR','CR:PA','CO:PA','CO:VE','CO:BR','CO:PE','CO:EC','PE:EC','PE:BR','PE:BO','BO:BR','BO:PY','BO:AR','BO:CL','CL:AR','AR:UY','AR:BR','AR:PY','BR:UY','BR:PY','BR:VE','BR:GY','BR:SR',
    'MA:DZ','DZ:TN','DZ:LY','DZ:NE','DZ:ML','DZ:MR','ZA:NA','ZA:BW','ZA:ZW','ZA:MZ','ZA:SZ','ZA:LS','KE:UG','KE:TZ','KE:ET','KE:SO','KE:SS',
    'CN:MN','CN:RU','CN:KZ','CN:KG','CN:TJ','CN:AF','CN:PK','CN:IN','CN:NP','CN:BT','CN:MM','CN:LA','CN:VN','IN:PK','IN:NP','IN:BT','IN:BD','IN:MM','TH:MM','TH:LA','TH:KH','TH:MY','VN:LA','VN:KH','MY:SG','MY:ID','AU:NZ'
  ])
);
alter table public.country_adjacencies enable row level security;
create policy country_adjacencies_read on public.country_adjacencies for select to authenticated using(true);
grant select on public.country_adjacencies to authenticated; grant all on public.country_adjacencies to service_role;

create or replace function public.get_team_welcome_center_level(p_team_id uuid) returns integer language sql stable security definer set search_path=public as $$
select coalesce(max(level),0)::integer from public.team_infrastructures where team_id=p_team_id and infrastructure_code='international_welcome_center' $$;
create or replace function public.get_team_professional_naturalization_days(p_team_id uuid) returns integer language sql stable as $$
select (array[84,70,56,42,28,14]::integer[])[least(5,greatest(0,public.get_team_welcome_center_level(p_team_id)))+1] $$;
create or replace function public.get_team_youth_naturalization_days(p_team_id uuid) returns integer language sql stable as $$
select (array[28,21,14,7,3,0]::integer[])[least(5,greatest(0,public.get_team_welcome_center_level(p_team_id)))+1] $$;

do $migration$ declare v_definition text; begin
  select pg_get_functiondef('public.naturalize_current_team_professional_rider(uuid)'::regprocedure) into v_definition;
  if position('if v_elapsed_days < 84 then' in v_definition)=0 then
    raise exception 'La naturalisation professionnelle a changÃ© : migration du Centre dâ€™accueil interrompue.';
  end if;
  v_definition:=replace(v_definition,'if v_elapsed_days < 84 then','if v_elapsed_days < public.get_team_professional_naturalization_days(v_context.team_id) then');
  v_definition:=replace(v_definition,'84 - v_elapsed_days','public.get_team_professional_naturalization_days(v_context.team_id) - v_elapsed_days'); execute v_definition;
  if position('get_team_professional_naturalization_days' in v_definition)=0 then
    raise exception 'Le délai professionnel du Centre d’accueil n’a pas été injecté.';
  end if;
  select pg_get_functiondef('public.naturalize_current_team_youth_rider(uuid)'::regprocedure) into v_definition;
  if position('if v_elapsed_days < 28 then' in v_definition)=0 then
    raise exception 'La naturalisation junior a changÃ© : migration du Centre dâ€™accueil interrompue.';
  end if;
  v_definition:=replace(v_definition,'if v_elapsed_days < 28 then','if v_elapsed_days < public.get_team_youth_naturalization_days(v_context.team_id) then');
  v_definition:=replace(v_definition,'28 - v_elapsed_days','public.get_team_youth_naturalization_days(v_context.team_id) - v_elapsed_days'); execute v_definition;
  if position('get_team_youth_naturalization_days' in v_definition)=0 then
    raise exception 'Le délai junior du Centre d’accueil n’a pas été injecté.';
  end if;
end $migration$;

create or replace function public.get_staff_contract_nationality_multiplier(p_contract_id uuid,p_rider_id uuid default null)
returns numeric language sql stable set search_path=public as $$
with context as (
  select contract.team_id,member.country_id staff_country_id,member.role,
    case when member.role='trainer' and p_rider_id is not null then rider.country_id else team_season.registration_country_id end target_country_id,
    staff_country.continent_code staff_continent,target_country.continent_code target_continent,
    public.get_team_welcome_center_level(contract.team_id) welcome_level
  from public.staff_contracts contract join public.staff_members member on member.id=contract.staff_member_id
  left join public.riders rider on rider.id=p_rider_id join public.seasons season on season.status='active'
  join public.team_seasons team_season on team_season.team_id=contract.team_id and team_season.season_id=season.id
  join public.countries staff_country on staff_country.id=member.country_id
  join public.countries target_country on target_country.id=case when member.role='trainer' and p_rider_id is not null then rider.country_id else team_season.registration_country_id end
  where contract.id=p_contract_id and contract.status='active'
)
select case when exists(select 1 from context where staff_country_id=target_country_id
  or (welcome_level>=3 and exists(select 1 from public.country_adjacencies a where a.country_id=staff_country_id and a.adjacent_country_id=target_country_id))
  or (welcome_level>=4 and staff_continent is not null and staff_continent=target_continent)) then 1.10 else 1.00 end::numeric;
$$;

do $migration$ declare v_definition text; begin
  select pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure) into v_definition;
  if position('v_trainer_country_match := v_trainer.country_id = (' in v_definition)=0 then
    raise exception 'Le calcul dâ€™affinitÃ© des entraÃ®neurs a changÃ© : migration du Centre dâ€™accueil interrompue.';
  end if;
  v_definition:=replace(
    v_definition,
    'v_trainer_country_match := v_trainer.country_id = (
          select rider.country_id from public.riders as rider where rider.id = v_rider.id
        );',
    'v_trainer_country_match := public.get_staff_contract_nationality_multiplier(v_plan.trainer_contract_id, v_rider.id) > 1;'
  );
  if position('get_staff_contract_nationality_multiplier' in v_definition)=0 then
    raise exception 'L’affinité internationale n’a pas été injectée dans les entraînements.';
  end if;
  execute v_definition;
end $migration$;

create or replace function public.get_team_media_center_community_multiplier(p_team_id uuid)
returns numeric language sql stable set search_path=public as $$
select (1 + coalesce(max(level),0) * 0.05)::numeric
from public.team_infrastructures
where team_id=p_team_id and infrastructure_code='media_center' $$;

do $migration$ declare v_definition text; begin
  select pg_get_functiondef('public.apply_community_manager_reputation_bonus()'::regprocedure) into v_definition;
  if position('v_bonus := round(new.reputation_points * v_percentage / 100.0, 2);' in v_definition)=0 then
    raise exception 'Le bonus du community manager a changé : migration du Média Center interrompue.';
  end if;
  v_definition:=replace(
    v_definition,
    'v_bonus := round(new.reputation_points * v_percentage / 100.0, 2);',
    'v_bonus := round(new.reputation_points * v_percentage * public.get_team_media_center_community_multiplier(v_team_id) / 100.0, 2);'
  );
  if position('get_team_media_center_community_multiplier' in v_definition)=0 then
    raise exception 'Le multiplicateur du Média Center n’a pas été injecté dans les récompenses.';
  end if;
  execute v_definition;

  select pg_get_functiondef('public.settle_current_team_staff_daily_reputation()'::regprocedure) into v_definition;
  if position('when member.country_id = v_context.registration_country_id' in v_definition)=0
     or position('if v_amount <= 0 then' in v_definition)=0 then
    raise exception 'La réputation quotidienne du community manager a changé : migration du Média Center interrompue.';
  end if;
  v_definition:=replace(
    v_definition,
    'case
          when member.country_id = v_context.registration_country_id
            then 1.10
          else 1.00
        end',
    'public.get_staff_contract_nationality_multiplier(contract.id)'
  );
  v_definition:=replace(
    v_definition,
    'if v_amount <= 0 then',
    'v_amount := round(v_amount * public.get_team_media_center_community_multiplier(v_context.team_id), 2);

    if v_amount <= 0 then'
  );
  execute v_definition;
end $migration$;

-- ---------------------------------------------------------------------------
-- Media Center and Gazette submissions
-- ---------------------------------------------------------------------------

create table public.media_center_articles(
  id uuid primary key default gen_random_uuid(),team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,day_number smallint not null check(day_number between 1 and 28),
  title text not null check(char_length(btrim(title)) between 5 and 100),body text not null check(char_length(btrim(body)) between 40 and 1600),
  team_name text not null,sponsor_name text,building_level smallint not null check(building_level between 1 and 5),
  reputation_awarded numeric(8,2) not null default 0,supporters_awarded integer not null default 0,
  status text not null default 'queued' check(status in ('queued','published')),created_at timestamptz not null default now(),published_edition_id uuid references public.cyclogazette_editions(id) on delete set null
);
create index media_center_articles_daily_idx on public.media_center_articles(season_id,day_number,status,created_at);
alter table public.media_center_articles enable row level security;
create policy media_center_articles_read on public.media_center_articles for select to authenticated using(true);
grant select on public.media_center_articles to authenticated; grant all on public.media_center_articles to service_role;
create table public.rider_popularity_profiles(rider_id uuid primary key references public.riders(id) on delete cascade,popularity_points integer not null default 0 check(popularity_points>=0),updated_at timestamptz not null default now());
alter table public.rider_popularity_profiles enable row level security; create policy rider_popularity_read on public.rider_popularity_profiles for select to authenticated using(true);
grant select on public.rider_popularity_profiles to authenticated; grant all on public.rider_popularity_profiles to service_role;

create or replace function public.publish_current_team_media_article(p_title text,p_body text,p_include_sponsor boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_context record; v_level integer; v_interval integer; v_game_day integer; v_last_game_day integer; v_rep numeric; v_fans integer; v_sponsor text; v_id uuid;
begin
  select director.id director_id,assignment.team_id,season.id season_id,season.game_year,season.current_day_number,
    team_season.display_name into v_context from public.sporting_directors director
  join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id and assignment.role='general_manager' and assignment.status='active'
  join public.seasons season on season.status='active' join public.team_seasons team_season on team_season.team_id=assignment.team_id and team_season.season_id=season.id
  where director.auth_user_id=auth.uid() and director.status='active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active.'; end if;
  if char_length(btrim(p_title)) not between 5 and 100 or char_length(btrim(p_body)) not between 40 and 1600 then raise exception 'Le titre ou le contenu ne respecte pas la longueur demandée.'; end if;
  select coalesce(max(level),0) into v_level from public.team_infrastructures where team_id=v_context.team_id and infrastructure_code='media_center';
  if v_level<1 then raise exception 'Construisez d’abord le Média Center.'; end if;
  v_interval:=(array[7,5,4,3,2]::integer[])[v_level]; v_game_day:=v_context.game_year*28+v_context.current_day_number-1;
  select max(season.game_year*28+article.day_number-1) into v_last_game_day from public.media_center_articles article join public.seasons season on season.id=article.season_id where article.team_id=v_context.team_id;
  if v_last_game_day is not null and v_game_day-v_last_game_day<v_interval then raise exception 'Votre rédaction pourra proposer une nouvelle tribune dans % jours.',v_interval-(v_game_day-v_last_game_day); end if;
  if p_include_sponsor and v_level>=3 then select sponsor.name into v_sponsor from public.team_sponsor_contracts contract join public.sponsors sponsor on sponsor.id=contract.sponsor_id where contract.team_id=v_context.team_id and contract.status='active' limit 1; end if;
  v_rep:=round(v_level*0.5*(1+coalesce((select max(member.level)*v_level*0.02 from public.staff_contracts contract join public.staff_members member on member.id=contract.staff_member_id where contract.team_id=v_context.team_id and contract.status='active' and member.role='community_manager'),0)),2);
  v_fans:=v_level*25;
  update public.sporting_directors set reputation_points=reputation_points+v_rep where id=v_context.director_id;
  insert into public.fan_club_profiles(team_id,supporter_count,fervor,popularity_index) values(v_context.team_id,v_fans,v_level,least(100,v_level))
  on conflict(team_id) do update set supporter_count=public.fan_club_profiles.supporter_count+v_fans,fervor=least(100,public.fan_club_profiles.fervor+1),popularity_index=least(100,public.fan_club_profiles.popularity_index+1),updated_at=now();
  insert into public.rider_popularity_profiles(rider_id,popularity_points)
  select rider.id,v_level from public.riders rider join public.rider_contracts contract on contract.rider_id=rider.id where contract.team_id=v_context.team_id and contract.status='active'
  on conflict(rider_id) do update set popularity_points=public.rider_popularity_profiles.popularity_points+v_level,updated_at=now();
  insert into public.media_center_articles(team_id,sporting_director_id,season_id,day_number,title,body,team_name,sponsor_name,building_level,reputation_awarded,supporters_awarded)
  values(v_context.team_id,v_context.director_id,v_context.season_id,v_context.current_day_number,btrim(p_title),btrim(p_body),v_context.display_name,v_sponsor,v_level,v_rep,v_fans) returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.settle_due_infrastructure_projects() from public,anon;
revoke all on function public.start_current_team_infrastructure_project(text,uuid,uuid) from public,anon;
revoke all on function public.settle_due_rider_performance_preparations() from public,anon;
revoke all on function public.start_current_team_rider_performance_preparation(uuid,text) from public,anon;
revoke all on function public.settle_due_equipment_rnd_projects() from public,anon;
revoke all on function public.start_current_team_equipment_rnd(uuid,uuid) from public,anon;
revoke all on function public.hire_current_team_staff(uuid) from public,anon;
revoke all on function public.publish_current_team_media_article(text,text,boolean) from public,anon;
grant execute on function public.settle_due_infrastructure_projects() to authenticated,service_role;
grant execute on function public.start_current_team_infrastructure_project(text,uuid,uuid) to authenticated,service_role;
grant execute on function public.settle_due_rider_performance_preparations() to authenticated,service_role;
grant execute on function public.start_current_team_rider_performance_preparation(uuid,text) to authenticated,service_role;
grant execute on function public.settle_due_equipment_rnd_projects() to authenticated,service_role;
grant execute on function public.start_current_team_equipment_rnd(uuid,uuid) to authenticated,service_role;
grant execute on function public.hire_current_team_staff(uuid) to authenticated;
grant execute on function public.publish_current_team_media_article(text,text,boolean) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
