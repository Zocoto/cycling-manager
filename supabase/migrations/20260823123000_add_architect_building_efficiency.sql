begin;

insert into public.staff_talent_catalog (
  code,
  role,
  display_name,
  minimum_level
)
values (
  'architect_building_efficiency',
  'architect',
  'Conception haute performance',
  2
)
on conflict (code) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  minimum_level = excluded.minimum_level,
  is_active = true;

alter table public.infrastructure_projects
  add column if not exists efficiency_bonus_percentage smallint
    not null default 0;
alter table public.team_infrastructures
  add column if not exists efficiency_bonus_percentage smallint
    not null default 0;
alter table public.international_youth_centers
  add column if not exists efficiency_bonus_percentage smallint
    not null default 0;

alter table public.infrastructure_projects
  drop constraint if exists infrastructure_projects_efficiency_bonus_range;
alter table public.infrastructure_projects
  add constraint infrastructure_projects_efficiency_bonus_range
  check (efficiency_bonus_percentage between 0 and 10);

alter table public.team_infrastructures
  drop constraint if exists team_infrastructures_efficiency_bonus_range;
alter table public.team_infrastructures
  add constraint team_infrastructures_efficiency_bonus_range
  check (efficiency_bonus_percentage between 0 and 10);

alter table public.international_youth_centers
  drop constraint if exists international_centers_efficiency_bonus_range;
alter table public.international_youth_centers
  add constraint international_centers_efficiency_bonus_range
  check (efficiency_bonus_percentage between 0 and 10);

create or replace function public.apply_architect_building_efficiency_talent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_efficiency integer := 0;
begin
  select member.level * 2
  into v_efficiency
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
  join public.staff_member_talents as talent
    on talent.staff_member_id = member.id
   and talent.talent_code = 'architect_building_efficiency'
  where contract.id = new.architect_contract_id
    and contract.status = 'active'
    and member.role = 'architect'
  limit 1;

  new.efficiency_bonus_percentage := least(10, coalesce(v_efficiency, 0));
  return new;
end;
$$;

drop trigger if exists infrastructure_project_architect_efficiency
  on public.infrastructure_projects;
create trigger infrastructure_project_architect_efficiency
before insert or update of architect_contract_id
on public.infrastructure_projects
for each row execute function public.apply_architect_building_efficiency_talent();

create or replace function public.sync_completed_infrastructure_efficiency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'completed' then
    return new;
  end if;

  update public.team_infrastructures
  set efficiency_bonus_percentage = new.efficiency_bonus_percentage
  where completed_project_id = new.id;

  update public.international_youth_centers
  set efficiency_bonus_percentage = new.efficiency_bonus_percentage
  where completed_project_id = new.id;

  return new;
end;
$$;

drop trigger if exists infrastructure_project_sync_efficiency
  on public.infrastructure_projects;
create trigger infrastructure_project_sync_efficiency
after update of status
on public.infrastructure_projects
for each row execute function public.sync_completed_infrastructure_efficiency();

create or replace function public.get_team_infrastructure_efficiency_multiplier(
  p_team_id uuid,
  p_infrastructure_code text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select 1 + coalesce(max(infrastructure.efficiency_bonus_percentage), 0) / 100.0
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = p_team_id
    and infrastructure.infrastructure_code = p_infrastructure_code;
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
    * public.get_team_infrastructure_efficiency_multiplier(
        p_team_id,
        'training_center'
      )
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = p_team_id
    and infrastructure.infrastructure_code = 'training_center';
$$;

create or replace function public.get_team_media_center_community_multiplier(
  p_team_id uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  select 1 + coalesce(max(infrastructure.level), 0) * 0.05
    * public.get_team_infrastructure_efficiency_multiplier(
        p_team_id,
        'media_center'
      )
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = p_team_id
    and infrastructure.infrastructure_code = 'media_center';
$$;

create or replace function public.get_team_professional_naturalization_days(
  p_team_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  select ceil(
    (array[84,70,56,42,28,14]::integer[])[
      least(5, greatest(0, public.get_team_welcome_center_level(p_team_id))) + 1
    ] / public.get_team_infrastructure_efficiency_multiplier(
      p_team_id,
      'international_welcome_center'
    )
  )::integer;
$$;

create or replace function public.get_team_youth_naturalization_days(
  p_team_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  select ceil(
    (array[28,21,14,7,3,0]::integer[])[
      least(5, greatest(0, public.get_team_welcome_center_level(p_team_id))) + 1
    ] / public.get_team_infrastructure_efficiency_multiplier(
      p_team_id,
      'international_welcome_center'
    )
  )::integer;
$$;

-- Les bonus de préparation peuvent être décimaux afin que +4 % ait un effet
-- même sur une installation qui fournit seulement +1 point de base.
alter table public.rider_performance_preparations
  drop constraint if exists rider_performance_preparations_rating_bonus_check;
alter table public.rider_performance_preparations
  alter column rating_bonus type numeric(5, 2)
    using rating_bonus::numeric(5, 2);
alter table public.rider_performance_preparations
  add constraint rider_performance_preparations_rating_bonus_check
  check (rating_bonus between 1 and 3.3);

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
begin
  v_signature := 'public.start_current_team_rider_performance_preparation(uuid,text)'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;
  if position('get_team_infrastructure_efficiency_multiplier' in v_definition) = 0 then
    v_patched_definition := replace(
      v_definition,
      'v_bonus integer;',
      'v_bonus numeric;'
    );
    v_patched_definition := replace(
      v_patched_definition,
      'v_bonus:=case when v_level<=2 then 1 when v_level<=4 then 2 else 3 end;',
      E'v_bonus := round((case when v_level <= 2 then 1 when v_level <= 4 then 2 else 3 end)\n    * public.get_team_infrastructure_efficiency_multiplier(v_context.team_id, p_preparation_type), 2);'
    );
    if v_patched_definition = v_definition then
      raise exception 'La formule des préparations de performance a changé.';
    end if;
    execute v_patched_definition;
  end if;

  v_signature := 'public.start_current_team_equipment_rnd(uuid,uuid)'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;
  if position('get_team_infrastructure_efficiency_multiplier' in v_definition) = 0 then
    v_patched_definition := replace(
      v_definition,
      E'v_success := least(\n    95,\n    45 + v_level * 5 +\n      case when v_has_research_success then v_engineer_level * 3 else 0 end\n  );',
      E'v_success := least(\n    95,\n    45 + round(\n      v_level * 5 * public.get_team_infrastructure_efficiency_multiplier(\n        v_context.team_id,\n        ''research_lab''\n      )\n    )::integer +\n      case when v_has_research_success then v_engineer_level * 3 else 0 end\n  );'
    );
    if v_patched_definition = v_definition then
      raise exception 'La formule de réussite R&D a changé.';
    end if;
    execute v_patched_definition;
  end if;

  v_signature := 'public.apply_assigned_physio_to_race_condition()'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;
  if position('get_team_infrastructure_efficiency_multiplier' in v_definition) = 0 then
    v_patched_definition := replace(
      v_definition,
      'select coalesce(max(level),0)*10 into v_cryo from public.team_infrastructures',
      E'select round(coalesce(max(level), 0) * 10\n    * public.get_team_infrastructure_efficiency_multiplier(v_team_id, ''cryotherapy_center''))::integer\n  into v_cryo from public.team_infrastructures'
    );
    if v_patched_definition = v_definition then
      raise exception 'La formule de protection cryothérapie a changé.';
    end if;
    execute v_patched_definition;
  end if;
end;
$migration$;

revoke all on function public.get_team_infrastructure_efficiency_multiplier(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_team_infrastructure_efficiency_multiplier(uuid, text)
  to authenticated, service_role;

commit;
