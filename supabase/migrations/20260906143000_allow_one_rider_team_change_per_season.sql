begin;

-- A free-agent signing is the rider's first team of the season, not a transfer.
-- The lock is only retained once the rider moves from one team to another.
update public.rider_contracts as contract
set transfer_locked_season_id = case
  when exists (
    select 1
    from public.rider_contracts as previous_contract
    join public.seasons as previous_start
      on previous_start.id = previous_contract.start_season_id
    join public.seasons as previous_end
      on previous_end.id = previous_contract.end_season_id
    where previous_contract.rider_id = contract.rider_id
      and previous_contract.id <> contract.id
      and previous_contract.team_id <> contract.team_id
      and previous_contract.status in ('active', 'terminated', 'completed')
      and active_season.game_year between
        previous_start.game_year and previous_end.game_year
  ) then active_season.id
  else null
end
from public.seasons as active_season
where active_season.status = 'active'
  and contract.status = 'active'
  and contract.transfer_locked_season_id = active_season.id
  and contract.acquisition_type in ('daily_auction', 'free_agent');

create index if not exists rider_contracts_team_change_lock_idx
  on public.rider_contracts (transfer_locked_season_id, rider_id)
  where transfer_locked_season_id is not null;

create or replace function private.enforce_rider_team_change_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_team_count integer := 0;
  v_already_changed_team boolean := false;
  v_has_previous_other_team boolean := false;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select
    count(distinct previous_contract.team_id)::integer,
    coalesce(
      bool_or(
        previous_contract.transfer_locked_season_id = new.start_season_id
      ),
      false
    ),
    coalesce(bool_or(previous_contract.team_id <> new.team_id), false)
  into
    v_previous_team_count,
    v_already_changed_team,
    v_has_previous_other_team
  from public.rider_contracts as previous_contract
  join public.seasons as previous_start
    on previous_start.id = previous_contract.start_season_id
  join public.seasons as previous_end
    on previous_end.id = previous_contract.end_season_id
  join public.seasons as contract_start
    on contract_start.id = new.start_season_id
  where previous_contract.rider_id = new.rider_id
    and previous_contract.status in ('active', 'terminated', 'completed')
    and contract_start.game_year between
      previous_start.game_year and previous_end.game_year;

  if v_already_changed_team or v_previous_team_count >= 2 then
    raise exception
      'Transfert impossible : ce coureur a déjà changé d’équipe cette saison.';
  end if;

  if new.acquisition_type in (
    'daily_auction',
    'director_auction',
    'free_agent',
    'direct_offer'
  ) then
    new.transfer_locked_season_id := case
      when v_has_previous_other_team then new.start_season_id
      else null
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists rider_contracts_team_change_limit
  on public.rider_contracts;
create trigger rider_contracts_team_change_limit
before insert on public.rider_contracts
for each row
execute function private.enforce_rider_team_change_limit();

comment on function private.enforce_rider_team_change_limit() is
  'Autorise au maximum un changement et deux équipes différentes par coureur et par saison ; le statut d’agent libre ne compte pas comme une équipe.';

comment on column public.rider_contracts.transfer_locked_season_id is
  'Saison pendant laquelle le coureur a déjà effectué son unique changement d’équipe autorisé.';

notify pgrst, 'reload schema';

commit;
