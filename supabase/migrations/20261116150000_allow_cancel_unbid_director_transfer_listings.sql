alter table public.transfer_market_listings
  add column has_received_bid boolean not null default false;

create function private.record_director_transfer_listing_bid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.transfer_market_listings
  set has_received_bid = true
  where id = new.listing_id
    and listing_type = 'director'
    and not has_received_bid;

  return new;
end;
$$;

revoke all on function private.record_director_transfer_listing_bid()
  from public, anon, authenticated, service_role;

create trigger record_director_transfer_listing_bid_after_insert
after insert on public.transfer_market_bids
for each row execute function private.record_director_transfer_listing_bid();

-- Preserve currently known first bids even if a bidder's account is removed.
update public.transfer_market_listings as listing
set has_received_bid = true
where listing.listing_type = 'director'
  and listing.status = 'open'
  and exists (
    select 1
    from public.transfer_market_bids as bid
    where bid.listing_id = listing.id
  );

create or replace function public.cancel_director_transfer_listing(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.transfer_market_listings%rowtype;
  v_cancelled_at timestamptz;
begin
  select listing.*
  into v_listing
  from public.transfer_market_listings as listing
  where listing.id = p_listing_id
    and listing.listing_type = 'director'
    and exists (
      select 1
      from public.team_manager_assignments as assignment
      join public.sporting_directors as director
        on director.id = assignment.sporting_director_id
      join public.seasons as season
        on season.id = listing.season_id
       and season.status = 'active'
      where assignment.team_id = listing.seller_team_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
        and director.auth_user_id = auth.uid()
        and director.status = 'active'
    )
  for update of listing;

  if not found then
    raise exception 'Cette mise en vente n’est pas accessible à votre équipe.';
  end if;

  v_cancelled_at := clock_timestamp();
  if v_listing.status <> 'open'
    or v_cancelled_at < v_listing.opens_at
    or v_cancelled_at >= v_listing.closes_at
  then
    raise exception 'Cette mise en vente n’est plus ouverte.';
  end if;

  -- The bid RPC takes this same row lock before writing any bid. Checking for
  -- bids in a separate statement sees a bid committed while we waited.
  if v_listing.has_received_bid or exists (
    select 1
    from public.transfer_market_bids
    where listing_id = v_listing.id
  ) then
    raise exception 'Une offre a déjà été déposée. La mise en vente ne peut plus être annulée.';
  end if;

  update public.transfer_market_listings
  set status = 'cancelled',
      settled_at = v_cancelled_at
  where id = v_listing.id;

  return v_listing.rider_id;
end;
$$;

revoke all on function public.cancel_director_transfer_listing(uuid) from public, anon, service_role;
grant execute on function public.cancel_director_transfer_listing(uuid) to authenticated;

notify pgrst, 'reload schema';
