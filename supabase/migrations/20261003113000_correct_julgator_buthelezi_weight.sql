begin;

set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $$
declare
  v_rider record;
begin
  select
    rider.id,
    rider.first_name,
    rider.last_name,
    rider.height_cm,
    rider.weight_kg,
    rider.baseline_weight_kg,
    rider.physiology_version
  into v_rider
  from public.riders as rider
  where rider.id = '0ba36e0d-498b-4a57-80a6-f387289b9476'::uuid
  for update;

  if v_rider is null
    or v_rider.first_name <> 'Byron'
    or v_rider.last_name <> 'Buthelezi' then
    raise exception 'Byron Buthelezi est introuvable.';
  end if;

  if not exists (
    select 1
    from public.rider_contracts as contract
    join public.team_manager_assignments as assignment
      on assignment.team_id = contract.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.username = 'Julgator'
    where contract.rider_id = v_rider.id
      and contract.status = 'active'
  ) then
    raise exception 'Byron Buthelezi n’appartient pas à l’équipe active de Julgator.';
  end if;

  if v_rider.height_cm <> 182.8
    or v_rider.weight_kg <> 75.9
    or v_rider.baseline_weight_kg <> 75.9
    or v_rider.physiology_version <> 0 then
    raise exception
      'Morphologie inattendue avant correction : taille %, poids %, référence %, version %.',
      v_rider.height_cm,
      v_rider.weight_kg,
      v_rider.baseline_weight_kg,
      v_rider.physiology_version;
  end if;

  update public.riders
  set
    weight_kg = 69.0,
    baseline_weight_kg = 69.0
  where id = v_rider.id;
end;
$$;

commit;
