begin;

-- The S2 -> S3 rollover copied equipment but omitted both consumable stores.
-- Keep a recovery ledger so this repair is safe to replay and never credits an
-- object twice if the migration is inspected or re-applied manually.
create table if not exists public.season_rollover_item_recoveries (
  source_season_id uuid not null references public.seasons(id) on delete restrict,
  target_season_id uuid not null references public.seasons(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_catalog_items(id) on delete restrict,
  quantity integer not null,
  acquisition_source text,
  acquired_at timestamptz not null,
  recovered_at timestamptz not null default now(),
  primary key (source_season_id, target_season_id, team_id, inventory_item_id),
  constraint season_rollover_item_recoveries_quantity_positive check (quantity > 0)
);

alter table public.season_rollover_item_recoveries enable row level security;
revoke all on table public.season_rollover_item_recoveries from public, anon, authenticated;
grant all privileges on table public.season_rollover_item_recoveries to service_role;

do $recover$
declare
  v_source_season_id uuid;
  v_target_season_id uuid;
begin
  select source.id, target.id
  into v_source_season_id, v_target_season_id
  from public.seasons as source
  join public.seasons as target on target.game_year = source.game_year + 1
  where source.game_year = 2
    and source.status = 'completed'
    and target.game_year = 3
    and target.status = 'active';

  if v_source_season_id is null or v_target_season_id is null then
    raise notice 'Aucun couple S2/S3 actif à réparer.';
    return;
  end if;

  -- Restore generic consumables. Existing S3 awards are kept and the missing
  -- S2 quantity is added to them.
  with candidates as (
    select
      source_team.team_id,
      inventory.inventory_item_id,
      inventory.quantity,
      inventory.acquisition_source,
      inventory.acquired_at
    from public.team_item_inventory as inventory
    join public.team_seasons as source_team
      on source_team.id = inventory.team_season_id
     and source_team.season_id = v_source_season_id
    join public.team_seasons as target_team
      on target_team.team_id = source_team.team_id
     and target_team.season_id = v_target_season_id
    where not exists (
      select 1
      from public.team_item_inventory as existing_target
      where existing_target.team_season_id = target_team.id
        and existing_target.inventory_item_id = inventory.inventory_item_id
        and existing_target.acquisition_source like 'Rollover S2 vers S3%'
    )
  ), recovered as (
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
      v_target_season_id,
      candidate.team_id,
      candidate.inventory_item_id,
      candidate.quantity,
      candidate.acquisition_source,
      candidate.acquired_at
    from candidates as candidate
    on conflict (source_season_id, target_season_id, team_id, inventory_item_id)
      do nothing
    returning team_id, inventory_item_id, quantity, acquisition_source, acquired_at
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
    target_team.id,
    recovered.inventory_item_id,
    recovered.quantity,
    'Rollover S2 vers S3 · ' || coalesce(recovered.acquisition_source, 'objet récupéré'),
    recovered.acquired_at,
    now()
  from recovered
  join public.team_seasons as target_team
    on target_team.team_id = recovered.team_id
   and target_team.season_id = v_target_season_id
  on conflict (team_season_id, inventory_item_id) do update set
    quantity = public.team_item_inventory.quantity + excluded.quantity,
    updated_at = now();

  -- Unused daily rewards explicitly valid through S3 stay usable. Used rows
  -- remain attached to S2 so historical usage is not rewritten.
  update public.daily_reward_wildcard_reservations as reservation
  set team_season_id = target_team.id
  from public.daily_reward_inventory as inventory
  join public.team_seasons as source_team
    on source_team.id = inventory.team_season_id
   and source_team.season_id = v_source_season_id
  join public.team_seasons as target_team
    on target_team.team_id = source_team.team_id
   and target_team.season_id = v_target_season_id
  join public.seasons as target_season on target_season.id = v_target_season_id
  where reservation.source_inventory_id = inventory.id
    and reservation.status = 'reserved'
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= target_season.game_year;

  update public.daily_reward_inventory as inventory
  set team_season_id = target_team.id
  from public.team_seasons as source_team
  join public.team_seasons as target_team
    on target_team.team_id = source_team.team_id
   and target_team.season_id = v_target_season_id
  join public.seasons as target_season on target_season.id = v_target_season_id
  where inventory.team_season_id = source_team.id
    and source_team.season_id = v_source_season_id
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= target_season.game_year;
end;
$recover$;

comment on table public.season_rollover_item_recoveries is
  'Journal idempotent de la restauration des consommables oubliés lors d’un rollover.';

commit;

