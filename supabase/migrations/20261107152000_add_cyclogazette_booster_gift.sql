begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- The gift belongs to issue 114 (S5 day 2), including when it is archived.
-- Publication can happen after this migration. No booster is granted on read.
create function private.cyclogazette_booster_gift_collection(p_edition_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select collection.id
  from public.cyclogazette_editions issue
  join public.season_days issue_day on issue_day.id = issue.season_day_id
    and issue_day.season_id = issue.season_id
  join public.seasons collection on collection.id = issue.season_id
  join public.cyclo_stickers_editions album on album.collection_season_id = collection.id
  join public.seasons source on source.id = album.source_season_id
  where issue.id = p_edition_id
    and issue.issue_number = 114
    and issue.issue_date = date '2026-11-07'
    and issue_day.day_number = 2
    and issue_day.calendar_date = issue.issue_date
    and issue.published_at <= now()
    and collection.game_year = 5
    and source.game_year = collection.game_year - 1
    and source.status = 'completed'
    and album.configuration ->> 'enabled' = 'true'
    and album.configuration ->> 'publicApproved' = 'true'
    and exists (
      select 1 from public.seasons active
      where active.status = 'active' and active.game_year >= collection.game_year
    );
$$;

create function public.get_current_cyclogazette_booster_gift(p_edition_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_director uuid := private.current_cyclo_stickers_director();
begin
  if private.cyclogazette_booster_gift_collection(p_edition_id) is null then
    return null;
  end if;

  if exists (
    select 1 from public.cyclo_stickers_boosters pack
    where pack.sporting_director_id = v_director
      and pack.acquisition_source = 'gazette'
      and pack.source_reference = p_edition_id::text
  ) then
    return 'claimed';
  end if;

  return 'available';
end;
$$;

create function public.claim_current_cyclogazette_booster_gift(p_edition_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director uuid := private.current_cyclo_stickers_director();
  v_collection uuid := private.cyclogazette_booster_gift_collection(p_edition_id);
begin
  if v_collection is null then
    raise exception 'Ce numéro ne propose pas de booster de Cyclo-Stickers disponible.';
  end if;

  -- The existing unique key makes retries and simultaneous claims idempotent.
  -- The original row remains the receipt even after opening the pack.
  insert into public.cyclo_stickers_boosters (
    sporting_director_id, collection_season_id, acquisition_source, source_reference, awarded_on
  ) values (
    v_director, v_collection, 'gazette', p_edition_id::text, (now() at time zone 'Europe/Paris')::date
  )
  on conflict (sporting_director_id, acquisition_source, source_reference) do nothing;

  return 'claimed';
end;
$$;

revoke all on function private.cyclogazette_booster_gift_collection(uuid) from public, anon, authenticated;
revoke all on function public.get_current_cyclogazette_booster_gift(uuid),
  public.claim_current_cyclogazette_booster_gift(uuid) from public, anon, authenticated;
grant execute on function public.get_current_cyclogazette_booster_gift(uuid),
  public.claim_current_cyclogazette_booster_gift(uuid) to authenticated;

-- Keep the inventory discriminator for opening packs. Expose the acquisition
-- source separately so the album can label packs from the Gazette.
create or replace function private.cyclo_stickers_state(p_edition text,p_director uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'edition',jsonb_build_object('id',e.edition_id,'sourceSeason',s.game_year,'collectionSeason',c.game_year,
      'sourceSeasonId',e.source_season_id,'collectionSeasonId',e.collection_season_id,'enabled',true,'odds',e.configuration->'odds','achievements',e.configuration->'achievements'),
    'directorId',p_director,
    'owner',jsonb_build_object('directorId',p_director,'displayName',(select display_name from public.sporting_directors where id=p_director)),
    'owned',coalesce((select jsonb_agg(jsonb_build_object('cardNumber',i.card_number,'quantity',i.quantity,'pasted',i.pasted,
      'reserved',coalesce((select count(*) from public.cyclo_stickers_trade_offers o cross join lateral unnest(o.give_cards) n
        where o.edition_id=p_edition and o.from_director_id=p_director and o.status='pending' and o.expires_at>now() and n=i.card_number),0)) order by i.card_number)
      from public.cyclo_stickers_card_inventory i where i.edition_id=p_edition and i.sporting_director_id=p_director and i.quantity>0),'[]'::jsonb),
    'boosterCount',(select count(*) from public.cyclo_stickers_booster_inventory b where b.sporting_director_id=p_director and b.collection_season_id=e.collection_season_id and b.source_season_id=e.source_season_id and b.opened_at is null),
    'boosters',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'inventorySource',b.inventory_source,'acquisitionSource',b.acquisition_source,'acquiredAt',b.acquired_at,
      'openedAt',b.opened_at,'collectionSeasonId',b.collection_season_id,'sourceSeasonId',b.source_season_id) order by b.acquired_at,b.inventory_source,b.id)
      from (select * from public.cyclo_stickers_booster_inventory b where b.sporting_director_id=p_director and b.collection_season_id=e.collection_season_id
        and b.source_season_id=e.source_season_id and b.opened_at is null order by b.acquired_at,b.inventory_source,b.id limit 100) b),'[]'::jsonb),
    'totalOpenedCount',(select count(*) from public.cyclo_stickers_openings where edition_id=p_edition and sporting_director_id=p_director),
    'openedPacks',coalesce((select jsonb_agg(jsonb_build_object('id',o.booster_id,'inventorySource',o.inventory_source,'cards',o.card_numbers) order by o.opened_at desc,o.booster_id)
      from (select * from public.cyclo_stickers_openings where edition_id=p_edition and sporting_director_id=p_director order by opened_at desc,booster_id limit 10) o),'[]'::jsonb),
    'claimedAchievements',coalesce((select jsonb_agg(achievement_id order by achievement_id) from public.cyclo_stickers_achievement_claims where edition_id=p_edition and sporting_director_id=p_director),'[]'::jsonb),
    'acceptedTradeCount',coalesce((select accepted_trade_count from public.cyclo_stickers_collections where edition_id=p_edition and sporting_director_id=p_director),0),
    'outgoingOffers',coalesce((select jsonb_agg(private.cyclo_stickers_trade_json(o) order by o.created_at desc) from public.cyclo_stickers_trade_offers o
      where o.edition_id=p_edition and o.from_director_id=p_director and o.status='pending' and o.expires_at>now()),'[]'::jsonb),
    'incomingOffers',coalesce((select jsonb_agg(private.cyclo_stickers_trade_json(o) order by o.created_at desc) from public.cyclo_stickers_trade_offers o
      where o.edition_id=p_edition and o.to_director_id=p_director and o.status='pending' and o.expires_at>now()),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(private.cyclo_stickers_trade_json(o) order by o.created_at desc) from
      (select * from public.cyclo_stickers_trade_offers where edition_id=p_edition and p_director in (from_director_id,to_director_id)
        and (status<>'pending' or expires_at<=now()) order by created_at desc,id limit 10) o),'[]'::jsonb))
  from public.cyclo_stickers_editions e join public.seasons s on s.id=e.source_season_id join public.seasons c on c.id=e.collection_season_id where e.edition_id=p_edition;
$$;

notify pgrst, 'reload schema';
commit;
