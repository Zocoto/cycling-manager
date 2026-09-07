begin;

create or replace function public.is_valid_team_infrastructure_specialization(
  p_infrastructure_code text,
  p_specialization_code text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_infrastructure_code
    when 'recruitment_data_room' then p_specialization_code in ('market_intelligence', 'talent_network', 'deal_room')
    when 'staff_academy' then p_specialization_code in ('pedagogy', 'expertise', 'versatility')
    when 'training_center' then p_specialization_code in ('individualization', 'elite_performance', 'durability')
    when 'indoor_track' then p_specialization_code in ('pure_speed', 'explosiveness', 'leadout_school')
    when 'cryotherapy_center' then p_specialization_code in ('rapid_recovery', 'rehabilitation', 'load_management')
    when 'wind_tunnel' then p_specialization_code in ('solo_aero', 'team_aero', 'versatile_aero')
    when 'weather_center' then p_specialization_code in ('microclimate', 'wet_protocol', 'extreme_weather')
    when 'tactical_center' then p_specialization_code in ('offensive_school', 'race_control', 'adaptive_cell')
    when 'media_center' then p_specialization_code in ('prestige_press', 'community_media', 'crisis_room')
    when 'international_welcome_center' then p_specialization_code in ('administrative_path', 'sporting_integration', 'youth_gateway')
    when 'research_lab' then p_specialization_code in ('pure_performance', 'reliability', 'frugal_innovation')
    when 'fan_club_headquarters' then p_specialization_code in ('recruitment_campaigns', 'loyalty_program', 'event_house')
    when 'club_shop' then p_specialization_code in ('volume_retail', 'premium_retail', 'limited_editions')
    else false
  end
$$;

create or replace function public.is_valid_federation_infrastructure_specialization(
  p_infrastructure_code text,
  p_specialization_code text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_infrastructure_code
    when 'national_detection_network' then p_specialization_code in ('territorial_coverage', 'elite_detection', 'profile_diversity')
    when 'regional_academies' then p_specialization_code in ('open_access', 'regional_excellence', 'multidiscipline')
    when 'national_performance_center' then p_specialization_code in ('altitude_endurance', 'speed_power', 'rolling_engine')
    when 'federal_staff_institute' then p_specialization_code in ('coach_school', 'scout_school', 'medical_school')
    when 'federal_medical_network' then p_specialization_code in ('emergency_network', 'rehab_network', 'prevention_network')
    when 'national_technical_laboratory' then p_specialization_code in ('individual_tt', 'national_ttt', 'equipment_standards')
    when 'race_organization_office' then p_specialization_code in ('prestige_events', 'dense_calendar', 'profitable_events')
    when 'federal_integration_office' then p_specialization_code in ('fast_track', 'diaspora_network', 'integration_program')
    when 'home_advantage_program' then p_specialization_code in ('terrain_library', 'climate_lab', 'supporter_roads')
    else false
  end
$$;

create table public.team_infrastructure_specializations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  infrastructure_code text not null,
  active_specialization_code text not null,
  pending_specialization_code text,
  effective_game_day_index integer not null,
  last_selected_season_id uuid not null references public.seasons(id) on delete restrict,
  selected_by_director_id uuid not null references public.sporting_directors(id) on delete restrict,
  last_change_cost numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_infrastructure_specializations_unique unique (team_id, infrastructure_code),
  constraint team_infrastructure_specializations_active_valid check (
    public.is_valid_team_infrastructure_specialization(infrastructure_code, active_specialization_code)
  ),
  constraint team_infrastructure_specializations_pending_valid check (
    pending_specialization_code is null
    or public.is_valid_team_infrastructure_specialization(infrastructure_code, pending_specialization_code)
  ),
  constraint team_infrastructure_specializations_distinct check (
    pending_specialization_code is null or pending_specialization_code <> active_specialization_code
  ),
  constraint team_infrastructure_specializations_cost_valid check (last_change_cost >= 0)
);

create table public.national_federation_infrastructure_specializations (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  infrastructure_code text not null,
  active_specialization_code text not null,
  pending_specialization_code text,
  effective_game_day_index integer not null,
  last_selected_season_id uuid not null references public.seasons(id) on delete restrict,
  selected_by_director_id uuid not null references public.sporting_directors(id) on delete restrict,
  last_change_cost numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint federation_infrastructure_specializations_unique unique (country_id, infrastructure_code),
  constraint federation_infrastructure_specializations_active_valid check (
    public.is_valid_federation_infrastructure_specialization(infrastructure_code, active_specialization_code)
  ),
  constraint federation_infrastructure_specializations_pending_valid check (
    pending_specialization_code is null
    or public.is_valid_federation_infrastructure_specialization(infrastructure_code, pending_specialization_code)
  ),
  constraint federation_infrastructure_specializations_distinct check (
    pending_specialization_code is null or pending_specialization_code <> active_specialization_code
  ),
  constraint federation_infrastructure_specializations_cost_valid check (last_change_cost >= 0)
);

alter table public.team_infrastructure_specializations enable row level security;
alter table public.national_federation_infrastructure_specializations enable row level security;

create policy team_infrastructure_specializations_read_managed
on public.team_infrastructure_specializations for select to authenticated
using (public.current_user_manages_team(team_id));

create policy federation_infrastructure_specializations_read_authenticated
on public.national_federation_infrastructure_specializations for select to authenticated
using (true);

grant select on table public.team_infrastructure_specializations to authenticated;
grant select on table public.national_federation_infrastructure_specializations to authenticated;
grant all on table public.team_infrastructure_specializations to service_role;
grant all on table public.national_federation_infrastructure_specializations to service_role;

create or replace function public.settle_due_infrastructure_specializations()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_current_game_day integer;
  v_team_count integer := 0;
  v_federation_count integer := 0;
begin
  select season.game_year * 28 + coalesce(season.current_day_number, 1) - 1
  into v_current_game_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_current_game_day is null then return 0; end if;

  update public.team_infrastructure_specializations
  set active_specialization_code = pending_specialization_code,
      pending_specialization_code = null,
      updated_at = now()
  where pending_specialization_code is not null
    and effective_game_day_index <= v_current_game_day;
  get diagnostics v_team_count = row_count;

  update public.national_federation_infrastructure_specializations
  set active_specialization_code = pending_specialization_code,
      pending_specialization_code = null,
      updated_at = now()
  where pending_specialization_code is not null
    and effective_game_day_index <= v_current_game_day;
  get diagnostics v_federation_count = row_count;

  return v_team_count + v_federation_count;
end;
$$;

create or replace function public.get_infrastructure_specialization_power_multiplier(
  p_level integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_level, 0) < 3 then 0::numeric
    when p_level = 3 then 0.6::numeric
    when p_level = 4 then 0.8::numeric
    else 1::numeric
  end
$$;

create or replace function public.get_team_infrastructure_specialization(
  p_team_id uuid,
  p_infrastructure_code text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when season.game_year >= 3 then
    case
      when specialization.pending_specialization_code is not null
        and specialization.effective_game_day_index <= season.game_year * 28 + coalesce(season.current_day_number, 1) - 1
      then specialization.pending_specialization_code
      else specialization.active_specialization_code
    end
  else null end
  from public.team_infrastructure_specializations as specialization
  cross join lateral (
    select game_year, current_day_number
    from public.seasons where status = 'active' limit 1
  ) as season
  where specialization.team_id = p_team_id
    and specialization.infrastructure_code = p_infrastructure_code
$$;

create or replace function public.get_federation_infrastructure_specialization(
  p_country_id uuid,
  p_infrastructure_code text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when season.game_year >= 3 then
    case
      when specialization.pending_specialization_code is not null
        and specialization.effective_game_day_index <= season.game_year * 28 + coalesce(season.current_day_number, 1) - 1
      then specialization.pending_specialization_code
      else specialization.active_specialization_code
    end
  else null end
  from public.national_federation_infrastructure_specializations as specialization
  cross join lateral (
    select game_year, current_day_number
    from public.seasons where status = 'active' limit 1
  ) as season
  where specialization.country_id = p_country_id
    and specialization.infrastructure_code = p_infrastructure_code
$$;

create or replace function public.choose_current_team_infrastructure_specialization(
  p_infrastructure_code text,
  p_specialization_code text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_context record;
  v_existing public.team_infrastructure_specializations%rowtype;
  v_level integer;
  v_current_game_day integer;
  v_cost numeric := 0;
  v_day_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if not public.is_valid_team_infrastructure_specialization(p_infrastructure_code, p_specialization_code) then
    raise exception 'Cette spécialisation ne correspond pas à ce bâtiment.';
  end if;

  perform public.settle_current_team_finances();
  perform public.settle_due_infrastructure_specializations();

  select director.id as director_id, assignment.team_id, season.id as season_id,
         season.game_year, coalesce(season.current_day_number, 1) as current_day_number,
         team_season.id as team_season_id, team_season.cash_balance
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  where director.auth_user_id = (select auth.uid()) and director.status = 'active'
  limit 1;
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;

  select infrastructure.level into v_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = p_infrastructure_code;
  if coalesce(v_level, 0) < 3 then
    raise exception 'Le bâtiment doit atteindre le niveau 3 avant de choisir sa spécialisation.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_context.team_id::text || ':' || p_infrastructure_code || ':specialization', 0)
  );
  select * into v_existing
  from public.team_infrastructure_specializations
  where team_id = v_context.team_id and infrastructure_code = p_infrastructure_code
  for update;
  v_current_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;

  if v_existing.id is null then
    insert into public.team_infrastructure_specializations (
      team_id, infrastructure_code, active_specialization_code,
      effective_game_day_index, last_selected_season_id, selected_by_director_id
    ) values (
      v_context.team_id, p_infrastructure_code, p_specialization_code,
      v_current_game_day, v_context.season_id, v_context.director_id
    );
    return jsonb_build_object(
      'status', 'active', 'cost', 0, 'delayDays', 0,
      'effectsActive', v_context.game_year >= 3
    );
  end if;

  if v_existing.active_specialization_code = p_specialization_code
    or v_existing.pending_specialization_code = p_specialization_code then
    raise exception 'Cette spécialisation est déjà sélectionnée.';
  end if;
  if v_existing.pending_specialization_code is not null then
    raise exception 'Une transition de spécialisation est déjà en cours.';
  end if;
  if v_existing.last_selected_season_id = v_context.season_id then
    raise exception 'La spécialisation de ce bâtiment a déjà été choisie cette saison.';
  end if;

  v_cost := coalesce(v_level, 3) * 50000;
  if v_context.cash_balance < v_cost then
    raise exception 'Trésorerie insuffisante pour financer cette réorientation.';
  end if;
  select id into v_day_id from public.season_days
  where season_id = v_context.season_id and day_number = v_context.current_day_number limit 1;

  update public.team_seasons set cash_balance = cash_balance - v_cost
  where id = v_context.team_season_id;
  update public.team_infrastructure_specializations
  set pending_specialization_code = p_specialization_code,
      effective_game_day_index = v_current_game_day + 7,
      last_selected_season_id = v_context.season_id,
      selected_by_director_id = v_context.director_id,
      last_change_cost = v_cost,
      updated_at = now()
  where id = v_existing.id;

  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  ) values (
    v_context.team_season_id, v_day_id, v_context.current_day_number,
    -v_cost, 'building', 'posted', 'Réorientation d’une infrastructure',
    'infrastructure-specialization:' || v_existing.id::text || ':' || v_context.season_id::text,
    now()
  );
  return jsonb_build_object('status', 'transition', 'cost', v_cost, 'delayDays', 7);
end;
$$;

create or replace function public.choose_national_federation_infrastructure_specialization(
  p_country_code text,
  p_infrastructure_code text,
  p_specialization_code text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_existing public.national_federation_infrastructure_specializations%rowtype;
  v_level integer;
  v_current_game_day integer;
  v_cost numeric := 0;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if not public.is_valid_federation_infrastructure_specialization(p_infrastructure_code, p_specialization_code) then
    raise exception 'Cette spécialisation ne correspond pas à ce bâtiment fédéral.';
  end if;

  perform public.initialize_due_national_federation_accounts();
  perform public.settle_due_infrastructure_specializations();
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null or v_season.game_year < 3 then
    raise exception 'Les spécialisations fédérales seront disponibles à partir de la Saison 3.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then raise exception 'Seul le président élu peut choisir une spécialisation fédérale.'; end if;

  select infrastructure.level into v_level
  from public.national_federation_infrastructures as infrastructure
  where infrastructure.country_id = v_identity.country_id
    and infrastructure.infrastructure_code = p_infrastructure_code;
  if coalesce(v_level, 0) < 3 then
    raise exception 'Le bâtiment fédéral doit atteindre le niveau 3 avant ce choix.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_identity.country_id::text || ':' || p_infrastructure_code || ':specialization', 0)
  );
  select * into v_existing
  from public.national_federation_infrastructure_specializations
  where country_id = v_identity.country_id and infrastructure_code = p_infrastructure_code
  for update;
  v_current_game_day := v_season.game_year * 28 + coalesce(v_season.current_day_number, 1) - 1;

  if v_existing.id is null then
    insert into public.national_federation_infrastructure_specializations (
      country_id, infrastructure_code, active_specialization_code,
      effective_game_day_index, last_selected_season_id, selected_by_director_id
    ) values (
      v_identity.country_id, p_infrastructure_code, p_specialization_code,
      v_current_game_day, v_season.id, v_identity.sporting_director_id
    );
    return jsonb_build_object('status', 'active', 'cost', 0, 'delayDays', 0);
  end if;

  if v_existing.active_specialization_code = p_specialization_code
    or v_existing.pending_specialization_code = p_specialization_code then
    raise exception 'Cette spécialisation est déjà sélectionnée.';
  end if;
  if v_existing.pending_specialization_code is not null then
    raise exception 'Une transition de spécialisation est déjà en cours.';
  end if;
  if v_existing.last_selected_season_id = v_season.id then
    raise exception 'La spécialisation de ce bâtiment a déjà été choisie cette saison.';
  end if;

  v_cost := coalesce(v_level, 3) * 250000;
  select * into v_account from public.national_federation_accounts
  where country_id = v_identity.country_id and season_id = v_season.id for update;
  if v_account.id is null or v_account.balance < v_cost then
    raise exception 'La trésorerie fédérale est insuffisante pour cette réorientation.';
  end if;

  update public.national_federation_accounts
  set balance = balance - v_cost, updated_at = now() where id = v_account.id;
  update public.national_federation_infrastructure_specializations
  set pending_specialization_code = p_specialization_code,
      effective_game_day_index = v_current_game_day + 7,
      last_selected_season_id = v_season.id,
      selected_by_director_id = v_identity.sporting_director_id,
      last_change_cost = v_cost,
      updated_at = now()
  where id = v_existing.id;

  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description, source_reference, metadata
  ) values (
    v_account.id, v_season.current_day_number, -v_cost, 'infrastructure',
    'Réorientation d’une infrastructure fédérale',
    'federation-infrastructure-specialization:' || v_existing.id::text || ':' || v_season.id::text,
    jsonb_build_object('infrastructureCode', p_infrastructure_code, 'specializationCode', p_specialization_code)
  );
  return jsonb_build_object('status', 'transition', 'cost', v_cost, 'delayDays', 7);
end;
$$;

revoke all on function public.is_valid_team_infrastructure_specialization(text, text) from public, anon, authenticated;
revoke all on function public.is_valid_federation_infrastructure_specialization(text, text) from public, anon, authenticated;
revoke all on function public.settle_due_infrastructure_specializations() from public, anon, authenticated;
revoke all on function public.get_infrastructure_specialization_power_multiplier(integer) from public, anon;
revoke all on function public.get_team_infrastructure_specialization(uuid, text) from public, anon;
revoke all on function public.get_federation_infrastructure_specialization(uuid, text) from public, anon;
revoke all on function public.choose_current_team_infrastructure_specialization(text, text) from public, anon;
revoke all on function public.choose_national_federation_infrastructure_specialization(text, text, text) from public, anon;

grant execute on function public.is_valid_team_infrastructure_specialization(text, text) to service_role;
grant execute on function public.is_valid_federation_infrastructure_specialization(text, text) to service_role;
grant execute on function public.settle_due_infrastructure_specializations() to service_role;
grant execute on function public.get_infrastructure_specialization_power_multiplier(integer) to authenticated, service_role;
grant execute on function public.get_team_infrastructure_specialization(uuid, text) to authenticated, service_role;
grant execute on function public.get_federation_infrastructure_specialization(uuid, text) to authenticated, service_role;
grant execute on function public.choose_current_team_infrastructure_specialization(text, text) to authenticated, service_role;
grant execute on function public.choose_national_federation_infrastructure_specialization(text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
