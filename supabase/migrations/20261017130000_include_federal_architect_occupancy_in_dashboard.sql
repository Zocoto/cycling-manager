begin;
set local lock_timeout = '1s';
set local statement_timeout = '4s';

-- Enrich the existing indexed, DS-scoped read: no extra dashboard request,
-- no gameplay mutation and no change to construction capacities or prices.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.get_current_dashboard_construction_context()'::regprocedure);
  v_before text := $before$'hasParallelConstructionTalent', exists ($before$;
  v_after text := $after$'isFederationBusy', exists (
              select 1
              from public.national_federation_project_architects as contribution
              join public.national_federation_infrastructure_projects as federal_project
                on federal_project.id = contribution.project_id
               and federal_project.status = 'active'
              where contribution.staff_contract_id = contract.id
            ),
            'hasParallelConstructionTalent', exists ($after$;
begin
  if position($key$'isFederationBusy'$key$ in v_definition) = 0 then
    if (length(v_definition) - length(replace(v_definition, v_before, ''))) / length(v_before) <> 1 then
      raise exception 'Dashboard architect context changed: review required before applying.';
    end if;
    execute replace(v_definition, v_before, v_after);
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
