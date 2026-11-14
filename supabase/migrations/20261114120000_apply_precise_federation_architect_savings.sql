begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';

alter table public.national_federation_infrastructure_projects
  add column completes_at timestamptz,
  add column final_duration_minutes integer;
alter table public.national_federation_project_architects
  add column saved_minutes integer;

create index national_federation_projects_precise_due_idx
  on public.national_federation_infrastructure_projects (completes_at)
  where status = 'active' and completes_at is not null;

create function public.apply_federation_architect_savings(
  p_project_id uuid,
  p_allow_partial_debit boolean,
  p_contribution_id uuid,
  p_backfill boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_project public.national_federation_infrastructure_projects%rowtype;
  v_season public.seasons%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_contribution public.national_federation_project_architects%rowtype;
  v_base_deadline timestamptz;
  v_deadline timestamptz;
  v_architect_count integer;
  v_cost_rate numeric;
  v_duration_rate numeric;
  v_new_cost numeric;
  v_new_minutes integer;
  v_new_days integer;
  v_current_day_index integer;
  v_legacy_completion_index integer;
  v_total_saved_minutes integer;
  v_saved_minutes integer;
  v_requested_change numeric;
  v_applied_change numeric;
begin
  select * into v_project
  from public.national_federation_infrastructure_projects
  where id = p_project_id and status = 'active' for update;
  if v_project.id is null then
    return '{}'::jsonb;
  end if;
  if v_project.completes_at <= now() then
    if not p_allow_partial_debit then
      raise exception 'Ce chantier est arrivé à échéance.';
    end if;
    return '{}'::jsonb;
  end if;

  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null then
    raise exception 'Aucune saison active.';
  end if;
  v_current_day_index := v_season.game_year * 28 + v_season.current_day_number - 1;

  select count(*)::integer into v_architect_count
  from public.national_federation_project_architects
  where project_id = v_project.id;
  v_cost_rate := case v_project.priority
    when 'cost' then .04
    when 'balanced' then .02 else 0 end;
  v_duration_rate := case v_project.priority
    when 'time' then .06
    when 'balanced' then .03 else 0 end;

  v_new_cost := round(v_project.base_cost * (1 - v_cost_rate * v_architect_count), 2);
  -- Preserve any extra historical discount and still apply the new contribution.
  if p_contribution_id is not null then
    v_new_cost := v_new_cost - greatest(0,
      round(v_project.base_cost * (1 - v_cost_rate * (v_architect_count - 1)), 2)
      - v_project.final_cost);
  elsif p_backfill then
    v_new_cost := least(v_new_cost, v_project.final_cost);
  end if;
  v_new_minutes := ceil(v_project.base_duration_days * 1440
    * (1 - v_duration_rate * v_architect_count))::integer;
  v_new_days := (v_new_minutes + 1439) / 1440;
  v_total_saved_minutes := v_project.base_duration_days * 1440 - v_new_minutes;
  v_saved_minutes := greatest(0,
    coalesce(v_project.final_duration_minutes, v_project.final_duration_days * 1440)
    - v_new_minutes);

  -- Deduct real minutes from the original Paris calendar deadline, including across DST.
  select ((season.starts_on + (v_project.starts_game_day_index - season.game_year * 28)
    + v_project.base_duration_days)::timestamp at time zone 'Europe/Paris')
  into strict v_base_deadline
  from public.seasons as season where season.id = v_project.started_season_id;
  v_deadline := greatest(case when p_backfill then v_project.created_at else now() end,
    v_base_deadline - make_interval(mins => v_total_saved_minutes));
  -- Keep the legacy index aligned to the civil day that contains the deadline.
  v_legacy_completion_index := greatest(v_project.starts_game_day_index + 1,
    v_current_day_index + ((v_deadline at time zone 'Europe/Paris')::date
      - (v_season.starts_on + v_season.current_day_number - 1)));

  v_requested_change := v_project.final_cost - v_new_cost;
  v_applied_change := v_requested_change;
  if p_contribution_id is not null then
    select * into strict v_contribution
    from public.national_federation_project_architects
    where id = p_contribution_id and project_id = v_project.id;
  end if;
  if v_requested_change <> 0 then
    select * into v_account
    from public.national_federation_accounts
    where country_id = v_project.country_id and season_id = v_season.id
    for update;
    if v_account.id is null then
      raise exception 'Le compte de cette fédération est introuvable.';
    end if;
    if v_requested_change < 0 and v_account.balance < -v_requested_change then
      if not p_allow_partial_debit then
        raise exception 'La trésorerie ne permet pas ce changement de priorité.';
      end if;
      v_applied_change := -greatest(0, v_account.balance);
    end if;
    -- The recorded price follows the actual transaction, including partial debits.
    v_new_cost := v_project.final_cost - v_applied_change;
    if v_applied_change <> 0 then
      update public.national_federation_accounts
      set balance = balance + v_applied_change, updated_at = now()
      where id = v_account.id;
      insert into public.national_federation_transactions (
        account_id, team_id, day_number, amount, category, description,
        source_reference, metadata
      ) values (
        v_account.id, v_contribution.team_id, v_season.current_day_number, v_applied_change,
        case when v_applied_change > 0 then 'refund' else 'infrastructure' end,
        case
          when p_backfill then 'Rattrapage des économies d’architecte'
          when p_contribution_id is not null then 'Économie apportée par un architecte'
          when v_applied_change > 0 then 'Réajustement favorable du chantier fédéral'
          else 'Réajustement du chantier après changement d’architecte ou de priorité'
        end,
        'federation-infrastructure:' || v_project.id::text || case
          when p_backfill then ':architect-precision'
          when p_contribution_id is not null then ':architect:' || p_contribution_id::text
          else ':recalculation:' || gen_random_uuid()::text end,
        jsonb_build_object('projectId', v_project.id, 'requestedChange', v_requested_change,
          'appliedChange', v_applied_change, 'staffContractId', v_contribution.staff_contract_id,
          'savedDays', v_saved_minutes / 1440, 'savedMinutes', v_saved_minutes)
      );
    end if;
  end if;

  update public.national_federation_infrastructure_projects
  set final_cost = v_new_cost, final_duration_days = v_new_days,
      final_duration_minutes = v_new_minutes, completes_at = v_deadline,
      completes_game_day_index = v_legacy_completion_index, updated_at = now()
  where id = v_project.id;

  -- Attribute the exact total down to the last cent and minute.
  with contribution_order as (
    select id, row_number() over (order by created_at, id)::integer as position
    from public.national_federation_project_architects where project_id = v_project.id
  ), contribution_savings as (
    select id,
      round((v_project.base_cost - v_new_cost) * position / v_architect_count, 2)
        - round((v_project.base_cost - v_new_cost) * (position - 1) / v_architect_count, 2) as refund,
      v_total_saved_minutes * position / v_architect_count
        - v_total_saved_minutes * (position - 1) / v_architect_count as minutes
    from contribution_order
  )
  update public.national_federation_project_architects as contribution
  set cost_refund = savings.refund, saved_minutes = savings.minutes, saved_days = savings.minutes / 1440
  from contribution_savings as savings where contribution.id = savings.id;

  return jsonb_build_object(
    'architectCount', v_architect_count, 'refund', greatest(0, v_applied_change),
    'savedDays', v_saved_minutes / 1440, 'savedMinutes', v_saved_minutes,
    'finalCost', v_new_cost, 'finalDurationDays', v_new_days,
    'finalDurationMinutes', v_new_minutes, 'completesAt', v_deadline,
    'completesGameDayIndex', v_legacy_completion_index, 'balanceChange', v_applied_change
  );
end;
$$;

revoke all on function public.apply_federation_architect_savings(uuid, boolean, uuid, boolean)
  from public, anon, authenticated;

create or replace function public.recalculate_national_federation_project(
  p_project_id uuid,
  p_allow_partial_debit boolean default false
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.apply_federation_architect_savings(p_project_id, p_allow_partial_debit, null, false);
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
  v_country_code text;
  v_contribution_id uuid;
  v_architect_count integer;
  v_calculation jsonb;
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
    and (completes_at is null or completes_at > now())
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

  v_calculation := public.apply_federation_architect_savings(
    v_project.id, false, v_contribution_id, false
  );

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
      || (v_calculation->>'refund')
      || ' € économisés et '
      || coalesce(nullif(concat_ws(' ',
        nullif((v_calculation->>'savedMinutes')::integer / 1440, 0) || ' j',
        nullif((v_calculation->>'savedMinutes')::integer % 1440 / 60, 0) || ' h',
        nullif((v_calculation->>'savedMinutes')::integer % 60, 0) || ' min'
      ), ''), '0 min') || ' de gagnées.',
    'federation-infrastructure:' || v_project.id::text
      || ':architect-journal:' || v_contribution_id::text
  );

  return v_calculation;
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
    where status = 'active'
      and (completes_at <= now()
        or (completes_at is null and completes_game_day_index <= v_current_game_day))
    order by completes_game_day_index, created_at for update skip locked
  loop
    insert into public.national_federation_infrastructures (
      country_id, infrastructure_code, level, completed_project_id,
      completed_at, updated_at
    ) values (
      v_project.country_id, v_project.infrastructure_code,
      v_project.target_level, v_project.id, coalesce(v_project.completes_at, now()), now()
    ) on conflict (country_id, infrastructure_code) do update set
      level = greatest(national_federation_infrastructures.level, excluded.level),
      completed_project_id = excluded.completed_project_id,
      completed_at = excluded.completed_at,
      updated_at = now();
    update public.national_federation_infrastructure_projects
    set status = 'completed', completed_at = coalesce(v_project.completes_at, now()), updated_at = now()
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

-- Adjust ongoing contributions once. Completed projects and their ledgers remain historical.
do $$
declare
  v_project_id uuid;
begin
  for v_project_id in
    select project.id
    from public.national_federation_infrastructure_projects as project
    where project.status = 'active' and project.completes_at is null
      and exists (select 1 from public.national_federation_project_architects as contribution
        where contribution.project_id = project.id)
    order by project.id
  loop
    perform public.apply_federation_architect_savings(v_project_id, false, null, true);
  end loop;
end;
$$;

-- Deliver new deadlines at minute precision without adding a Vercel invocation.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule(
      'settle-federal-construction-deadlines',
      '* * * * *',
      'select public.settle_due_national_federation_infrastructure_projects();'
    );
  end if;
end;
$$;

commit;
