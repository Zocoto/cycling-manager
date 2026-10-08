begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table public.halloween_editions (
  id text primary key, starts_at timestamptz not null, ends_at timestamptz not null,
  shop_ends_at timestamptz not null, enabled boolean not null default false,
  settled_through date, final_settled_at timestamptz,
  check(starts_at < ends_at and ends_at < shop_ends_at)
);
insert into public.halloween_editions(id,starts_at,ends_at,shop_ends_at) values
('halloween-2026','2026-10-08 22:00Z','2026-11-02 23:00Z','2026-11-09 23:00Z');
create table public.halloween_wallets (
  edition_id text not null references public.halloween_editions(id),
  user_id uuid not null references auth.users(id), coins integer not null default 24 check(coins >= 0),
  tickets integer not null default 0 check(tickets >= 0), inventory jsonb not null default '{}',
  obtained jsonb not null default '{}', purchases jsonb not null default '{}', cosmetics jsonb not null default '{}',
  joined_at timestamptz not null default now(), primary key(edition_id,user_id)
);
create table public.halloween_ledger (
  edition_id text not null, user_id uuid not null, source text not null,
  delta integer not null, balance_after integer not null check(balance_after>=0), created_at timestamptz not null default now(),
  primary key(edition_id,user_id,source), foreign key(edition_id,user_id) references public.halloween_wallets(edition_id,user_id)
);
create table public.halloween_requests (
  edition_id text not null,user_id uuid not null,id uuid not null,kind text not null, fingerprint text not null,
  result jsonb not null, created_at timestamptz not null default now(), primary key(edition_id,user_id,id)
);
create table public.halloween_runs (
  id uuid primary key default gen_random_uuid(),edition_id text not null,user_id uuid not null,day date not null,
  attempt integer not null check(attempt in(1,2)),seed bigint not null check(seed between 0 and 4294967295),
  started_at timestamptz not null default now(),expires_at timestamptz not null,
  status text not null default 'running' check(status in('running','finished')),
  score integer, distance integer,coins integer,proof jsonb, finished_at timestamptz, curse_id uuid,
  unique(edition_id,user_id,day,attempt), foreign key(edition_id,user_id) references public.halloween_wallets(edition_id,user_id)
);
create index halloween_runs_daily_records on public.halloween_runs(edition_id,day,user_id,score desc,distance desc,finished_at) where status='finished';
create index halloween_runs_event_records on public.halloween_runs(edition_id,user_id,score desc,distance desc,finished_at) where status='finished';
create table public.halloween_curses (
  edition_id text not null,user_id uuid not null,id uuid not null default gen_random_uuid(), sender_id uuid not null,
  kind text not null check(kind in('vampire','mummy')),expires_at timestamptz not null,
  pending_gift jsonb,bandages integer not null default 0 check(bandages between 0 and 5),
  primary key(edition_id,user_id),foreign key(edition_id,user_id) references public.halloween_wallets(edition_id,user_id)
);
create table public.halloween_rider_effects (
  rider_id uuid not null references public.riders(id),item_id text not null,user_id uuid not null,
  used_at timestamptz not null default now(),protection_expires_at timestamptz, primary key(rider_id,item_id)
);
create table public.halloween_catalog (
  id text primary key,name text not null,kind text not null check(kind in('cosmetic','consumable','transformation')),
  price integer not null check(price>=0),max_obtained integer not null check(max_obtained>0),
  draw_pool text check(draw_pool in('consumable','cosmetic','rare')),effect jsonb not null default '{}'
);

do $$ declare t text; begin
  foreach t in array array['halloween_editions','halloween_wallets','halloween_ledger','halloween_requests','halloween_runs','halloween_curses','halloween_rider_effects','halloween_catalog'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create function public.halloween_credit(p_edition text,p_user uuid,p_source text,p_delta integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_balance integer;
begin
  select coins into v_balance from public.halloween_wallets where edition_id=p_edition and user_id=p_user for update;
  if v_balance is null then raise exception 'Portefeuille absent.'; end if;
  if exists(select 1 from public.halloween_ledger where edition_id=p_edition and user_id=p_user and source=p_source) then return; end if;
  if v_balance+p_delta < 0 then raise exception 'Roues démoniaques insuffisantes.'; end if;
  update public.halloween_wallets set coins=coins+p_delta where edition_id=p_edition and user_id=p_user;
  insert into public.halloween_ledger(edition_id,user_id,source,delta,balance_after) values(p_edition,p_user,p_source,p_delta,v_balance+p_delta);
end $$;

create function public.halloween_gift(p_edition text,p_user uuid,p_source text,p_gift jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item public.halloween_catalog%rowtype; v_owned integer; v_wallet public.halloween_wallets%rowtype;
begin
  select * into strict v_wallet from public.halloween_wallets where edition_id=p_edition and user_id=p_user for update;
  if exists(select 1 from public.halloween_ledger where edition_id=p_edition and user_id=p_user and source=p_source) then return; end if;
  if p_gift->>'item' is not null then
    select * into strict v_item from public.halloween_catalog where id=p_gift->>'item';
    v_owned:=coalesce((v_wallet.obtained->>v_item.id)::integer,0);
    if v_owned>=v_item.max_obtained then
      perform public.halloween_credit(p_edition,p_user,p_source,case when v_item.id='witches-star' then 15 else greatest(5,v_item.price/2) end);
      return;
    end if;
    update public.halloween_wallets set inventory=jsonb_set(inventory,array[v_item.id],to_jsonb(coalesce((inventory->>v_item.id)::integer,0)+1)),
      obtained=jsonb_set(obtained,array[v_item.id],to_jsonb(v_owned+1)) where edition_id=p_edition and user_id=p_user;
  end if;
  perform public.halloween_credit(p_edition,p_user,p_source,coalesce((p_gift->>'coins')::integer,0));
  update public.halloween_wallets set tickets=tickets+coalesce((p_gift->>'tickets')::integer,0) where edition_id=p_edition and user_id=p_user;
end $$;

create function public.halloween_release_curse(p_edition text,p_user uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_curse public.halloween_curses%rowtype;
begin
  select * into v_curse from public.halloween_curses where edition_id=p_edition and user_id=p_user for update;
  if v_curse.pending_gift is not null then perform public.halloween_gift(p_edition,p_user,'mummy:'||v_curse.id,v_curse.pending_gift); end if;
  delete from public.halloween_curses where edition_id=p_edition and user_id=p_user;
end $$;

/** Trusted endpoint only: authenticated users cannot submit trusted scores or choose random rolls. */
create function public.halloween_action(p_user uuid,p_id uuid,p_kind text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_edition public.halloween_editions%rowtype; v_wallet public.halloween_wallets%rowtype;
  v_request public.halloween_requests%rowtype; v_run public.halloween_runs%rowtype;
  v_item public.halloween_catalog%rowtype; v_curse public.halloween_curses%rowtype;
  v_day date:=(now() at time zone 'Europe/Paris')::date; v_attempt integer; v_result jsonb:='{}';
  v_roll integer; v_credit integer; v_pool text; v_gift jsonb; v_target uuid;
begin
  if p_user is null or p_id is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Demande invalide.'; end if;
  select * into strict v_edition from public.halloween_editions where id='halloween-2026' for share;
  if (not v_edition.enabled and p_kind<>'dispel') or now()<v_edition.starts_at then raise exception 'L’événement n’est pas ouvert.'; end if;
  if not v_edition.enabled and not exists(select 1 from public.halloween_wallets where edition_id=v_edition.id and user_id=p_user) then raise exception 'L’événement n’est pas ouvert.'; end if;
  if p_kind='curse' and not pg_try_advisory_xact_lock(hashtextextended('halloween-curse-send',0)) then raise exception 'Un sort est en cours d’envoi. Réessayez dans un instant.'; end if;
  if not exists(select 1 from public.sporting_directors d join public.team_manager_assignments a on a.sporting_director_id=d.id
    where d.auth_user_id=p_user and d.status='active' and a.status='active' and a.role='general_manager') then raise exception 'Une équipe active est nécessaire.'; end if;
  insert into public.halloween_wallets(edition_id,user_id) values(v_edition.id,p_user) on conflict do nothing;
  if found then insert into public.halloween_ledger(edition_id,user_id,source,delta,balance_after) values(v_edition.id,p_user,'welcome',24,24); end if;
  select * into strict v_wallet from public.halloween_wallets where edition_id=v_edition.id and user_id=p_user for update;
  select * into v_request from public.halloween_requests where edition_id=v_edition.id and user_id=p_user and id=p_id;
  if found then
    if v_request.kind<>p_kind or v_request.fingerprint<>md5(p_payload::text) then raise exception 'Cette requête a déjà été utilisée autrement.'; end if;
    return v_request.result;
  end if;
  if now()>=v_edition.shop_ends_at and p_kind not in('equip','dispel','unwrap','use') then raise exception 'L’édition est terminée.'; end if;
  if now()>=v_edition.ends_at and p_kind in('start','draw','curse') then raise exception 'Les jeux sont terminés. La boutique reste ouverte jusqu’au 9 novembre inclus.'; end if;
  select * into v_curse from public.halloween_curses where edition_id=v_edition.id and user_id=p_user;
  if v_curse.expires_at<=now() then perform public.halloween_release_curse(v_edition.id,p_user); v_curse:=null; end if;
  if p_kind='join' then v_result:=jsonb_build_object('message','Bienvenue ! 24 roues démoniaques vous attendent.');
  elsif p_kind='start' then
    select * into v_run from public.halloween_runs where edition_id=v_edition.id and user_id=p_user and day=v_day and status='running' and expires_at>now() order by attempt limit 1;
    if v_run.id is null then
      select coalesce(max(attempt),0)+1 into v_attempt from public.halloween_runs where edition_id=v_edition.id and user_id=p_user and day=v_day;
      if v_attempt>2 or (v_attempt=2 and v_wallet.tickets<1) then raise exception 'Votre essai quotidien est utilisé. Un seul ticket bonus peut être utilisé par jour.'; end if;
      if v_attempt=2 then update public.halloween_wallets set tickets=tickets-1 where edition_id=v_edition.id and user_id=p_user; end if;
      insert into public.halloween_runs(edition_id,user_id,day,attempt,seed,expires_at,curse_id)
      values(v_edition.id,p_user,v_day,v_attempt,('x'||substr(md5(v_edition.id||v_day::text),1,8))::bit(32)::bigint,
        least(now()+interval '2 hours',((v_day+1)::timestamp at time zone 'Europe/Paris')+interval '5 minutes',v_edition.ends_at+interval '5 minutes'),
        case when v_curse.kind='vampire' then v_curse.id end) returning * into v_run;
    end if;
    v_result:=jsonb_build_object('id',v_run.id,'seed',v_run.seed,'startedAt',v_run.started_at,'expiresAt',v_run.expires_at);
  elsif p_kind='finish' then
    select * into strict v_run from public.halloween_runs where id=(p_payload->>'runId')::uuid and edition_id=v_edition.id and user_id=p_user for update;
    if v_run.status='finished' then v_result:=jsonb_build_object('message','Score déjà enregistré.','coins',v_run.coins,'score',v_run.score);
    else
      if now()>v_run.expires_at or v_run.day<=v_edition.settled_through or v_edition.final_settled_at is not null then raise exception 'Cet essai est expiré.'; end if;
      v_credit:=(p_payload->>'coins')::integer;
      if v_credit<0 or v_credit>12000 or (p_payload->>'distance')::integer<0 or (p_payload->>'score')::integer<>(p_payload->>'distance')::integer+25*v_credit then raise exception 'Score invalide.'; end if;
      update public.halloween_runs set status='finished',score=(p_payload->>'score')::integer,distance=(p_payload->>'distance')::integer,
        coins=v_credit,proof=p_payload->'proof',finished_at=now() where id=v_run.id;
      if v_curse.kind='vampire' and v_curse.id=v_run.curse_id then
        v_credit:=v_credit-v_credit/10; perform public.halloween_release_curse(v_edition.id,p_user);
      end if;
      perform public.halloween_credit(v_edition.id,p_user,'run:'||v_run.id,v_credit);
      v_result:=jsonb_build_object('message','Score validé et roues créditées.','coins',v_credit,'score',(p_payload->>'score')::integer);
    end if;
  elsif p_kind='draw' then
    if exists(select 1 from public.halloween_requests where edition_id=v_edition.id and user_id=p_user and kind='draw' and (created_at at time zone 'Europe/Paris')::date=v_day) then raise exception 'Vous avez déjà choisi votre bonbon aujourd’hui.'; end if;
    if v_curse.pending_gift is not null then raise exception 'Déballez votre cadeau en attente.'; end if;
    perform public.halloween_credit(v_edition.id,p_user,'draw-stake:'||v_day,-5);
    -- PostgreSQL cryptographic random bytes, independent of the selected candy.
    v_roll:=floor(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint::numeric/4294967296*10000)::integer;
    v_gift:=jsonb_build_object('coins',0,'tickets',0);
    if v_roll<5000 then v_result:=jsonb_build_object('message','Ce bonbon était vide…');
    elsif v_roll<8000 then v_gift:=jsonb_build_object('coins',8); v_result:=jsonb_build_object('message','8 roues démoniaques !');
    elsif v_roll<9200 then v_gift:=jsonb_build_object('coins',15); v_result:=jsonb_build_object('message','15 roues démoniaques !');
    elsif v_roll<9800 or v_roll>=9990 then
      v_pool:=case when v_roll<9700 then 'consumable' when v_roll<9800 then 'cosmetic' else 'rare' end;
      select * into strict v_item from public.halloween_catalog where draw_pool=v_pool order by id offset floor(random()*(select count(*) from public.halloween_catalog where draw_pool=v_pool)) limit 1;
      v_gift:=jsonb_build_object('item',v_item.id); v_result:=jsonb_build_object('message',v_item.name,'item',v_item.id);
    else v_gift:=jsonb_build_object('tickets',1); v_result:=jsonb_build_object('message','Un essai bonus Cycling Hollow !'); end if;
    if v_curse.kind='mummy' and (v_gift->>'item' is not null or coalesce((v_gift->>'coins')::integer,0)>0 or coalesce((v_gift->>'tickets')::integer,0)>0) then
      update public.halloween_curses set pending_gift=v_gift,bandages=0 where edition_id=v_edition.id and user_id=p_user;
      v_result:=jsonb_build_object('message','La momie a emballé votre cadeau. Retirez ses cinq bandelettes ou utilisez le sel gratuit.','wrapped',true);
    else perform public.halloween_gift(v_edition.id,p_user,'draw-gift:'||v_day,v_gift); end if;
  elsif p_kind='buy' then
    select * into strict v_item from public.halloween_catalog where id=p_payload->>'item';
    if coalesce((v_item.effect->>'exclusive')::boolean,false) then raise exception 'Cette récompense est réservée au vainqueur.'; end if;
    if coalesce((v_wallet.purchases->>v_item.id)::integer,0)>=(case when v_item.kind='cosmetic' or v_item.price>=180 then 1 when v_item.kind='transformation' then 10 else 30 end) then raise exception 'Limite d’achat de cet objet atteinte.';end if;
    if coalesce((v_wallet.obtained->>v_item.id)::integer,0)>=v_item.max_obtained then raise exception 'Limite de cet objet atteinte.'; end if;
    perform public.halloween_credit(v_edition.id,p_user,'buy:'||p_id,-v_item.price);
    perform public.halloween_gift(v_edition.id,p_user,'buy-gift:'||p_id,jsonb_build_object('item',v_item.id));
    update public.halloween_wallets set purchases=jsonb_set(purchases,array[v_item.id],to_jsonb(coalesce((purchases->>v_item.id)::integer,0)+1)) where edition_id=v_edition.id and user_id=p_user;
    v_result:=jsonb_build_object('message',v_item.name||' ajouté à votre collection.');
  elsif p_kind='dispel' then perform public.halloween_release_curse(v_edition.id,p_user); v_result:=jsonb_build_object('message','Votre portrait habituel est restauré. Tout cadeau en attente vous est remis.');
  elsif p_kind='unwrap' then
    if v_curse.kind<>'mummy' or v_curse.pending_gift is null then raise exception 'Aucun cadeau à déballer.'; end if;
    if (p_payload->>'bandage')::integer<>v_curse.bandages then raise exception 'Retirez la bandelette du dessus.'; end if;
    if v_curse.bandages=4 then perform public.halloween_release_curse(v_edition.id,p_user); else update public.halloween_curses set bandages=bandages+1 where edition_id=v_edition.id and user_id=p_user; end if;
    v_result:=jsonb_build_object('message',case when v_curse.bandages=4 then 'Cadeau récupéré !' else 'Une bandelette de moins…' end);
  elsif p_kind='equip' then
    if p_payload->>'item'='none' then update public.halloween_wallets set cosmetics='{}' where edition_id=v_edition.id and user_id=p_user;
    else
      select * into strict v_item from public.halloween_catalog where id=p_payload->>'item' and kind='cosmetic';
      if coalesce((v_wallet.inventory->>v_item.id)::integer,0)<1 then raise exception 'Vous ne possédez pas ce cosmétique.'; end if;
      update public.halloween_wallets set cosmetics=jsonb_set(cosmetics,array[coalesce(v_item.effect->>'slot','accessory')],to_jsonb(v_item.id)) where edition_id=v_edition.id and user_id=p_user;
    end if;
    v_result:=jsonb_build_object('message','Votre portrait a été mis à jour.');
  elsif p_kind='curse' then
    select * into strict v_item from public.halloween_catalog where id=p_payload->>'item' and kind='transformation';
    if coalesce((v_wallet.inventory->>v_item.id)::integer,0)<1 then raise exception 'Vous ne possédez pas ce sort.'; end if;
    v_target:=(p_payload->>'target')::uuid;
    if v_target=p_user or not exists(select 1 from public.halloween_wallets where edition_id=v_edition.id and user_id=v_target) then raise exception 'Choisissez un autre participant.'; end if;
    -- One lock covers reciprocal sends without deadlocking wallets.
    if not pg_try_advisory_xact_lock(hashtextextended('halloween-curse:'||v_target,0)) then raise exception 'Un sort est déjà en cours. Réessayez.'; end if;
    select * into v_curse from public.halloween_curses where edition_id=v_edition.id and user_id=v_target;
    if v_curse.expires_at>now() then raise exception 'Ce DS est déjà sous le coup d’un sort.'; end if;
    if v_curse.id is not null then perform public.halloween_release_curse(v_edition.id,v_target); end if;
    insert into public.halloween_curses(edition_id,user_id,sender_id,kind,expires_at) values(v_edition.id,v_target,p_user,case when v_item.id='vampire-kiss' then 'vampire' else 'mummy' end,least(now()+interval '24 hours',v_edition.ends_at));
    update public.halloween_wallets set inventory=jsonb_set(inventory,array[v_item.id],to_jsonb((inventory->>v_item.id)::integer-1)) where edition_id=v_edition.id and user_id=p_user;
    v_result:=jsonb_build_object('message','Votre sort a été envoyé. Il peut être levé gratuitement.');
  elsif p_kind='use' then
    perform public.halloween_use_item(p_user,p_payload->>'item',(p_payload->>'target')::uuid);
    v_result:=jsonb_build_object('message','Objet utilisé.');
  else raise exception 'Action inconnue.';
  end if;
  insert into public.halloween_requests(edition_id,user_id,id,kind,fingerprint,result) values(v_edition.id,p_user,p_id,p_kind,md5(p_payload::text),v_result);
  return v_result;
end $$;

revoke all on function public.halloween_credit(text,uuid,text,integer),public.halloween_gift(text,uuid,text,jsonb),public.halloween_release_curse(text,uuid),public.halloween_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.halloween_action(uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
