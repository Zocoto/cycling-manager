begin;

create or replace function private.award_night_auction_trophies(
  p_listing_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.transfer_market_listings%rowtype;
  v_participant record;
  v_trophy_id uuid;
  v_source_reference text;
  v_now timestamptz := now();
  v_awarded integer := 0;
begin
  select listing.*
  into v_listing
  from public.transfer_market_listings as listing
  where listing.id = p_listing_id;

  if not found
     or v_listing.listing_type <> 'daily'
     or v_listing.market_date is null
     or v_listing.closes_at < (
       (v_listing.market_date + time '22:00') at time zone 'Europe/Paris'
     )
     or v_now < (
       (v_listing.market_date + time '22:00') at time zone 'Europe/Paris'
     )
  then
    return 0;
  end if;

  for v_participant in
    select distinct on (bid.sporting_director_id)
      bid.sporting_director_id,
      team_season.id as team_season_id,
      greatest(
        1,
        least(28, coalesce(season.current_day_number, 1))
      )::smallint as day_number,
      season_day.id as season_day_id
    from public.transfer_market_bids as bid
    join public.sporting_directors as director
      on director.id = bid.sporting_director_id
     and director.status = 'active'
     and director.auth_user_id is not null
    join public.team_seasons as team_season
      on team_season.team_id = bid.team_id
     and team_season.season_id = v_listing.season_id
    join public.seasons as season
      on season.id = team_season.season_id
    left join public.season_days as season_day
      on season_day.season_id = season.id
     and season_day.day_number = greatest(
       1,
       least(28, coalesce(season.current_day_number, 1))
     )
    where bid.listing_id = v_listing.id
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = bid.sporting_director_id
      )
    order by
      bid.sporting_director_id,
      bid.created_at desc,
      bid.id desc
  loop
    v_trophy_id := null;

    insert into public.sporting_director_trophies (
      sporting_director_id,
      trophy_key,
      available_at,
      claimed_at
    )
    values (
      v_participant.sporting_director_id,
      'jusqu_au_bout_de_la_nuit',
      v_now,
      v_now
    )
    on conflict (sporting_director_id, trophy_key) do nothing
    returning id into v_trophy_id;

    if v_trophy_id is null then
      continue;
    end if;

    v_source_reference := 'night-auction-trophy:' || v_trophy_id::text;

    update public.sporting_directors
    set
      experience_points = experience_points + 250,
      reputation_points = reputation_points + 15
    where id = v_participant.sporting_director_id;

    update public.team_seasons
    set cash_balance = cash_balance + 50000
    where id = v_participant.team_season_id;

    insert into public.team_finance_transactions (
      team_season_id,
      season_day_id,
      day_number,
      amount,
      category,
      status,
      description,
      source_reference,
      posted_at
    )
    values (
      v_participant.team_season_id,
      v_participant.season_day_id,
      v_participant.day_number,
      50000,
      'other',
      'posted',
      'Trophée : Jusqu’au bout de la nuit',
      v_source_reference,
      v_now
    );

    insert into public.reward_events (
      source_reference,
      source_type,
      sporting_director_id,
      team_season_id,
      reputation_points,
      experience_points,
      cash_prize,
      description
    )
    values (
      v_source_reference,
      'game_objective',
      v_participant.sporting_director_id,
      v_participant.team_season_id,
      15,
      250,
      50000,
      'Trophée Jusqu’au bout de la nuit : participation à une enchère quotidienne prolongée jusqu’à 22 h'
    );

    v_awarded := v_awarded + 1;
  end loop;

  return v_awarded;
end;
$$;

create or replace function private.evaluate_night_auction_trophy_after_bid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.award_night_auction_trophies(new.listing_id);
  exception
    when others then
      raise warning
        'Attribution du trophée nocturne impossible après l’offre % : %',
        new.id,
        sqlerrm;
  end;

  return new;
end;
$$;

create trigger evaluate_night_auction_trophy_after_bid
after insert on public.transfer_market_bids
for each row
execute function private.evaluate_night_auction_trophy_after_bid();

create or replace function private.evaluate_night_auction_trophy_after_extension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold timestamptz;
begin
  if new.listing_type <> 'daily' or new.market_date is null then
    return new;
  end if;

  v_threshold :=
    (new.market_date + time '22:00') at time zone 'Europe/Paris';

  if new.closes_at < v_threshold or old.closes_at >= v_threshold then
    return new;
  end if;

  begin
    perform private.award_night_auction_trophies(new.id);
  exception
    when others then
      raise warning
        'Attribution du trophée nocturne impossible après la prolongation de l’enchère % : %',
        new.id,
        sqlerrm;
  end;

  return new;
end;
$$;

create trigger evaluate_night_auction_trophy_after_extension
after update of closes_at on public.transfer_market_listings
for each row
execute function private.evaluate_night_auction_trophy_after_extension();

create or replace function private.evaluate_night_auction_trophy_after_settlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('settled', 'no_bid')
     or old.status in ('settled', 'no_bid')
  then
    return new;
  end if;

  begin
    perform private.award_night_auction_trophies(new.id);
  exception
    when others then
      raise warning
        'Attribution du trophée nocturne impossible à la clôture de l’enchère % : %',
        new.id,
        sqlerrm;
  end;

  return new;
end;
$$;

create trigger evaluate_night_auction_trophy_after_settlement
after update of status on public.transfer_market_listings
for each row
execute function private.evaluate_night_auction_trophy_after_settlement();

create or replace function private.validate_night_auction_avatar_skin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cheek_key text;
begin
  if new.avatar_key is null
     or new.avatar_key not like 'director_custom_v1:%'
  then
    return new;
  end if;

  v_cheek_key := split_part(
    substring(
      new.avatar_key
      from char_length('director_custom_v1:') + 1
    ),
    '.',
    11
  );

  if v_cheek_key <> 'dark-circles' then
    return new;
  end if;

  if not exists (
    select 1
    from public.sporting_director_trophies as trophy
    where trophy.sporting_director_id = new.id
      and trophy.trophy_key = 'jusqu_au_bout_de_la_nuit'
      and trophy.claimed_at is not null
  ) then
    raise exception
      'Le trophée Jusqu’au bout de la nuit est requis pour porter le skin Cernes.';
  end if;

  return new;
end;
$$;

create trigger validate_night_auction_avatar_skin_before_write
before insert or update of avatar_key
on public.sporting_directors
for each row
execute function private.validate_night_auction_avatar_skin();

create or replace function private.notify_sporting_director_trophy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_kind text;
  v_detail text;
begin
  if new.claimed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.claimed_at is not null then
    return new;
  end if;

  v_title := case new.trophy_key
    when 'alpha_tester' then 'Alphatesteur'
    when 'atlas_peloton' then 'Atlas du peloton'
    when 'campus_de_pointe' then 'Campus de pointe'
    when 'alchimiste_carbone' then 'Alchimiste du carbone'
    when 'triple_couronne_integrale' then 'Triple Couronne intégrale'
    when 'virage_cache' then 'Le Virage caché'
    when 'ambulancier' then 'Ambulancier'
    when 'medecin_urgentiste' then 'Médecin urgentiste'
    when 'peloton_eternel' then 'Le Peloton éternel'
    when 'joueur_inveter' then 'Joueur invétéré'
    when 'jusqu_au_bout_de_la_nuit' then 'Jusqu’au bout de la nuit'
    else initcap(replace(new.trophy_key, '_', ' '))
  end;
  v_kind := case
    when new.trophy_key in ('ambulancier', 'medecin_urgentiste') then 'medical'
    when new.trophy_key = 'alpha_tester' then 'special'
    else 'achievement'
  end;
  v_detail := case
    when new.trophy_key = 'peloton_eternel' then
      'Récompenses remises : 5 000 000 €, 5 000 XP, 500 points de réputation et 3 objets de niveau 10.'
    when new.trophy_key = 'joueur_inveter' then
      'Récompenses remises : 50 000 €, 250 XP, 15 points de réputation et les piles de jetons pour votre avatar.'
    when new.trophy_key = 'jusqu_au_bout_de_la_nuit' then
      'Récompenses remises : 50 000 €, 250 XP, 15 points de réputation et le skin Cernes pour votre avatar.'
    else
      'Cette distinction de carrière est désormais visible dans votre galerie.'
  end;

  perform private.create_trophy_notification(
    new.sporting_director_id,
    v_kind,
    new.trophy_key,
    v_title,
    'special:' || new.id::text,
    new.claimed_at,
    null,
    null,
    v_detail
  );

  return new;
end;
$$;

-- Les enchères quotidiennes déjà prolongées jusqu’à 22 h sont récompensées
-- de manière idempotente au déploiement.
do $$
declare
  v_listing record;
begin
  for v_listing in
    select listing.id
    from public.transfer_market_listings as listing
    where listing.listing_type = 'daily'
      and listing.market_date is not null
      and listing.closes_at >= (
        (listing.market_date + time '22:00') at time zone 'Europe/Paris'
      )
      and now() >= (
        (listing.market_date + time '22:00') at time zone 'Europe/Paris'
      )
  loop
    perform private.award_night_auction_trophies(v_listing.id);
  end loop;
end;
$$;

revoke all on function private.award_night_auction_trophies(uuid)
  from public, anon, authenticated;
revoke all on function private.evaluate_night_auction_trophy_after_bid()
  from public, anon, authenticated;
revoke all on function private.evaluate_night_auction_trophy_after_extension()
  from public, anon, authenticated;
revoke all on function private.evaluate_night_auction_trophy_after_settlement()
  from public, anon, authenticated;
revoke all on function private.validate_night_auction_avatar_skin()
  from public, anon, authenticated;
revoke all on function private.notify_sporting_director_trophy()
  from public, anon, authenticated;

comment on function private.award_night_auction_trophies(uuid) is
  'Attribue une seule fois le trophée Jusqu’au bout de la nuit et ses gains à tous les DS humains ayant participé à une enchère quotidienne prolongée jusqu’à 22 h.';
comment on function private.validate_night_auction_avatar_skin() is
  'Réserve le skin Cernes aux DS ayant obtenu le trophée Jusqu’au bout de la nuit.';

notify pgrst, 'reload schema';

commit;
