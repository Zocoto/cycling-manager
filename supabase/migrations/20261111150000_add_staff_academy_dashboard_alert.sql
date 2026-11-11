begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';

create function private.get_staff_academy_training_opportunity(p_team_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with academy as materialized (
    select infrastructure.level,
      public.get_team_staff_academy_educator_bonuses(p_team_id) as bonuses
    from public.team_infrastructures as infrastructure
    where infrastructure.team_id = p_team_id
      and infrastructure.infrastructure_code = 'staff_academy'
      and infrastructure.level > 0
  ),
  available_capacity as materialized (
    select greatest(0,
      academy.level + coalesce((academy.bonuses ->> 'extraCapacity')::integer, 0) - (
        select count(*)::integer
        from public.staff_academy_trainings as training
        where training.team_id = p_team_id
          and training.status = 'active'
          and cardinality(training.talent_choice_codes) = 0
      )
    ) as free_slots
    from academy
    where coalesce((academy.bonuses ->> 'activeEducatorCount')::integer, 0) > 0
  )
  select jsonb_build_object(
    'freeSlotCount', coalesce((select free_slots from available_capacity), 0),
    'eligibleMemberCount', (
      select count(*)::integer
      from available_capacity as capacity
      join public.staff_contracts as contract
        on contract.team_id = p_team_id and contract.status = 'active'
      join public.staff_members as member on member.id = contract.staff_member_id
      where capacity.free_slots > 0
        and not exists (
          select 1 from public.staff_academy_trainings as training
          where training.staff_member_id = member.id and training.status = 'active'
        )
        and (
          member.level < 5 or (
            -- At level 5 every staff role can have up to three talent lines.
            (select count(*) from public.staff_member_talents as talent
              where talent.staff_member_id = member.id) < 3
            and exists (select 1 from public.get_staff_academy_available_talents(member.id))
          )
        )
    )
  );
$$;

revoke all on function private.get_staff_academy_training_opportunity(uuid)
  from public, anon, authenticated;

-- Reuse the authenticated team context and the existing assistant response.
do $migration$
declare
  v_definition text;
  v_anchor constant text := '      ''equipmentPartnerSignatureAvailable'', (';
begin
  select replace(pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ), E'\r\n', E'\n') into v_definition;

  if strpos(v_definition, '''staffAcademyOpportunity''') > 0
    or length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor) then
    raise exception 'Unexpected staff academy alert insertion point.';
  end if;

  execute replace(v_definition, v_anchor,
    E'      ''staffAcademyOpportunity'', (\n'
    || E'        select private.get_staff_academy_training_opportunity(context.team_id)\n'
    || E'        from current_context as context\n'
    || E'      ),\n'
    || v_anchor);
end;
$migration$;

commit;
