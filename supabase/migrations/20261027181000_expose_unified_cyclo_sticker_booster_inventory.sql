-- One read interface for the independently granted login/referral packs.
-- UNION ALL copies no rows and retains each source's ownership RLS and IDs.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
create or replace view public.cyclo_stickers_booster_inventory
with (security_invoker=true) as
  select pack.id,pack.sporting_director_id,pack.collection_season_id,source.id source_season_id,
    pack.acquisition_source,pack.source_reference,pack.acquired_at,pack.opened_at,'login'::text inventory_source
  from public.cyclo_stickers_boosters pack
  join public.seasons collection on collection.id=pack.collection_season_id
  join public.seasons source on source.game_year=collection.game_year-1
  union all
  select pack.id,pack.sporting_director_id,pack.collection_season_id,pack.source_season_id,
    'referral'::text,pack.source_referral_id::text||':'||pack.copy_number,pack.granted_at,pack.opened_at,'referral'::text
  from public.cyclo_sticker_boosters pack;
revoke all on public.cyclo_stickers_booster_inventory from public,anon,authenticated;
grant select on public.cyclo_stickers_booster_inventory to authenticated,service_role;
comment on view public.cyclo_stickers_booster_inventory is
  'Read-only, RLS-preserving view of login and referral packs. Opening must consume the original inventory_source/id row atomically, never copy or recreate a pack.';
notify pgrst,'reload schema';
commit;
