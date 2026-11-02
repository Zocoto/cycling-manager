begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

-- Existing immediate cash/trade cores remain unchanged. Refuse source drift.
do $preflight$
begin
  if md5(replace(pg_get_functiondef('public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure),chr(13),'')) <> 'e59e973844a59dd7cc902e8a8df0baa8'
    or md5(replace(pg_get_functiondef('public.enforce_team_roster_capacity()'::regprocedure),chr(13),'')) <> 'ce9b957ae9406ecde64b62c8e78e8ad3'
  then raise exception 'Deferred transfer source drift: review required'; end if;
end;
$preflight$;

alter table public.direct_transfer_offers
  add column effective_season_id uuid references public.seasons(id) on delete restrict,
  add column effective_contract_id uuid references public.rider_contracts(id) on delete restrict,
  add column offered_effective_contract_id uuid references public.rider_contracts(id) on delete restrict,
  add column escrowed_at timestamptz,
  add column released_at timestamptz,
  add column released_team_season_id uuid references public.team_seasons(id) on delete restrict;

-- Cash offers normally have no gross quotation. A deferred cash signing needs
-- that quotation too, so normal INSERT salary discounts are applied only once.
alter table public.direct_transfer_offers drop constraint direct_transfer_offers_trade_shape;
alter table public.direct_transfer_offers add constraint direct_transfer_offers_trade_shape check (
  (offered_rider_id is null and offered_rider_salary_per_season is null
    and offered_rider_salary_before_team_discounts is null
    and (salary_before_team_discounts is null or
      (effective_season_id is not null and salary_before_team_discounts >= 0)))
  or (offered_rider_id is not null and offered_rider_id <> rider_id
    and offered_rider_salary_per_season is not null
    and salary_before_team_discounts is not null
    and offered_rider_salary_before_team_discounts is not null
    and offered_rider_salary_per_season >= 0 and salary_before_team_discounts >= 0
    and offered_rider_salary_before_team_discounts >= 0)
);
alter table public.direct_transfer_offers add constraint direct_transfer_offers_deferred_shape check (
  (effective_season_id is null and effective_contract_id is null and offered_effective_contract_id is null
    and escrowed_at is null and released_at is null and released_team_season_id is null)
  or (effective_season_id is not null and effective_season_id <> season_id
    and salary_before_team_discounts is not null
    and ((status = 'accepted' and effective_contract_id is not null and escrowed_at is not null
      and (offered_rider_id is null or offered_effective_contract_id is not null))
      or (status <> 'accepted' and effective_contract_id is null and offered_effective_contract_id is null
        and escrowed_at is null and released_at is null and released_team_season_id is null)))
  and ((released_at is null and released_team_season_id is null)
    or (released_at is not null and released_team_season_id is not null and escrowed_at is not null))
);
create unique index direct_transfer_offers_effective_contract_idx
  on public.direct_transfer_offers(effective_contract_id) where effective_contract_id is not null;
create unique index direct_transfer_offers_offered_effective_contract_idx
  on public.direct_transfer_offers(offered_effective_contract_id) where offered_effective_contract_id is not null;
create index direct_transfer_offers_deferred_departure_idx
  on public.direct_transfer_offers(rider_id,seller_team_id,effective_season_id)
  where status='accepted' and effective_season_id is not null;
create index direct_transfer_offers_deferred_counterpart_departure_idx
  on public.direct_transfer_offers(offered_rider_id,buyer_team_id,effective_season_id)
  where status='accepted' and effective_season_id is not null and offered_rider_id is not null;
create index direct_transfer_offers_deferred_received_idx
  on public.direct_transfer_offers(buyer_team_id,season_id,created_at desc)
  where status='accepted' and effective_season_id is not null;
create index direct_transfer_offers_unreleased_escrow_idx
  on public.direct_transfer_offers(seller_team_id,effective_season_id,id)
  where status='accepted' and effective_season_id is not null and released_at is null;

comment on column public.direct_transfer_offers.effective_season_id is
  'NULL : transfert immédiat historique ; sinon arrivée définitive au début de cette saison, indemnité bloquée à acceptation et versée au vendeur lors de l’arrivée.';

-- Shortening an unchanged contract never adds a roster commitment. A team
-- already above its ceiling must be able to sell multiple future departures.
do $capacity$
declare v_definition text; v_old text; v_new text;
begin
  v_definition := replace(pg_get_functiondef('public.enforce_team_roster_capacity()'::regprocedure),chr(13),'');
  v_old := $old$  if new.status not in ('active', 'planned') then return new; end if;$old$;
  v_new := $new$  if new.status not in ('active', 'planned') then return new; end if;
  if tg_op = 'UPDATE' and new.rider_id = old.rider_id and new.team_id = old.team_id
    and new.status = old.status and new.acquisition_type is not distinct from old.acquisition_type
    and new.start_season_id = old.start_season_id and new.end_season_id <> old.end_season_id
    and exists (
      select 1 from public.seasons shorter, public.seasons previous, public.seasons first
      where shorter.id = new.end_season_id and previous.id = old.end_season_id
        and first.id = new.start_season_id
        and shorter.game_year between first.game_year and previous.game_year
    ) then return new; end if;$new$;
  if position(v_old in v_definition)=0 then raise exception 'Unexpected roster capacity body'; end if;
  execute replace(v_definition,v_old,v_new);
end;
$capacity$;

create function private.assert_deferred_rider_eligible(p_rider_id uuid,p_team_id uuid,p_current_year integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select concat_ws(' ',r.first_name,r.last_name) into v_name from public.riders r
  where r.id=p_rider_id and r.status='active';
  if v_name is null or not exists (
    select 1 from public.rider_contracts c join public.seasons s on s.id=c.start_season_id
    join public.seasons e on e.id=c.end_season_id
    where c.rider_id=p_rider_id and c.team_id=p_team_id and c.status='active'
      and p_current_year between s.game_year and e.game_year
  ) then raise exception 'Un coureur proposé n’appartient plus à l’équipe attendue ou n’est plus actif.'; end if;
  if exists (
    select 1 from public.rider_contracts c where c.rider_id=p_rider_id and c.status='planned'
      and (c.team_id<>p_team_id or c.acquisition_type is distinct from 'renewal')
  ) then raise exception '% possède déjà un engagement futur incompatible avec ce transfert.',v_name; end if;
  if exists (select 1 from public.transfer_market_listings l where l.rider_id=p_rider_id and l.status='open')
  then raise exception '% est actuellement proposé aux enchères. Retirez d’abord son enchère.',v_name; end if;
  -- Current-year transfers, races, camps and reconnaissance remain valid: the
  -- rider does not leave now. No current-season race withdrawal is performed.
end;
$$;

create function private.assert_deferred_roster_capacity(p_team_id uuid,p_game_year integer,p_incoming uuid,p_outgoing uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_total integer; v_non_homegrown integer; v_outgoing_present boolean; v_outgoing_homegrown boolean;
begin
  v_total:=public.get_team_roster_commitment_count(p_team_id,p_game_year);
  v_non_homegrown:=public.get_team_non_homegrown_roster_commitment_count(p_team_id,p_game_year);
  select count(*)>0,coalesce(bool_or(c.acquisition_type='academy'
    or public.is_team_homegrown_rider(p_team_id,p_outgoing)),false)
  into v_outgoing_present,v_outgoing_homegrown
  from public.rider_contracts c join public.seasons s on s.id=c.start_season_id
  join public.seasons e on e.id=c.end_season_id
  where c.team_id=p_team_id and c.rider_id=p_outgoing and c.status in ('active','planned')
    and p_game_year between s.game_year and e.game_year;
  if v_outgoing_present then
    v_total:=greatest(0,v_total-1);
    if not v_outgoing_homegrown then v_non_homegrown:=greatest(0,v_non_homegrown-1); end if;
  end if;
  if v_total+1>public.get_team_roster_limit(p_team_id)
    or (not public.is_team_homegrown_rider(p_team_id,p_incoming)
      and v_non_homegrown+1>public.get_team_roster_base_limit(p_team_id))
  then raise exception 'Ce transfert dépasserait la capacité d’effectif pour la saison %.',p_game_year; end if;
end;
$$;

create function public.submit_deferred_direct_transfer_offer(
  p_rider_id uuid,p_amount numeric,p_offered_rider_id uuid default null,p_message text default null
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '2s' set statement_timeout = '8s' as $$
declare
  v_context record; v_seller record; v_next record; v_amount numeric(14,2);
  v_gross numeric; v_other_gross numeric; v_available numeric; v_offer_id uuid;
  v_name text; v_other_name text; v_custom text; v_body text; v_conversation_id uuid;
  v_message public.direct_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'Votre session ne permet pas de proposer un transfert.'; end if;
  if p_rider_id is null or p_rider_id=p_offered_rider_id then raise exception 'Choisissez des coureurs distincts.'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount<(case when p_offered_rider_id is null then 500 else 0 end) or p_amount>100000000
  then raise exception 'Le montant proposé est invalide.'; end if;
  v_amount:=round(p_amount/100)*100;
  v_custom:=replace(replace(btrim(coalesce(p_message,'')),E'\r\n',E'\n'),E'\r',E'\n');
  v_custom:=regexp_replace(v_custom,E'[\t ]+',' ','g');
  v_custom:=regexp_replace(v_custom,E'\n[\t ]+',E'\n','g');
  v_custom:=regexp_replace(v_custom,E'\n{3,}',E'\n\n','g');
  if char_length(v_custom)>500 then raise exception 'Le message ne peut pas dépasser 500 caractères.'; end if;

  perform public.settle_current_team_finances();
  select d.id director_id,a.team_id,s.id season_id,s.game_year,t.id team_season_id,t.display_name,t.currency
  into v_context from public.sporting_directors d
  join public.team_manager_assignments a on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
  join public.seasons s on s.status='active'
  join public.team_seasons t on t.team_id=a.team_id and t.season_id=s.id
  where d.auth_user_id=auth.uid() and d.status='active'
    and not exists(select 1 from public.alpha_bot_managers b where b.sporting_director_id=d.id)
  limit 1;
  if v_context is null then raise exception 'Les transferts différés sont réservés aux équipes gérées par des joueurs.'; end if;
  select d.id director_id,a.team_id,t.id team_season_id,t.display_name into v_seller
  from public.rider_contracts c
  join public.team_manager_assignments a on a.team_id=c.team_id and a.role='general_manager' and a.status='active'
  join public.sporting_directors d on d.id=a.sporting_director_id and d.status='active' and d.auth_user_id is not null
  join public.team_seasons t on t.team_id=a.team_id and t.season_id=v_context.season_id
  where c.rider_id=p_rider_id and c.status='active'
    and not exists(select 1 from public.alpha_bot_managers b where b.sporting_director_id=d.id) limit 1;
  if v_seller is null or v_seller.team_id=v_context.team_id or v_seller.director_id=v_context.director_id
  then raise exception 'Choisissez un coureur d’une autre équipe gérée par un joueur.'; end if;

  perform s.id from public.seasons s where s.id=v_context.season_id and s.status='active' for share nowait;
  if not found then raise exception 'La saison a changé. Actualisez la page.'; end if;
  select s.id,s.game_year,s.name into v_next from public.seasons s
  where s.game_year=v_context.game_year+1 and s.status='planned' for share nowait;
  if v_next is null then
    perform public.ensure_transfer_next_season(v_context.season_id);
    select s.id,s.game_year,s.name into v_next from public.seasons s
    where s.game_year=v_context.game_year+1 and s.status='planned' for share nowait;
  end if;
  if v_next is null then raise exception 'La saison suivante n’est pas disponible.'; end if;
  perform private.lock_direct_transfer_scope(v_context.season_id,array[v_context.team_id,v_seller.team_id],array[p_rider_id,p_offered_rider_id]);
  perform private.assert_deferred_rider_eligible(p_rider_id,v_seller.team_id,v_context.game_year);
  if p_offered_rider_id is not null then
    perform private.assert_deferred_rider_eligible(p_offered_rider_id,v_context.team_id,v_context.game_year);
    if exists(select 1 from public.direct_transfer_offers o where o.status='pending'
      and (o.rider_id=p_offered_rider_id or o.offered_rider_id=p_offered_rider_id))
    then raise exception 'Le coureur proposé est déjà impliqué dans une offre en attente.'; end if;
    perform private.assert_deferred_roster_capacity(v_seller.team_id,v_next.game_year,p_offered_rider_id,p_rider_id);
  end if;
  if exists(select 1 from public.direct_transfer_offers o where o.status='pending'
    and o.buyer_team_id=v_context.team_id and o.rider_id=p_rider_id)
  then raise exception 'Votre équipe a déjà une offre en attente pour ce coureur.'; end if;
  perform private.assert_deferred_roster_capacity(v_context.team_id,v_next.game_year,p_rider_id,p_offered_rider_id);
  select t.cash_balance-public.get_team_transfer_reserved_budget(v_context.team_id)
  into v_available from public.team_seasons t where t.id=v_context.team_season_id;
  if v_amount>0 and v_available<v_amount then raise exception 'Votre trésorerie disponible ne couvre pas cette offre.'; end if;
  v_gross:=public.calculate_rider_season_salary(p_rider_id,v_next.id);
  if p_offered_rider_id is not null then v_other_gross:=public.calculate_rider_season_salary(p_offered_rider_id,v_next.id); end if;
  insert into public.direct_transfer_offers(season_id,rider_id,buyer_team_id,seller_team_id,submitted_by_director_id,
    offered_amount,salary_per_season,currency_code,offered_rider_id,offered_rider_salary_per_season,
    salary_before_team_discounts,offered_rider_salary_before_team_discounts,effective_season_id)
  values(v_context.season_id,p_rider_id,v_context.team_id,v_seller.team_id,v_context.director_id,
    v_amount,private.quote_direct_transfer_salary(p_rider_id,v_context.team_id,v_next.id,v_gross),v_context.currency,
    p_offered_rider_id,case when p_offered_rider_id is not null then
      private.quote_direct_transfer_salary(p_offered_rider_id,v_seller.team_id,v_next.id,v_other_gross) end,
    v_gross,v_other_gross,v_next.id) returning id into v_offer_id;

  select concat_ws(' ',first_name,last_name) into v_name from public.riders where id=p_rider_id;
  select concat_ws(' ',first_name,last_name) into v_other_name from public.riders where id=p_offered_rider_id;
  v_body:=format('💼 %s propose %s %s%s pour %s. Arrivée au début de %s ; indemnité bloquée à l’acceptation et versée au vendeur à l’arrivée. Le nouveau contrat couvre cette saison suivante.',
    v_context.display_name,v_amount,v_context.currency,
    case when p_offered_rider_id is not null then ' + '||v_other_name else '' end,v_name,v_next.name);
  insert into public.sporting_director_messages(sporting_director_id,season_id,team_season_id,message_type,sender_name,
    subject,preview,body,action_href,action_label,source_reference,is_important)
  values(v_seller.director_id,v_context.season_id,v_seller.team_season_id,'system',v_context.display_name,
    'Offre différée pour '||v_name,left(v_body,240),v_body||' Les coureurs restent disponibles dans leur équipe actuelle jusqu’à la fin de saison. Les prolongations de cette équipe seront remplacées uniquement en cas d’acceptation.',
    '/jeu/transferts?onglet=offres','Examiner l’offre','direct-transfer-offer:'||v_offer_id::text||':received',true);
  v_conversation_id:=public.get_or_create_current_direct_conversation(v_seller.director_id);
  v_body:=v_body||case when v_custom<>'' then E'\n\nMessage du DS :\n'||v_custom else '' end||E'\n\nVoir l’offre : /jeu/transferts?onglet=offres';
  if char_length(v_body)>1000 then raise exception 'Le message associé à cette offre est trop long.'; end if;
  insert into public.direct_messages(conversation_id,sender_id,recipient_id,body,message_type,source_reference)
  values(v_conversation_id,v_context.director_id,v_seller.director_id,v_body,'transfer_offer',
    'direct-transfer-offer:'||v_offer_id::text||':chat') returning * into v_message;
  update public.direct_conversations set last_message_sender_id=v_context.director_id,last_message_body=v_body,
    last_message_at=v_message.created_at,updated_at=v_message.created_at where id=v_conversation_id;
  insert into public.direct_conversation_states(conversation_id,sporting_director_id,unread_count,last_activity_at)
  values(v_conversation_id,v_seller.director_id,1,v_message.created_at)
  on conflict(conversation_id,sporting_director_id) do update set
    unread_count=public.direct_conversation_states.unread_count+1,last_activity_at=excluded.last_activity_at;
  insert into public.direct_conversation_states(conversation_id,sporting_director_id,unread_count,last_read_at,last_activity_at)
  values(v_conversation_id,v_context.director_id,0,v_message.created_at,v_message.created_at)
  on conflict(conversation_id,sporting_director_id) do update set unread_count=0,last_read_at=excluded.last_read_at,last_activity_at=excluded.last_activity_at;
  return jsonb_build_object('offerId',v_offer_id,'conversationId',v_conversation_id);
end;
$$;

create function private.respond_to_deferred_direct_transfer_offer(p_offer_id uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_buyer record; v_next record; v_offer public.direct_transfer_offers%rowtype;
  v_available numeric; v_contract uuid; v_other_contract uuid; v_net numeric; v_other_net numeric;
  v_name text; v_other_name text; v_note text;
begin
  select d.id director_id,a.team_id,s.id season_id,s.game_year,coalesce(s.current_day_number,1) day_number,
    t.id team_season_id,t.display_name into v_context
  from public.sporting_directors d
  join public.team_manager_assignments a on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
  join public.seasons s on s.status='active'
  join public.team_seasons t on t.team_id=a.team_id and t.season_id=s.id
  where d.auth_user_id=auth.uid() and d.status='active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;
  if p_accept is null then raise exception 'La décision transmise est invalide.'; end if;
  select * into v_offer from public.direct_transfer_offers where id=p_offer_id;
  if v_offer.id is null or v_offer.seller_team_id<>v_context.team_id or v_offer.effective_season_id is null
  then raise exception 'Cette offre ne concerne pas votre équipe.'; end if;
  perform s.id from public.seasons s where s.id=v_context.season_id and s.status='active' for share nowait;
  if not found then raise exception 'La saison a changé. Actualisez la page.'; end if;
  select id,game_year,name into v_next from public.seasons
  where id=v_offer.effective_season_id and game_year=v_context.game_year+1 and status='planned' for share nowait;
  if v_next is null or v_offer.season_id<>v_context.season_id then raise exception 'Cette offre différée appartient à une saison terminée.'; end if;
  perform private.lock_direct_transfer_scope(v_context.season_id,array[v_offer.buyer_team_id,v_offer.seller_team_id],array[v_offer.rider_id,v_offer.offered_rider_id]);
  select * into v_offer from public.direct_transfer_offers where id=p_offer_id for update nowait;
  if v_offer.status<>'pending' then raise exception 'Cette offre a déjà reçu une réponse.'; end if;
  select d.id director_id,t.id team_season_id,t.display_name into v_buyer from public.team_seasons t
  join public.team_manager_assignments a on a.team_id=t.team_id and a.role='general_manager' and a.status='active'
  join public.sporting_directors d on d.id=a.sporting_director_id and d.status='active' and d.auth_user_id is not null
  where t.team_id=v_offer.buyer_team_id and t.season_id=v_context.season_id
    and not exists(select 1 from public.alpha_bot_managers b where b.sporting_director_id=d.id) limit 1;
  select concat_ws(' ',first_name,last_name) into v_name from public.riders where id=v_offer.rider_id;
  select concat_ws(' ',first_name,last_name) into v_other_name from public.riders where id=v_offer.offered_rider_id;
  if not p_accept then
    update public.direct_transfer_offers set status='rejected',responded_by_director_id=v_context.director_id,responded_at=now() where id=v_offer.id;
    insert into public.sporting_director_messages(sporting_director_id,season_id,team_season_id,message_type,sender_name,
      subject,preview,body,action_href,action_label,source_reference,is_important)
    values(v_offer.submitted_by_director_id,v_context.season_id,v_buyer.team_season_id,'system',v_context.display_name,
      'Offre différée refusée · '||v_name,'Votre offre différée a été refusée.',v_context.display_name||' a refusé le transfert prévu au début de '||v_next.name||'.',
      '/jeu/transferts?onglet=offres','Voir les offres','direct-transfer-offer:'||v_offer.id::text||':rejected',false);
    return null;
  end if;
  if v_buyer.team_season_id is null or v_buyer.director_id<>v_offer.submitted_by_director_id
    or exists(select 1 from public.alpha_bot_managers b where b.sporting_director_id=v_context.director_id)
  then raise exception 'L’un des responsables de ce transfert n’est plus un joueur actif de son équipe.'; end if;
  perform private.assert_deferred_rider_eligible(v_offer.rider_id,v_offer.seller_team_id,v_context.game_year);
  if v_offer.offered_rider_id is not null then
    perform private.assert_deferred_rider_eligible(v_offer.offered_rider_id,v_offer.buyer_team_id,v_context.game_year);
    perform private.assert_deferred_roster_capacity(v_offer.seller_team_id,v_next.game_year,v_offer.offered_rider_id,v_offer.rider_id);
  end if;
  perform private.assert_deferred_roster_capacity(v_offer.buyer_team_id,v_next.game_year,v_offer.rider_id,v_offer.offered_rider_id);
  select cash_balance-public.get_team_transfer_reserved_budget(v_offer.buyer_team_id,v_offer.id,null)
  into v_available from public.team_seasons where id=v_buyer.team_season_id;
  if v_offer.offered_amount>0 and v_available<v_offer.offered_amount
  then raise exception 'L’équipe acheteuse ne dispose plus de la trésorerie nécessaire.'; end if;

  -- Replace only the source clubs' own renewals, including S+2. Current
  -- contracts, wages, races and equipment continue through the current season.
  update public.rider_contracts set status='cancelled'
  where status='planned' and acquisition_type='renewal' and
    ((rider_id=v_offer.rider_id and team_id=v_offer.seller_team_id)
      or (rider_id=v_offer.offered_rider_id and team_id=v_offer.buyer_team_id));
  update public.rider_contracts c set end_season_id=v_context.season_id
  from public.seasons e where c.end_season_id=e.id and e.game_year>v_context.game_year and c.status='active'
    and ((c.rider_id=v_offer.rider_id and c.team_id=v_offer.seller_team_id)
      or (c.rider_id=v_offer.offered_rider_id and c.team_id=v_offer.buyer_team_id));
  insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,salary_per_season,currency,currency_code,
    status,signed_at,acquisition_type,transfer_locked_season_id,transfer_fee)
  values(v_offer.rider_id,v_offer.buyer_team_id,v_next.id,v_next.id,v_offer.salary_before_team_discounts,
    v_offer.currency_code,v_offer.currency_code,'planned',now(),'direct_offer',v_next.id,v_offer.offered_amount)
  returning id,salary_per_season into v_contract,v_net;
  if v_offer.offered_rider_id is not null then
    insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,salary_per_season,currency,currency_code,
      status,signed_at,acquisition_type,transfer_locked_season_id,transfer_fee)
    values(v_offer.offered_rider_id,v_offer.seller_team_id,v_next.id,v_next.id,v_offer.offered_rider_salary_before_team_discounts,
      v_offer.currency_code,v_offer.currency_code,'planned',now(),'direct_offer',v_next.id,0)
    returning id,salary_per_season into v_other_contract,v_other_net;
  end if;
  update public.direct_transfer_offers set status='accepted',responded_by_director_id=v_context.director_id,responded_at=now(),
    effective_contract_id=v_contract,offered_effective_contract_id=v_other_contract,
    salary_per_season=v_net,offered_rider_salary_per_season=v_other_net,escrowed_at=now() where id=v_offer.id;
  perform public.cancel_pending_direct_transfer_offers(v_offer.rider_id,v_offer.seller_team_id,'Le coureur a accepté un transfert différé.');
  if v_offer.offered_rider_id is not null then
    perform public.cancel_pending_direct_transfer_offers(v_offer.offered_rider_id,v_offer.buyer_team_id,'Le coureur a accepté un échange différé.');
  end if;
  if v_offer.offered_amount>0 then
    insert into public.team_finance_transactions(team_season_id,day_number,amount,category,status,description,source_reference,posted_at)
    values(v_buyer.team_season_id,v_context.day_number,-v_offer.offered_amount,'transfer','posted',
      'Indemnité de transfert bloquée · '||v_name,'direct-transfer-purchase:'||v_offer.id::text,now());
    update public.team_seasons set cash_balance=cash_balance-v_offer.offered_amount where id=v_buyer.team_season_id;
  end if;
  v_note:=format('Transfert définitif prévu au début de %s : %s%s. Indemnité de %s %s bloquée chez l’acheteur jusqu’à l’arrivée, puis versée au vendeur. Les coureurs restent dans leur équipe actuelle jusqu’à la fin de saison ; les nouveaux contrats couvrent %s.',
    v_next.name,v_name,case when v_offer.offered_rider_id is not null then ' contre '||v_other_name else '' end,
    v_offer.offered_amount,v_offer.currency_code,v_next.name);
  insert into public.sporting_director_messages(sporting_director_id,season_id,team_season_id,message_type,sender_name,
    subject,preview,body,action_href,action_label,source_reference,is_important)
  values(v_offer.submitted_by_director_id,v_context.season_id,v_buyer.team_season_id,'system',v_context.display_name,
    'Transfert différé accepté · '||v_name,v_name||' arrivera au début de '||v_next.name||'.',v_note,
    '/jeu/transferts?onglet=offres','Voir le transfert programmé','direct-transfer-offer:'||v_offer.id::text||':accepted',true),
    (v_context.director_id,v_context.season_id,v_context.team_season_id,'system',v_buyer.display_name,
    'Transfert différé conclu · '||v_name,'Départ prévu au début de '||v_next.name||'.',v_note,
    '/jeu/transferts?onglet=offres','Voir le transfert programmé','direct-transfer-offer:'||v_offer.id::text||':accepted',true);
  return v_contract;
end;
$$;

-- Dispatch before the existing immediate workflow acquires its team locks.
-- The new path uses the same season -> team -> rider ordering as submission.
do $dispatch$
declare v_definition text; v_old text; v_new text;
begin
  v_definition:=replace(pg_get_functiondef('public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure),chr(13),'');
  v_old:=$old$begin
  select director.id as director_id$old$;
  v_new:=$new$begin
  if exists (select 1 from public.direct_transfer_offers where id=p_offer_id and effective_season_id is not null) then
    return private.respond_to_deferred_direct_transfer_offer(p_offer_id,p_accept);
  end if;
  select director.id as director_id$new$;
  if position(v_old in v_definition)=0 then raise exception 'Unexpected direct transfer response body'; end if;
  execute replace(v_definition,v_old,v_new);
end;
$dispatch$;

-- An accepted, paid future contract is binding. Older immediate transfer or
-- auction code must not silently cancel it, nor may the source club leave early
-- or extend its current contract across the agreed handover.
create function private.guard_deferred_transfer_contract()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_offer public.direct_transfer_offers%rowtype; v_source_year integer; v_effective_year integer;
begin
  if old.status='planned' then
    select * into v_offer from public.direct_transfer_offers
    where status='accepted' and (effective_contract_id=old.id or offered_effective_contract_id=old.id) limit 1;
    if v_offer.id is not null then
      if tg_op='DELETE' then raise exception 'Ce contrat fait partie d’un transfert différé accepté et ne peut pas être supprimé.'; end if;
      if new.team_id<>old.team_id or new.rider_id<>old.rider_id or new.start_season_id<>old.start_season_id
        or (select game_year from public.seasons where id=new.end_season_id)<(select game_year from public.seasons where id=old.end_season_id)
        or new.status not in ('planned','active')
        or (new.status='active' and not exists(select 1 from public.seasons where id=new.start_season_id and status='active'))
      then raise exception 'Ce contrat fait partie d’un transfert différé accepté et ne peut pas être annulé ou raccourci.'; end if;
    end if;
  end if;
  if old.status='active' then
    select o.* into v_offer from public.direct_transfer_offers o
    where o.status='accepted' and o.effective_season_id is not null and (
      (o.rider_id=old.rider_id and o.seller_team_id=old.team_id)
      or (o.offered_rider_id=old.rider_id and o.buyer_team_id=old.team_id))
      and exists(select 1 from public.seasons s where s.id=o.season_id and s.status='active') limit 1;
    if v_offer.id is not null then
      if tg_op='DELETE' then raise exception 'Ce coureur doit rester dans son équipe jusqu’au transfert différé accepté.'; end if;
      if new.team_id<>old.team_id or new.rider_id<>old.rider_id or new.start_season_id<>old.start_season_id or new.status<>'active'
        or (select game_year from public.seasons where id=new.end_season_id)>=(select game_year from public.seasons where id=v_offer.effective_season_id)
      then raise exception 'Ce coureur doit rester dans son équipe jusqu’au transfert différé accepté.'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_deferred_transfer_contract_before_change
before delete or update of rider_id,team_id,start_season_id,end_season_id,status
on public.rider_contracts for each row execute function private.guard_deferred_transfer_contract();

-- A legacy auction must not be created for a promised future departure: its
-- later settlement would conflict with the binding contract and block the
-- market batch. Share the transfer's rider mutex before inspecting the offer.
create function private.guard_deferred_transfer_listing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status<>'open' then return new; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(new.rider_id::text,0)) then
    raise exception 'Un mouvement concernant ce coureur est déjà en cours. Réessayez dans quelques secondes.'
      using errcode='55P03';
  end if;
  if exists (
    select 1 from public.direct_transfer_offers o
    join public.seasons effective on effective.id=o.effective_season_id
    where o.status='accepted' and o.effective_season_id is not null and effective.status='planned'
      and (o.rider_id=new.rider_id or o.offered_rider_id=new.rider_id)
  ) then
    raise exception 'Ce coureur a déjà un transfert différé accepté. Il ne peut pas être mis aux enchères avant son départ.';
  end if;
  return new;
end;
$$;
create trigger guard_deferred_transfer_listing_before_write
before insert or update of rider_id,status on public.transfer_market_listings
for each row execute function private.guard_deferred_transfer_listing();

-- The legacy departure hook deliberately skips cleanup when ANY successor
-- exists. A deferred move changes clubs, so detach source-team assignments at
-- actual season completion, never while the rider is still racing for it.
create function private.cleanup_deferred_transfer_departure()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_effective_year integer;
begin
  if old.status<>'active' or new.status<>'completed' then return new; end if;
  select effective.game_year into v_effective_year
  from public.direct_transfer_offers o join public.seasons source on source.id=o.season_id
  join public.seasons effective on effective.id=o.effective_season_id
  where o.status='accepted' and source.status='completed' and source.id=old.end_season_id
    and ((o.rider_id=old.rider_id and o.seller_team_id=old.team_id)
      or (o.offered_rider_id=old.rider_id and o.buyer_team_id=old.team_id)) limit 1;
  if v_effective_year is null then return new; end if;
  perform public.detach_departing_rider(old.rider_id,old.team_id,old.end_season_id,28);
  delete from public.race_stage_equipment_assignments equipment using public.team_seasons team_season,public.stages stage
  where equipment.rider_id=old.rider_id and team_season.id=equipment.team_season_id and team_season.team_id=old.team_id
    and stage.id=equipment.stage_id and stage.status not in ('completed','cancelled');
  update public.rider_training_plan_versions plan set trainer_contract_id=null
  from public.seasons season where plan.rider_id=old.rider_id and plan.team_id=old.team_id
    and season.id=plan.season_id and season.game_year>=v_effective_year;
  return new;
end;
$$;
create trigger cleanup_deferred_transfer_departure_after_status
after update of status on public.rider_contracts for each row execute function private.cleanup_deferred_transfer_departure();

-- Release the held consideration in the SAME transaction as activation. For a
-- swap, neither club is credited before BOTH planned contracts are active.
-- The offer row lock, receipt and unique finance reference prevent double pay.
create function private.release_deferred_transfer_escrow_for_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_offer public.direct_transfer_offers%rowtype; v_team_season_id uuid; v_day integer; v_name text;
begin
  select * into v_offer from public.direct_transfer_offers o
  where o.id=p_offer_id and o.status='accepted' and o.effective_season_id is not null and o.released_at is null
  for update nowait;
  if v_offer.id is null then return; end if;
  -- Protected future contracts cannot be cancelled before activation. A later
  -- completed/terminated contract therefore also proves handover occurred,
  -- allowing a withdrawn seller to recover its escrow after returning later.
  if not exists(select 1 from public.seasons where id=v_offer.effective_season_id and status in ('active','completed'))
    or not exists(select 1 from public.rider_contracts where id=v_offer.effective_contract_id and status<>'planned')
    or (v_offer.offered_rider_id is not null and not exists(
      select 1 from public.rider_contracts where id=v_offer.offered_effective_contract_id and status<>'planned'))
  then return; end if;
  if v_offer.escrowed_at is null then raise exception 'L’indemnité de ce transfert n’a pas été bloquée.'; end if;
  select t.id,coalesce(s.current_day_number,1) into v_team_season_id,v_day
  from public.team_seasons t join public.seasons s on s.id=t.season_id
  where t.team_id=v_offer.seller_team_id and t.status='active'
    and s.game_year>=(select game_year from public.seasons where id=v_offer.effective_season_id)
    and s.status='active' order by s.game_year limit 1
  for update of t nowait;
  -- Missing/withdrawn seller accounts must never abort the global rollover.
  -- The receipt stays unreleased and is retried on account creation/activation.
  if v_team_season_id is null then return; end if;
  if v_offer.offered_amount>0 then
    select concat_ws(' ',first_name,last_name) into v_name from public.riders where id=v_offer.rider_id;
    insert into public.team_finance_transactions(team_season_id,day_number,amount,category,status,description,source_reference,posted_at)
    values(v_team_season_id,v_day,v_offer.offered_amount,'transfer','posted',
      'Transfert différé finalisé · '||v_name,'direct-transfer-sale:'||v_offer.id::text,now());
    update public.team_seasons set cash_balance=cash_balance+v_offer.offered_amount where id=v_team_season_id;
  end if;
  update public.direct_transfer_offers set released_at=now(),released_team_season_id=v_team_season_id where id=v_offer.id;
end;
$$;
create function private.release_deferred_transfer_escrow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_offer_id uuid;
begin
  if old.status<>'planned' or new.status<>'active' then return new; end if;
  select id into v_offer_id from public.direct_transfer_offers o
  where o.status='accepted' and o.effective_season_id=new.start_season_id and o.released_at is null
    and (o.effective_contract_id=new.id or o.offered_effective_contract_id=new.id);
  if v_offer_id is not null then perform private.release_deferred_transfer_escrow_for_offer(v_offer_id); end if;
  return new;
end;
$$;
create trigger release_deferred_transfer_escrow_after_activation
after update of status on public.rider_contracts for each row execute function private.release_deferred_transfer_escrow();

create function private.release_deferred_escrow_on_team_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_offer_id uuid;
begin
  if new.status<>'active' or (tg_op='UPDATE' and old.status='active') then return new; end if;
  for v_offer_id in
    select o.id from public.direct_transfer_offers o join public.seasons effective on effective.id=o.effective_season_id
    join public.seasons account on account.id=new.season_id
    where o.seller_team_id=new.team_id and o.status='accepted' and o.released_at is null
      and effective.game_year<=account.game_year
    order by o.id for update of o skip locked
  loop perform private.release_deferred_transfer_escrow_for_offer(v_offer_id); end loop;
  return new;
end;
$$;
create trigger release_deferred_escrow_on_team_account_after_activation
after insert or update of status on public.team_seasons for each row execute function private.release_deferred_escrow_on_team_account();

-- A returning club can have its future account created/activated before the
-- closing cash is carried over. Wait for the SEASON to become active, then
-- retry only outstanding escrow for its active accounts, after cash carry.
create function private.release_deferred_escrow_on_season_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_offer_id uuid;
begin
  if new.status<>'active' or old.status='active' then return new; end if;
  for v_offer_id in
    select o.id from public.team_seasons account
    join public.direct_transfer_offers o on o.seller_team_id=account.team_id
    join public.seasons effective on effective.id=o.effective_season_id
    where account.season_id=new.id and account.status='active'
      and o.status='accepted' and o.effective_season_id is not null and o.released_at is null
      and effective.game_year<=new.game_year
    order by o.id for update of o skip locked
  loop perform private.release_deferred_transfer_escrow_for_offer(v_offer_id); end loop;
  return new;
end;
$$;
create trigger zz_release_deferred_escrow_on_season_activation
after update of status on public.seasons for each row execute function private.release_deferred_escrow_on_season_activation();

revoke all on function private.assert_deferred_rider_eligible(uuid,uuid,integer) from public,anon,authenticated,service_role;
revoke all on function private.assert_deferred_roster_capacity(uuid,integer,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.respond_to_deferred_direct_transfer_offer(uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function private.guard_deferred_transfer_contract() from public,anon,authenticated,service_role;
revoke all on function private.guard_deferred_transfer_listing() from public,anon,authenticated,service_role;
revoke all on function private.cleanup_deferred_transfer_departure() from public,anon,authenticated,service_role;
revoke all on function private.release_deferred_transfer_escrow() from public,anon,authenticated,service_role;
revoke all on function private.release_deferred_transfer_escrow_for_offer(uuid) from public,anon,authenticated,service_role;
revoke all on function private.release_deferred_escrow_on_team_account() from public,anon,authenticated,service_role;
revoke all on function private.release_deferred_escrow_on_season_activation() from public,anon,authenticated,service_role;
revoke all on function public.submit_deferred_direct_transfer_offer(uuid,numeric,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_deferred_direct_transfer_offer(uuid,numeric,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
