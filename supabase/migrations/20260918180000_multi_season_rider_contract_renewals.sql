begin;

-- A rider can be secured at most through the second season after the active
-- one. Keep the future salary on a planned contract: the current-season salary
-- must not change when the extension is signed.
create or replace function public.renew_current_team_rider_until(
  p_rider_id uuid,
  p_target_end_game_year integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_active public.rider_contracts%rowtype;
  v_existing public.rider_contracts%rowtype;
  v_active_end_year integer;
  v_existing_end_year integer;
  v_start_year integer;
  v_start_season_id uuid;
  v_next_season public.seasons%rowtype;
  v_target_season_id uuid;
  v_base_salary numeric;
  v_new_salary numeric;
  v_contract_id uuid;
begin
  if p_rider_id is null or p_target_end_game_year is null then
    raise exception 'La prolongation demandée est invalide.';
  end if;

  select assignment.team_id, season.id as season_id, season.game_year
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

  -- Serialize two requests for the same rider, including an upgrade of a
  -- one-season renewal already signed by this team.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('rider-renewal:' || p_rider_id::text, 0)
  );

  select contract.*
  into v_active
  from public.rider_contracts as contract
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update;

  if v_active is null then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;

  select season.game_year into v_active_end_year
  from public.seasons as season
  where season.id = v_active.end_season_id;

  if (v_active_end_year not between v_context.game_year
    and v_context.game_year + 1)
    or p_target_end_game_year <= v_active_end_year
    or p_target_end_game_year > v_context.game_year + 2
  then
    raise exception 'Cette échéance dépasse la limite de deux saisons à venir.';
  end if;

  v_start_year := v_active_end_year + 1;

  select season.* into v_next_season
  from public.seasons as season
  where season.game_year = v_context.game_year + 1
    and exists (
      select 1 from public.season_days as final_day
      where final_day.season_id = season.id
        and final_day.day_number = 28
    );

  if v_next_season.id is null then
    perform public.ensure_transfer_next_season(v_context.season_id);
    select season.* into v_next_season
    from public.seasons as season
    where season.game_year = v_context.game_year + 1;
  end if;

  if v_next_season.id is null then
    raise exception 'La saison suivante n’a pas pu être préparée.';
  end if;

  if p_target_end_game_year = v_next_season.game_year then
    v_target_season_id := v_next_season.id;
  else
    -- Only the season identity is needed for a contract signed two years
    -- ahead. Its calendar is provisioned normally when it becomes S+1.
    insert into public.seasons (
      game_year, name, starts_on, ends_on, status, current_day_number
    ) values (
      v_context.game_year + 2,
      'Saison ' || (v_context.game_year + 2),
      v_next_season.ends_on + 1,
      v_next_season.ends_on + 28,
      'planned',
      1
    ) on conflict (game_year) do nothing;

    select season.id into v_target_season_id
    from public.seasons as season
    where season.game_year = v_context.game_year + 2
      and season.status = 'planned';
  end if;

  if v_target_season_id is null then
    raise exception 'La saison cible n’a pas pu être préparée.';
  end if;

  select contract.* into v_existing
  from public.rider_contracts as contract
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'planned'
    and contract.acquisition_type = 'renewal'
    and start_season.game_year = v_start_year
  order by contract.signed_at desc nulls last, contract.id
  limit 1
  for update of contract;

  if v_existing.id is not null then
    select season.game_year into v_existing_end_year
    from public.seasons as season
    where season.id = v_existing.end_season_id;

    if v_active_end_year <> v_context.game_year
      or v_existing_end_year <> v_context.game_year + 1
      or p_target_end_game_year <> v_context.game_year + 2
    then
      raise exception 'Le contrat de ce coureur est déjà prolongé.';
    end if;
  end if;

  if exists (
    select 1
    from public.rider_contracts as future
    join public.seasons as start_season
      on start_season.id = future.start_season_id
    join public.seasons as end_season
      on end_season.id = future.end_season_id
    where future.rider_id = p_rider_id
      and future.id <> v_active.id
      and (v_existing.id is null or future.id <> v_existing.id)
      and future.status in ('planned', 'active')
      and start_season.game_year <= p_target_end_game_year
      and end_season.game_year >= v_start_year
  ) then
    raise exception 'Un autre contrat couvre déjà cette période.';
  end if;

  v_base_salary := case
    when v_existing.id is not null then coalesce(
      v_existing.homegrown_salary_before_discount,
      v_existing.salary_per_season
    )
    else public.calculate_rider_season_salary(
      p_rider_id, v_next_season.id
    )
  end;

  -- Securing both S+1 and S+2 costs 25% more per season, including when a
  -- previously signed S+1 renewal is upgraded to S+2.
  v_new_salary := case
    when v_active_end_year = v_context.game_year
      and p_target_end_game_year = v_context.game_year + 2
      then round(v_base_salary * 1.25, 2)
    else v_base_salary
  end;

  if v_existing.id is not null then
    update public.rider_contracts as contract
    set end_season_id = v_target_season_id,
      salary_per_season = v_new_salary,
      signed_at = now()
    where contract.id = v_existing.id
    returning contract.id into v_contract_id;
  else
    select season.id into v_start_season_id
    from public.seasons as season
    where season.game_year = v_start_year;

    if v_start_season_id is null then
      raise exception 'La saison de début du contrat est introuvable.';
    end if;

    insert into public.rider_contracts (
      rider_id, team_id, start_season_id, end_season_id,
      salary_per_season, currency, currency_code, status,
      signed_at, acquisition_type
    ) values (
      p_rider_id, v_context.team_id, v_start_season_id, v_target_season_id,
      v_new_salary, v_active.currency, v_active.currency_code, 'planned',
      now(), 'renewal'
    )
    on conflict (rider_id, team_id, start_season_id)
    do update set
      end_season_id = excluded.end_season_id,
      salary_per_season = excluded.salary_per_season,
      currency = excluded.currency,
      currency_code = excluded.currency_code,
      status = 'planned',
      signed_at = excluded.signed_at,
      acquisition_type = 'renewal',
      left_season_id = null,
      left_day_number = null
    where rider_contracts.status = 'cancelled'
    returning id into v_contract_id;
  end if;

  if v_contract_id is null then
    raise exception 'Un autre contrat existe déjà pour cette saison.';
  end if;

  return v_contract_id;
end;
$$;

revoke all on function public.renew_current_team_rider_until(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.renew_current_team_rider_until(uuid, integer)
  to authenticated;

comment on function public.renew_current_team_rider_until(uuid, integer) is
  'Signe une prolongation jusqu à S+1 ou S+2 ; deux saisons supplémentaires majorent le salaire futur de 25 %, sans modifier le salaire courant.';

notify pgrst, 'reload schema';
commit;
