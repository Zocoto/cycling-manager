begin;

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
    and contract.status in ('active', 'planned')
  order by case when contract.status = 'planned' then 0 else 1 end,
    contract.signed_at desc
  limit 1
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

  v_next_season_id := public.ensure_transfer_next_season(v_contract.end_season_id);
  update public.rider_contracts
  set end_season_id = v_next_season_id
  where id = v_contract.id;
  return v_contract.id;
end;
$$;

revoke all on function public.renew_current_team_rider(uuid) from public;
grant execute on function public.renew_current_team_rider(uuid) to authenticated;
notify pgrst, 'reload schema';

commit;
