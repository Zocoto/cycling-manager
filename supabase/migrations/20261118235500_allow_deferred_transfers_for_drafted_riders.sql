begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

do $preflight$
begin
  if md5(replace(pg_get_functiondef('public.guard_season_draft_resale()'::regprocedure), chr(13), ''))
    <> 'ebd50e2e2f8c0d2bcb3b7314b3093641' then
    raise exception 'Draft resale guard has changed; review is required.';
  end if;
end;
$preflight$;

create or replace function public.guard_season_draft_resale()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_draft_team_id uuid;
  v_season_id uuid;
  v_game_year integer;
begin
  select p.team_id, s.id, s.game_year into v_draft_team_id, v_season_id, v_game_year
  from public.season_draft_participants p
  join public.season_draft_editions e on e.id = p.edition_id
  join public.seasons s on s.id = e.season_id and s.status = 'active'
  where p.selected_rider_id = new.rider_id and p.status = 'picked'
  limit 1;
  if not found then return new; end if;

  if tg_table_name = 'transfer_market_listings' then
    if new.status = 'open' then
      raise exception 'Un coureur drafté ne peut pas être revendu pendant cette saison.' using errcode = '23514';
    end if;
  elsif new.status in ('active', 'planned') and new.team_id <> v_draft_team_id then
    -- A deferred signing replaces the future commitment. The drafted rider
    -- remains at the drafting club until the active season ends.
    if tg_op = 'INSERT' and new.status = 'planned' and new.acquisition_type = 'direct_offer'
      and new.end_season_id = new.start_season_id and new.transfer_locked_season_id = new.start_season_id
      and exists (
        select 1 from public.seasons next_season
        where next_season.id = new.start_season_id and next_season.status = 'planned'
          and next_season.game_year = v_game_year + 1
      ) and exists (
        select 1 from public.direct_transfer_offers offer
        where offer.status = 'pending' and offer.season_id = v_season_id
          and offer.effective_season_id = new.start_season_id
          and ((offer.rider_id = new.rider_id and offer.seller_team_id = v_draft_team_id
            and offer.buyer_team_id = new.team_id)
          or (offer.offered_rider_id = new.rider_id and offer.buyer_team_id = v_draft_team_id
            and offer.seller_team_id = new.team_id))
      ) then return new; end if;

    raise exception 'Un coureur drafté ne peut pas changer d’équipe pendant cette saison.' using errcode = '23514';
  end if;
  return new;
end;
$$;

commit;
