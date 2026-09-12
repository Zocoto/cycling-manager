begin;

-- Future rollovers create the next team_season from the division-closure
-- trigger. Carry consumables at that boundary, alongside equipment, so a new
-- season never starts with an empty stock by accident.
create or replace function public.carry_team_consumables_on_rollover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_game_year integer;
  v_source_season_id uuid;
begin
  select season.game_year
  into v_target_game_year
  from public.seasons as season
  where season.id = new.season_id;

  if v_target_game_year is null or v_target_game_year <= 1 then
    return new;
  end if;

  select source_season.id
  into v_source_season_id
  from public.seasons as source_season
  where source_season.game_year = v_target_game_year - 1
    and source_season.status = 'completed';

  if v_source_season_id is null then
    return new;
  end if;

  with recovered as (
    insert into public.season_rollover_item_recoveries (
      source_season_id,
      target_season_id,
      team_id,
      inventory_item_id,
      quantity,
      acquisition_source,
      acquired_at
    )
    select
      v_source_season_id,
      new.season_id,
      new.team_id,
      inventory.inventory_item_id,
      inventory.quantity,
      inventory.acquisition_source,
      inventory.acquired_at
    from public.team_item_inventory as inventory
    join public.team_seasons as source_team
      on source_team.id = inventory.team_season_id
     and source_team.team_id = new.team_id
     and source_team.season_id = v_source_season_id
    on conflict (source_season_id, target_season_id, team_id, inventory_item_id)
      do nothing
    returning inventory_item_id, quantity, acquisition_source, acquired_at
  )
  insert into public.team_item_inventory (
    team_season_id,
    inventory_item_id,
    quantity,
    acquisition_source,
    acquired_at,
    updated_at
  )
  select
    new.id,
    recovered.inventory_item_id,
    recovered.quantity,
    'Rollover consommables · ' || coalesce(recovered.acquisition_source, 'objet récupéré'),
    recovered.acquired_at,
    now()
  from recovered
  on conflict (team_season_id, inventory_item_id) do update set
    quantity = public.team_item_inventory.quantity + excluded.quantity,
    updated_at = now();

  update public.daily_reward_wildcard_reservations as reservation
  set team_season_id = new.id
  from public.daily_reward_inventory as inventory
  join public.seasons as target_season on target_season.id = new.season_id
  where reservation.source_inventory_id = inventory.id
    and reservation.status = 'reserved'
    and inventory.team_season_id in (
      select source_team.id
      from public.team_seasons as source_team
      where source_team.team_id = new.team_id
        and source_team.season_id = v_source_season_id
    )
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= target_season.game_year;

  update public.daily_reward_inventory as inventory
  set team_season_id = new.id
  from public.seasons as target_season
  where target_season.id = new.season_id
    and inventory.team_season_id in (
      select source_team.id
      from public.team_seasons as source_team
      where source_team.team_id = new.team_id
        and source_team.season_id = v_source_season_id
    )
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= target_season.game_year;

  return new;
end;
$$;

drop trigger if exists zzz_team_season_consumable_rollover on public.team_seasons;
create trigger zzz_team_season_consumable_rollover
after insert or update of status
on public.team_seasons
for each row execute function public.carry_team_consumables_on_rollover();

revoke all on function public.carry_team_consumables_on_rollover() from public, anon, authenticated;
grant execute on function public.carry_team_consumables_on_rollover() to service_role;

comment on function public.carry_team_consumables_on_rollover() is
  'Conserve les consommables génériques et récompenses encore valides lors du changement de saison.';

commit;
<<<<<<< HEAD
=======

>>>>>>> origin/main
