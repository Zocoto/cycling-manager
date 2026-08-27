begin;

-- A winning transfer only needs the id of the following season. The previous
-- implementation reprovisioned its complete race calendar (including every
-- stage and segment) for every awarded rider, even when that season was
-- already ready. Keep the repair path for an incomplete season, but make the
-- normal path a pair of indexed existence checks.
create or replace function public.ensure_transfer_next_season(
  p_active_season_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.seasons%rowtype;
  v_next_id uuid;
begin
  select *
  into v_current
  from public.seasons
  where id = p_active_season_id;

  if v_current is null then
    raise exception 'La saison active est introuvable.';
  end if;

  select season.id
  into v_next_id
  from public.seasons as season
  where season.game_year = v_current.game_year + 1;

  if v_next_id is not null
    and exists (
      select 1
      from public.season_days as season_day
      where season_day.season_id = v_next_id
      limit 1
    )
    and exists (
      select 1
      from public.race_editions as edition
      where edition.season_id = v_next_id
      limit 1
    )
  then
    return v_next_id;
  end if;

  if v_next_id is null then
    insert into public.seasons (
      game_year,
      name,
      starts_on,
      ends_on,
      status,
      current_day_number
    )
    values (
      v_current.game_year + 1,
      'Saison ' || (v_current.game_year + 1),
      v_current.ends_on + 1,
      v_current.ends_on + 28,
      'planned',
      1
    )
    on conflict (game_year) do nothing
    returning id into v_next_id;

    if v_next_id is null then
      select season.id
      into v_next_id
      from public.seasons as season
      where season.game_year = v_current.game_year + 1;
    end if;
  end if;

  insert into public.season_days (season_id, day_number, calendar_date, label)
  select
    v_next_id,
    day_number,
    v_current.ends_on + day_number,
    'Jour ' || day_number
  from generate_series(1, 28) as day_number
  on conflict (season_id, day_number) do update set
    calendar_date = excluded.calendar_date,
    label = excluded.label;

  if not exists (
    select 1
    from public.race_editions as edition
    where edition.season_id = v_next_id
    limit 1
  ) then
    perform public.provision_season_race_calendar(v_current.id, v_next_id);
  end if;

  return v_next_id;
end;
$$;

-- The winner is simply the highest binding bid. Selecting the best bid for
-- every team before sorting all candidates produced the same answer with an
-- unnecessary distinct/sort at the busiest minute of the market.
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
    limit 2
    for update skip locked
  loop
    select
      bid.team_id,
      bid.amount,
      bid.created_at,
      bid.id
    into v_bid
    from public.transfer_market_bids as bid
    where bid.listing_id = v_listing.id
    order by bid.amount desc, bid.created_at asc, bid.id asc, bid.team_id
    limit 1;

    if v_bid.id is not null then
      perform public.complete_transfer_listing(
        v_listing.id,
        v_bid.team_id,
        v_bid.amount
      );
    else
      update public.transfer_market_listings
      set status = 'no_bid',
        settled_at = now()
      where id = v_listing.id;

      if v_listing.listing_type = 'daily' then
        update public.riders
        set status = 'free_agent'
        where id = v_listing.rider_id;
      end if;
    end if;

    v_settled := v_settled + 1;
  end loop;

  return v_settled;
end;
$$;

create index if not exists transfer_market_open_closes_idx
  on public.transfer_market_listings (closes_at, id)
  where status = 'open';

revoke all on function public.ensure_transfer_next_season(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_transfer_next_season(uuid)
  to service_role;

revoke all on function public.settle_transfer_market() from public;
grant execute on function public.settle_transfer_market() to service_role;

notify pgrst, 'reload schema';

commit;
