begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Keep the inbox insert in the same transaction as the outgoing reservation.
do $migration$
declare
  v_signature constant text := 'public.propose_current_cyclo_stickers_trade(text,uuid,uuid,integer[],integer[])';
  v_definition text := replace(pg_get_functiondef(v_signature::regprocedure), chr(13), '');
  v_previous constant text := $previous$    p_recipient_id, v_edition.collection_season_id, 'system', 'La Cyclogazette', 'Une proposition de Cyclo-Stickers',
    'Un autre directeur vous propose un échange de vignettes.',
    'Consultez la proposition dans votre album. Les exemplaires proposés sont réservés jusqu’à la réponse ou l’expiration.',
    '/jeu/album?saison=4&onglet=echanges', 'Voir la proposition', 'cyclo-stickers:trade:' || v_offer.id::text || ':proposed'$previous$;
  v_updated constant text := $updated$    p_recipient_id, v_edition.collection_season_id, 'system',
    (select display_name from public.sporting_directors where id = v_director), 'Proposition d’échange Cyclo-Stickers',
    'Vous avez reçu une proposition d’échange de vignettes.',
    'Consultez les cartes proposées et demandées dans votre album avant de répondre.',
    '/jeu/album?onglet=echanges&vue=recues', 'Voir la proposition', 'cyclo-stickers:trade:' || v_offer.id::text || ':proposed'$updated$;
begin
  if length(v_definition) - length(replace(v_definition, v_previous, '')) <> length(v_previous) then
    raise exception 'Unexpected Cyclo-Stickers trade notification definition.';
  end if;
  execute replace(v_definition, v_previous, v_updated);
end;
$migration$;

-- Refresh the existing notice only while the offer is actionable and the
-- recipient has not read it. Preserve the mailbox ID, timestamp and state.
update public.sporting_director_messages as message
set sender_name = sender.display_name,
  subject = 'Proposition d’échange Cyclo-Stickers',
  preview = 'Vous avez reçu une proposition d’échange de vignettes.',
  body = 'Consultez les cartes proposées et demandées dans votre album avant de répondre.',
  action_href = '/jeu/album?onglet=echanges&vue=recues'
from public.cyclo_stickers_trade_offers as offer
join public.sporting_directors as sender on sender.id = offer.from_director_id
where offer.status = 'pending' and offer.expires_at > now()
  and message.sporting_director_id = offer.to_director_id
  and message.source_reference = 'cyclo-stickers:trade:' || offer.id::text || ':proposed'
  and message.action_href = '/jeu/album?saison=4&onglet=echanges'
  and message.read_at is null and message.archived_at is null;

commit;
