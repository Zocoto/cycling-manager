begin;

create table public.national_federation_infrastructures (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  infrastructure_code text not null,
  level smallint not null default 0,
  completed_project_id uuid,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint national_federation_infrastructures_code_allowed check (
    infrastructure_code in (
      'national_detection_network', 'regional_academies',
      'national_performance_center', 'federal_staff_institute',
      'federal_medical_network', 'national_technical_laboratory',
      'race_organization_office', 'federal_integration_office',
      'home_advantage_program'
    )
  ),
  constraint national_federation_infrastructures_level_valid check (level between 0 and 5),
  constraint national_federation_infrastructures_country_code_unique
    unique (country_id, infrastructure_code)
);

create table public.national_federation_infrastructure_projects (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  started_season_id uuid not null references public.seasons(id) on delete restrict,
  infrastructure_code text not null,
  target_level smallint not null,
  priority text not null,
  base_cost numeric(14, 2) not null,
  final_cost numeric(14, 2) not null,
  base_duration_days integer not null,
  final_duration_days integer not null,
  starts_game_day_index integer not null,
  completes_game_day_index integer not null,
  started_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  status text not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_federation_projects_code_allowed check (
    infrastructure_code in (
      'national_detection_network', 'regional_academies',
      'national_performance_center', 'federal_staff_institute',
      'federal_medical_network', 'national_technical_laboratory',
      'race_organization_office', 'federal_integration_office',
      'home_advantage_program'
    )
  ),
  constraint national_federation_projects_level_valid check (target_level between 1 and 5),
  constraint national_federation_projects_priority_allowed check (
    priority in ('balanced', 'cost', 'time')
  ),
  constraint national_federation_projects_cost_valid check (
    base_cost > 0 and final_cost > 0 and final_cost <= base_cost
  ),
  constraint national_federation_projects_duration_valid check (
    base_duration_days > 0 and final_duration_days > 0
      and final_duration_days <= base_duration_days
      and completes_game_day_index > starts_game_day_index
  ),
  constraint national_federation_projects_status_allowed check (
    status in ('active', 'completed', 'cancelled')
  )
);

alter table public.national_federation_infrastructures
  add constraint national_federation_infrastructures_completed_project_fk
  foreign key (completed_project_id)
  references public.national_federation_infrastructure_projects(id)
  on delete set null;

create unique index national_federation_projects_one_active_code_idx
  on public.national_federation_infrastructure_projects (
    country_id, infrastructure_code
  ) where status = 'active';
create index national_federation_projects_due_idx
  on public.national_federation_infrastructure_projects (
    completes_game_day_index, created_at
  ) where status = 'active';

create table public.national_federation_project_architects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.national_federation_infrastructure_projects(id) on delete cascade,
  staff_contract_id uuid not null references public.staff_contracts(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  added_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  cost_refund numeric(14, 2) not null default 0,
  saved_days integer not null default 0,
  created_at timestamptz not null default now(),
  constraint national_federation_project_architects_refund_valid check (cost_refund >= 0),
  constraint national_federation_project_architects_days_valid check (saved_days >= 0),
  constraint national_federation_project_architects_contract_unique unique (project_id, staff_contract_id),
  constraint national_federation_project_architects_team_unique unique (project_id, team_id)
);

alter table public.national_federation_infrastructures enable row level security;
alter table public.national_federation_infrastructure_projects enable row level security;
alter table public.national_federation_project_architects enable row level security;
create policy national_federation_infrastructures_select_authenticated
on public.national_federation_infrastructures for select to authenticated using (true);
create policy national_federation_projects_select_authenticated
on public.national_federation_infrastructure_projects for select to authenticated using (true);
create policy national_federation_architects_select_authenticated
on public.national_federation_project_architects for select to authenticated using (true);
grant select on table public.national_federation_infrastructures to authenticated;
grant select on table public.national_federation_infrastructure_projects to authenticated;
grant select on table public.national_federation_project_architects to authenticated;
grant all on table public.national_federation_infrastructures to service_role;
grant all on table public.national_federation_infrastructure_projects to service_role;
grant all on table public.national_federation_project_architects to service_role;

create or replace function public.start_national_federation_infrastructure_project(
  p_country_code text,
  p_infrastructure_code text,
  p_priority text
)
returns uuid
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
  v_current_level integer := 0;
  v_target_level integer;
  v_costs numeric[];
  v_durations integer[];
  v_base_cost numeric;
  v_base_duration integer;
  v_current_game_day integer;
  v_project_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'Les chantiers sont limités à la fédération belge pendant la bêta.';
  end if;
  if p_priority not in ('balanced', 'cost', 'time') then
    raise exception 'La priorité du chantier est invalide.';
  end if;

  perform public.initialize_due_national_federation_accounts();
  perform public.settle_due_national_federation_infrastructure_projects();
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.game_year < 3 then
    raise exception 'Les chantiers fédéraux seront disponibles à partir de la Saison 3.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then raise exception 'Seul le président élu peut lancer un chantier.'; end if;

  case p_infrastructure_code
    when 'national_detection_network' then v_costs := array[450000,800000,1300000,2000000,2900000]; v_durations := array[4,6,8,10,12];
    when 'regional_academies' then v_costs := array[500000,900000,1450000,2150000,3100000]; v_durations := array[5,6,8,10,12];
    when 'national_performance_center' then v_costs := array[700000,1200000,1900000,2800000,4000000]; v_durations := array[5,7,9,11,13];
    when 'federal_staff_institute' then v_costs := array[400000,750000,1200000,1850000,2650000]; v_durations := array[4,5,7,9,11];
    when 'federal_medical_network' then v_costs := array[550000,950000,1500000,2250000,3250000]; v_durations := array[4,6,8,10,12];
    when 'national_technical_laboratory' then v_costs := array[750000,1300000,2050000,3000000,4300000]; v_durations := array[5,7,9,11,14];
    when 'race_organization_office' then v_costs := array[450000,850000,1400000,2100000,3000000]; v_durations := array[4,6,8,10,12];
    when 'federal_integration_office' then v_costs := array[600000,1050000,1650000,2450000,3500000]; v_durations := array[5,7,9,11,13];
    when 'home_advantage_program' then v_costs := array[350000,650000,1050000,1600000,2300000]; v_durations := array[3,5,7,9,11];
    else raise exception 'Cette infrastructure fédérale n’existe pas.';
  end case;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_identity.country_id::text || ':' || p_infrastructure_code, 0)
  );
  select coalesce(level, 0) into v_current_level
  from public.national_federation_infrastructures
  where country_id = v_identity.country_id
    and infrastructure_code = p_infrastructure_code;
  v_current_level := coalesce(v_current_level, 0);
  v_target_level := v_current_level + 1;
  if v_target_level > 5 then raise exception 'Cette infrastructure a atteint son niveau maximal.'; end if;
  if exists (
    select 1 from public.national_federation_infrastructure_projects
    where country_id = v_identity.country_id
      and infrastructure_code = p_infrastructure_code and status = 'active'
  ) then raise exception 'Un chantier est déjà actif pour cette infrastructure.'; end if;

  v_base_cost := v_costs[v_target_level];
  v_base_duration := v_durations[v_target_level];
  select * into v_account from public.national_federation_accounts
  where country_id = v_identity.country_id and season_id = v_season.id for update;
  if v_account.id is null or v_account.balance < v_base_cost then
    raise exception 'La trésorerie fédérale est insuffisante pour ce chantier.';
  end if;
  v_current_game_day := v_season.game_year * 28 + v_season.current_day_number - 1;

  insert into public.national_federation_infrastructure_projects (
    country_id, started_season_id, infrastructure_code, target_level, priority,
    base_cost, final_cost, base_duration_days, final_duration_days,
    starts_game_day_index, completes_game_day_index, started_by_director_id
  ) values (
    v_identity.country_id, v_season.id, p_infrastructure_code, v_target_level,
    p_priority, v_base_cost, v_base_cost, v_base_duration, v_base_duration,
    v_current_game_day, v_current_game_day + v_base_duration,
    v_identity.sporting_director_id
  ) returning id into v_project_id;

  update public.national_federation_accounts
  set balance = balance - v_base_cost, updated_at = now() where id = v_account.id;
  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description, source_reference,
    metadata
  ) values (
    v_account.id, v_season.current_day_number, -v_base_cost, 'infrastructure',
    'Lancement du chantier ' || p_infrastructure_code || ' niveau ' || v_target_level::text,
    'federation-infrastructure:' || v_project_id::text || ':launch',
    jsonb_build_object('infrastructureCode', p_infrastructure_code,
      'targetLevel', v_target_level, 'priority', p_priority)
  );
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number,
    'infrastructure', 'Chantier fédéral lancé',
    p_infrastructure_code || ' · niveau ' || v_target_level::text || ' · ' || v_base_duration::text || ' jours.',
    'federation-infrastructure:' || v_project_id::text || ':journal'
  );
  return v_project_id;
end;
$$;

create or replace function public.contribute_architect_to_federation_project(
  p_project_id uuid,
  p_staff_contract_id uuid
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
  v_project public.national_federation_infrastructure_projects%rowtype;
  v_contribution_id uuid;
  v_architect_count integer;
  v_cost_rate numeric;
  v_duration_rate numeric;
  v_new_cost numeric;
  v_new_duration integer;
  v_refund numeric;
  v_saved_days integer;
  v_account_id uuid;
  v_current_game_day integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  select * into v_identity from public.get_current_federation_identity('BE');
  select * into v_season from public.seasons where status = 'active' limit 1;
  select * into v_project from public.national_federation_infrastructure_projects
  where id = p_project_id and status = 'active' for update;
  if v_season.game_year < 3 or v_project.id is null then
    raise exception 'Ce chantier n’est pas disponible.';
  end if;
  if v_identity.team_id is null or v_identity.country_id is null then
    raise exception 'Aucune équipe affiliée à cette fédération.';
  end if;
  if v_project.country_id <> v_identity.country_id then
    raise exception 'Ce chantier ne dépend pas de votre fédération.';
  end if;
  if not exists (
    select 1 from public.staff_contracts as contract
    join public.staff_members as member on member.id = contract.staff_member_id
    where contract.id = p_staff_contract_id
      and contract.team_id = v_identity.team_id
      and contract.status = 'active' and member.role = 'architect'
  ) then raise exception 'Cet architecte n’appartient pas à votre staff actif.'; end if;
  if exists (
    select 1 from public.infrastructure_projects
    where architect_contract_id = p_staff_contract_id and status = 'active'
  ) or exists (
    select 1 from public.national_federation_project_architects as contribution
    join public.national_federation_infrastructure_projects as project
      on project.id = contribution.project_id and project.status = 'active'
    where contribution.staff_contract_id = p_staff_contract_id
  ) then raise exception 'Cet architecte travaille déjà sur un chantier.'; end if;
  select count(*)::integer into v_architect_count
  from public.national_federation_project_architects where project_id = v_project.id;
  if v_architect_count >= 5 then raise exception 'Ce chantier mobilise déjà cinq architectes.'; end if;

  insert into public.national_federation_project_architects (
    project_id, staff_contract_id, team_id, added_by_director_id
  ) values (
    v_project.id, p_staff_contract_id, v_identity.team_id,
    v_identity.sporting_director_id
  ) returning id into v_contribution_id;
  v_architect_count := v_architect_count + 1;
  v_cost_rate := case v_project.priority when 'cost' then .04 * v_architect_count
    when 'balanced' then .02 * v_architect_count else 0 end;
  v_duration_rate := case v_project.priority when 'time' then .06 * v_architect_count
    when 'balanced' then .03 * v_architect_count else 0 end;
  v_new_cost := round((v_project.base_cost * (1 - v_cost_rate)) / 5000) * 5000;
  v_new_duration := greatest(1, ceil(v_project.base_duration_days * (1 - v_duration_rate))::integer);
  v_refund := greatest(0, v_project.final_cost - v_new_cost);
  v_saved_days := greatest(0, v_project.final_duration_days - v_new_duration);
  v_current_game_day := v_season.game_year * 28 + v_season.current_day_number - 1;

  update public.national_federation_infrastructure_projects
  set final_cost = v_new_cost,
      final_duration_days = v_new_duration,
      completes_game_day_index = greatest(v_current_game_day + 1, starts_game_day_index + v_new_duration),
      updated_at = now()
  where id = v_project.id;
  update public.national_federation_project_architects
  set cost_refund = v_refund, saved_days = v_saved_days
  where id = v_contribution_id;

  if v_refund > 0 then
    select id into v_account_id from public.national_federation_accounts
    where country_id = v_project.country_id and season_id = v_season.id for update;
    update public.national_federation_accounts
    set balance = balance + v_refund, updated_at = now() where id = v_account_id;
    insert into public.national_federation_transactions (
      account_id, team_id, day_number, amount, category, description, source_reference
    ) values (
      v_account_id, v_identity.team_id, v_season.current_day_number, v_refund,
      'refund', 'Économie apportée par un architecte de ' || v_identity.team_name,
      'federation-infrastructure:' || v_project.id::text || ':architect:' || v_contribution_id::text
    );
  end if;
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_project.country_id, v_season.id, v_season.current_day_number,
    'infrastructure', 'Architecte mobilisé',
    v_identity.team_name || ' rejoint le chantier : ' || trim(to_char(v_refund, 'FM999G999G999')) || ' € économisés et ' || v_saved_days::text || ' jour(s) gagnés.',
    'federation-infrastructure:' || v_project.id::text || ':architect-journal:' || v_contribution_id::text
  );
  return jsonb_build_object('architectCount', v_architect_count,
    'refund', v_refund, 'savedDays', v_saved_days);
end;
$$;

create or replace function public.settle_due_national_federation_infrastructure_projects()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_project public.national_federation_infrastructure_projects%rowtype;
  v_current_game_day integer;
  v_completed integer := 0;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null then return 0; end if;
  v_current_game_day := v_season.game_year * 28 + v_season.current_day_number - 1;
  for v_project in
    select * from public.national_federation_infrastructure_projects
    where status = 'active' and completes_game_day_index <= v_current_game_day
    order by completes_game_day_index, created_at for update skip locked
  loop
    insert into public.national_federation_infrastructures (
      country_id, infrastructure_code, level, completed_project_id,
      completed_at, updated_at
    ) values (
      v_project.country_id, v_project.infrastructure_code,
      v_project.target_level, v_project.id, now(), now()
    ) on conflict (country_id, infrastructure_code) do update set
      level = greatest(national_federation_infrastructures.level, excluded.level),
      completed_project_id = excluded.completed_project_id,
      completed_at = excluded.completed_at,
      updated_at = now();
    update public.national_federation_infrastructure_projects
    set status = 'completed', completed_at = now(), updated_at = now()
    where id = v_project.id;
    insert into public.national_federation_journal_entries (
      country_id, season_id, day_number, category, title, detail, source_reference
    ) values (
      v_project.country_id, v_season.id, v_season.current_day_number,
      'infrastructure', 'Infrastructure livrée',
      v_project.infrastructure_code || ' atteint le niveau ' || v_project.target_level::text || '.',
      'federation-infrastructure:' || v_project.id::text || ':completed'
    ) on conflict (source_reference) do nothing;
    v_completed := v_completed + 1;
  end loop;
  return v_completed;
end;
$$;

revoke all on function public.start_national_federation_infrastructure_project(text, text, text)
  from public, anon;
revoke all on function public.contribute_architect_to_federation_project(uuid, uuid)
  from public, anon;
revoke all on function public.settle_due_national_federation_infrastructure_projects()
  from public, anon, authenticated;
grant execute on function public.start_national_federation_infrastructure_project(text, text, text)
  to authenticated, service_role;
grant execute on function public.contribute_architect_to_federation_project(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.settle_due_national_federation_infrastructure_projects()
  to service_role;

notify pgrst, 'reload schema';

commit;
