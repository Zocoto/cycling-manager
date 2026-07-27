begin;

create or replace function public.get_team_roster_commitment_count(
  p_team_id uuid,
  p_game_year integer
)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with contract_slots as (
    select
      'contract:' || contract.rider_id::text as slot_key
    from public.rider_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    where contract.team_id = p_team_id
      and contract.status in ('active', 'planned')
      and p_game_year between start_season.game_year and end_season.game_year
    group by contract.rider_id
  ),
  youth_slots as (
    select
      'youth:' || academy.id::text as slot_key
    from public.youth_academy_riders as academy
    where academy.team_id = p_team_id
      and academy.status = 'recruited'
      and academy.promotion_game_year = p_game_year
  ),
  listing_leaders as (
    select distinct on (listing.id)
      listing.id as listing_id,
      listing.season_id,
      bid.team_id
    from public.transfer_market_listings as listing
    join public.transfer_market_bids as bid
      on bid.listing_id = listing.id
    where listing.status = 'open'
    order by
      listing.id,
      bid.amount desc,
      bid.created_at asc,
      bid.id asc
  ),
  transfer_slots as (
    select
      'transfer:' || leader.listing_id::text as slot_key
    from listing_leaders as leader
    join public.seasons as listing_season
      on listing_season.id = leader.season_id
    where leader.team_id = p_team_id
      and p_game_year between
        listing_season.game_year and listing_season.game_year + 1
  )
  select count(*)::integer
  from (
    select slot_key from contract_slots
    union all
    select slot_key from youth_slots
    union all
    select slot_key from transfer_slots
  ) as commitments;
$$;

comment on function public.get_team_roster_commitment_count(uuid, integer) is
  'Compte les places d’effectif engagées pour une équipe et une saison : contrats, promotions juniors et enchères menées.';

revoke all
on function public.get_team_roster_commitment_count(uuid, integer)
from public, anon, authenticated;

grant execute
on function public.get_team_roster_commitment_count(uuid, integer)
to service_role;

create or replace function public.enforce_team_roster_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_game_year integer;
  v_end_game_year integer;
  v_game_year integer;
  v_commitment_count integer;
  v_replaced_commitment integer;
begin
  if new.status not in ('active', 'planned') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('team-roster:' || new.team_id::text, 0)
  );

  select season.game_year
  into v_start_game_year
  from public.seasons as season
  where season.id = new.start_season_id;

  select season.game_year
  into v_end_game_year
  from public.seasons as season
  where season.id = new.end_season_id;

  if v_start_game_year is null or v_end_game_year is null then
    raise exception 'Les saisons du contrat coureur sont invalides.';
  end if;

  for v_game_year in v_start_game_year..v_end_game_year loop
    v_commitment_count := public.get_team_roster_commitment_count(
      new.team_id,
      v_game_year
    );
    v_replaced_commitment := 0;

    if new.acquisition_type = 'academy'
      and exists (
        select 1
        from public.youth_academy_riders as academy
        where academy.team_id = new.team_id
          and academy.status = 'recruited'
          and academy.promotion_game_year = v_game_year
      ) then
      v_replaced_commitment := 1;
    elsif new.acquisition_type in ('daily_auction', 'director_auction')
      and exists (
        select 1
        from public.transfer_market_listings as listing
        join public.seasons as listing_season
          on listing_season.id = listing.season_id
        join lateral (
          select bid.team_id
          from public.transfer_market_bids as bid
          where bid.listing_id = listing.id
          order by bid.amount desc, bid.created_at asc, bid.id asc
          limit 1
        ) as leader on leader.team_id = new.team_id
        where listing.rider_id = new.rider_id
          and listing.status = 'open'
          and v_game_year between
            listing_season.game_year and listing_season.game_year + 1
      ) then
      v_replaced_commitment := 1;
    end if;

    if v_commitment_count - v_replaced_commitment > 35 then
      raise exception
        'L’effectif professionnel est limité à 35 coureurs pour la saison %.',
        v_game_year
        using
          errcode = '23514',
          hint = 'Libérez une place avant de recruter un nouveau coureur.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists enforce_team_roster_capacity_after_write
on public.rider_contracts;

create trigger enforce_team_roster_capacity_after_write
after insert or update of
  rider_id,
  team_id,
  start_season_id,
  end_season_id,
  status,
  acquisition_type
on public.rider_contracts
for each row
execute function public.enforce_team_roster_capacity();

create or replace function public.enforce_youth_promotion_roster_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_commitment integer := 0;
  v_commitment_count integer;
begin
  if new.status <> 'recruited' or new.promotion_game_year is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('team-roster:' || new.team_id::text, 0)
  );

  if tg_op = 'UPDATE'
    and old.status = 'recruited'
    and old.team_id = new.team_id
    and old.promotion_game_year = new.promotion_game_year then
    v_existing_commitment := 1;
  end if;

  v_commitment_count := public.get_team_roster_commitment_count(
    new.team_id,
    new.promotion_game_year
  );

  if v_commitment_count - v_existing_commitment >= 35 then
    raise exception
      'L’effectif professionnel est limité à 35 coureurs pour la saison %.',
      new.promotion_game_year
      using
        errcode = '23514',
        hint = 'Libérez une place avant de programmer cette promotion.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_youth_promotion_roster_capacity_before_write
on public.youth_academy_riders;

create trigger enforce_youth_promotion_roster_capacity_before_write
before insert or update of
  team_id,
  status,
  promotion_game_year
on public.youth_academy_riders
for each row
execute function public.enforce_youth_promotion_roster_capacity();

create or replace function public.enforce_transfer_bid_roster_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing record;
  v_current_leader_team_id uuid;
  v_existing_reservation integer := 0;
  v_game_year integer;
  v_commitment_count integer;
begin
  select
    listing.status,
    season.game_year
  into v_listing
  from public.transfer_market_listings as listing
  join public.seasons as season
    on season.id = listing.season_id
  where listing.id = new.listing_id;

  if not found or v_listing.status <> 'open' then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('team-roster:' || new.team_id::text, 0)
  );

  select bid.team_id
  into v_current_leader_team_id
  from public.transfer_market_bids as bid
  where bid.listing_id = new.listing_id
  order by bid.amount desc, bid.created_at asc, bid.id asc
  limit 1;

  if v_current_leader_team_id = new.team_id then
    v_existing_reservation := 1;
  end if;

  for v_game_year in v_listing.game_year..(v_listing.game_year + 1) loop
    v_commitment_count := public.get_team_roster_commitment_count(
      new.team_id,
      v_game_year
    );

    if v_commitment_count - v_existing_reservation >= 35 then
      raise exception
        'L’effectif professionnel est limité à 35 coureurs pour la saison %.',
        v_game_year
        using
          errcode = '23514',
          hint = 'Libérez une place avant de mener une nouvelle enchère.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists enforce_transfer_bid_roster_capacity_before_insert
on public.transfer_market_bids;

create trigger enforce_transfer_bid_roster_capacity_before_insert
before insert
on public.transfer_market_bids
for each row
execute function public.enforce_transfer_bid_roster_capacity();

comment on function public.enforce_team_roster_capacity() is
  'Empêche tout contrat faisant dépasser 35 engagements d’effectif sur une saison.';

comment on function public.enforce_youth_promotion_roster_capacity() is
  'Réserve une place d’effectif dès qu’une promotion junior est programmée.';

comment on function public.enforce_transfer_bid_roster_capacity() is
  'Réserve une place d’effectif à l’équipe qui prend la tête d’une enchère.';

revoke all on function public.enforce_team_roster_capacity()
from public, anon, authenticated;

revoke all on function public.enforce_youth_promotion_roster_capacity()
from public, anon, authenticated;

revoke all on function public.enforce_transfer_bid_roster_capacity()
from public, anon, authenticated;

commit;
