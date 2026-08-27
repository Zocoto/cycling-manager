begin;

-- PostgREST applies a short statement timeout to RPC calls. Settling the whole
-- daily market in one transaction can exceed it because every winning rider
-- also creates a contract, finance entries and salary schedules. The cron runs
-- every minute and calls this function twice, so two listings per call keeps
-- each transaction short while draining a full daily market within minutes.
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
    limit 2
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

-- Bidding must remain fast and independent from expired auctions. The cron is
-- solely responsible for settlement; this RPC only locks the selected listing,
-- records the bid and extends its current deadline atomically when appropriate.
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

-- Traceable level-8 compensation for the failed post-18:00 counterbid on
-- Yssouf Seydi. The deterministic order still selects one catalog item at
-- random-looking odds while keeping migration replays idempotent.
do $compensation$
declare
  v_listing_id constant uuid := '0411cf66-1184-4b35-ac10-db5d4d56f5aa';
  v_director_id constant uuid := 'f1437c24-ad40-44e4-b508-f08d610a3a9d';
  v_team_season_id constant uuid := '998ef037-d665-48c1-97bd-6577c5291566';
  v_listing public.transfer_market_listings%rowtype;
  v_season public.seasons%rowtype;
  v_reward record;
  v_grant_id uuid;
begin
  select *
  into v_listing
  from public.transfer_market_listings
  where id = v_listing_id
  for update;

  -- Fresh/local databases do not contain the production auction.
  if v_listing.id is null then
    return;
  end if;

  if v_listing.market_date is distinct from date '2026-08-26'
    or v_listing.status is distinct from 'settled'
  then
    raise exception 'État inattendu pour l’enchère compensée d’Alioch.';
  end if;

  select *
  into v_season
  from public.seasons
  where id = v_listing.season_id;

  if v_season.id is null
    or not exists (
      select 1
      from public.team_manager_assignments as assignment
      where assignment.sporting_director_id = v_director_id
        and assignment.team_id = (
          select team_id
          from public.team_seasons
          where id = v_team_season_id
        )
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
    )
  then
    raise exception 'Le contexte actif d’Alioch/Yukikaze est introuvable.';
  end if;

  select catalog.reward_key, catalog.name, catalog.importance
  into v_reward
  from public.daily_reward_catalog as catalog
  where catalog.is_active
    and catalog.importance = 8
  order by md5(
    catalog.reward_key || v_listing_id::text || v_director_id::text
  )
  limit 1;

  if v_reward.reward_key is null then
    raise exception 'Aucun cadeau actif de niveau 8 n’est disponible.';
  end if;

  insert into public.transfer_auction_compensation_grants (
    listing_id,
    sporting_director_id,
    reward_key,
    reason
  ) values (
    v_listing_id,
    v_director_id,
    v_reward.reward_key,
    'Compensation pour la surenchère impossible après 18 h le 26 août 2026.'
  )
  on conflict (listing_id, sporting_director_id) do nothing
  returning id into v_grant_id;

  if v_grant_id is null then
    select grant_row.id
    into v_grant_id
    from public.transfer_auction_compensation_grants as grant_row
    where grant_row.listing_id = v_listing_id
      and grant_row.sporting_director_id = v_director_id;

    select catalog.reward_key, catalog.name, catalog.importance
    into v_reward
    from public.transfer_auction_compensation_grants as grant_row
    join public.daily_reward_catalog as catalog
      on catalog.reward_key = grant_row.reward_key
    where grant_row.id = v_grant_id;
  end if;

  insert into public.daily_reward_inventory (
    sporting_director_id,
    team_season_id,
    source_claim_id,
    source_referral_reward_id,
    source_auction_compensation_id,
    reward_key,
    expires_after_game_year
  )
  select
    v_director_id,
    v_team_season_id,
    null,
    null,
    v_grant_id,
    v_reward.reward_key,
    v_season.game_year + 1
  where not exists (
    select 1
    from public.daily_reward_inventory as inventory
    where inventory.source_auction_compensation_id = v_grant_id
  );

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important
  )
  select
    v_director_id,
    v_listing.season_id,
    v_team_season_id,
    'system',
    'Direction de Cyclo Stratège',
    'Compensation · enchères du 26 août',
    'Un cadeau de niveau 8 vous a été attribué.',
    E'Une anomalie a empêché votre surenchère après 18 h malgré la prolongation en cours. Le mécanisme a été corrigé.\n\nEn compensation, vous recevez un cadeau de niveau 8 : « ' || v_reward.name || ' ». Il est disponible dans votre inventaire.',
    '/jeu/inventaire',
    'Voir mon cadeau',
    'auction-correction:' || v_listing_id::text || ':alioch',
    true
  where not exists (
    select 1
    from public.sporting_director_messages as message
    where message.source_reference =
      'auction-correction:' || v_listing_id::text || ':alioch'
  );
end;
$compensation$;

notify pgrst, 'reload schema';

commit;
