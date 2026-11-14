begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Keep the scalar and its foreign key for existing offers and older clients.
alter table public.cyclo_stickers_trade_offers
  add column receive_cards integer[],
  add constraint cyclo_stickers_receive_cards_shape check (
    receive_cards is null or (
      array_ndims(receive_cards) = 1
      and cardinality(receive_cards) between 1 and 3
      and array_lower(receive_cards, 1) = 1
      and receive_cards[1] = receive_card
      and not (receive_cards && give_cards)
      and array_position(receive_cards, null) is null
    )
  ) not valid;

create or replace function private.cyclo_stickers_trade_json(p_offer public.cyclo_stickers_trade_offers)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p_offer.id, 'fromDirectorId', p_offer.from_director_id, 'fromName', f.display_name,
    'toDirectorId', p_offer.to_director_id, 'toName', t.display_name, 'give', p_offer.give_cards,
    'receive', p_offer.receive_card,
    'receiveCards', coalesce(p_offer.receive_cards, array[p_offer.receive_card::integer]),
    'status', case when p_offer.status = 'pending' and p_offer.expires_at <= now() then 'expired' else p_offer.status end,
    'createdAt', p_offer.created_at, 'expiresAt', p_offer.expires_at
  )
  from public.sporting_directors f, public.sporting_directors t
  where f.id = p_offer.from_director_id and t.id = p_offer.to_director_id;
$$;

create function public.propose_current_cyclo_stickers_trade(
  p_edition text, p_request_id uuid, p_recipient_id uuid, p_give integer[], p_receive_cards integer[]
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_director uuid := private.current_cyclo_stickers_director();
  v_edition public.cyclo_stickers_editions%rowtype;
  v_offer public.cyclo_stickers_trade_offers%rowtype;
  v_receive integer[];
  v_copy record;
  v_available integer;
begin
  perform private.require_cyclo_stickers_edition(p_edition);
  if p_request_id is null or p_recipient_id is null or p_recipient_id = v_director
    or p_give is null or p_receive_cards is null
    or array_ndims(p_give) is distinct from 1 or array_ndims(p_receive_cards) is distinct from 1
    or cardinality(p_give) not between 1 and 3 or cardinality(p_receive_cards) not between 1 and 3 then
    raise exception 'Proposition d’échange invalide.';
  end if;

  if array_position(p_give, null) is not null or array_position(p_receive_cards, null) is not null
    or p_give && p_receive_cards
    or not exists (select 1 from public.sporting_directors where id = p_recipient_id and status = 'active' and auth_user_id is not null)
    or exists (
      select 1 from unnest(p_give || p_receive_cards) as requested(card_number)
      where not exists (
        select 1 from public.cyclo_stickers_cards as card
        where card.edition_id = p_edition and card.card_number = requested.card_number
      )
    ) then
    raise exception 'Proposition d’échange invalide.';
  end if;

  select array_agg(card_number order by card_number) into v_receive
  from unnest(p_receive_cards) as requested(card_number);

  perform private.lock_cyclo_stickers_collections(p_edition, array[v_director, p_recipient_id]);
  v_edition := private.require_cyclo_stickers_edition(p_edition);
  perform private.expire_cyclo_stickers_offers(p_edition, v_director);
  perform private.expire_cyclo_stickers_offers(p_edition, p_recipient_id);

  select * into v_offer from public.cyclo_stickers_trade_offers
  where edition_id = p_edition and from_director_id = v_director and request_id = p_request_id;
  if found then
    if v_offer.to_director_id <> p_recipient_id or v_offer.give_cards <> p_give
      or coalesce(v_offer.receive_cards, array[v_offer.receive_card::integer]) <> v_receive then
      raise exception 'Identifiant de proposition déjà utilisé.';
    end if;
    return jsonb_build_object('offerId', v_offer.id, 'state', private.cyclo_stickers_state(p_edition, v_director));
  end if;

  if exists (select 1 from public.cyclo_stickers_trade_offers where edition_id = p_edition and from_director_id = v_director and status = 'pending') then
    raise exception 'Une seule proposition sortante peut rester active.';
  end if;
  if (select count(*) from public.cyclo_stickers_trade_offers where from_director_id = v_director and created_at > now() - interval '24 hours') >= (v_edition.configuration->>'maxOffersPerDay')::integer
    or (select count(*) from public.cyclo_stickers_trade_offers where edition_id = p_edition and to_director_id = p_recipient_id and status = 'pending' and expires_at > now()) >= (v_edition.configuration->>'maxIncomingOffers')::integer then
    raise exception 'La limite de propositions est atteinte. Réessayez plus tard.';
  end if;

  for v_copy in select card_number, count(*)::integer as quantity from unnest(p_give) as offered(card_number) group by card_number loop
    select quantity - reserved - pasted::integer into v_available from public.cyclo_stickers_card_inventory
    where edition_id = p_edition and sporting_director_id = v_director and card_number = v_copy.card_number;
    if coalesce(v_available, 0) < v_copy.quantity then raise exception 'Exemplaires proposés indisponibles ou collés.'; end if;
  end loop;
  for v_copy in select card_number, count(*)::integer as quantity from unnest(v_receive) as requested(card_number) group by card_number loop
    select quantity - reserved - pasted::integer into v_available from public.cyclo_stickers_card_inventory
    where edition_id = p_edition and sporting_director_id = p_recipient_id and card_number = v_copy.card_number;
    if coalesce(v_available, 0) < v_copy.quantity then raise exception 'Une des cartes demandées n’est plus disponible.'; end if;
  end loop;

  for v_copy in select card_number, count(*)::integer as quantity from unnest(p_give) as offered(card_number) group by card_number loop
    update public.cyclo_stickers_card_inventory set reserved = reserved + v_copy.quantity
    where edition_id = p_edition and sporting_director_id = v_director and card_number = v_copy.card_number;
  end loop;

  insert into public.cyclo_stickers_trade_offers (
    edition_id, from_director_id, to_director_id, request_id, give_cards, receive_card, receive_cards, expires_at
  ) values (
    p_edition, v_director, p_recipient_id, p_request_id, p_give, v_receive[1], v_receive,
    now() + make_interval(hours => (v_edition.configuration->>'tradeExpiryHours')::integer)
  ) returning * into v_offer;

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, message_type, sender_name, subject, preview, body, action_href, action_label, source_reference
  ) values (
    p_recipient_id, v_edition.collection_season_id, 'system', 'La Cyclogazette', 'Une proposition de Cyclo-Stickers',
    'Un autre directeur vous propose un échange de vignettes.',
    'Consultez la proposition dans votre album. Les exemplaires proposés sont réservés jusqu’à la réponse ou l’expiration.',
    '/jeu/album?saison=4&onglet=echanges', 'Voir la proposition', 'cyclo-stickers:trade:' || v_offer.id::text || ':proposed'
  ) on conflict (sporting_director_id, source_reference) do nothing;

  return jsonb_build_object('offerId', v_offer.id, 'state', private.cyclo_stickers_state(p_edition, v_director));
end;
$$;

create or replace function public.propose_current_cyclo_stickers_trade(
  p_edition text, p_request_id uuid, p_recipient_id uuid, p_give integer[], p_receive integer
)
returns jsonb language sql security definer set search_path = '' as $$
  select public.propose_current_cyclo_stickers_trade(p_edition, p_request_id, p_recipient_id, p_give, array[p_receive]);
$$;

create function public.respond_current_cyclo_stickers_trade(
  p_edition text, p_offer_id uuid, p_response text, p_expected_receive_cards integer[]
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_director uuid := private.current_cyclo_stickers_director();
  v_offer public.cyclo_stickers_trade_offers%rowtype;
  v_receive integer[];
  v_expected integer[];
  v_copy record;
  v_available integer;
  v_status text;
begin
  perform private.require_cyclo_stickers_edition(p_edition);
  select * into v_offer from public.cyclo_stickers_trade_offers where id = p_offer_id and edition_id = p_edition;
  if not found or p_response is null or p_response not in ('accept', 'cancel', 'decline')
    or (p_response = 'cancel' and v_offer.from_director_id <> v_director)
    or (p_response in ('accept', 'decline') and v_offer.to_director_id <> v_director) then
    raise exception 'Cette réponse à l’échange n’est pas autorisée.';
  end if;

  perform private.lock_cyclo_stickers_collections(p_edition, array[v_offer.from_director_id, v_offer.to_director_id]);
  perform private.require_cyclo_stickers_edition(p_edition);
  perform private.expire_cyclo_stickers_offers(p_edition, v_offer.from_director_id);
  perform private.expire_cyclo_stickers_offers(p_edition, v_offer.to_director_id);
  select * into v_offer from public.cyclo_stickers_trade_offers where id = p_offer_id for update;
  if v_offer.status <> 'pending' then
    return jsonb_build_object('status', v_offer.status, 'state', private.cyclo_stickers_state(p_edition, v_director));
  end if;

  v_status := case p_response when 'accept' then 'accepted' when 'cancel' then 'cancelled' else 'declined' end;
  if p_response = 'accept' then
    v_receive := coalesce(v_offer.receive_cards, array[v_offer.receive_card::integer]);
    if p_expected_receive_cards is not null and cardinality(p_expected_receive_cards) between 1 and 3
      and array_ndims(p_expected_receive_cards) = 1 then
      select array_agg(card_number order by card_number) into v_expected
      from unnest(p_expected_receive_cards) as expected(card_number);
    end if;

    -- An old client only displays the first requested card.
    if (p_expected_receive_cards is null and cardinality(v_receive) <> 1)
      or (p_expected_receive_cards is not null and v_expected is distinct from v_receive) then
      raise exception 'Actualisez la proposition avant de confirmer les cartes demandées.';
    end if;

    if not exists (select 1 from public.sporting_directors where id = v_offer.from_director_id and status = 'active') then
      raise exception 'Ce collectionneur n’est plus actif.';
    end if;
    for v_copy in select card_number, count(*)::integer as quantity from unnest(v_offer.give_cards) as offered(card_number) group by card_number loop
      if not exists (
        select 1 from public.cyclo_stickers_card_inventory
        where edition_id = p_edition and sporting_director_id = v_offer.from_director_id
          and card_number = v_copy.card_number and reserved >= v_copy.quantity and quantity >= pasted::integer + reserved
      ) then
        raise exception 'Les copies réservées de cette proposition sont indisponibles.';
      end if;
    end loop;

    for v_copy in select card_number, count(*)::integer as quantity from unnest(v_receive) as requested(card_number) group by card_number loop
      select quantity - reserved - pasted::integer into v_available from public.cyclo_stickers_card_inventory
      where edition_id = p_edition and sporting_director_id = v_offer.to_director_id and card_number = v_copy.card_number;
      if coalesce(v_available, 0) < v_copy.quantity then raise exception 'Une des cartes demandées n’est plus disponible.'; end if;
    end loop;

    for v_copy in select card_number, count(*)::integer as quantity from unnest(v_receive) as requested(card_number) group by card_number loop
      update public.cyclo_stickers_card_inventory set quantity = quantity - v_copy.quantity
      where edition_id = p_edition and sporting_director_id = v_offer.to_director_id and card_number = v_copy.card_number;
      insert into public.cyclo_stickers_card_inventory (edition_id, sporting_director_id, card_number, quantity)
      values (p_edition, v_offer.from_director_id, v_copy.card_number, v_copy.quantity)
      on conflict (edition_id, sporting_director_id, card_number) do update
      set quantity = public.cyclo_stickers_card_inventory.quantity + excluded.quantity;
    end loop;
  end if;

  for v_copy in select card_number, count(*)::integer as quantity from unnest(v_offer.give_cards) as offered(card_number) group by card_number loop
    update public.cyclo_stickers_card_inventory
    set reserved = reserved - v_copy.quantity,
      quantity = quantity - case when p_response = 'accept' then v_copy.quantity else 0 end
    where edition_id = p_edition and sporting_director_id = v_offer.from_director_id and card_number = v_copy.card_number;
    if p_response = 'accept' then
      insert into public.cyclo_stickers_card_inventory (edition_id, sporting_director_id, card_number, quantity)
      values (p_edition, v_offer.to_director_id, v_copy.card_number, v_copy.quantity)
      on conflict (edition_id, sporting_director_id, card_number) do update
      set quantity = public.cyclo_stickers_card_inventory.quantity + excluded.quantity;
    end if;
  end loop;

  update public.cyclo_stickers_trade_offers set status = v_status, responded_at = now() where id = v_offer.id;
  if p_response = 'accept' then
    update public.cyclo_stickers_collections set accepted_trade_count = accepted_trade_count + 1
    where edition_id = p_edition and sporting_director_id in (v_offer.from_director_id, v_offer.to_director_id);
  end if;
  return jsonb_build_object('status', v_status, 'state', private.cyclo_stickers_state(p_edition, v_director));
end;
$$;

create or replace function public.respond_current_cyclo_stickers_trade(p_edition text, p_offer_id uuid, p_response text)
returns jsonb language sql security definer set search_path = '' as $$
  select public.respond_current_cyclo_stickers_trade(p_edition, p_offer_id, p_response, null::integer[]);
$$;

revoke all on function public.propose_current_cyclo_stickers_trade(text, uuid, uuid, integer[], integer[]),
  public.respond_current_cyclo_stickers_trade(text, uuid, text, integer[]) from public, anon;
grant execute on function public.propose_current_cyclo_stickers_trade(text, uuid, uuid, integer[], integer[]),
  public.respond_current_cyclo_stickers_trade(text, uuid, text, integer[]) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
