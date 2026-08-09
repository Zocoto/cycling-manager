begin;

create or replace function public.renew_all_current_team_riders()
returns table (
  renewed_count integer,
  total_salary numeric
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_next_season_id uuid;
  v_rider record;
  v_contract_id uuid;
  v_salary numeric;
begin
  select
    assignment.team_id,
    season.id as season_id,
    season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au DS.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bulk-rider-renewal:' || v_context.team_id::text,
      0
    )
  );

  v_next_season_id := public.ensure_transfer_next_season(
    v_context.season_id
  );
  renewed_count := 0;
  total_salary := 0;

  for v_rider in
    select contract.rider_id
    from public.rider_contracts as contract
    join public.seasons as contract_end
      on contract_end.id = contract.end_season_id
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
      and contract_end.game_year <= v_context.game_year
      and not exists (
        select 1
        from public.rider_contracts as successor
        where successor.rider_id = contract.rider_id
          and successor.start_season_id = v_next_season_id
          and successor.status in ('planned', 'active')
      )
    order by contract.rider_id
  loop
    v_contract_id := public.renew_current_team_rider(v_rider.rider_id);

    select contract.salary_per_season
    into v_salary
    from public.rider_contracts as contract
    where contract.id = v_contract_id;

    renewed_count := renewed_count + 1;
    total_salary := total_salary + coalesce(v_salary, 0);
  end loop;

  return next;
end;
$$;

revoke all on function public.renew_all_current_team_riders()
from public, anon;

grant execute on function public.renew_all_current_team_riders()
to authenticated, service_role;

comment on function public.renew_all_current_team_riders() is
  'Prolonge atomiquement tous les contrats éligibles de l équipe du DS pour la saison suivante.';

notify pgrst, 'reload schema';

commit;
