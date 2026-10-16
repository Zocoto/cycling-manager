begin;
set local application_name='query-performance-delivery-20261016';
set local lock_timeout = '3s';
set local statement_timeout = '10s';

-- A team can lead only a listing on which it has bid. Prune unrelated listings
-- before ranking, but retain EVERY competing bid on each candidate listing.
-- Filtering bid.team_id before DISTINCT ON would incorrectly turn losing bids
-- into commitments. Preserve the existing amount/date/id tie-break verbatim.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_team_roster_commitment_count(uuid,integer)'::regprocedure;
  v_definition text;
  v_body text;
  v_expected_body constant text := $expected$
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
    select slot_key from transfer_slots
  ) as commitments;
$expected$;
  v_anchor constant text := $anchor$
    where listing.status = 'open'
    order by
$anchor$;
  v_replacement constant text := $replacement$
    where listing.status = 'open'
      and exists (
        select 1
        from public.transfer_market_bids as team_bid
        where team_bid.listing_id = listing.id
          and team_bid.team_id = p_team_id
      )
      and exists (
        select 1
        from public.seasons as candidate_season
        where candidate_season.id = listing.season_id
          and p_game_year between
            candidate_season.game_year and candidate_season.game_year + 1
      )
    order by
$replacement$;
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), ''),
    btrim(replace(procedure.prosrc, chr(13), ''))
  into v_definition, v_body
  from pg_catalog.pg_proc as procedure
  where procedure.oid = v_signature;

  if v_body is distinct from btrim(v_expected_body) then
    raise exception 'Unexpected roster commitment source; migration aborted.';
  end if;

  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

commit;
