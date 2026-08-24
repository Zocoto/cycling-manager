begin;

-- A bid accepted by the database is binding. Later expenses must not silently
-- hand the rider to a lower bidder when the auction is settled.
create or replace function public.settle_transfer_market()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.transfer_market_listings%rowtype;
  v_bid record;
  v_settled integer := 0;
  v_has_winner boolean;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('settle_transfer_market', 0)) then
    return 0;
  end if;

  for v_listing in
    select *
    from public.transfer_market_listings
    where status = 'open'
      and closes_at <= now()
    order by closes_at, id
    limit 20
    for update skip locked
  loop
    v_has_winner := false;

    for v_bid in
      select candidate.*
      from (
        select distinct on (bid.team_id)
          bid.team_id,
          bid.amount,
          bid.created_at,
          bid.id
        from public.transfer_market_bids as bid
        where bid.listing_id = v_listing.id
        order by bid.team_id, bid.amount desc, bid.created_at asc, bid.id asc
      ) as candidate
      order by candidate.amount desc, candidate.created_at asc,
        candidate.id asc, candidate.team_id
      limit 1
    loop
      perform public.complete_transfer_listing(
        v_listing.id,
        v_bid.team_id,
        v_bid.amount
      );
      v_has_winner := true;
      v_settled := v_settled + 1;
    end loop;

    if not v_has_winner then
      update public.transfer_market_listings
      set status = 'no_bid',
        settled_at = now()
      where id = v_listing.id;

      if v_listing.listing_type = 'daily' then
        update public.riders
        set status = 'free_agent'
        where id = v_listing.rider_id;
      end if;

      v_settled := v_settled + 1;
    end if;
  end loop;

  return v_settled;
end;
$$;

-- Every accepted bid in the final ten minutes adds thirty minutes to the
-- current deadline. The same rule therefore applies again near the new close.
create or replace function public.place_transfer_bid(
  p_listing_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_listing public.transfer_market_listings%rowtype;
  v_current_amount numeric;
  v_minimum_amount numeric;
  v_reserved numeric;
  v_available numeric;
  v_bid_id uuid;
begin
  perform public.settle_transfer_market();

  select
    director.id as director_id,
    assignment.team_id,
    team_season.id as team_season_id,
    team_season.cash_balance
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au DS.';
  end if;

  select *
  into v_listing
  from public.transfer_market_listings
  where id = p_listing_id
  for update;

  if v_listing is null
    or v_listing.status <> 'open'
    or now() < v_listing.opens_at
    or now() >= v_listing.closes_at
  then
    raise exception 'Cette enchère n’est pas ouverte.';
  end if;

  if v_listing.seller_team_id = v_context.team_id then
    raise exception 'Vous ne pouvez pas enchérir sur votre propre coureur.';
  end if;

  select max(amount)
  into v_current_amount
  from public.transfer_market_bids
  where listing_id = v_listing.id;

  v_minimum_amount := case
    when v_current_amount is null then v_listing.minimum_bid
    else v_current_amount
      + greatest(500, ceil(v_current_amount * 0.02 / 100) * 100)
  end;

  if p_amount is null or p_amount < v_minimum_amount then
    raise exception 'La prochaine offre doit atteindre au moins % €.', v_minimum_amount;
  end if;

  v_reserved := public.get_team_transfer_reserved_budget(
    v_context.team_id,
    null,
    v_listing.id
  );
  v_available := v_context.cash_balance;

  if v_available - v_reserved < p_amount then
    raise exception 'Votre trésorerie disponible ne couvre pas cette offre.';
  end if;

  insert into public.transfer_market_bids (
    listing_id,
    team_id,
    sporting_director_id,
    amount
  ) values (
    v_listing.id,
    v_context.team_id,
    v_context.director_id,
    p_amount
  )
  returning id into v_bid_id;

  if v_listing.closes_at - now() < interval '10 minutes' then
    update public.transfer_market_listings
    set closes_at = closes_at + interval '30 minutes'
    where id = v_listing.id;
  end if;

  return v_bid_id;
end;
$$;

revoke all on function public.settle_transfer_market() from public;
grant execute on function public.settle_transfer_market() to service_role;
revoke all on function public.place_transfer_bid(uuid, numeric) from public;
grant execute on function public.place_transfer_bid(uuid, numeric) to authenticated;

notify pgrst, 'reload schema';

commit;
