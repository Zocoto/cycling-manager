begin;

create index if not exists rider_training_plan_versions_team_season_latest_idx
  on public.rider_training_plan_versions (
    team_id,
    season_id,
    rider_id,
    effective_from_day_number desc,
    created_at desc
  )
  include (trainer_contract_id);

create or replace function public.save_current_rider_training_plans(
  p_plans jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '0'
as $$
declare
  v_context record;
  v_effective_day integer;
  v_plan_count integer;
  v_conflicting_trainer_id uuid;
  v_conflicting_trainer_name text;
  v_conflicting_trainer_count integer;
  v_conflicting_trainer_capacity integer;
begin
  if p_plans is null or jsonb_typeof(p_plans) <> 'array' then
    raise exception 'Les programmes d’entraînement doivent former une liste.';
  end if;

  v_plan_count := jsonb_array_length(p_plans);
  if v_plan_count not between 1 and 35 then
    raise exception 'Entre 1 et 35 programmes peuvent être modifiés ensemble.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_plans) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or coalesce(entry.value ->> 'rider_id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or case
        when coalesce(entry.value ->> 'intensity', '') ~ '^[0-9]+$'
          then (entry.value ->> 'intensity')::numeric between 0 and 100
        else false
      end is not true
      or coalesce(entry.value ->> 'domain', '') not in (
        'climber', 'puncheur', 'stage_racer', 'northern_classics',
        'rouleur', 'breakaway', 'sprinter'
      )
      or (
        entry.value -> 'trainer_contract_id' is not null
        and jsonb_typeof(entry.value -> 'trainer_contract_id') <> 'null'
        and coalesce(entry.value ->> 'trainer_contract_id', '') !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
  ) then
    raise exception 'Un des programmes d’entraînement est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_plans) as plan(
      rider_id uuid,
      intensity integer,
      domain text,
      trainer_contract_id uuid
    )
    group by plan.rider_id
    having plan.rider_id is null or count(*) > 1
  ) then
    raise exception 'Chaque coureur doit apparaître une seule fois.';
  end if;

  select assignment.team_id, season.id as season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  v_effective_day := public.get_training_effective_day_number(
    v_context.season_id
  );

  if (
    select count(distinct contract.rider_id)
    from public.rider_contracts as contract
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
      and contract.rider_id in (
        select plan.rider_id
        from jsonb_to_recordset(p_plans) as plan(
          rider_id uuid,
          intensity integer,
          domain text,
          trainer_contract_id uuid
        )
      )
  ) <> v_plan_count then
    raise exception 'Au moins un coureur ne fait pas partie de votre effectif actif.';
  end if;

  -- Tous les changements d’entraîneur de l’équipe sont sérialisés dans le même
  -- ordre. Le contrôle de capacité porte ensuite sur la répartition finale.
  perform 1
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'trainer'
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
  order by contract.id
  for update of contract;

  if exists (
    select 1
    from jsonb_to_recordset(p_plans) as plan(
      rider_id uuid,
      intensity integer,
      domain text,
      trainer_contract_id uuid
    )
    where plan.trainer_contract_id is not null
      and not exists (
        select 1
        from public.staff_contracts as contract
        join public.staff_members as member
          on member.id = contract.staff_member_id
         and member.role = 'trainer'
        where contract.id = plan.trainer_contract_id
          and contract.team_id = v_context.team_id
          and contract.status = 'active'
      )
  ) then
    raise exception 'Un entraîneur choisi ne fait pas partie de votre staff actif.';
  end if;

  with requested as (
    select *
    from jsonb_to_recordset(p_plans) as plan(
      rider_id uuid,
      intensity integer,
      domain text,
      trainer_contract_id uuid
    )
  ),
  active_riders as (
    select distinct contract.rider_id
    from public.rider_contracts as contract
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
  ),
  latest_plans as (
    select distinct on (plan.rider_id)
      plan.rider_id,
      plan.trainer_contract_id
    from public.rider_training_plan_versions as plan
    join active_riders as rider on rider.rider_id = plan.rider_id
    where plan.team_id = v_context.team_id
      and plan.season_id = v_context.season_id
      and plan.effective_from_day_number <= v_effective_day
    order by
      plan.rider_id,
      plan.effective_from_day_number desc,
      plan.created_at desc
  ),
  final_assignments as (
    select
      rider.rider_id,
      case
        when requested.rider_id is not null
          then requested.trainer_contract_id
        else latest_plan.trainer_contract_id
      end as trainer_contract_id
    from active_riders as rider
    left join requested on requested.rider_id = rider.rider_id
    left join latest_plans as latest_plan
      on latest_plan.rider_id = rider.rider_id
  )
  select
    contract.id,
    member.first_name || ' ' || member.last_name,
    count(*)::integer,
    least(8, greatest(4, member.level + 3))
  into
    v_conflicting_trainer_id,
    v_conflicting_trainer_name,
    v_conflicting_trainer_count,
    v_conflicting_trainer_capacity
  from final_assignments as final_assignment
  join public.staff_contracts as contract
    on contract.id = final_assignment.trainer_contract_id
   and contract.team_id = v_context.team_id
   and contract.status = 'active'
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'trainer'
  where final_assignment.trainer_contract_id in (
    select requested.trainer_contract_id
    from requested
    where requested.trainer_contract_id is not null
  )
  group by contract.id, member.first_name, member.last_name, member.level
  having count(*) > least(8, greatest(4, member.level + 3))
  order by contract.id
  limit 1;

  if v_conflicting_trainer_id is not null then
    raise exception
      'Le quota de % est dépassé (%/% coureurs).',
      v_conflicting_trainer_name,
      v_conflicting_trainer_count,
      v_conflicting_trainer_capacity;
  end if;

  insert into public.rider_training_plan_versions (
    rider_id,
    team_id,
    season_id,
    intensity,
    domain,
    trainer_contract_id,
    effective_from_day_number
  )
  select
    plan.rider_id,
    v_context.team_id,
    v_context.season_id,
    plan.intensity,
    plan.domain,
    plan.trainer_contract_id,
    v_effective_day
  from jsonb_to_recordset(p_plans) as plan(
    rider_id uuid,
    intensity integer,
    domain text,
    trainer_contract_id uuid
  )
  on conflict (rider_id, season_id, effective_from_day_number)
  do update set
    intensity = excluded.intensity,
    domain = excluded.domain,
    trainer_contract_id = excluded.trainer_contract_id,
    team_id = excluded.team_id,
    created_at = now();

  return v_effective_day;
end;
$$;

revoke all on function public.save_current_rider_training_plans(jsonb)
  from public, anon;
grant execute on function public.save_current_rider_training_plans(jsonb)
  to authenticated, service_role;

comment on function public.save_current_rider_training_plans(jsonb) is
  'Valide la répartition finale des entraîneurs puis enregistre un lot de programmes en une seule écriture atomique.';

notify pgrst, 'reload schema';

commit;
