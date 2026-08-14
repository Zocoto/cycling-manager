begin;

-- A rider whose contract was already completed before the season status changed
-- escaped the old CTE because only rows updated by that exact statement were
-- returned. Reconcile from the final contract state instead.
create or replace function public.settle_expiring_rider_contracts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update public.rider_contracts as contract
    set status = 'completed'
    where contract.end_season_id = new.id
      and contract.status = 'active';

    update public.riders as rider
    set status = 'free_agent'
    where rider.status <> 'retired'
      and exists (
        select 1
        from public.rider_contracts as expired_contract
        where expired_contract.rider_id = rider.id
          and expired_contract.end_season_id = new.id
          and expired_contract.status = 'completed'
      )
      and not exists (
        select 1
        from public.rider_contracts as successor
        where successor.rider_id = rider.id
          and successor.status in ('active', 'planned')
      );
  end if;

  if new.status = 'active' and old.status <> 'active' then
    update public.rider_contracts as contract
    set status = 'active'
    where contract.start_season_id = new.id
      and contract.status = 'planned';

    update public.riders as rider
    set status = 'active'
    where exists (
      select 1
      from public.rider_contracts as contract
      where contract.rider_id = rider.id
        and contract.start_season_id = new.id
        and contract.status = 'active'
    );
  end if;

  return new;
end;
$$;

-- Retirement is reserved for riders who were free agents for the whole
-- completed season. A contracted rider is no longer retired merely because he
-- did not start a race, and a newly expired contract grants a full new season
-- on the free-agent market.
do $migration$
declare
  v_definition text;
  v_previous_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.archive_inactive_riders_for_season(uuid)'::regprocedure
  ) into v_definition;

  if position(
    'where rider.status <> ''retired''' in v_definition
  ) = 0 then
    raise exception
      'Le filtre historique des coureurs à archiver est introuvable.';
  end if;

  v_previous_definition := v_definition;
  v_definition := replace(
    v_definition,
    'where rider.status <> ''retired''',
    'where rider.status = ''free_agent'''
  );

  if v_definition = v_previous_definition then
    raise exception
      'Impossible de limiter la retraite aux agents libres.';
  end if;

  if position(
    'if v_has_team and v_has_race then' in v_definition
  ) = 0 then
    raise exception
      'La garde historique équipe/course est introuvable.';
  end if;

  v_previous_definition := v_definition;
  v_definition := replace(
    v_definition,
    'if v_has_team and v_has_race then',
    'if v_has_team then'
  );

  if v_definition = v_previous_definition then
    raise exception
      'Impossible de protéger les coureurs sous contrat de la retraite.';
  end if;

  execute v_definition;
end;
$migration$;

-- Repair the rollover which opened the current season. This deliberately
-- targets only riders whose previous-season contract is completed, who have a
-- current-season rating, and who have no active or planned successor contract.
do $repair$
declare
  v_active_season_id uuid;
  v_previous_season_id uuid;
  v_active_game_year integer;
begin
  select season.id, season.game_year
  into v_active_season_id, v_active_game_year
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_active_season_id is null then
    return;
  end if;

  select season.id
  into v_previous_season_id
  from public.seasons as season
  where season.game_year = v_active_game_year - 1
    and season.status = 'completed'
  limit 1;

  if v_previous_season_id is null then
    return;
  end if;

  update public.riders as rider
  set status = 'free_agent'
  where rider.status = 'active'
    and exists (
      select 1
      from public.rider_season_ratings as rating
      where rating.rider_id = rider.id
        and rating.season_id = v_active_season_id
    )
    and exists (
      select 1
      from public.rider_contracts as expired_contract
      where expired_contract.rider_id = rider.id
        and expired_contract.end_season_id = v_previous_season_id
        and expired_contract.status = 'completed'
    )
    and not exists (
      select 1
      from public.rider_contracts as successor
      where successor.rider_id = rider.id
        and successor.status in ('active', 'planned')
    );
end;
$repair$;

revoke all on function public.settle_expiring_rider_contracts()
from public, anon, authenticated;

comment on function public.settle_expiring_rider_contracts() is
  'Clôt les contrats échus et place sans exception les coureurs non prolongés parmi les agents libres.';

comment on function public.archive_inactive_riders_for_season(uuid) is
  'Archive uniquement les coureurs agents libres pendant une saison complète, jamais un coureur sous contrat sans départ en course.';

notify pgrst, 'reload schema';

commit;
