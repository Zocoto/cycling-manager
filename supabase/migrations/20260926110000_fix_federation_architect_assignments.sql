begin;

-- An architect is an employee of one team and can only work on one active
-- construction site, regardless of whether that site belongs to the team or
-- to its federation. The advisory lock serialises assignments across both
-- scopes so two concurrent requests cannot reserve the same contract.
create or replace function public.assert_team_infrastructure_construction_slot(
  p_team_id uuid,
  p_infrastructure_code text,
  p_country_id uuid,
  p_architect_contract_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_count integer;
  v_existing_project_uses_talent boolean;
  v_new_project_uses_talent boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 0));

  if p_architect_contract_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'architect-assignment:' || p_architect_contract_id::text,
        0
      )
    );
  end if;

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

  if p_architect_contract_id is not null and exists (
    select 1
    from public.national_federation_project_architects as contribution
    join public.national_federation_infrastructure_projects as project
      on project.id = contribution.project_id
     and project.status = 'active'
    where contribution.staff_contract_id = p_architect_contract_id
  ) then
    raise exception 'Cet architecte travaille déjà sur un chantier fédéral.';
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

-- Keep the invariant even for service-role writes which do not pass through
-- the public RPC helpers.
create or replace function public.prevent_team_project_architect_double_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or new.architect_contract_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'architect-assignment:' || new.architect_contract_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.national_federation_project_architects as contribution
    join public.national_federation_infrastructure_projects as project
      on project.id = contribution.project_id
     and project.status = 'active'
    where contribution.staff_contract_id = new.architect_contract_id
  ) then
    raise exception 'Cet architecte travaille déjà sur un chantier fédéral.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_team_project_architect_double_booking
  on public.infrastructure_projects;
create trigger prevent_team_project_architect_double_booking
before insert or update of architect_contract_id, status
on public.infrastructure_projects
for each row
execute function public.prevent_team_project_architect_double_booking();

create or replace function public.prevent_federation_architect_double_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_is_active boolean;
begin
  select project.status = 'active'
  into v_project_is_active
  from public.national_federation_infrastructure_projects as project
  where project.id = new.project_id;

  if not coalesce(v_project_is_active, false) then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'architect-assignment:' || new.staff_contract_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.infrastructure_projects as project
    where project.architect_contract_id = new.staff_contract_id
      and project.status = 'active'
  ) then
    raise exception 'Cet architecte travaille déjà sur un chantier de son équipe.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_federation_architect_double_booking
  on public.national_federation_project_architects;
create trigger prevent_federation_architect_double_booking
before insert or update of project_id, staff_contract_id
on public.national_federation_project_architects
for each row
execute function public.prevent_federation_architect_double_booking();

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
  v_country_code text;
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
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

  select *
  into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  select *
  into v_project
  from public.national_federation_infrastructure_projects
  where id = p_project_id
    and status = 'active'
  for update;

  if v_season.id is null
     or v_season.game_year < 3
     or v_project.id is null then
    raise exception 'Ce chantier n’est pas disponible.';
  end if;

  select upper(country.iso_alpha2)
  into v_country_code
  from public.countries as country
  where country.id = v_project.country_id;

  if v_country_code is null then
    raise exception 'La fédération de ce chantier est introuvable.';
  end if;

  -- Resolve the affiliation from the actual project country. The former
  -- implementation used BE for every project, rejecting every other nation.
  select *
  into v_identity
  from public.get_current_federation_identity(v_country_code);

  if v_identity.team_id is null or v_identity.country_id is null then
    raise exception 'Aucune équipe affiliée à cette fédération.';
  end if;
  if v_project.country_id <> v_identity.country_id then
    raise exception 'Ce chantier ne dépend pas de votre fédération.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'architect-assignment:' || p_staff_contract_id::text,
      0
    )
  );

  if not exists (
    select 1
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
    where contract.id = p_staff_contract_id
      and contract.team_id = v_identity.team_id
      and contract.status = 'active'
      and member.role = 'architect'
  ) then
    raise exception 'Cet architecte n’appartient pas à votre staff actif.';
  end if;

  if exists (
    select 1
    from public.infrastructure_projects
    where architect_contract_id = p_staff_contract_id
      and status = 'active'
  ) or exists (
    select 1
    from public.national_federation_project_architects as contribution
    join public.national_federation_infrastructure_projects as project
      on project.id = contribution.project_id
     and project.status = 'active'
    where contribution.staff_contract_id = p_staff_contract_id
  ) then
    raise exception 'Cet architecte travaille déjà sur un chantier.';
  end if;

  select count(*)::integer
  into v_architect_count
  from public.national_federation_project_architects
  where project_id = v_project.id;

  if v_architect_count >= 5 then
    raise exception 'Ce chantier mobilise déjà cinq architectes.';
  end if;

  insert into public.national_federation_project_architects (
    project_id,
    staff_contract_id,
    team_id,
    added_by_director_id
  ) values (
    v_project.id,
    p_staff_contract_id,
    v_identity.team_id,
    v_identity.sporting_director_id
  )
  returning id into v_contribution_id;

  v_architect_count := v_architect_count + 1;
  v_cost_rate := case v_project.priority
    when 'cost' then .04 * v_architect_count
    when 'balanced' then .02 * v_architect_count
    else 0
  end;
  v_duration_rate := case v_project.priority
    when 'time' then .06 * v_architect_count
    when 'balanced' then .03 * v_architect_count
    else 0
  end;
  v_new_cost := round((v_project.base_cost * (1 - v_cost_rate)) / 5000) * 5000;
  v_new_duration := greatest(
    1,
    ceil(v_project.base_duration_days * (1 - v_duration_rate))::integer
  );
  v_refund := greatest(0, v_project.final_cost - v_new_cost);
  v_saved_days := greatest(0, v_project.final_duration_days - v_new_duration);
  v_current_game_day := v_season.game_year * 28
    + v_season.current_day_number - 1;

  update public.national_federation_infrastructure_projects
  set final_cost = v_new_cost,
      final_duration_days = v_new_duration,
      completes_game_day_index = greatest(
        v_current_game_day + 1,
        starts_game_day_index + v_new_duration
      ),
      updated_at = now()
  where id = v_project.id;

  update public.national_federation_project_architects
  set cost_refund = v_refund,
      saved_days = v_saved_days
  where id = v_contribution_id;

  if v_refund > 0 then
    select account.id
    into v_account_id
    from public.national_federation_accounts as account
    where account.country_id = v_project.country_id
      and account.season_id = v_season.id
    for update;

    if v_account_id is null then
      raise exception 'Le compte de cette fédération est introuvable.';
    end if;

    update public.national_federation_accounts
    set balance = balance + v_refund,
        updated_at = now()
    where id = v_account_id;

    insert into public.national_federation_transactions (
      account_id,
      team_id,
      day_number,
      amount,
      category,
      description,
      source_reference,
      metadata
    ) values (
      v_account_id,
      v_identity.team_id,
      v_season.current_day_number,
      v_refund,
      'refund',
      'Économie apportée par un architecte de ' || v_identity.team_name,
      'federation-infrastructure:' || v_project.id::text
        || ':architect:' || v_contribution_id::text,
      jsonb_build_object(
        'projectId', v_project.id,
        'staffContractId', p_staff_contract_id,
        'savedDays', v_saved_days
      )
    );
  end if;

  insert into public.national_federation_journal_entries (
    country_id,
    season_id,
    day_number,
    category,
    title,
    detail,
    source_reference
  ) values (
    v_project.country_id,
    v_season.id,
    v_season.current_day_number,
    'infrastructure',
    'Architecte mobilisé',
    v_identity.team_name || ' rejoint le chantier : '
      || trim(to_char(v_refund, 'FM999G999G999'))
      || ' € économisés et ' || v_saved_days::text || ' jour(s) gagnés.',
    'federation-infrastructure:' || v_project.id::text
      || ':architect-journal:' || v_contribution_id::text
  );

  return jsonb_build_object(
    'architectCount', v_architect_count,
    'refund', v_refund,
    'savedDays', v_saved_days,
    'finalCost', v_new_cost,
    'finalDurationDays', v_new_duration,
    'completesGameDayIndex', greatest(
      v_current_game_day + 1,
      v_project.starts_game_day_index + v_new_duration
    )
  );
end;
$$;

revoke all on function public.prevent_team_project_architect_double_booking()
  from public, anon, authenticated;
revoke all on function public.prevent_federation_architect_double_booking()
  from public, anon, authenticated;
revoke all on function public.contribute_architect_to_federation_project(uuid, uuid)
  from public, anon;

grant execute on function public.prevent_team_project_architect_double_booking()
  to service_role;
grant execute on function public.prevent_federation_architect_double_booking()
  to service_role;
grant execute on function public.contribute_architect_to_federation_project(uuid, uuid)
  to authenticated, service_role;

comment on function public.contribute_architect_to_federation_project(uuid, uuid)
is 'Affecte atomiquement un architecte de l’équipe affiliée au chantier de sa fédération et applique immédiatement économie et délai.';

notify pgrst, 'reload schema';

commit;
