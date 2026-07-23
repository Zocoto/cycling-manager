create or replace function public.save_current_rider_training_plan(
  p_rider_id uuid,
  p_intensity integer,
  p_domain text,
  p_trainer_contract_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_effective_day integer;
  v_trainer_level integer;
  v_trainer_capacity integer;
  v_assigned_rider_count integer;
  v_current_trainer_contract_id uuid;
begin
  if p_intensity not between 0 and 100 then
    raise exception 'L’intensité doit être comprise entre 0 et 100.';
  end if;

  if p_domain not in (
    'climber', 'puncheur', 'stage_racer', 'northern_classics',
    'rouleur', 'breakaway', 'sprinter'
  ) then
    raise exception 'Le domaine d’entraînement est invalide.';
  end if;

  select assignment.team_id, season.id as season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.rider_contracts as rider_contract
    on rider_contract.team_id = assignment.team_id
   and rider_contract.rider_id = p_rider_id
   and rider_contract.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Ce coureur ne fait pas partie de votre effectif actif.';
  end if;

  v_effective_day := public.get_training_effective_day_number(v_context.season_id);

  if p_trainer_contract_id is not null then
    select member.level
    into v_trainer_level
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'trainer'
    where contract.id = p_trainer_contract_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active'
    for update of contract;

    if not found then
      raise exception 'L’entraîneur choisi ne fait pas partie de votre staff actif.';
    end if;

    select latest.trainer_contract_id
    into v_current_trainer_contract_id
    from (
      select distinct on (plan.rider_id)
        plan.rider_id,
        plan.trainer_contract_id
      from public.rider_training_plan_versions as plan
      where plan.rider_id = p_rider_id
        and plan.team_id = v_context.team_id
        and plan.season_id = v_context.season_id
        and plan.effective_from_day_number <= v_effective_day
      order by
        plan.rider_id,
        plan.effective_from_day_number desc,
        plan.created_at desc
    ) as latest;

    if v_current_trainer_contract_id is distinct from p_trainer_contract_id then
      v_trainer_capacity := least(8, greatest(4, v_trainer_level + 3));

      select count(*)
      into v_assigned_rider_count
      from (
        select distinct on (plan.rider_id)
          plan.rider_id,
          plan.trainer_contract_id
        from public.rider_training_plan_versions as plan
        where plan.team_id = v_context.team_id
          and plan.season_id = v_context.season_id
          and plan.effective_from_day_number <= v_effective_day
          and exists (
            select 1
            from public.rider_contracts as rider_contract
            where rider_contract.rider_id = plan.rider_id
              and rider_contract.team_id = v_context.team_id
              and rider_contract.status = 'active'
          )
        order by
          plan.rider_id,
          plan.effective_from_day_number desc,
          plan.created_at desc
      ) as latest
      where latest.trainer_contract_id = p_trainer_contract_id
        and latest.rider_id <> p_rider_id;

      if v_assigned_rider_count >= v_trainer_capacity then
        raise exception
          'Le quota de cet entraîneur est atteint (%/% coureurs).',
          v_assigned_rider_count,
          v_trainer_capacity;
      end if;
    end if;
  end if;

  insert into public.rider_training_plan_versions (
    rider_id,
    team_id,
    season_id,
    intensity,
    domain,
    trainer_contract_id,
    effective_from_day_number
  ) values (
    p_rider_id,
    v_context.team_id,
    v_context.season_id,
    p_intensity,
    p_domain,
    p_trainer_contract_id,
    v_effective_day
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

comment on function public.save_current_rider_training_plan(uuid, integer, text, uuid)
is 'Enregistre le programme d’un coureur et limite chaque entraîneur actif à 4-8 coureurs selon son niveau.';
