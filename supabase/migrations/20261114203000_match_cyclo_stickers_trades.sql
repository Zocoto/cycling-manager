begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create function public.search_current_cyclo_stickers_trade_matches(
  p_edition text,
  p_give integer[],
  p_wanted integer[],
  p_query text,
  p_limit integer
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_director uuid := private.current_cyclo_stickers_director();
  v_result jsonb;
begin
  perform private.require_cyclo_stickers_edition(p_edition);
  if p_give is null or cardinality(p_give) not between 1 and 3
    or coalesce(array_ndims(p_give), 0) > 1
    or coalesce(array_ndims(p_wanted), 0) > 1
    or cardinality(p_wanted) > 100
    or char_length(coalesce(p_query, '')) > 80 then
    raise exception 'Recherche invalide.';
  end if;

  if array_position(p_give, null) is not null or array_position(p_wanted, null) is not null then
    raise exception 'Recherche invalide.';
  end if;

  if exists (
    select 1
    from unnest(p_give) as proposed(card_number)
    left join public.cyclo_stickers_card_inventory as inventory
      on inventory.edition_id = p_edition and inventory.sporting_director_id = v_director
      and inventory.card_number = proposed.card_number
    group by proposed.card_number, inventory.quantity, inventory.pasted
    having count(*) > coalesce(inventory.quantity - inventory.pasted::integer, 0) - (
      select count(*)
      from public.cyclo_stickers_trade_offers as offer
      cross join lateral unnest(offer.give_cards) as reserved(card_number)
      where offer.edition_id = p_edition and offer.from_director_id = v_director
        and offer.status = 'pending' and offer.expires_at > now()
        and reserved.card_number = proposed.card_number
    )
  ) then
    raise exception 'Exemplaires proposés indisponibles ou collés.';
  end if;

  with wanted as (
    select card.card_number
    from public.cyclo_stickers_cards as card
    where card.edition_id = p_edition and not (card.card_number = any(p_give))
      and case when coalesce(cardinality(p_wanted), 0) > 0
        then card.card_number = any(p_wanted)
        else not exists (
          select 1 from public.cyclo_stickers_card_inventory as own
          where own.edition_id = p_edition and own.sporting_director_id = v_director
            and own.card_number = card.card_number and own.quantity > 0
        )
      end
  ), stock as materialized (
    select inventory.sporting_director_id as director_id, inventory.card_number, inventory.quantity
    from wanted
    join public.cyclo_stickers_card_inventory as inventory
      on inventory.edition_id = p_edition and inventory.card_number = wanted.card_number
      and inventory.quantity > 1 and inventory.sporting_director_id <> v_director
    join public.sporting_directors as director
      on director.id = inventory.sporting_director_id and director.status = 'active'
      and director.auth_user_id is not null
    where strpos(lower(director.display_name), lower(btrim(coalesce(p_query, '')))) > 0
  ), candidates as (
    select distinct director_id from stock
  ), reservations as (
    select candidate.director_id, reserved.card_number, count(*)::integer as quantity
    from candidates as candidate
    join public.cyclo_stickers_trade_offers as offer
      on offer.edition_id = p_edition and offer.from_director_id = candidate.director_id
      and offer.status = 'pending' and offer.expires_at > now()
    cross join lateral unnest(offer.give_cards) as reserved(card_number)
    group by candidate.director_id, reserved.card_number
  ), surplus as materialized (
    select stock.director_id, stock.card_number,
      stock.quantity - 1 - coalesce(reservations.quantity, 0) as quantity
    from stock
    left join reservations on reservations.director_id = stock.director_id
      and reservations.card_number = stock.card_number
    where stock.quantity - 1 > coalesce(reservations.quantity, 0)
  ), available as (
    select director_id, count(*)::integer as card_count
    from surplus
    group by director_id
  ), matches as (
    select director.id, director.display_name, available.card_count, missing.numbers
    from available
    join public.sporting_directors as director on director.id = available.director_id
    cross join lateral (
      select array_agg(distinct proposed.card_number order by proposed.card_number) as numbers
      from unnest(p_give) as proposed(card_number)
      where not exists (
        select 1 from public.cyclo_stickers_card_inventory as owned
        where owned.edition_id = p_edition and owned.sporting_director_id = director.id
          and owned.card_number = proposed.card_number and owned.quantity > 0
      )
    ) as missing
    where cardinality(missing.numbers) > 0
    order by cardinality(missing.numbers) desc, available.card_count desc, director.display_name, director.id
    limit greatest(1, least(20, coalesce(p_limit, 20)))
  ), matched_cards as (
    select surplus.director_id,
      jsonb_agg(jsonb_build_object('cardNumber', card_number, 'quantity', quantity) order by card_number) as cards
    from surplus
    join matches on matches.id = surplus.director_id
    group by surplus.director_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'directorId', id, 'displayName', display_name, 'availableCards', cards, 'wantedOfferCards', numbers
  ) order by cardinality(numbers) desc, card_count desc, display_name, id), '[]'::jsonb)
  into v_result
  from matches
  join matched_cards on matched_cards.director_id = matches.id;

  return v_result;
end;
$$;

revoke all on function public.search_current_cyclo_stickers_trade_matches(text, integer[], integer[], text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.search_current_cyclo_stickers_trade_matches(text, integer[], integer[], text, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
