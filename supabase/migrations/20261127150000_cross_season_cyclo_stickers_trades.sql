-- Infrastructure only: no catalogue, card, booster, collection or reward is
-- created here. Pending legacy offers retain their schema and RPCs.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

create function private.cyclo_stickers_public_editions()
returns table(edition_id text,source_season_id uuid,collection_season_id uuid,source_season integer,collection_season integer)
language sql stable security definer set search_path='' as $$
  select e.edition_id,e.source_season_id,e.collection_season_id,s.game_year,c.game_year
  from public.cyclo_stickers_editions e
  join public.seasons s on s.id=e.source_season_id and s.status='completed' and s.game_year>=4
  join public.seasons c on c.id=e.collection_season_id and c.game_year=s.game_year+1
  where e.configuration->>'enabled'='true' and e.configuration->>'publicApproved'='true'
    and exists(select 1 from public.seasons a where a.status='active' and a.game_year>=c.game_year);
$$;

create function public.get_current_cyclo_stickers_library()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'editionId',e.edition_id,'sourceSeasonId',e.source_season_id,'collectionSeasonId',e.collection_season_id,
    'sourceSeason',e.source_season,'collectionSeason',e.collection_season,'totalCards',counts.total,
    'pastedCount',stock.pasted,'ownedCount',stock.owned,
    'unopenedBoosterCount',(select count(*)::integer from public.cyclo_stickers_booster_inventory b
      where b.sporting_director_id=v_director and b.collection_season_id=e.collection_season_id and b.source_season_id=e.source_season_id and b.opened_at is null),
    'completionPercent',case when counts.total>0 then round(100.0*stock.pasted/counts.total)::integer else 0 end
  ) order by e.source_season desc,e.edition_id),'[]'::jsonb) into v_result
  from private.cyclo_stickers_public_editions() e
  cross join lateral(select count(*)::integer total from public.cyclo_stickers_cards c where c.edition_id=e.edition_id) counts
  cross join lateral(select count(*) filter(where i.pasted)::integer pasted,count(*)::integer owned
    from public.cyclo_stickers_card_inventory i where i.edition_id=e.edition_id and i.sporting_director_id=v_director and i.quantity>0) stock;
  return v_result;
end;
$$;

create function public.get_cyclo_stickers_catalogue(p_edition text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_result jsonb;
begin
  select jsonb_build_object('snapshot',e.snapshot,'sha256',e.snapshot_sha256,'editionId',e.edition_id) into v_result
  from public.cyclo_stickers_editions e join private.cyclo_stickers_public_editions() allowed on allowed.edition_id=e.edition_id
  where e.edition_id=p_edition;
  return v_result;
end;
$$;

create function private.cyclo_stickers_normalize_items(p_items jsonb,p_maximum integer default 3,p_allow_empty boolean default false)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_item jsonb; v_result jsonb;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Vignettes d’échange invalides.'; end if;
  if jsonb_array_length(p_items)>p_maximum or (not p_allow_empty and jsonb_array_length(p_items)=0) then
    raise exception 'Vignettes d’échange invalides.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object' or jsonb_typeof(v_item->'editionId') is distinct from 'string'
      or (v_item->>'editionId') !~ '^[a-z0-9][a-z0-9_-]{2,100}$'
      or jsonb_typeof(v_item->'cardNumber') is distinct from 'number'
      or (v_item->>'cardNumber') !~ '^[1-9][0-9]{0,4}$'
      or (v_item->>'cardNumber')::integer>32767 then raise exception 'Vignettes d’échange invalides.'; end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('editionId',value->>'editionId','cardNumber',(value->>'cardNumber')::integer)
    order by value->>'editionId',(value->>'cardNumber')::integer),'[]'::jsonb) into v_result from jsonb_array_elements(p_items);
  return v_result;
end;
$$;

create function private.cyclo_stickers_item_refs(p_items jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('editionId',item->>'editionId','cardNumber',(item->>'cardNumber')::integer,
    'sourceSeason',e.source_season) order by item->>'editionId',(item->>'cardNumber')::integer),'[]'::jsonb)
  from jsonb_array_elements(p_items) item join private.cyclo_stickers_public_editions() e on e.edition_id=item->>'editionId';
$$;

create function private.lock_cyclo_stickers_offer_quotas(p_directors uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare v_director uuid;
begin
  -- Quotas span editions. Two proposals on disjoint albums must still serialize
  -- the sender's daily and recipient's pending counters, including old clients.
  for v_director in select distinct director from unnest(p_directors) director order by director loop
    perform pg_advisory_xact_lock(hashtextextended('cyclo-stickers-offer-quota:'||v_director::text,0));
  end loop;
end;
$$;

create table public.cyclo_stickers_cross_trade_offers(
  id uuid primary key default gen_random_uuid(),
  from_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  to_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  request_id uuid not null,
  give_items jsonb not null,
  receive_items jsonb not null,
  status text not null default 'pending' check(status in ('pending','accepted','cancelled','declined','expired')),
  created_at timestamptz not null default now(),expires_at timestamptz not null,responded_at timestamptz,
  unique(from_director_id,request_id),check(from_director_id<>to_director_id),check(expires_at>created_at),
  check(give_items=private.cyclo_stickers_normalize_items(give_items)),
  check(receive_items=private.cyclo_stickers_normalize_items(receive_items))
);
create index cyclo_stickers_cross_outgoing_idx on public.cyclo_stickers_cross_trade_offers(from_director_id,expires_at) where status='pending';
create index cyclo_stickers_cross_incoming_idx on public.cyclo_stickers_cross_trade_offers(to_director_id,expires_at) where status='pending';
create index cyclo_stickers_cross_daily_idx on public.cyclo_stickers_cross_trade_offers(from_director_id,created_at desc);
create index cyclo_stickers_cross_history_idx on public.cyclo_stickers_cross_trade_offers(to_director_id,created_at desc);
create index cyclo_stickers_legacy_global_incoming_idx on public.cyclo_stickers_trade_offers(to_director_id,created_at desc);
alter table public.cyclo_stickers_cross_trade_offers enable row level security;
create policy cyclo_stickers_cross_offers_own on public.cyclo_stickers_cross_trade_offers for select to authenticated
  using(exists(select 1 from public.sporting_directors d where d.auth_user_id=(select auth.uid()) and d.id in(from_director_id,to_director_id)));
revoke all on public.cyclo_stickers_cross_trade_offers from public,anon,authenticated;
grant all on public.cyclo_stickers_cross_trade_offers to service_role;

create function private.lock_cyclo_stickers_cross_collections(p_items jsonb,p_directors uuid[],p_try boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_edition text; v_pair record;
begin
  -- An older client may already hold one edition's locks before expiry. The
  -- NOWAIT path is a savepoint: partial acquisitions are released on contention.
  begin
    for v_edition in select distinct value->>'editionId' from jsonb_array_elements(p_items) order by 1 loop
      if p_try then perform 1 from public.cyclo_stickers_editions where edition_id=v_edition for share nowait;
      else perform 1 from public.cyclo_stickers_editions where edition_id=v_edition for share; end if;
    end loop;
    for v_pair in select distinct item->>'editionId' edition_id,director from jsonb_array_elements(p_items) item
      cross join unnest(p_directors) director order by 1,2 loop
      if p_try then
        -- Every offered collection already exists; avoid ON CONFLICT waiting
        -- on a speculative insert while an old mutation owns another edition.
        perform 1 from public.cyclo_stickers_collections where edition_id=v_pair.edition_id and sporting_director_id=v_pair.director for update nowait;
        if not found then raise lock_not_available; end if;
      else
        insert into public.cyclo_stickers_collections(edition_id,sporting_director_id) values(v_pair.edition_id,v_pair.director) on conflict do nothing;
        perform 1 from public.cyclo_stickers_collections where edition_id=v_pair.edition_id and sporting_director_id=v_pair.director for update;
      end if;
    end loop;
  exception when lock_not_available then return false;
  end;
  return true;
end;
$$;

create function private.expire_cyclo_stickers_cross_offers(p_edition text,p_director uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_offer public.cyclo_stickers_cross_trade_offers%rowtype; v_id uuid; v_copy record;
begin
  for v_id in select o.id from public.cyclo_stickers_cross_trade_offers o
    where o.from_director_id=p_director and o.status='pending' and o.expires_at<=now()
      and (p_edition is null or exists(select 1 from jsonb_array_elements(o.give_items) item where item->>'editionId'=p_edition))
    order by o.id loop
    begin
      select * into v_offer from public.cyclo_stickers_cross_trade_offers where id=v_id;
      if not private.lock_cyclo_stickers_cross_collections(v_offer.give_items||v_offer.receive_items,array[v_offer.from_director_id,v_offer.to_director_id],true) then continue; end if;
      select * into v_offer from public.cyclo_stickers_cross_trade_offers where id=v_id for update nowait;
      if v_offer.status<>'pending' or v_offer.expires_at>now() then continue; end if;
      for v_copy in select item->>'editionId' edition_id,(item->>'cardNumber')::integer card_number,count(*)::integer quantity
        from jsonb_array_elements(v_offer.give_items) item group by 1,2 loop
        update public.cyclo_stickers_card_inventory set reserved=reserved-v_copy.quantity
          where edition_id=v_copy.edition_id and sporting_director_id=v_offer.from_director_id and card_number=v_copy.card_number;
      end loop;
      update public.cyclo_stickers_cross_trade_offers set status='expired',responded_at=now() where id=v_id;
    exception when lock_not_available then null;
    end;
  end loop;
end;
$$;

create or replace function private.expire_cyclo_stickers_offers(p_edition text,p_director uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_offer public.cyclo_stickers_trade_offers%rowtype; v_copy record;
begin
  for v_offer in select * from public.cyclo_stickers_trade_offers where edition_id=p_edition and from_director_id=p_director
    and status='pending' and expires_at<=now() for update loop
    for v_copy in select n,count(*)::integer quantity from unnest(v_offer.give_cards) n group by n loop
      update public.cyclo_stickers_card_inventory set reserved=reserved-v_copy.quantity
        where edition_id=p_edition and sporting_director_id=p_director and card_number=v_copy.n;
    end loop;
    update public.cyclo_stickers_trade_offers set status='expired',responded_at=now() where id=v_offer.id;
  end loop;
  perform private.expire_cyclo_stickers_cross_offers(p_edition,p_director);
end;
$$;

create function private.cyclo_stickers_active_reservations(p_edition text,p_director uuid,p_card integer)
returns integer language sql stable security definer set search_path='' as $$
  select ((select count(*) from public.cyclo_stickers_trade_offers o cross join lateral unnest(o.give_cards) n
    where o.edition_id=p_edition and o.from_director_id=p_director and o.status='pending' and o.expires_at>now() and n=p_card)
    +(select count(*) from public.cyclo_stickers_cross_trade_offers o cross join lateral jsonb_array_elements(o.give_items) item
      where o.from_director_id=p_director and o.status='pending' and o.expires_at>now()
        and item->>'editionId'=p_edition and (item->>'cardNumber')::integer=p_card))::integer;
$$;

create or replace function private.cyclo_stickers_trade_json(p_offer public.cyclo_stickers_trade_offers)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p_offer.id,'legacy',true,'editionId',p_offer.edition_id,
    'fromDirectorId',p_offer.from_director_id,'fromName',f.display_name,'toDirectorId',p_offer.to_director_id,'toName',t.display_name,
    'give',p_offer.give_cards,'receive',p_offer.receive_card,'receiveCards',coalesce(p_offer.receive_cards,array[p_offer.receive_card::integer]),
    'giveItems',private.cyclo_stickers_item_refs((select jsonb_agg(jsonb_build_object('editionId',p_offer.edition_id,'cardNumber',n)) from unnest(p_offer.give_cards) n)),
    'receiveItems',private.cyclo_stickers_item_refs((select jsonb_agg(jsonb_build_object('editionId',p_offer.edition_id,'cardNumber',n)) from unnest(coalesce(p_offer.receive_cards,array[p_offer.receive_card::integer])) n)),
    'status',case when p_offer.status='pending' and p_offer.expires_at<=now() then 'expired' else p_offer.status end,
    'createdAt',p_offer.created_at,'expiresAt',p_offer.expires_at)
  from public.sporting_directors f,public.sporting_directors t where f.id=p_offer.from_director_id and t.id=p_offer.to_director_id;
$$;

create function private.cyclo_stickers_cross_trade_json(p_offer public.cyclo_stickers_cross_trade_offers)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p_offer.id,'legacy',false,
    'fromDirectorId',p_offer.from_director_id,'fromName',f.display_name,'toDirectorId',p_offer.to_director_id,'toName',t.display_name,
    'giveItems',private.cyclo_stickers_item_refs(p_offer.give_items),'receiveItems',private.cyclo_stickers_item_refs(p_offer.receive_items),
    'status',case when p_offer.status='pending' and p_offer.expires_at<=now() then 'expired' else p_offer.status end,
    'createdAt',p_offer.created_at,'expiresAt',p_offer.expires_at)
  from public.sporting_directors f,public.sporting_directors t where f.id=p_offer.from_director_id and t.id=p_offer.to_director_id;
$$;

create function public.get_current_cyclo_stickers_trade_inventory()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_result jsonb;
begin
  with available as materialized(select * from private.cyclo_stickers_public_editions()),pending as materialized(
    select o.id,true legacy,o.from_director_id,o.to_director_id,o.created_at,o.expires_at,o.status
      from public.cyclo_stickers_trade_offers o where v_director in(o.from_director_id,o.to_director_id) and o.status='pending' and o.expires_at>now()
        and exists(select 1 from available e where e.edition_id=o.edition_id)
    union all
    select o.id,false,o.from_director_id,o.to_director_id,o.created_at,o.expires_at,o.status
      from public.cyclo_stickers_cross_trade_offers o where v_director in(o.from_director_id,o.to_director_id) and o.status='pending' and o.expires_at>now()
        and not exists(select 1 from jsonb_array_elements(o.give_items||o.receive_items) item where not exists(select 1 from available e where e.edition_id=item->>'editionId'))
  ), recent as materialized(
    select * from(
      (select o.id,true legacy,o.from_director_id,o.to_director_id,o.created_at,o.expires_at,o.status
        from public.cyclo_stickers_trade_offers o where v_director in(o.from_director_id,o.to_director_id) and(o.status<>'pending' or o.expires_at<=now())
          and exists(select 1 from available e where e.edition_id=o.edition_id) order by o.created_at desc,o.id limit 20)
      union all
      (select o.id,false,o.from_director_id,o.to_director_id,o.created_at,o.expires_at,o.status
        from public.cyclo_stickers_cross_trade_offers o where v_director in(o.from_director_id,o.to_director_id) and(o.status<>'pending' or o.expires_at<=now())
          and not exists(select 1 from jsonb_array_elements(o.give_items||o.receive_items) item where not exists(select 1 from available e where e.edition_id=item->>'editionId'))
          order by o.created_at desc,o.id limit 20)
    ) all_recent order by created_at desc,id limit 20
  ), chosen as(select * from pending union all select * from recent), offers as materialized(
    -- Enrich only live offers and the twenty newest history rows, never every
    -- exchange made across an owner's lifetime of albums.
    select c.*,case when c.legacy then private.cyclo_stickers_trade_json(old_offer) else private.cyclo_stickers_cross_trade_json(new_offer) end payload
    from chosen c left join public.cyclo_stickers_trade_offers old_offer on c.legacy and old_offer.id=c.id
      left join public.cyclo_stickers_cross_trade_offers new_offer on not c.legacy and new_offer.id=c.id
  )
  select jsonb_build_object('directorId',v_director,'editions',public.get_current_cyclo_stickers_library(),
    'owned',coalesce((select jsonb_agg(jsonb_build_object('editionId',i.edition_id,'sourceSeason',e.source_season,'cardNumber',i.card_number,
      'quantity',i.quantity,'pasted',i.pasted,'reserved',private.cyclo_stickers_active_reservations(i.edition_id,v_director,i.card_number))
      order by e.source_season desc,i.card_number)
      from public.cyclo_stickers_card_inventory i join available e on e.edition_id=i.edition_id
      where i.sporting_director_id=v_director and i.quantity>0),'[]'::jsonb),
    'incomingOffers',coalesce((select jsonb_agg(payload order by created_at desc,id) from offers where to_director_id=v_director and status='pending' and expires_at>now()),'[]'::jsonb),
    'outgoingOffers',coalesce((select jsonb_agg(payload order by created_at desc,id) from offers where from_director_id=v_director and status='pending' and expires_at>now()),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(payload order by created_at desc,id) from(select * from offers where status<>'pending' or expires_at<=now() order by created_at desc,id limit 20) recent),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create function public.search_cyclo_stickers_cross_season_matches(p_give jsonb,p_wanted jsonb,p_query text,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_give jsonb; v_wanted jsonb; v_result jsonb; v_edition text;
begin
  v_give:=private.cyclo_stickers_normalize_items(p_give);
  v_wanted:=private.cyclo_stickers_normalize_items(coalesce(p_wanted,'[]'::jsonb),100,true);
  if char_length(coalesce(p_query,''))>80 then raise exception 'Recherche invalide.'; end if;
  for v_edition in select distinct item->>'editionId' from jsonb_array_elements(v_give||v_wanted) item loop perform private.require_cyclo_stickers_edition(v_edition); end loop;
  if exists(select 1 from jsonb_array_elements(v_give||v_wanted) item where not exists(
    select 1 from public.cyclo_stickers_cards c where c.edition_id=item->>'editionId' and c.card_number=(item->>'cardNumber')::integer)) then raise exception 'Recherche invalide.'; end if;
  if exists(select 1 from jsonb_array_elements(v_give) item
    left join public.cyclo_stickers_card_inventory i on i.edition_id=item->>'editionId' and i.card_number=(item->>'cardNumber')::integer and i.sporting_director_id=v_director
    group by item->>'editionId',(item->>'cardNumber')::integer,i.quantity
    having count(*)>coalesce(i.quantity-1,0)-private.cyclo_stickers_active_reservations(item->>'editionId',v_director,(item->>'cardNumber')::integer)) then
    raise exception 'Exemplaires proposés indisponibles ou collés.';
  end if;
  with wanted as materialized(
    select c.edition_id,c.card_number,e.source_season from public.cyclo_stickers_cards c
      join private.cyclo_stickers_public_editions() e on e.edition_id=c.edition_id
    where not exists(select 1 from jsonb_array_elements(v_give) item where item->>'editionId'=c.edition_id and (item->>'cardNumber')::integer=c.card_number)
      and case when jsonb_array_length(v_wanted)>0 then exists(select 1 from jsonb_array_elements(v_wanted) item where item->>'editionId'=c.edition_id and (item->>'cardNumber')::integer=c.card_number)
        else not exists(select 1 from public.cyclo_stickers_card_inventory own where own.edition_id=c.edition_id and own.card_number=c.card_number and own.sporting_director_id=v_director and own.quantity>0) end
  ), stock as materialized(
    select i.sporting_director_id director_id,w.edition_id,w.card_number,w.source_season,
      i.quantity-1-private.cyclo_stickers_active_reservations(i.edition_id,i.sporting_director_id,i.card_number) quantity
    from wanted w join public.cyclo_stickers_card_inventory i on i.edition_id=w.edition_id and i.card_number=w.card_number and i.quantity>1 and i.sporting_director_id<>v_director
    join public.sporting_directors d on d.id=i.sporting_director_id and d.status='active' and d.auth_user_id is not null
    where strpos(lower(d.display_name),lower(btrim(coalesce(p_query,''))))>0
  ), matches as(
    select d.id,d.display_name,count(*)::integer card_count,missing.items
    from stock join public.sporting_directors d on d.id=stock.director_id
    cross join lateral(select jsonb_agg(distinct item) items from jsonb_array_elements(v_give) item where not exists(
      select 1 from public.cyclo_stickers_card_inventory own where own.edition_id=item->>'editionId' and own.card_number=(item->>'cardNumber')::integer and own.sporting_director_id=d.id and own.quantity>0)) missing
    where stock.quantity>0 and(missing.items is not null or btrim(coalesce(p_query,''))<>'')
    group by d.id,d.display_name,missing.items
    order by coalesce(jsonb_array_length(missing.items),0) desc,count(*) desc,d.display_name,d.id limit greatest(1,least(20,coalesce(p_limit,20)))
  )
  select coalesce(jsonb_agg(jsonb_build_object('directorId',m.id,'displayName',m.display_name,
    'wantedOfferCards',private.cyclo_stickers_item_refs(m.items),
    'availableCards',(select jsonb_agg(jsonb_build_object('editionId',s.edition_id,'cardNumber',s.card_number,'sourceSeason',s.source_season,'quantity',s.quantity) order by s.source_season desc,s.card_number)
      from stock s where s.director_id=m.id and s.quantity>0)
    ) order by coalesce(jsonb_array_length(m.items),0) desc,m.card_count desc,m.display_name,m.id),'[]'::jsonb) into v_result from matches m;
  return v_result;
end;
$$;

create function public.propose_cyclo_stickers_cross_season_trade(p_view_edition text,p_expected_director_id uuid,p_request_id uuid,p_recipient_id uuid,p_give jsonb,p_receive jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_give jsonb;v_receive jsonb;v_offer public.cyclo_stickers_cross_trade_offers%rowtype;
  v_edition text;v_owner uuid;v_copy record;v_view public.cyclo_stickers_editions%rowtype;v_config jsonb;
  v_expiry integer:=168;v_daily integer:=100;v_incoming integer:=100;v_available integer;
begin
  if p_expected_director_id is distinct from v_director then raise exception 'Votre session a changé. Rechargez la page avant de proposer un échange.'; end if;
  v_view:=private.require_cyclo_stickers_edition(p_view_edition);
  v_give:=private.cyclo_stickers_normalize_items(p_give);v_receive:=private.cyclo_stickers_normalize_items(p_receive);
  if p_request_id is null or p_recipient_id is null or p_recipient_id=v_director
    or exists(select 1 from jsonb_array_elements(v_give) g join jsonb_array_elements(v_receive) r on g=r)
    or not exists(select 1 from public.sporting_directors where id=p_recipient_id and status='active' and auth_user_id is not null) then raise exception 'Proposition d’échange invalide.'; end if;
  for v_edition in select distinct item->>'editionId' from jsonb_array_elements(v_give||v_receive) item loop perform private.require_cyclo_stickers_edition(v_edition); end loop;
  if exists(select 1 from jsonb_array_elements(v_give||v_receive) item where not exists(select 1 from public.cyclo_stickers_cards c where c.edition_id=item->>'editionId' and c.card_number=(item->>'cardNumber')::integer)) then raise exception 'Proposition d’échange invalide.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cyclo-stickers-cross-request:'||v_director::text||':'||p_request_id::text,0));
  perform private.lock_cyclo_stickers_offer_quotas(array[v_director,p_recipient_id]);
  perform private.lock_cyclo_stickers_cross_collections(v_give||v_receive,array[v_director,p_recipient_id]);
  for v_edition in select distinct item->>'editionId' from jsonb_array_elements(v_give||v_receive) item order by 1 loop
    v_config:=(private.require_cyclo_stickers_edition(v_edition)).configuration;
    v_expiry:=least(v_expiry,(v_config->>'tradeExpiryHours')::integer);v_daily:=least(v_daily,(v_config->>'maxOffersPerDay')::integer);v_incoming:=least(v_incoming,(v_config->>'maxIncomingOffers')::integer);
    foreach v_owner in array array[v_director,p_recipient_id] loop perform private.expire_cyclo_stickers_offers(v_edition,v_owner); end loop;
  end loop;
  select * into v_offer from public.cyclo_stickers_cross_trade_offers where from_director_id=v_director and request_id=p_request_id;
  if found then
    if v_offer.to_director_id<>p_recipient_id or v_offer.give_items<>v_give or v_offer.receive_items<>v_receive then raise exception 'Identifiant de proposition déjà utilisé.'; end if;
    return jsonb_build_object('offerId',v_offer.id,'status',v_offer.status,'state',private.cyclo_stickers_state(p_view_edition,v_director),'tradeState',public.get_current_cyclo_stickers_trade_inventory());
  end if;
  if (select count(*) from public.cyclo_stickers_trade_offers where from_director_id=v_director and created_at>now()-interval '24 hours')
      +(select count(*) from public.cyclo_stickers_cross_trade_offers where from_director_id=v_director and created_at>now()-interval '24 hours')>=v_daily
    or (select count(*) from public.cyclo_stickers_trade_offers where to_director_id=p_recipient_id and status='pending' and expires_at>now())
      +(select count(*) from public.cyclo_stickers_cross_trade_offers where to_director_id=p_recipient_id and status='pending' and expires_at>now())>=v_incoming then raise exception 'La limite de propositions est atteinte. Réessayez plus tard.'; end if;
  for v_copy in select item->>'editionId' edition_id,(item->>'cardNumber')::integer card_number,count(*)::integer quantity from jsonb_array_elements(v_give) item group by 1,2 loop
    select quantity-reserved-1 into v_available from public.cyclo_stickers_card_inventory where edition_id=v_copy.edition_id and sporting_director_id=v_director and card_number=v_copy.card_number;
    if coalesce(v_available,0)<v_copy.quantity then raise exception 'Exemplaires proposés indisponibles ou collés.'; end if;
  end loop;
  for v_copy in select item->>'editionId' edition_id,(item->>'cardNumber')::integer card_number,count(*)::integer quantity from jsonb_array_elements(v_receive) item group by 1,2 loop
    select quantity-reserved-1 into v_available from public.cyclo_stickers_card_inventory where edition_id=v_copy.edition_id and sporting_director_id=p_recipient_id and card_number=v_copy.card_number;
    if coalesce(v_available,0)<v_copy.quantity then raise exception 'Une des cartes demandées n’est plus disponible.'; end if;
  end loop;
  for v_copy in select item->>'editionId' edition_id,(item->>'cardNumber')::integer card_number,count(*)::integer quantity from jsonb_array_elements(v_give) item group by 1,2 loop
    update public.cyclo_stickers_card_inventory set reserved=reserved+v_copy.quantity where edition_id=v_copy.edition_id and sporting_director_id=v_director and card_number=v_copy.card_number;
  end loop;
  insert into public.cyclo_stickers_cross_trade_offers(from_director_id,to_director_id,request_id,give_items,receive_items,expires_at)
    values(v_director,p_recipient_id,p_request_id,v_give,v_receive,now()+make_interval(hours=>v_expiry)) returning * into v_offer;
  insert into public.sporting_director_messages(sporting_director_id,season_id,message_type,sender_name,subject,preview,body,action_href,action_label,source_reference)
    values(p_recipient_id,v_view.collection_season_id,'system',(select display_name from public.sporting_directors where id=v_director),
      'Proposition d’échange Cyclo-Stickers','Vous avez reçu une proposition d’échange de vignettes.',
      'Chaque vignette indique sa collection. Consultez les cartes proposées et demandées avant de répondre.',
      '/jeu/album?edition='||p_view_edition||'&onglet=echanges&vue=recues','Voir la proposition','cyclo-stickers:trade:'||v_offer.id::text||':proposed')
    on conflict(sporting_director_id,source_reference) do nothing;
  return jsonb_build_object('offerId',v_offer.id,'status','pending','state',private.cyclo_stickers_state(p_view_edition,v_director),'tradeState',public.get_current_cyclo_stickers_trade_inventory());
end;
$$;

create function public.respond_cyclo_stickers_cross_season_trade(p_view_edition text,p_expected_director_id uuid,p_offer_id uuid,p_response text,p_expected_give jsonb,p_expected_receive jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director();v_offer public.cyclo_stickers_cross_trade_offers%rowtype;v_old public.cyclo_stickers_trade_offers%rowtype;
  v_give jsonb;v_receive jsonb;v_expected_give jsonb;v_expected_receive jsonb;v_edition text;v_owner uuid;v_copy record;v_available integer;v_status text;v_old_result jsonb;
begin
  if p_expected_director_id is distinct from v_director then raise exception 'Votre session a changé. Rechargez la page avant de répondre à un échange.'; end if;
  perform private.require_cyclo_stickers_edition(p_view_edition);
  if p_offer_id is null or p_response is null or p_response not in('accept','cancel','decline') then raise exception 'Cette réponse à l’échange n’est pas autorisée.'; end if;
  select * into v_offer from public.cyclo_stickers_cross_trade_offers where id=p_offer_id;
  if not found then
    select * into v_old from public.cyclo_stickers_trade_offers where id=p_offer_id;
    if not found or (p_response='cancel' and v_old.from_director_id<>v_director) or(p_response in('accept','decline') and v_old.to_director_id<>v_director) then raise exception 'Cette réponse à l’échange n’est pas autorisée.'; end if;
    v_give:=private.cyclo_stickers_normalize_items((select jsonb_agg(jsonb_build_object('editionId',v_old.edition_id,'cardNumber',n)) from unnest(v_old.give_cards) n));
    v_receive:=private.cyclo_stickers_normalize_items((select jsonb_agg(jsonb_build_object('editionId',v_old.edition_id,'cardNumber',n)) from unnest(coalesce(v_old.receive_cards,array[v_old.receive_card::integer])) n));
    if p_response='accept' then
      if private.cyclo_stickers_normalize_items(p_expected_give)<>v_give or private.cyclo_stickers_normalize_items(p_expected_receive)<>v_receive then raise exception 'Actualisez la proposition avant de confirmer les collections et cartes demandées.'; end if;
    end if;
    v_old_result:=public.respond_current_cyclo_stickers_trade(v_old.edition_id,p_offer_id,p_response,
      case when p_response='accept' then coalesce(v_old.receive_cards,array[v_old.receive_card::integer]) else null::integer[] end);
    return jsonb_build_object('status',v_old_result->>'status','state',private.cyclo_stickers_state(p_view_edition,v_director),'tradeState',public.get_current_cyclo_stickers_trade_inventory(),
      'receivedItems',case when v_old_result->>'status'='accepted' then private.cyclo_stickers_item_refs(case when v_director=v_old.from_director_id then v_receive else v_give end) else '[]'::jsonb end);
  end if;
  if (p_response='cancel' and v_offer.from_director_id<>v_director) or(p_response in('accept','decline') and v_offer.to_director_id<>v_director) then raise exception 'Cette réponse à l’échange n’est pas autorisée.'; end if;
  perform private.lock_cyclo_stickers_cross_collections(v_offer.give_items||v_offer.receive_items,array[v_offer.from_director_id,v_offer.to_director_id]);
  for v_edition in select distinct item->>'editionId' from jsonb_array_elements(v_offer.give_items||v_offer.receive_items) item order by 1 loop
    foreach v_owner in array array[v_offer.from_director_id,v_offer.to_director_id] loop perform private.expire_cyclo_stickers_offers(v_edition,v_owner); end loop;
  end loop;
  select * into v_offer from public.cyclo_stickers_cross_trade_offers where id=p_offer_id for update;
  if v_offer.status<>'pending' then
    return jsonb_build_object('status',v_offer.status,'state',private.cyclo_stickers_state(p_view_edition,v_director),'tradeState',public.get_current_cyclo_stickers_trade_inventory(),
      'receivedItems',case when v_offer.status='accepted' then private.cyclo_stickers_item_refs(case when v_director=v_offer.from_director_id then v_offer.receive_items else v_offer.give_items end) else '[]'::jsonb end);
  end if;
  v_status:=case p_response when 'accept' then 'accepted' when 'cancel' then 'cancelled' else 'declined' end;
  if p_response='accept' then
    v_expected_give:=private.cyclo_stickers_normalize_items(p_expected_give);v_expected_receive:=private.cyclo_stickers_normalize_items(p_expected_receive);
    if v_expected_give<>v_offer.give_items or v_expected_receive<>v_offer.receive_items then raise exception 'Actualisez la proposition avant de confirmer les collections et cartes demandées.'; end if;
    for v_edition in select distinct item->>'editionId' from jsonb_array_elements(v_offer.give_items||v_offer.receive_items) item loop perform private.require_cyclo_stickers_edition(v_edition); end loop;
    if not exists(select 1 from public.sporting_directors where id=v_offer.from_director_id and status='active' and auth_user_id is not null) then raise exception 'Ce collectionneur n’est plus actif.'; end if;
    for v_copy in select item->>'editionId' edition_id,(item->>'cardNumber')::integer card_number,count(*)::integer quantity from jsonb_array_elements(v_offer.give_items) item group by 1,2 loop
      if not exists(select 1 from public.cyclo_stickers_card_inventory where edition_id=v_copy.edition_id and sporting_director_id=v_offer.from_director_id and card_number=v_copy.card_number and reserved>=v_copy.quantity and quantity>=reserved+1) then raise exception 'Les copies réservées de cette proposition sont indisponibles.'; end if;
    end loop;
    for v_copy in select item->>'editionId' edition_id,(item->>'cardNumber')::integer card_number,count(*)::integer quantity from jsonb_array_elements(v_offer.receive_items) item group by 1,2 loop
      select quantity-reserved-1 into v_available from public.cyclo_stickers_card_inventory where edition_id=v_copy.edition_id and sporting_director_id=v_offer.to_director_id and card_number=v_copy.card_number;
      if coalesce(v_available,0)<v_copy.quantity then raise exception 'Une des cartes demandées n’est plus disponible.'; end if;
    end loop;
    for v_copy in select item->>'editionId' edition_id,(item->>'cardNumber')::integer card_number,count(*)::integer quantity from jsonb_array_elements(v_offer.receive_items) item group by 1,2 loop
      update public.cyclo_stickers_card_inventory set quantity=quantity-v_copy.quantity where edition_id=v_copy.edition_id and sporting_director_id=v_offer.to_director_id and card_number=v_copy.card_number;
      insert into public.cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity) values(v_copy.edition_id,v_offer.from_director_id,v_copy.card_number,v_copy.quantity)
        on conflict(edition_id,sporting_director_id,card_number) do update set quantity=public.cyclo_stickers_card_inventory.quantity+excluded.quantity;
    end loop;
  end if;
  for v_copy in select item->>'editionId' edition_id,(item->>'cardNumber')::integer card_number,count(*)::integer quantity from jsonb_array_elements(v_offer.give_items) item group by 1,2 loop
    update public.cyclo_stickers_card_inventory set reserved=reserved-v_copy.quantity,quantity=quantity-case when p_response='accept' then v_copy.quantity else 0 end
      where edition_id=v_copy.edition_id and sporting_director_id=v_offer.from_director_id and card_number=v_copy.card_number;
    if p_response='accept' then
      insert into public.cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity) values(v_copy.edition_id,v_offer.to_director_id,v_copy.card_number,v_copy.quantity)
        on conflict(edition_id,sporting_director_id,card_number) do update set quantity=public.cyclo_stickers_card_inventory.quantity+excluded.quantity;
    end if;
  end loop;
  update public.cyclo_stickers_cross_trade_offers set status=v_status,responded_at=now() where id=p_offer_id;
  if p_response='accept' then
    update public.cyclo_stickers_collections set accepted_trade_count=accepted_trade_count+1
      where sporting_director_id in(v_offer.from_director_id,v_offer.to_director_id)
        and edition_id in(select distinct item->>'editionId' from jsonb_array_elements(v_offer.give_items||v_offer.receive_items) item);
  end if;
  return jsonb_build_object('status',v_status,'state',private.cyclo_stickers_state(p_view_edition,v_director),'tradeState',public.get_current_cyclo_stickers_trade_inventory(),
    'receivedItems',case when v_status='accepted' then private.cyclo_stickers_item_refs(case when v_director=v_offer.from_director_id then v_offer.receive_items else v_offer.give_items end) else '[]'::jsonb end);
end;
$$;

-- Make old clients see reservations from both kinds of offer. No existing
-- receipt, offer, copied sticker or read mailbox message is rewritten.
do $patch_legacy$
declare v_definition text;v_old text;v_new text;v_signature text;
begin
  v_signature:='private.cyclo_stickers_state(text,uuid)';
  v_definition:=replace(pg_get_functiondef(v_signature::regprocedure),chr(13),'');
  v_old:=$old$'reserved',coalesce((select count(*) from public.cyclo_stickers_trade_offers o cross join lateral unnest(o.give_cards) n
        where o.edition_id=p_edition and o.from_director_id=p_director and o.status='pending' and o.expires_at>now() and n=i.card_number),0)$old$;
  v_new:=$new$'reserved',private.cyclo_stickers_active_reservations(p_edition,p_director,i.card_number)$new$;
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then raise exception 'Unexpected sticker reservation projection.'; end if;
  execute replace(v_definition,v_old,v_new);
  v_signature:='public.propose_current_cyclo_stickers_trade(text,uuid,uuid,integer[],integer[])';
  v_definition:=replace(pg_get_functiondef(v_signature::regprocedure),chr(13),'');
  v_old:=$old$  perform private.lock_cyclo_stickers_collections(p_edition, array[v_director, p_recipient_id]);$old$;
  v_new:=$new$  perform private.lock_cyclo_stickers_offer_quotas(array[v_director,p_recipient_id]);
  perform private.lock_cyclo_stickers_collections(p_edition, array[v_director, p_recipient_id]);$new$;
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then raise exception 'Unexpected sticker quota locking anchor.'; end if;
  v_definition:=replace(v_definition,v_old,v_new);
  v_old:=$old$(select count(*) from public.cyclo_stickers_trade_offers where from_director_id = v_director and created_at > now() - interval '24 hours')$old$;
  v_new:=$new$((select count(*) from public.cyclo_stickers_trade_offers where from_director_id = v_director and created_at > now() - interval '24 hours') + (select count(*) from public.cyclo_stickers_cross_trade_offers where from_director_id=v_director and created_at>now()-interval '24 hours'))$new$;
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then raise exception 'Unexpected sticker daily quota.'; end if;
  v_definition:=replace(v_definition,v_old,v_new);
  v_old:=$old$(select count(*) from public.cyclo_stickers_trade_offers where edition_id = p_edition and to_director_id = p_recipient_id and status = 'pending' and expires_at > now())$old$;
  v_new:=$new$((select count(*) from public.cyclo_stickers_trade_offers where to_director_id=p_recipient_id and status='pending' and expires_at>now()) + (select count(*) from public.cyclo_stickers_cross_trade_offers where to_director_id=p_recipient_id and status='pending' and expires_at>now()))$new$;
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then raise exception 'Unexpected sticker incoming quota.'; end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
  -- Legacy stock/consent rules are deliberately unchanged, so an already
  -- pending offer requesting its final loose copy remains actionable.
  v_signature:='public.search_current_cyclo_stickers_trade_matches(text,integer[],integer[],text,integer)';
  v_definition:=replace(pg_get_functiondef(v_signature::regprocedure),chr(13),'');
  v_old:=$old$(
      select count(*)
      from public.cyclo_stickers_trade_offers as offer
      cross join lateral unnest(offer.give_cards) as reserved(card_number)
      where offer.edition_id = p_edition and offer.from_director_id = v_director
        and offer.status = 'pending' and offer.expires_at > now()
        and reserved.card_number = proposed.card_number
    )$old$;
  v_new:=$new$private.cyclo_stickers_active_reservations(p_edition,v_director,proposed.card_number)$new$;
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then raise exception 'Unexpected legacy own-stock reservation search.'; end if;
  v_definition:=replace(v_definition,v_old,v_new);
  v_old:=$old$    select candidate.director_id, reserved.card_number, count(*)::integer as quantity
    from candidates as candidate
    join public.cyclo_stickers_trade_offers as offer
      on offer.edition_id = p_edition and offer.from_director_id = candidate.director_id
      and offer.status = 'pending' and offer.expires_at > now()
    cross join lateral unnest(offer.give_cards) as reserved(card_number)
    group by candidate.director_id, reserved.card_number$old$;
  v_new:=$new$    select stock.director_id,stock.card_number,
      private.cyclo_stickers_active_reservations(p_edition,stock.director_id,stock.card_number) as quantity
    from stock$new$;
  if length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old) then raise exception 'Unexpected legacy candidate reservation search.'; end if;
  execute replace(v_definition,v_old,v_new);
end;
$patch_legacy$;

create or replace function public.get_current_game_header_indicators_v4()
returns table(current_sporting_director_id uuid,mailbox_unread_count integer,direct_message_unread_count integer,
  has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text,collector_album_available boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  return query select i.current_sporting_director_id,i.mailbox_unread_count,i.direct_message_unread_count,i.has_unread_global_chat,i.has_unread_cyclogazette,i.game_role,
    i.current_sporting_director_id is not null and exists(select 1 from private.cyclo_stickers_public_editions())
    from public.get_current_game_header_indicators_v3() i;
end;
$$;

create or replace function public.get_current_game_header_indicators_v5()
returns table(current_sporting_director_id uuid,mailbox_unread_count integer,direct_message_unread_count integer,
  has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text,collector_album_available boolean,
  collector_album_has_unopened_boosters boolean)
language sql stable security definer set search_path='' as $$
  select i.*,case when i.collector_album_available then exists(
    select 1 from private.cyclo_stickers_public_editions() e join public.cyclo_stickers_booster_inventory b
      on b.collection_season_id=e.collection_season_id and b.source_season_id=e.source_season_id
      where b.sporting_director_id=i.current_sporting_director_id and b.opened_at is null
  ) else false end
  from public.get_current_game_header_indicators_v4() i;
$$;

create or replace function public.get_current_game_header_indicators_v7()
returns table(current_sporting_director_id uuid,mailbox_unread_count integer,direct_message_unread_count integer,
  has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text,collector_album_available boolean,
  collector_album_has_unopened_boosters boolean,has_unread_global_chat_quiz boolean,global_chat_quiz_unread_until timestamptz,
  collector_album_pending_trade_count integer)
language sql stable security definer set search_path='' as $$
  select i.*,
    case when i.collector_album_available and i.current_sporting_director_id is not null then
      ((select count(*) from public.cyclo_stickers_trade_offers o join private.cyclo_stickers_public_editions() e on e.edition_id=o.edition_id
        where o.to_director_id=i.current_sporting_director_id and o.status='pending' and o.expires_at>now())
       +(select count(*) from public.cyclo_stickers_cross_trade_offers o where o.to_director_id=i.current_sporting_director_id and o.status='pending' and o.expires_at>now()
         and not exists(select 1 from jsonb_array_elements(o.give_items||o.receive_items) item where not exists(select 1 from private.cyclo_stickers_public_editions() e where e.edition_id=item->>'editionId'))))::integer
      else 0 end
  from public.get_current_game_header_indicators_v6() i;
$$;

revoke all on function private.cyclo_stickers_public_editions(),private.cyclo_stickers_normalize_items(jsonb,integer,boolean),
  private.cyclo_stickers_item_refs(jsonb),private.lock_cyclo_stickers_cross_collections(jsonb,uuid[],boolean),
  private.lock_cyclo_stickers_offer_quotas(uuid[]),
  private.expire_cyclo_stickers_cross_offers(text,uuid),private.cyclo_stickers_active_reservations(text,uuid,integer),
  private.cyclo_stickers_cross_trade_json(public.cyclo_stickers_cross_trade_offers) from public,anon,authenticated,service_role;
revoke all on function public.get_current_cyclo_stickers_library(),public.get_cyclo_stickers_catalogue(text),
  public.get_current_cyclo_stickers_trade_inventory(),public.search_cyclo_stickers_cross_season_matches(jsonb,jsonb,text,integer),
  public.propose_cyclo_stickers_cross_season_trade(text,uuid,uuid,uuid,jsonb,jsonb),
  public.respond_cyclo_stickers_cross_season_trade(text,uuid,uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.get_current_cyclo_stickers_library(),public.get_cyclo_stickers_catalogue(text),
  public.get_current_cyclo_stickers_trade_inventory(),public.search_cyclo_stickers_cross_season_matches(jsonb,jsonb,text,integer),
  public.propose_cyclo_stickers_cross_season_trade(text,uuid,uuid,uuid,jsonb,jsonb),
  public.respond_cyclo_stickers_cross_season_trade(text,uuid,uuid,text,jsonb,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
