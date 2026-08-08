begin;

-- L'ancien renouvellement créait une ligne planifiée séparée. La nouvelle
-- interface n'affiche volontairement que le contrat actif, alors que la
-- première version de la RPC continuait à prolonger cette ligne cachée.
-- Consolider ces anciennes prolongations avant de supprimer l'ambiguïté.
with legacy_extensions as (
  select distinct on (active_contract.id)
    active_contract.id as active_contract_id,
    planned_contract.end_season_id
  from public.rider_contracts as active_contract
  join public.seasons as active_end
    on active_end.id = active_contract.end_season_id
  join public.rider_contracts as planned_contract
    on planned_contract.rider_id = active_contract.rider_id
    and planned_contract.team_id = active_contract.team_id
    and planned_contract.status = 'planned'
    and planned_contract.acquisition_type = 'renewal'
  join public.seasons as planned_end
    on planned_end.id = planned_contract.end_season_id
  where active_contract.status = 'active'
    and planned_end.game_year > active_end.game_year
  order by
    active_contract.id,
    planned_end.game_year desc,
    planned_contract.signed_at desc nulls last,
    planned_contract.id
),
merged_contracts as (
  update public.rider_contracts as active_contract
  set end_season_id = legacy_extension.end_season_id
  from legacy_extensions as legacy_extension
  where active_contract.id = legacy_extension.active_contract_id
  returning active_contract.id
),
cancelled_legacy_contracts as (
  update public.rider_contracts as planned_contract
  set status = 'cancelled'
  where planned_contract.status = 'planned'
    and planned_contract.acquisition_type = 'renewal'
    and exists (
      select 1
      from public.rider_contracts as active_contract
      where active_contract.rider_id = planned_contract.rider_id
        and active_contract.team_id = planned_contract.team_id
        and active_contract.status = 'active'
    )
  returning planned_contract.id
)
select public.sync_rider_salary_installments(merged_contract.id)
from merged_contracts as merged_contract;

create or replace function public.renew_current_team_rider(p_rider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_contract public.rider_contracts%rowtype;
  v_end_year integer;
  v_next_season_id uuid;
begin
  select assignment.team_id, season.game_year
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
    raise exception 'Aucune équipe active ne correspond au DS.';
  end if;

  select contract.* into v_contract
  from public.rider_contracts as contract
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update;

  if v_contract is null then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;

  select game_year into v_end_year
  from public.seasons where id = v_contract.end_season_id;

  if v_end_year is null then
    raise exception 'L’échéance du contrat est introuvable.';
  end if;
  if v_end_year >= v_context.game_year + 2 then
    raise exception 'Un coureur ne peut pas être engagé au-delà de trois saisons glissantes.';
  end if;

  v_next_season_id := public.ensure_transfer_next_season(
    v_contract.end_season_id
  );

  update public.rider_contracts
  set end_season_id = v_next_season_id
  where id = v_contract.id;

  perform public.sync_rider_salary_installments(v_contract.id);
  return v_contract.id;
end;
$$;

revoke all on function public.renew_current_team_rider(uuid) from public;
grant execute on function public.renew_current_team_rider(uuid) to authenticated;
notify pgrst, 'reload schema';

commit;
