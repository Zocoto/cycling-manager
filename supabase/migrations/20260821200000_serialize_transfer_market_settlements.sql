begin;

create or replace function public.settle_transfer_market()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.transfer_market_listings%rowtype;
  v_bid record;
  v_team_season_id uuid;
  v_available numeric;
  v_settled integer := 0;
  v_has_winner boolean;
begin
  -- Page loads, bids and the maintenance cron can arrive together. Only one
  -- settlement worker may mutate auctions at a time.
  if not pg_try_advisory_xact_lock(hashtextextended('settle_transfer_market', 0)) then
    return 0;
  end if;

  for v_listing in
    select * from public.transfer_market_listings
    where status = 'open' and closes_at <= now()
    order by closes_at, id
    limit 20
    for update skip locked
  loop
    v_has_winner := false;

    for v_bid in
      select candidate.* from (
        select distinct on (bid.team_id)
          bid.team_id, bid.amount, bid.created_at
        from public.transfer_market_bids as bid
        where bid.listing_id = v_listing.id
        order by bid.team_id, bid.amount desc, bid.created_at asc
      ) as candidate
      order by candidate.amount desc, candidate.created_at asc, candidate.team_id
    loop
      select id into v_team_season_id
      from public.team_seasons
      where team_id = v_bid.team_id and season_id = v_listing.season_id
      for update;

      v_available := public.get_projected_transfer_budget(v_team_season_id);
      if v_team_season_id is not null
        and v_available >= v_bid.amount + v_listing.salary_per_season then
        perform public.complete_transfer_listing(
          v_listing.id, v_bid.team_id, v_bid.amount
        );
        v_has_winner := true;
        v_settled := v_settled + 1;
        exit;
      end if;
    end loop;

    if not v_has_winner then
      update public.transfer_market_listings set
        status = 'no_bid', settled_at = now()
      where id = v_listing.id;

      if v_listing.listing_type = 'daily' then
        update public.riders set status = 'free_agent'
        where id = v_listing.rider_id;
      end if;
      v_settled := v_settled + 1;
    end if;
  end loop;

  return v_settled;
end;
$$;

revoke all on function public.settle_transfer_market() from public;
grant execute on function public.settle_transfer_market() to service_role;

notify pgrst, 'reload schema';

commit;
