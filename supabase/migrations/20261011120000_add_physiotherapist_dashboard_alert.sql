begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';

-- Extend only the existing compact payload; preserve its authentication,
-- timeout, other alerts and return shape. No gameplay rows are changed.
do $migration$
declare
  v_definition text;
  v_previous_payload constant text := replace($previous$
      'equipmentPartnerSignatureAvailable', (
$previous$, E'\r\n', E'\n');
  v_replacement_payload constant text := replace($replacement$
      'physiotherapistOpportunity', (
        with active_physios as materialized (
          select contract.id, member.level
          from public.staff_contracts as contract
          join public.staff_members as member
            on member.id = contract.staff_member_id
           and member.role = 'physiotherapist'
          join current_context as context
            on context.team_id = contract.team_id
          where contract.status = 'active'
        ),
        physio_availability as (
          select greatest(0,
            public.get_physiotherapist_contract_rider_capacity(physio.id, physio.level)
            - (
              select count(*)::integer
              from public.staff_rider_assignments as assignment
              where assignment.staff_contract_id = physio.id
                and assignment.status = 'active'
            )
          ) as free_slots
          from active_physios as physio
        )
        select jsonb_build_object(
          'freeSlotCount', coalesce(sum(availability.free_slots), 0)::integer,
          'unassignedRiderCount', (
            select count(distinct rider.rider_id)::integer
            from active_contracts as rider
            where not exists (
              select 1
              from public.staff_rider_assignments as assignment
              join active_physios as physio
                on physio.id = assignment.staff_contract_id
              where assignment.rider_id = rider.rider_id
                and assignment.status = 'active'
            )
          )
        )
        from physio_availability as availability
      ),
      'equipmentPartnerSignatureAvailable', (
$replacement$, E'\r\n', E'\n');
begin
  select replace(pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ), E'\r\n', E'\n') into v_definition;

  if strpos(v_definition, '''physiotherapistOpportunity''') > 0 then
    raise exception 'L’alerte kiné est déjà installée : vérifier le reçu de migration.';
  end if;
  if length(v_definition) - length(replace(v_definition, v_previous_payload, ''))
    <> length(v_previous_payload) then
    raise exception 'Point d’insertion de l’alerte kiné absent ou non unique.';
  end if;
  execute replace(v_definition, v_previous_payload, v_replacement_payload);
end;
$migration$;

notify pgrst, 'reload schema';
commit;
