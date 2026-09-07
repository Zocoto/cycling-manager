-- Replace blk14's weakest open S3 proposal with the eligible national sponsor
-- Kyrgyz Highlands. The operation is deliberately narrow and idempotent.

begin;

do $$
declare
  v_director record;
  v_active_season record;
  v_target_season record;
  v_sponsor record;
  v_target_offer record;
  v_open_offer_count integer;
begin
  select director.id, director.reputation_points
  into v_director
  from public.sporting_directors as director
  where lower(btrim(director.username)) = 'blk14'
    and director.status = 'active';

  if not found then
    raise exception 'Active sporting director blk14 was not found.';
  end if;

  if v_director.reputation_points < 15 then
    raise exception
      'blk14 is no longer eligible for Kyrgyz Highlands (reputation=%).',
      v_director.reputation_points;
  end if;

  select season.id, season.game_year
  into v_active_season
  from public.seasons as season
  where season.status = 'active';

  if not found then
    raise exception 'No active season was found.';
  end if;

  select season.id, season.game_year
  into v_target_season
  from public.seasons as season
  where season.status = 'planned'
    and season.game_year = v_active_season.game_year + 1;

  if not found then
    raise exception 'The next planned season was not found.';
  end if;

  select sponsor.id, sponsor.name
  into v_sponsor
  from public.sponsors as sponsor
  where sponsor.catalog_key = 'kyrgyz-highlands'
    and sponsor.status = 'active';

  if not found then
    raise exception 'Active sponsor Kyrgyz Highlands was not found.';
  end if;

  -- A previous successful application must remain a no-op.
  if exists (
    select 1
    from public.sponsor_offers as offer
    where offer.sporting_director_id = v_director.id
      and offer.season_id = v_target_season.id
      and offer.sponsor_id = v_sponsor.id
      and offer.status in ('draft', 'open', 'accepted')
  ) then
    return;
  end if;

  -- Sponsors cannot be offered to two teams for the same season.
  if exists (
    select 1
    from public.sponsor_offers as offer
    where offer.season_id = v_target_season.id
      and offer.sponsor_id = v_sponsor.id
      and offer.status in ('draft', 'open', 'accepted')
  ) then
    raise exception 'Kyrgyz Highlands is already reserved for season %.',
      v_target_season.game_year;
  end if;

  select count(*)
  into v_open_offer_count
  from public.sponsor_offers as offer
  where offer.sporting_director_id = v_director.id
    and offer.season_id = v_target_season.id
    and offer.status in ('draft', 'open');

  if v_open_offer_count <> 3 then
    raise exception
      'Expected exactly three replaceable offers for blk14, found %.',
      v_open_offer_count;
  end if;

  select offer.id, offer.title, offer.budget_per_season
  into v_target_offer
  from public.sponsor_offers as offer
  where offer.sporting_director_id = v_director.id
    and offer.season_id = v_target_season.id
    and offer.status in ('draft', 'open')
  order by offer.budget_per_season, offer.created_at, offer.id
  limit 1
  for update;

  -- Objectives are sponsor-specific and will be rebuilt by the normal loader.
  delete from public.sponsor_objectives
  where sponsor_offer_id = v_target_offer.id;

  update public.sponsor_offers
  set sponsor_id = v_sponsor.id,
      title = 'Proposition de Kyrgyz Highlands',
      description =
        'Une destination kirghize qui organise des voyages entre lacs d’altitude, pâturages, yourtes et grands cols des massifs d’Asie centrale.',
      budget_per_season = 540000,
      base_budget_per_season = 540000,
      negotiation_budget_ceiling = 680000,
      objective_difficulty = 'balanced',
      contract_duration_seasons = 2,
      available_from = now(),
      available_until = null,
      status = 'open',
      generation_version = greatest(generation_version, 8)
  where id = v_target_offer.id;

  if not found then
    raise exception 'The selected blk14 offer could not be updated.';
  end if;
end;
$$;

commit;
