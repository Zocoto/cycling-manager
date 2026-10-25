begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';

-- Drafts can outlive the staff contract that they reference. Preserve the
-- historical plan, but never require that departed trainer to save the rider.
-- The integer RPCs below remain atomic compatibility entry points for bots and
-- older clients; the interactive v2 endpoint reports one outcome per rider.
create or replace function public.save_current_rider_training_plans_v2(p_plans jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2500ms'
set statement_timeout = '12s'
as $$
declare
  v_context record;
  v_effective_day integer;
  v_trainers jsonb;
  v_baseline jsonb;
  v_items jsonb := '[]'::jsonb;
  v_entry record;
  v_item jsonb;
  v_rider_id uuid;
  v_trainer_id uuid;
  v_trainer_reset boolean;
  v_duplicate text;
  v_overfull record;
  v_rejected_ordinal integer;
  v_writing_ordinal integer;
  v_completed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_plans is null or jsonb_typeof(p_plans) <> 'array' then
    raise exception 'Les programmes d’entraînement doivent former une liste.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_plans) not between 1 and 35
    or octet_length(p_plans::text) > 100000 then
    raise exception 'Entre 1 et 35 programmes peuvent être modifiés ensemble.' using errcode = '22023';
  end if;

  select assignment.team_id, season.id as season_id into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;
  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.' using errcode = '42501';
  end if;

  -- Day synchronization can update the season row used by rollover too.
  -- Resolve it before taking any team-local training locks, as the legacy
  -- saver did, so training cannot invert the rollover lock order.
  v_effective_day := public.get_training_effective_day_number(v_context.season_id);

  -- Only this team is serialized. All three save entry points use the same
  -- lock order, including saves that remove a trainer or use no trainer.
  -- NO KEY UPDATE also lets unrelated FK checks (registrations, recruiting)
  -- proceed while serializing the team's training writers.
  perform 1 from public.teams where id = v_context.team_id for no key update;
  perform 1 from public.rider_contracts as contract
  where contract.team_id = v_context.team_id and contract.status = 'active'
  order by contract.id for update;
  perform 1 from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
    and member.role = 'trainer'
  where contract.team_id = v_context.team_id and contract.status = 'active'
  order by contract.id for update of contract;

  select coalesce(jsonb_object_agg(contract.id::text, jsonb_build_object(
    'name', member.first_name || ' ' || member.last_name,
    'capacity', least(8, greatest(4, member.level + 3)))), '{}'::jsonb)
  into v_trainers
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
    and member.role = 'trainer'
  where contract.team_id = v_context.team_id and contract.status = 'active';

  with active_riders as (
    select distinct contract.rider_id from public.rider_contracts as contract
    where contract.team_id = v_context.team_id and contract.status = 'active'
  ), latest_plans as (
    select distinct on (plan.rider_id) plan.rider_id, plan.trainer_contract_id
    from public.rider_training_plan_versions as plan
    join active_riders as rider on rider.rider_id = plan.rider_id
    where plan.team_id = v_context.team_id and plan.season_id = v_context.season_id
      and plan.effective_from_day_number <= v_effective_day
    order by plan.rider_id, plan.effective_from_day_number desc, plan.created_at desc
  )
  select coalesce(jsonb_object_agg(rider.rider_id::text, jsonb_build_object(
    'raw_trainer_contract_id', plan.trainer_contract_id,
    'trainer_contract_id', case when v_trainers ? plan.trainer_contract_id::text
      then plan.trainer_contract_id else null end)), '{}'::jsonb)
  into v_baseline from active_riders as rider
  left join latest_plans as plan on plan.rider_id = rider.rider_id;

  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_plans) with ordinality
  loop
    v_item := jsonb_build_object('ordinal', v_entry.ordinal,
      'rider_id', case when coalesce(v_entry.value ->> 'rider_id', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then lower(v_entry.value ->> 'rider_id') else v_entry.value ->> 'rider_id' end, 'status', 'error',
      'code', 'invalid_plan', 'message', 'Ce programme d’entraînement est invalide.');
    if jsonb_typeof(v_entry.value) <> 'object'
      or coalesce(v_entry.value ->> 'rider_id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_entry.value ->> 'intensity', '') !~ '^[0-9]{1,3}$'
      or coalesce(v_entry.value ->> 'domain', '') not in (
        'climber', 'puncheur', 'stage_racer', 'northern_classics', 'rouleur', 'breakaway', 'sprinter')
      or (v_entry.value -> 'trainer_contract_id' is not null
        and jsonb_typeof(v_entry.value -> 'trainer_contract_id') <> 'null'
        and coalesce(v_entry.value ->> 'trainer_contract_id', '') !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
      v_items := v_items || jsonb_build_array(v_item);
      continue;
    end if;
    if (v_entry.value ->> 'intensity')::integer > 100 then
      v_items := v_items || jsonb_build_array(v_item);
      continue;
    end if;
    v_rider_id := (v_entry.value ->> 'rider_id')::uuid;
    v_trainer_id := (v_entry.value ->> 'trainer_contract_id')::uuid;
    v_trainer_reset := false;
    v_item := v_item || jsonb_build_object('rider_id', v_rider_id);
    if not (v_baseline ? v_rider_id::text) then
      v_items := v_items || jsonb_build_array(v_item || jsonb_build_object(
        'code', 'inactive_rider', 'message', 'Ce coureur ne fait pas partie de votre effectif actif.'));
      continue;
    end if;
    if v_trainer_id is not null and not (v_trainers ? v_trainer_id::text) then
      if v_baseline #>> array[v_rider_id::text, 'raw_trainer_contract_id'] = v_trainer_id::text then
        v_trainer_id := null;
        v_trainer_reset := true;
      else
        v_items := v_items || jsonb_build_array(v_item || jsonb_build_object(
          'code', 'inactive_trainer', 'message', 'L’entraîneur choisi ne fait pas partie de votre staff actif.'));
        continue;
      end if;
    end if;
    v_items := v_items || jsonb_build_array(v_item || jsonb_build_object(
      'intensity', (v_entry.value ->> 'intensity')::integer, 'domain', v_entry.value ->> 'domain',
      'trainer_contract_id', v_trainer_id, 'trainer_reset', v_trainer_reset,
      'status', 'pending', 'code', null, 'message', null));
  end loop;

  -- Reject every occurrence of a duplicate, rather than arbitrarily saving
  -- one of two contradictory instructions for the same rider.
  for v_duplicate in select item ->> 'rider_id' from jsonb_array_elements(v_items) item
    where item ->> 'rider_id' is not null group by item ->> 'rider_id' having count(*) > 1
  loop
    select jsonb_agg(case when item ->> 'rider_id' = v_duplicate
      then item || jsonb_build_object('status', 'error', 'code', 'duplicate_rider',
        'message', 'Chaque coureur doit apparaître une seule fois.') else item end order by n)
    into v_items from jsonb_array_elements(v_items) with ordinality t(item, n);
  end loop;

  while not v_completed loop
    -- Start with ALL valid requests, so reciprocal swaps at capacity work.
    -- A rejected move keeps its original assignment; recompute until stable.
    loop
      with requested as (
        select * from jsonb_to_recordset(v_items) as p(ordinal integer, rider_id text,
          trainer_contract_id text, status text) where status = 'pending'
      ), final_assignments as (
        select b.key as rider_id, b.value ->> 'trainer_contract_id' as old_trainer,
          case when r.ordinal is not null then r.trainer_contract_id
            else b.value ->> 'trainer_contract_id' end as trainer,
          r.ordinal from jsonb_each(v_baseline) b left join requested r on r.rider_id = b.key
      )
      select f.trainer, count(*)::integer as assigned,
        (v_trainers #>> array[f.trainer, 'capacity'])::integer as capacity,
        v_trainers #>> array[f.trainer, 'name'] as trainer_name,
        max(f.ordinal) filter (where f.old_trainer is distinct from f.trainer) as reject_ordinal
      into v_overfull from final_assignments f
      where f.trainer is not null and v_trainers ? f.trainer
      group by f.trainer
      having count(*) > (v_trainers #>> array[f.trainer, 'capacity'])::integer
        and count(*) filter (where f.ordinal is not null and f.old_trainer is distinct from f.trainer) > 0
      order by f.trainer limit 1;
      exit when not found;
      v_rejected_ordinal := v_overfull.reject_ordinal;
      v_items := jsonb_set(v_items, array[(v_rejected_ordinal - 1)::text],
        (v_items -> (v_rejected_ordinal - 1)) || jsonb_build_object('status', 'error',
          'code', 'trainer_capacity', 'message', format('Le quota de %s est dépassé (%s/%s coureurs).',
            v_overfull.trainer_name, v_overfull.assigned, v_overfull.capacity)));
    end loop;

    begin
      for v_item in select value from jsonb_array_elements(v_items)
        where value ->> 'status' = 'pending' order by (value ->> 'ordinal')::integer
      loop
        v_writing_ordinal := (v_item ->> 'ordinal')::integer;
        insert into public.rider_training_plan_versions(rider_id, team_id, season_id,
          intensity, domain, trainer_contract_id, effective_from_day_number)
        values ((v_item ->> 'rider_id')::uuid, v_context.team_id, v_context.season_id,
          (v_item ->> 'intensity')::integer, v_item ->> 'domain',
          (v_item ->> 'trainer_contract_id')::uuid, v_effective_day)
        on conflict (rider_id, season_id, effective_from_day_number) do update set
          intensity = excluded.intensity, domain = excluded.domain,
          trainer_contract_id = excluded.trainer_contract_id, team_id = excluded.team_id, created_at = now();
      end loop;
      v_completed := true;
    exception when data_exception or integrity_constraint_violation or raise_exception then
      -- This block rolls back EVERY tentative write in this pass. Removing
      -- only the failed row then rechecking quotas cannot leave behind a move
      -- that relied on the failed row releasing a trainer's last place.
      v_items := jsonb_set(v_items, array[(v_writing_ordinal - 1)::text],
        (v_items -> (v_writing_ordinal - 1)) || jsonb_build_object('status', 'error',
          'code', 'save_failed', 'message', 'Ce programme n’a pas pu être enregistré. Réessayez pour ce coureur.'));
      -- Cancellation, deadlock, serialization and resource failures are NOT
      -- caught: those are transaction-wide failures, never reported as saved.
    end;
  end loop;

  return jsonb_build_object('effective_day', v_effective_day, 'results', (
    select jsonb_agg(jsonb_build_object('rider_id', item -> 'rider_id',
      'status', case when item ->> 'status' = 'pending' then 'saved' else 'error' end,
      'code', case when item ->> 'status' = 'pending' then 'saved' else item ->> 'code' end,
      'message', case when item ->> 'status' = 'pending' then
        case when (item ->> 'trainer_reset')::boolean then
          'Programme enregistré sans l’ancien entraîneur, qui n’est plus actif.' else 'Programme enregistré.' end
        else item ->> 'message' end,
      'trainer_contract_id', item -> 'trainer_contract_id',
      'trainer_reset', item ->> 'status' = 'pending' and coalesce((item ->> 'trainer_reset')::boolean, false))
      order by n) from jsonb_array_elements(v_items) with ordinality t(item, n)));
end;
$$;

create or replace function public.save_current_rider_training_plans(p_plans jsonb)
returns integer
language plpgsql security definer set search_path = ''
set lock_timeout = '2500ms' set statement_timeout = '12s'
as $$
declare v_result jsonb; v_error text;
begin
  v_result := public.save_current_rider_training_plans_v2(p_plans);
  select item ->> 'message' into v_error from jsonb_array_elements(v_result -> 'results') item
  where item ->> 'status' = 'error' limit 1;
  if v_error is not null then raise exception '%', v_error; end if;
  return (v_result ->> 'effective_day')::integer;
end;
$$;

create or replace function public.save_current_rider_training_plan(
  p_rider_id uuid, p_intensity integer, p_domain text, p_trainer_contract_id uuid default null)
returns integer
language plpgsql security definer set search_path = ''
set lock_timeout = '2500ms' set statement_timeout = '12s'
as $$
begin
  return public.save_current_rider_training_plans(jsonb_build_array(jsonb_build_object(
    'rider_id', p_rider_id, 'intensity', p_intensity, 'domain', p_domain,
    'trainer_contract_id', p_trainer_contract_id)));
end;
$$;

revoke all on function public.save_current_rider_training_plans_v2(jsonb) from public, anon;
grant execute on function public.save_current_rider_training_plans_v2(jsonb) to authenticated, service_role;
revoke all on function public.save_current_rider_training_plans(jsonb),
  public.save_current_rider_training_plan(uuid, integer, text, uuid) from public, anon;
grant execute on function public.save_current_rider_training_plans(jsonb),
  public.save_current_rider_training_plan(uuid, integer, text, uuid) to authenticated, service_role;
comment on function public.save_current_rider_training_plans_v2(jsonb) is
  'Sauvegarde les programmes indépendamment par coureur, neutralise un ancien entraîneur conservé dans son programme et vérifie la capacité finale après chaque rejet.';
comment on function public.save_current_rider_training_plans(jsonb) is
  'Compatibilité atomique : enregistre tous les programmes ou annule le lot et retourne la journée effective.';
notify pgrst, 'reload schema';
commit;
