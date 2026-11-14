begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create function public.get_current_game_header_indicators_v7()
returns table (
  current_sporting_director_id uuid,
  mailbox_unread_count integer,
  direct_message_unread_count integer,
  has_unread_global_chat boolean,
  has_unread_cyclogazette boolean,
  game_role text,
  collector_album_available boolean,
  collector_album_has_unopened_boosters boolean,
  has_unread_global_chat_quiz boolean,
  global_chat_quiz_unread_until timestamptz,
  collector_album_pending_trade_count integer
)
language sql stable security definer
set search_path = ''
as $$
  select indicators.*,
    case when indicators.collector_album_available and indicators.current_sporting_director_id is not null then (
      select count(*)::integer
      from public.cyclo_stickers_trade_offers as offer
      where offer.edition_id = (
        select edition.edition_id
        from public.cyclo_stickers_editions as edition
        join public.seasons as source on source.id = edition.source_season_id
          and source.status = 'completed'
        join public.seasons as collection on collection.id = edition.collection_season_id
        where edition.configuration->>'enabled' = 'true'
          and edition.configuration->>'publicApproved' = 'true'
          and exists (
            select 1 from public.seasons as active
            where active.status = 'active' and active.game_year >= collection.game_year
          )
        order by collection.game_year desc
        limit 1
      )
        and offer.to_director_id = indicators.current_sporting_director_id
        and offer.status = 'pending' and offer.expires_at > now()
    ) else 0 end
  from public.get_current_game_header_indicators_v6() as indicators;
$$;

revoke all on function public.get_current_game_header_indicators_v7() from public, anon;
grant execute on function public.get_current_game_header_indicators_v7() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
