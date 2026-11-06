begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- daily_reward_inventory stores ordinary owned objects. Activated effects,
-- wildcard reservations and event-specific wallets keep their own lifecycles.
-- Keep the existing non-null integer contract so every redemption RPC and
-- dashboard expiry predicate remains compatible without extra request queries.
create or replace function private.preserve_owned_inventory_reward_lifetime()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'available' then
    new.expires_after_game_year := 2147483647;
  end if;
  return new;
end;
$$;

revoke all on function private.preserve_owned_inventory_reward_lifetime() from public, anon, authenticated;
grant execute on function private.preserve_owned_inventory_reward_lifetime() to service_role;

-- Run after the existing BEFORE INSERT equipment conversion: those traces
-- already have status='used' and must never become another physical item.
drop trigger if exists zzz_preserve_owned_inventory_reward_lifetime on public.daily_reward_inventory;
create trigger zzz_preserve_owned_inventory_reward_lifetime
before insert or update of status, expires_after_game_year
on public.daily_reward_inventory
for each row execute function private.preserve_owned_inventory_reward_lifetime();

alter table public.daily_reward_inventory
  alter column expires_after_game_year set default 2147483647;

-- Original ownership, IDs, provenance, acquisition dates and quantities remain
-- intact. This private one-time ledger records only changed rows for review.
create table if not exists private.inventory_reward_persistence_recoveries (
  inventory_id uuid primary key references public.daily_reward_inventory(id) on delete cascade,
  sporting_director_id uuid not null,
  reward_key text not null,
  previous_team_season_id uuid not null,
  target_team_season_id uuid not null,
  previous_status text not null,
  previous_expires_after_game_year integer not null,
  was_hidden boolean not null,
  recovered_at timestamptz not null default now()
);
alter table private.inventory_reward_persistence_recoveries enable row level security;
revoke all on private.inventory_reward_persistence_recoveries from public, anon, authenticated;

with candidates as materialized (
  select inventory.id, inventory.sporting_director_id, inventory.reward_key,
    inventory.team_season_id, inventory.status, inventory.expires_after_game_year,
    coalesce(target.id, inventory.team_season_id) as target_team_season_id,
    inventory.status = 'expired' or inventory.expires_after_game_year < (
      select season.game_year from public.seasons season
      where season.status = 'active' order by season.game_year desc limit 1
    ) as was_hidden
  from public.daily_reward_inventory inventory
  join public.daily_reward_catalog catalog on catalog.reward_key = inventory.reward_key
  join public.team_seasons source_team on source_team.id = inventory.team_season_id
  join public.seasons source_season on source_season.id = source_team.season_id
  left join lateral (
    select team_season.id
    from public.team_seasons team_season
    join public.seasons season on season.id = team_season.season_id
      and season.status = 'active' and season.game_year >= source_season.game_year
    where team_season.team_id = source_team.team_id
      and team_season.status in ('planned', 'active')
      and exists (
        select 1 from public.team_manager_assignments assignment
        where assignment.team_id = team_season.team_id
          and assignment.sporting_director_id = inventory.sporting_director_id
          and assignment.role = 'general_manager' and assignment.status = 'active'
      )
    order by season.game_year desc, team_season.id limit 1
  ) target on true
  where (
    inventory.status = 'available'
    or (
      inventory.status = 'expired'
      and inventory.used_at is null and inventory.usage_payload = '{}'::jsonb
      and catalog.effect_kind <> 'equipment'
      and not exists (select 1 from public.daily_reward_active_effects effect where effect.source_inventory_id = inventory.id)
      and not exists (select 1 from public.daily_reward_wildcard_reservations reservation where reservation.source_inventory_id = inventory.id)
      and not exists (select 1 from public.rider_injury_care_item_applications care where care.daily_reward_inventory_id = inventory.id)
      and not exists (select 1 from public.team_scouting_visibility_activations activation where activation.daily_reward_inventory_id = inventory.id)
    )
  ) and (
    inventory.expires_after_game_year <> 2147483647
    or inventory.status = 'expired'
    or inventory.team_season_id <> coalesce(target.id, inventory.team_season_id)
  )
  for update of inventory
), recorded as (
  insert into private.inventory_reward_persistence_recoveries (
    inventory_id, sporting_director_id, reward_key, previous_team_season_id,
    target_team_season_id, previous_status, previous_expires_after_game_year, was_hidden
  )
  select id, sporting_director_id, reward_key, team_season_id,
    target_team_season_id, status, expires_after_game_year, coalesce(was_hidden, false)
  from candidates
  on conflict (inventory_id) do nothing
  returning inventory_id
)
update public.daily_reward_inventory inventory
set expires_after_game_year = 2147483647, status = 'available',
  team_season_id = candidate.target_team_season_id
from candidates candidate join recorded on recorded.inventory_id = candidate.id
where inventory.id = candidate.id;

-- The lightweight write-time invariant also rejects future attempts to restore
-- a finite lifetime if a grant or rollover path is added without this policy.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.daily_reward_inventory'::regclass
      and conname = 'daily_reward_inventory_available_is_permanent'
  ) then
    alter table public.daily_reward_inventory
      add constraint daily_reward_inventory_available_is_permanent
      check (status <> 'available' or expires_after_game_year = 2147483647);
  end if;
end;
$$;

comment on function private.preserve_owned_inventory_reward_lifetime() is
  'Les objets possédés et non utilisés sont conservés sans expiration de saison ; aucun effet activé ni objet consommé n’est recrédité.';
comment on column public.daily_reward_inventory.expires_after_game_year is
  'Compatibilité des RPC historiques : 2147483647 pour tout objet disponible, conservé entre les saisons.';

commit;
