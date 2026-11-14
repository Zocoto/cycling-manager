begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Keep live offers indexed by both participants as the mailbox history grows.
create index cyclo_stickers_pending_outgoing_offers_idx
  on public.cyclo_stickers_trade_offers (edition_id, from_director_id, expires_at)
  where status = 'pending';
create index cyclo_stickers_pending_incoming_offers_idx
  on public.cyclo_stickers_trade_offers (edition_id, to_director_id, expires_at)
  where status = 'pending';

do $migration$
declare
  v_signature constant text := 'public.propose_current_cyclo_stickers_trade(text,uuid,uuid,integer[],integer[])';
  v_definition text := replace(pg_get_functiondef(v_signature::regprocedure), chr(13), '');
  v_single_offer_guard constant text := $old$  if exists (select 1 from public.cyclo_stickers_trade_offers where edition_id = p_edition and from_director_id = v_director and status = 'pending') then
    raise exception 'Une seule proposition sortante peut rester active.';
  end if;
$old$;
begin
  if length(v_definition) - length(replace(v_definition, v_single_offer_guard, '')) <> length(v_single_offer_guard) then
    raise exception 'Unexpected Cyclo-Stickers outgoing offer limit definition.';
  end if;
  execute replace(v_definition, v_single_offer_guard, '');
end;
$migration$;

-- The request identifier remains unique and both inventory owners are locked
-- in the existing proposal RPC before checking or consuming reservations.
drop index public.cyclo_stickers_one_outgoing_offer_idx;

commit;
