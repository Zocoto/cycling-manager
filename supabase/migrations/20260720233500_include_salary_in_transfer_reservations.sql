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
  for v_listing in
    select * from public.transfer_market_listings
    where status = 'open' and closes_at <= now()
    order by closes_at, id
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

create or replace function public.place_transfer_bid(
  p_listing_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
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

  select director.id as director_id, assignment.team_id,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_context is null then raise exception 'Aucune équipe active ne correspond au DS.'; end if;

  select * into v_listing from public.transfer_market_listings
  where id = p_listing_id for update;

  if v_listing is null or v_listing.status <> 'open'
    or now() < v_listing.opens_at or now() >= v_listing.closes_at then
    raise exception 'Cette enchère n’est pas ouverte.';
  end if;
  if v_listing.seller_team_id = v_context.team_id then
    raise exception 'Vous ne pouvez pas enchérir sur votre propre coureur.';
  end if;

  select max(amount) into v_current_amount
  from public.transfer_market_bids where listing_id = v_listing.id;
  v_minimum_amount := case
    when v_current_amount is null then v_listing.minimum_bid
    else v_current_amount + greatest(500, ceil(v_current_amount * 0.02 / 100) * 100)
  end;

  if p_amount is null or p_amount < v_minimum_amount then
    raise exception 'La prochaine offre doit atteindre au moins % €.', v_minimum_amount;
  end if;

  with leaders as (
    select distinct on (bid.listing_id)
      bid.listing_id, bid.team_id,
      bid.amount + listing.salary_per_season as amount
    from public.transfer_market_bids as bid
    join public.transfer_market_listings as listing on listing.id = bid.listing_id
    where listing.status = 'open' and listing.id <> v_listing.id
    order by bid.listing_id, bid.amount desc, bid.created_at asc
  )
  select coalesce(sum(amount), 0) into v_reserved
  from leaders where team_id = v_context.team_id;

  v_available := public.get_projected_transfer_budget(v_context.team_season_id);
  if v_available - v_reserved < p_amount + v_listing.salary_per_season then
    raise exception 'Votre budget disponible ne couvre pas l’offre et la première saison de salaire.';
  end if;

  insert into public.transfer_market_bids (
    listing_id, team_id, sporting_director_id, amount
  ) values (
    v_listing.id, v_context.team_id, v_context.director_id, p_amount
  ) returning id into v_bid_id;

  return v_bid_id;
end;
$$;

revoke all on function public.settle_transfer_market() from public;
grant execute on function public.settle_transfer_market() to service_role;
revoke all on function public.place_transfer_bid(uuid, numeric) from public;
grant execute on function public.place_transfer_bid(uuid, numeric) to authenticated;

notify pgrst, 'reload schema';

commit;
