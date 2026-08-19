begin;

insert into public.staff_talent_catalog (code, role, display_name)
values (
  'architect_parallel_construction',
  'architect',
  'Double chantier'
)
on conflict (code) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  is_active = true;

create or replace function public.validate_staff_member_talent_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_member_role text;
  v_member_level integer;
  v_talent_role text;
begin
  select role, level
  into v_member_role, v_member_level
  from public.staff_members
  where id = new.staff_member_id;

  select role into v_talent_role
  from public.staff_talent_catalog
  where code = new.talent_code and is_active;

  if v_member_role is null
    or v_talent_role is null
    or v_member_role <> v_talent_role then
    raise exception 'Ce talent ne correspond pas au métier du membre du staff.';
  end if;

  if new.talent_code = 'architect_parallel_construction'
    and v_member_level < 3 then
    raise exception 'Le talent Double chantier est réservé aux architectes de niveau 3 minimum.';
  end if;

  return new;
end;
$$;

-- L’Académie ne peut tirer ce talent que pour un architecte déjà 3★.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_pattern constant text :=
    '(where talent\.role = v_member\.role[[:space:]]+and talent\.is_active)';
  v_replacement constant text := E'\\1\n        and (\n          talent.code <> ''architect_parallel_construction''\n          or v_member.level >= 3\n        )';
begin
  foreach v_signature in array array[
    'public.settle_due_staff_academy_trainings()'::regprocedure,
    'public.start_current_team_staff_academy_training(uuid,text)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;

    if position('architect_parallel_construction' in v_definition) > 0 then
      continue;
    end if;

    v_patched_definition := regexp_replace(
      v_definition,
      v_pattern,
      v_replacement,
      'g'
    );

    if v_patched_definition = v_definition then
      raise exception 'La fonction d’Académie % a une définition inattendue.',
        v_signature::text;
    end if;

    execute v_patched_definition;
  end loop;
end;
$migration$;

create or replace function public.assert_team_infrastructure_construction_slot(
  p_team_id uuid,
  p_infrastructure_code text,
  p_country_id uuid,
  p_architect_contract_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count integer;
  v_existing_project_uses_talent boolean;
  v_new_project_uses_talent boolean;
begin
  -- Sérialise deux lancements concurrents pour une même équipe.
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 0));

  select count(*)::integer
  into v_active_count
  from public.infrastructure_projects
  where team_id = p_team_id
    and status = 'active';

  if v_active_count >= 2 then
    raise exception 'Votre équipe possède déjà deux chantiers actifs.';
  end if;

  if exists (
    select 1
    from public.infrastructure_projects
    where team_id = p_team_id
      and status = 'active'
      and infrastructure_code = p_infrastructure_code
      and country_id is not distinct from p_country_id
  ) then
    raise exception 'Un chantier est déjà actif pour cette infrastructure.';
  end if;

  if p_architect_contract_id is not null and exists (
    select 1
    from public.infrastructure_projects
    where team_id = p_team_id
      and status = 'active'
      and architect_contract_id = p_architect_contract_id
  ) then
    raise exception 'Cet architecte est déjà affecté à un chantier actif.';
  end if;

  if v_active_count = 0 then
    return;
  end if;

  select exists (
    select 1
    from public.infrastructure_projects as project
    join public.staff_contracts as contract
      on contract.id = project.architect_contract_id
    join public.staff_member_talents as talent
      on talent.staff_member_id = contract.staff_member_id
     and talent.talent_code = 'architect_parallel_construction'
    where project.team_id = p_team_id
      and project.status = 'active'
  )
  into v_existing_project_uses_talent;

  select exists (
    select 1
    from public.staff_contracts as contract
    join public.staff_member_talents as talent
      on talent.staff_member_id = contract.staff_member_id
     and talent.talent_code = 'architect_parallel_construction'
    where contract.id = p_architect_contract_id
      and contract.team_id = p_team_id
      and contract.status = 'active'
  )
  into v_new_project_uses_talent;

  if not v_existing_project_uses_talent
    and not v_new_project_uses_talent then
    raise exception 'Le second chantier exige que l’architecte doté du talent Double chantier soit affecté à l’un des deux projets.';
  end if;
end;
$$;

drop index if exists public.infrastructure_projects_one_active_per_team_idx;

-- Remplace le verrou historique « un seul chantier » dans chaque branche
-- encore active du répartiteur d’infrastructures.
do $migration$
declare
  v_function_name text;
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_pattern constant text :=
    'if[[:space:]]+exists[[:space:]]*\([[:space:]]*select[[:space:]]+1[[:space:]]+from[[:space:]]+public\.infrastructure_projects[[:space:]]+where[[:space:]]+team_id[[:space:]]*=[[:space:]]*v_context\.team_id[[:space:]]+and[[:space:]]+status[[:space:]]*=[[:space:]]*''active''[[:space:]]*\)[[:space:]]+then[[:space:]]+raise[[:space:]]+exception[[:space:]]+''Votre équipe possède déjà un chantier actif\.'';[[:space:]]+end[[:space:]]+if;';
  v_replacement constant text :=
    'perform public.assert_team_infrastructure_construction_slot(v_context.team_id, p_infrastructure_code, p_country_id, p_architect_contract_id);';
begin
  foreach v_function_name in array array[
    'start_current_team_infrastructure_project',
    'start_current_team_infrastructure_project_legacy_20260812',
    'start_current_team_infrastructure_project_legacy_20260811'
  ]
  loop
    v_signature := to_regprocedure(
      format('public.%I(text,uuid,uuid)', v_function_name)
    );
    if v_signature is null then
      raise exception 'La fonction d’infrastructure % est introuvable.',
        v_function_name;
    end if;

    select pg_get_functiondef(v_signature) into v_definition;

    if position('assert_team_infrastructure_construction_slot' in v_definition) > 0 then
      continue;
    end if;

    v_patched_definition := regexp_replace(
      v_definition,
      v_pattern,
      v_replacement
    );
    if v_patched_definition = v_definition then
      raise exception 'La fonction d’infrastructure % a une définition inattendue.',
        v_function_name;
    end if;

    execute v_patched_definition;
  end loop;
end;
$migration$;

revoke all on function public.assert_team_infrastructure_construction_slot(
  uuid, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.assert_team_infrastructure_construction_slot(
  uuid, text, uuid, uuid
) to service_role;

commit;
