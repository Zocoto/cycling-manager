begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Reuse the existing authenticated header and publication gates. The album's
-- unified inventory covers login, Gazette, referral and edition boosters.
create function public.get_current_game_header_indicators_v5()
returns table (
  current_sporting_director_id uuid,
  mailbox_unread_count integer,
  direct_message_unread_count integer,
  has_unread_global_chat boolean,
  has_unread_cyclogazette boolean,
  game_role text,
  collector_album_available boolean,
  collector_album_has_unopened_boosters boolean
)
language sql stable security definer set search_path = ''
as $$
  select indicators.current_sporting_director_id,
    indicators.mailbox_unread_count,
    indicators.direct_message_unread_count,
    indicators.has_unread_global_chat,
    indicators.has_unread_cyclogazette,
    indicators.game_role,
    indicators.collector_album_available,
    case when indicators.collector_album_available then exists (
      select 1
      from public.cyclo_stickers_editions as edition
      join public.seasons as source
        on source.id = edition.source_season_id and source.game_year = 4
      join public.seasons as collection
        on collection.id = edition.collection_season_id and collection.game_year = 5
      join public.cyclo_stickers_booster_inventory as booster
        on booster.collection_season_id = edition.collection_season_id
        and booster.source_season_id = edition.source_season_id
      where booster.sporting_director_id = indicators.current_sporting_director_id
        and booster.opened_at is null
    ) else false end
  from public.get_current_game_header_indicators_v4() as indicators;
$$;

revoke all on function public.get_current_game_header_indicators_v5() from public, anon;
grant execute on function public.get_current_game_header_indicators_v5() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
