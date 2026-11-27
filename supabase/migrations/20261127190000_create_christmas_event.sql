begin;
set local statement_timeout='5s';
set local lock_timeout='500ms';

create table public.christmas_editions (
 id text primary key,starts_at timestamptz not null,ends_at timestamptz not null,
 enabled boolean not null default true,total_lights bigint not null default 0 check(total_lights>=0),
 participants integer not null default 0 check(participants>=0),rank_frozen_at timestamptz,final_settled_at timestamptz,
 check(starts_at<ends_at)
);
insert into public.christmas_editions(id,starts_at,ends_at,enabled)values
 ('christmas-2026','2026-11-30 23:00:00+00','2026-12-31 23:00:00+00',true);
create table public.christmas_wallets (
 edition_id text not null references public.christmas_editions(id),user_id uuid not null references auth.users(id),
 coins integer not null default 0 check(coins>=0),personal_lights integer not null default 0 check(personal_lights>=0),
 inventory jsonb not null default '{}',obtained jsonb not null default '{}',purchases jsonb not null default '{}',cosmetics jsonb not null default '{}',
 prepared_sniper boolean not null default false,prepared_retry_date date,joined_at timestamptz not null default now(),
 primary key(edition_id,user_id),check(jsonb_typeof(inventory)='object' and jsonb_typeof(cosmetics)='object')
);
create index christmas_wallets_ranking_idx on public.christmas_wallets(edition_id,personal_lights desc,user_id)where personal_lights>0;
create table public.christmas_ledger (
 edition_id text not null,user_id uuid not null,source text not null,delta integer not null,balance_after integer not null check(balance_after>=0),
 created_at timestamptz not null default now(),primary key(edition_id,user_id,source),
 foreign key(edition_id,user_id)references public.christmas_wallets(edition_id,user_id)
);
create index christmas_ledger_history_idx on public.christmas_ledger(edition_id,user_id,created_at desc);
create table public.christmas_requests (
 edition_id text not null,user_id uuid not null,id uuid not null,kind text not null,fingerprint text not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(edition_id,user_id,id)
);
create table public.christmas_runs (
 id uuid primary key default gen_random_uuid(),edition_id text not null,user_id uuid not null,day date not null,
 seed bigint not null check(seed between 0 and 4294967295),practice boolean not null,retry boolean not null,sniper boolean not null,
 started_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 status text not null default 'running'check(status in('running','finished','abandoned')),
 score integer check(score between 0 and 7000),deliveries integer check(deliveries between 0 and 14),
 qualities jsonb,coins integer check(coins between 0 and 45),lights integer check(lights between 0 and 42),proof jsonb,finished_at timestamptz,
 validation_attempts smallint not null default 0 check(validation_attempts between 0 and 20),last_validation_at timestamptz,
 foreign key(edition_id,user_id)references public.christmas_wallets(edition_id,user_id),check(expires_at>started_at),check(not(practice and retry))
);
create unique index christmas_one_running_idx on public.christmas_runs(edition_id,user_id)where status='running';
create unique index christmas_one_daily_free_reward_idx on public.christmas_runs(edition_id,user_id,day)where status='finished' and not practice and not retry;
create index christmas_runs_owner_day_idx on public.christmas_runs(edition_id,user_id,day,started_at desc);
create table public.christmas_catalog (
 id text primary key,name text not null,category text not null,slot text,price integer check(price>=0),
 max_obtained integer check(max_obtained>0),source text,effect jsonb not null default '{}'
);
create table public.christmas_advent (
 day smallint primary key check(day between 1 and 24),title text not null,description text not null,coins integer not null default 0 check(coins>=0),item_id text references public.christmas_catalog(id)
);
create table public.christmas_advent_claims (
 edition_id text not null,user_id uuid not null,day smallint not null references public.christmas_advent(day),claimed_at timestamptz not null default now(),
 primary key(edition_id,user_id,day),foreign key(edition_id,user_id)references public.christmas_wallets(edition_id,user_id)
);
create table public.christmas_milestones(goal integer primary key check(goal>0),title text not null,coins integer not null default 0 check(coins>=0),items jsonb not null default '[]'check(jsonb_typeof(items)='array'));
create table public.christmas_tree_claims (
 edition_id text not null,user_id uuid not null,goal integer not null references public.christmas_milestones(goal),claimed_at timestamptz not null default now(),
 primary key(edition_id,user_id,goal),foreign key(edition_id,user_id)references public.christmas_wallets(edition_id,user_id)
);
create table public.christmas_grants (
 id uuid primary key default gen_random_uuid(),edition_id text not null,user_id uuid not null,source text not null,
 item_id text not null references public.christmas_catalog(id),quantity integer not null check(quantity between 1 and 100),
 created_at timestamptz not null default now(),delivered_at timestamptz,
 unique(edition_id,user_id,source),foreign key(edition_id,user_id)references public.christmas_wallets(edition_id,user_id)
);
create table public.christmas_contributor_prizes(rank_from integer not null,rank_to integer not null,item_id text not null references public.christmas_catalog(id),primary key(rank_from,rank_to),check(rank_from>0 and rank_to>=rank_from));
create table public.christmas_final_ranks (
 edition_id text not null,user_id uuid not null,lights integer not null,rank bigint not null,delivered_at timestamptz,
 settlement_attempts integer not null default 0 check(settlement_attempts>=0),last_attempt_at timestamptz,last_error text check(length(last_error)<=500),
 primary key(edition_id,user_id),foreign key(edition_id,user_id)references public.christmas_wallets(edition_id,user_id)
);
create index christmas_pending_final_idx on public.christmas_final_ranks(edition_id,last_attempt_at nulls first,user_id)where delivered_at is null;

do $$declare t text;begin
 foreach t in array array['christmas_editions','christmas_wallets','christmas_ledger','christmas_requests','christmas_runs','christmas_catalog','christmas_advent','christmas_advent_claims','christmas_milestones','christmas_tree_claims','christmas_grants','christmas_contributor_prizes','christmas_final_ranks']loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end$$;

create function private.christmas_credit(p_user uuid,p_source text,p_delta integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_balance integer;
begin
 select coins into strict v_balance from public.christmas_wallets where edition_id='christmas-2026' and user_id=p_user for update;
 if exists(select 1 from public.christmas_ledger where edition_id='christmas-2026' and user_id=p_user and source=p_source)then return;end if;
 if v_balance+p_delta<0 then raise exception 'Grelots insuffisants.';end if;
 update public.christmas_wallets set coins=coins+p_delta where edition_id='christmas-2026' and user_id=p_user;
 insert into public.christmas_ledger(edition_id,user_id,source,delta,balance_after)values('christmas-2026',p_user,p_source,p_delta,v_balance+p_delta);
end;
$$;

create function private.christmas_gift(p_user uuid,p_source text,p_item text,p_quantity integer default 1)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.christmas_catalog%rowtype;v_owned integer;v_inserted uuid;
begin
 if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Quantité de cadeau invalide.';end if;
 perform 1 from public.christmas_wallets where edition_id='christmas-2026' and user_id=p_user for update;
 select * into strict v_item from public.christmas_catalog where id=p_item;
 insert into public.christmas_grants(edition_id,user_id,source,item_id,quantity)values('christmas-2026',p_user,p_source,p_item,p_quantity)
  on conflict(edition_id,user_id,source)do nothing returning id into v_inserted;
 if v_inserted is null then return;end if;
 select coalesce((obtained->>p_item)::integer,0)into v_owned from public.christmas_wallets where edition_id='christmas-2026' and user_id=p_user;
 if v_item.max_obtained is not null and v_owned+p_quantity>v_item.max_obtained then
  perform private.christmas_credit(p_user,'duplicate:'||p_source,20*p_quantity);
 else
  perform private.christmas_deliver_reward(p_user,p_source,p_item,p_quantity);
  update public.christmas_wallets set obtained=jsonb_set(obtained,array[p_item],to_jsonb(v_owned+p_quantity)) where edition_id='christmas-2026' and user_id=p_user;
 end if;
 update public.christmas_grants set delivered_at=clock_timestamp()where id=v_inserted;
end;
$$;

create function private.christmas_claim_tree(p_user uuid,p_goal integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_milestone public.christmas_milestones%rowtype;v_total bigint;v_personal integer;v_item text;v_index integer:=0;
begin
 select total_lights into strict v_total from public.christmas_editions where id='christmas-2026';
 select personal_lights into strict v_personal from public.christmas_wallets where edition_id='christmas-2026' and user_id=p_user for update;
 select * into strict v_milestone from public.christmas_milestones where goal=p_goal;
 if v_personal<=0 or v_total<p_goal then raise exception 'Contribuez au sapin et atteignez ce palier avant de récupérer le cadeau.';end if;
 insert into public.christmas_tree_claims(edition_id,user_id,goal)values('christmas-2026',p_user,p_goal)on conflict do nothing;
 if not found then return;end if;
 perform private.christmas_credit(p_user,'tree:'||p_goal||':coins',v_milestone.coins);
 for v_item in select jsonb_array_elements_text(v_milestone.items)loop
  v_index:=v_index+1;perform private.christmas_gift(p_user,'tree:'||p_goal||':item:'||v_index,v_item,1);
 end loop;
end;
$$;

create function public.christmas_action(p_auth_user_id uuid,p_request_id uuid,p_kind text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='500ms' as $$
declare
 v_edition public.christmas_editions%rowtype;v_wallet public.christmas_wallets%rowtype;v_run public.christmas_runs%rowtype;
 v_request public.christmas_requests%rowtype;v_item public.christmas_catalog%rowtype;v_advent public.christmas_advent%rowtype;
 v_now timestamptz;v_day date;v_day_number integer;v_result jsonb:='{}';v_count integer;v_quantity integer;v_retry boolean;v_practice boolean;v_sniper boolean;
 v_score integer;v_deliveries integer;v_success integer;v_super integer;v_perfect integer;v_lights integer;v_coins integer;v_slot text;
begin
 if p_auth_user_id is null or p_request_id is null or p_kind is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>262144 then raise exception 'Demande de Noël invalide.';end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('christmas-2026:actions',0));
 v_now:=clock_timestamp();v_day:=(v_now at time zone 'Europe/Paris')::date;
 select * into strict v_edition from public.christmas_editions where id='christmas-2026';
 if not v_edition.enabled or v_now<v_edition.starts_at then raise exception 'L’événement de Noël n’est pas encore ouvert.';end if;
 if not exists(select 1 from public.sporting_directors d join public.team_manager_assignments a on a.sporting_director_id=d.id
  join public.teams t on t.id=a.team_id and t.status='active' where d.auth_user_id=p_auth_user_id and d.status='active' and a.status='active' and a.role='general_manager')then
  raise exception 'Une équipe active est nécessaire.';
 end if;
 insert into public.christmas_wallets(edition_id,user_id)values(v_edition.id,p_auth_user_id)on conflict do nothing;
 select * into strict v_wallet from public.christmas_wallets where edition_id=v_edition.id and user_id=p_auth_user_id for update;
 select * into v_request from public.christmas_requests where edition_id=v_edition.id and user_id=p_auth_user_id and id=p_request_id;
 if found then
  if v_request.kind<>p_kind or v_request.fingerprint<>md5(p_payload::text)then raise exception 'Cette demande a déjà été utilisée autrement.';end if;
  return v_request.result;
 end if;
 if v_now>=v_edition.ends_at and p_kind not in('finish','abandon','equip','use')then raise exception 'Les festivités de Noël sont terminées.';end if;
 if v_now>=v_edition.ends_at+interval '5 minutes' and p_kind='finish'then raise exception 'Cette tournée est expirée.';end if;
 v_day_number:=(v_day-(v_edition.starts_at at time zone 'Europe/Paris')::date)+1;
 if p_kind='join'then v_result:=jsonb_build_object('message','Bienvenue au village de Rudolphe !');
 elsif p_kind='prepare'then
  if p_payload->>'item'is null or p_payload->>'item'not in('lunette-sniper-cadeaux','grelot-repechage')or jsonb_typeof(p_payload->'prepared')is distinct from'boolean'then raise exception 'Préparation de tournée invalide.';end if;
  if (p_payload->>'prepared')::boolean and coalesce((v_wallet.inventory->>(p_payload->>'item'))::integer,0)<1 then raise exception 'Vous ne possédez pas cet objet.';end if;
  if exists(select 1 from public.christmas_runs where edition_id=v_edition.id and user_id=p_auth_user_id and status='running' and expires_at>v_now)then raise exception 'Terminez la tournée en cours avant de préparer cet objet.';end if;
  update public.christmas_wallets set
   prepared_sniper=case when p_payload->>'item'='lunette-sniper-cadeaux'then(p_payload->>'prepared')::boolean else prepared_sniper end,
   prepared_retry_date=case when p_payload->>'item'='grelot-repechage'then case when(p_payload->>'prepared')::boolean then v_day end else prepared_retry_date end
   where edition_id=v_edition.id and user_id=p_auth_user_id;
  v_result:=jsonb_build_object('message','Préparation enregistrée.');
 elsif p_kind='start'then
  if(p_payload?'practice'and jsonb_typeof(p_payload->'practice')is distinct from'boolean')
   or(p_payload?'retry'and jsonb_typeof(p_payload->'retry')is distinct from'boolean')
   or(p_payload?'sniper'and jsonb_typeof(p_payload->'sniper')is distinct from'boolean')then raise exception 'Préparation de tournée invalide.';end if;
  update public.christmas_runs set status='abandoned'where edition_id=v_edition.id and user_id=p_auth_user_id and status='running' and expires_at<=v_now;
  select * into v_run from public.christmas_runs where edition_id=v_edition.id and user_id=p_auth_user_id and status='running';
  if v_run.id is null then
   if(select count(*)from public.christmas_runs where edition_id=v_edition.id and user_id=p_auth_user_id and day=v_day)>=150 then raise exception 'Le nombre de tournées de cette journée est atteint.';end if;
   v_retry:=coalesce((p_payload->>'retry')::boolean,false)or v_wallet.prepared_retry_date=v_day;
   v_retry:=coalesce(v_retry,false);
   v_practice:=coalesce((p_payload->>'practice')::boolean,false);
   if not v_practice and exists(select 1 from public.christmas_runs where edition_id=v_edition.id and user_id=p_auth_user_id and day=v_day and status='finished' and not practice)then
    v_practice:=not v_retry;
   else v_retry:=false;end if;
   v_sniper:=coalesce((p_payload->>'sniper')::boolean,v_wallet.prepared_sniper);
   if v_retry then
    v_count:=coalesce((v_wallet.inventory->>'grelot-repechage')::integer,0);
    if v_count<1 then raise exception 'Un Second tour du traîneau est nécessaire.';end if;
    update public.christmas_wallets set inventory=jsonb_set(inventory,'{grelot-repechage}',to_jsonb(v_count-1)),prepared_retry_date=null where edition_id=v_edition.id and user_id=p_auth_user_id;
   end if;
   if v_sniper then
    v_count:=coalesce((v_wallet.inventory->>'lunette-sniper-cadeaux')::integer,0);
    if v_count<1 then raise exception 'Une Lunette de sniper de cadeaux est nécessaire.';end if;
    update public.christmas_wallets set inventory=jsonb_set(inventory,'{lunette-sniper-cadeaux}',to_jsonb(v_count-1))where edition_id=v_edition.id and user_id=p_auth_user_id;
   end if;
   update public.christmas_wallets set prepared_sniper=false where edition_id=v_edition.id and user_id=p_auth_user_id;
   insert into public.christmas_runs(edition_id,user_id,day,seed,practice,retry,sniper,started_at,expires_at)
    values(v_edition.id,p_auth_user_id,v_day,('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint,v_practice,v_retry,v_sniper,v_now,least(v_now+interval '2 hours',v_edition.ends_at+interval '5 minutes'))returning*into v_run;
  end if;
  v_result:=jsonb_build_object('run',jsonb_build_object('id',v_run.id,'seed',v_run.seed,'day',extract(day from v_run.day)::integer,'practice',v_run.practice,'retry',v_run.retry,'sniper',v_run.sniper,'startedAt',v_run.started_at,'expiresAt',v_run.expires_at));
 elsif p_kind='abandon'then
  update public.christmas_runs set status='abandoned'where id=(p_payload->>'runId')::uuid and edition_id=v_edition.id and user_id=p_auth_user_id and status='running';
  v_result:=jsonb_build_object('message','Tournée abandonnée. Les objets utilisés au départ restent consommés.');
 elsif p_kind='finish'then
  select * into strict v_run from public.christmas_runs where id=(p_payload->>'runId')::uuid and edition_id=v_edition.id and user_id=p_auth_user_id for update;
  if v_run.status='finished'then
   v_result:=jsonb_build_object('runId',v_run.id,'grelots',v_run.coins,'lights',v_run.lights,'score',v_run.score,'deliveries',v_run.deliveries,'qualities',v_run.qualities,'practice',v_run.practice,'retry',v_run.retry);
  else
   if v_run.status<>'running'or v_now>v_run.expires_at then raise exception 'Cette tournée est expirée.';end if;
   if jsonb_typeof(p_payload->'score')is distinct from'number'or jsonb_typeof(p_payload->'deliveries')is distinct from'number'or jsonb_typeof(p_payload->'qualities')is distinct from'object'
    or jsonb_typeof(p_payload->'proof')is distinct from'object'then raise exception 'Résultat de tournée incomplet.';end if;
   v_score:=(p_payload->>'score')::integer;v_deliveries:=(p_payload->>'deliveries')::integer;
   v_success:=(p_payload->'qualities'->>'successful')::integer;v_super:=(p_payload->'qualities'->>'super')::integer;v_perfect:=(p_payload->'qualities'->>'perfect')::integer;
   if v_score is null or v_deliveries is null or v_score not between 0 and 7000 or v_deliveries not between 0 and 14 or v_success is null or v_super is null or v_perfect is null
    or v_success not between 0 and 14 or v_super not between 0 and 14 or v_perfect not between 0 and 14 or v_success+v_super+v_perfect<>v_deliveries
    or(select count(*)from jsonb_object_keys(p_payload->'qualities'))<>3 then raise exception 'Résultat de tournée invalide.';end if;
   v_coins:=case when v_run.practice then 0 else least(45,8+v_score/110)end;
   v_lights:=case when v_run.practice then 0 else v_success+v_super*2+v_perfect*3 end;
   update public.christmas_runs set status='finished',score=v_score,deliveries=v_deliveries,qualities=p_payload->'qualities',coins=v_coins,lights=v_lights,proof=p_payload->'proof',finished_at=v_now where id=v_run.id;
   if not v_run.practice then
    perform private.christmas_credit(p_auth_user_id,'run:'||v_run.id,v_coins);
    if v_lights>0 then
     update public.christmas_wallets set personal_lights=personal_lights+v_lights where edition_id=v_edition.id and user_id=p_auth_user_id;
     update public.christmas_editions set total_lights=total_lights+v_lights,participants=participants+case when v_wallet.personal_lights=0 then 1 else 0 end where id=v_edition.id;
    end if;
   end if;
   v_result:=jsonb_build_object('runId',v_run.id,'grelots',v_coins,'lights',v_lights,'score',v_score,'deliveries',v_deliveries,'qualities',p_payload->'qualities','practice',v_run.practice,'retry',v_run.retry);
  end if;
 elsif p_kind='advent'then
  v_count:=(p_payload->>'day')::integer;
  if v_count is null or v_count not between 1 and least(24,v_day_number)then raise exception 'Cette fenêtre de l’Avent n’est pas encore disponible.';end if;
  select * into strict v_advent from public.christmas_advent where day=v_count;
  insert into public.christmas_advent_claims(edition_id,user_id,day)values(v_edition.id,p_auth_user_id,v_count)on conflict do nothing;
  if found then
   perform private.christmas_credit(p_auth_user_id,'advent:'||v_count||':coins',v_advent.coins);
   if v_advent.item_id is not null then perform private.christmas_gift(p_auth_user_id,'advent:'||v_count||':item',v_advent.item_id,1);end if;
  end if;
  v_result:=jsonb_build_object('message','Cadeau de l’Avent récupéré.','day',v_count);
 elsif p_kind='buy'then
  select * into strict v_item from public.christmas_catalog where id=p_payload->>'item';
  v_quantity:=coalesce((p_payload->>'quantity')::integer,1);
  if v_item.source is not null or v_item.price is null or v_quantity not between 1 and 100 then raise exception 'Cet article n’est pas proposé à la boutique.';end if;
  if v_item.max_obtained is not null and coalesce((v_wallet.obtained->>v_item.id)::integer,0)+v_quantity>v_item.max_obtained then raise exception 'Vous avez déjà obtenu cet objet.';end if;
  perform private.christmas_credit(p_auth_user_id,'buy:'||p_request_id,-v_item.price*v_quantity);
  perform private.christmas_gift(p_auth_user_id,'buy:'||p_request_id,v_item.id,v_quantity);
  update public.christmas_wallets set purchases=jsonb_set(purchases,array[v_item.id],to_jsonb(coalesce((purchases->>v_item.id)::integer,0)+v_quantity))where edition_id=v_edition.id and user_id=p_auth_user_id;
  v_result:=jsonb_build_object('message',v_item.name||' ajouté à votre inventaire.','item',v_item.id,'quantity',v_quantity);
 elsif p_kind='tree'then
  perform private.christmas_claim_tree(p_auth_user_id,(p_payload->>'goal')::integer);v_result:=jsonb_build_object('message','Cadeau du sapin récupéré.');
 elsif p_kind='equip'then
  v_slot:=p_payload->>'slot';
  if v_slot is null or v_slot not in('fond','chapeau','tenue','masque','lunettes','cadre')then raise exception 'Emplacement de portrait invalide.';end if;
  if p_payload->>'item'is null or p_payload->>'item'='none'then
   update public.christmas_wallets set cosmetics=cosmetics-v_slot where edition_id=v_edition.id and user_id=p_auth_user_id;
  else
   select * into strict v_item from public.christmas_catalog where id=p_payload->>'item' and category='portrait' and slot=v_slot;
   if coalesce((v_wallet.inventory->>v_item.id)::integer,0)<1 then raise exception 'Vous ne possédez pas ce cosmétique.';end if;
   update public.christmas_wallets set cosmetics=jsonb_set(cosmetics,array[v_slot],to_jsonb(v_item.id))where edition_id=v_edition.id and user_id=p_auth_user_id;
  end if;
  v_result:=jsonb_build_object('message','Portrait mis à jour.');
 elsif p_kind='use'then
  v_result:=private.christmas_use_item(p_auth_user_id,p_payload->>'item',p_payload);
 else raise exception 'Action de Noël inconnue.';
 end if;
 insert into public.christmas_requests(edition_id,user_id,id,kind,fingerprint,result)values(v_edition.id,p_auth_user_id,p_request_id,p_kind,md5(p_payload::text),v_result);
 return v_result;
end;
$$;
revoke all on function public.christmas_action(uuid,uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.christmas_action(uuid,uuid,text,jsonb)to service_role;

-- Reserve a bounded validation attempt before the HTTP endpoint runs the
-- relatively expensive physics replay. Failed proofs still spend an attempt.
create function public.claim_christmas_run_validation(p_run uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' set lock_timeout='500ms' as $$
declare v_run public.christmas_runs%rowtype;v_now timestamptz:=clock_timestamp();
begin
 select * into v_run from public.christmas_runs where id=p_run and user_id=p_user and edition_id='christmas-2026'for update;
 if v_run.id is null or v_run.status<>'running' or v_run.expires_at<=v_now
  or not exists(select 1 from public.christmas_editions where id=v_run.edition_id and enabled and v_now>=starts_at and v_now<ends_at+interval'5 minutes')then
  raise exception 'Cette tournée est expirée ou indisponible.';
 end if;
 if v_run.validation_attempts>=20 then raise exception 'Trop de tentatives de validation pour cette tournée.';end if;
 if v_run.last_validation_at is not null and v_run.last_validation_at>v_now-interval'2 seconds'then raise exception 'Patientez deux secondes avant de renvoyer cette tournée.';end if;
 update public.christmas_runs set validation_attempts=validation_attempts+1,last_validation_at=v_now where id=v_run.id;
end;
$$;
revoke all on function public.claim_christmas_run_validation(uuid,uuid)from public,anon,authenticated;
grant execute on function public.claim_christmas_run_validation(uuid,uuid)to service_role;

create function public.get_current_christmas_state()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_edition public.christmas_editions%rowtype;v_wallet public.christmas_wallets%rowtype;v_user uuid:=auth.uid();v_team uuid;v_phase text;v_now timestamptz:=clock_timestamp();v_day date;
 v_opened jsonb;v_claimed jsonb;v_ranking jsonb;v_runs jsonb;v_active jsonb;v_logs jsonb;v_riders jsonb;v_rank bigint;
begin
 if v_user is null then raise exception 'Connexion requise.';end if;
 select * into strict v_edition from public.christmas_editions where id='christmas-2026';
 v_phase:=case when not v_edition.enabled then 'paused'when v_now<v_edition.starts_at then 'scheduled'when v_now<v_edition.ends_at then 'open'else 'archived'end;
 v_day:=(v_now at time zone 'Europe/Paris')::date;
 select * into v_wallet from public.christmas_wallets where edition_id=v_edition.id and user_id=v_user;
 select a.team_id into v_team from public.sporting_directors d join public.team_manager_assignments a on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
  join public.teams t on t.id=a.team_id and t.status='active'where d.auth_user_id=v_user and d.status='active'limit 1;
 select coalesce(jsonb_agg(day order by day),'[]')into v_opened from public.christmas_advent_claims where edition_id=v_edition.id and user_id=v_user;
 select coalesce(jsonb_agg(goal order by goal),'[]')into v_claimed from public.christmas_tree_claims where edition_id=v_edition.id and user_id=v_user;
 select coalesce(jsonb_agg(row_to_json(x)order by x.rank,x."userId"),'[]')into v_ranking from(
  select w.user_id as "userId",coalesce(d.display_name,d.username)as name,w.personal_lights as lights,
   rank()over(order by w.personal_lights desc)as rank,w.user_id=v_user as "isCurrent"
  from public.christmas_wallets w join public.sporting_directors d on d.auth_user_id=w.user_id
  where w.edition_id=v_edition.id and w.personal_lights>0 order by w.personal_lights desc,w.user_id limit 100
 )x;
 if coalesce(v_wallet.personal_lights,0)>0 then select 1+count(*)into v_rank from public.christmas_wallets where edition_id=v_edition.id and personal_lights>v_wallet.personal_lights;end if;
 select coalesce(jsonb_object_agg(x.day,x.data),'{}')into v_runs from(
  select extract(day from r.day)::integer as day,jsonb_build_object('score',sum(r.score),'deliveries',sum(r.deliveries),'lights',sum(r.lights),'reward',sum(r.coins),'count',count(*),
   'history',jsonb_agg(jsonb_build_object('runId',r.id,'score',r.score,'deliveries',r.deliveries,'lights',r.lights,'reward',r.coins,'qualities',r.qualities)order by r.started_at,r.id)filter(where r.history_position<=20))data
  from(select run.*,row_number()over(partition by run.day order by run.started_at desc,run.id desc)as history_position
   from public.christmas_runs run where run.edition_id=v_edition.id and run.user_id=v_user and run.status='finished'and not run.practice)r group by r.day
 )x;
 select jsonb_build_object('id',id,'seed',seed,'day',extract(day from day)::integer,'practice',practice,'retry',retry,'sniper',sniper,'startedAt',started_at,'expiresAt',expires_at)
  into v_active from public.christmas_runs where edition_id=v_edition.id and user_id=v_user and status='running'and expires_at>v_now;
 select coalesce(jsonb_agg(x),'[]')into v_logs from(select source as message,delta,extract(day from(created_at at time zone'Europe/Paris'))::integer as day from public.christmas_ledger where edition_id=v_edition.id and user_id=v_user order by created_at desc limit 20)x;
 select coalesce(jsonb_agg(x),'[]')into v_riders from(select r.id,r.first_name||' '||r.last_name as name from public.rider_contracts c join public.riders r on r.id=c.rider_id and r.status='active'where c.team_id=v_team and c.status='active'order by r.last_name,r.id limit 100)x;
 return jsonb_build_object('state',v_phase,'startsAt',v_edition.starts_at,'endsAt',v_edition.ends_at,'day',greatest(1,least(31,(v_day-(v_edition.starts_at at time zone'Europe/Paris')::date)+1)),
  'eligible',v_team is not null,'joined',v_wallet.user_id is not null,'balance',coalesce(v_wallet.coins,0),'quantities',coalesce(v_wallet.inventory,'{}'),'obtained',coalesce(v_wallet.obtained,'{}'),
  'purchases',coalesce(v_wallet.purchases,'{}'),'equipped',coalesce(v_wallet.cosmetics,'{}'),'opened',v_opened,'milestones',v_claimed,
  'sniperPrepared',coalesce(v_wallet.prepared_sniper,false),'retryDays',case when v_wallet.prepared_retry_date=v_day then jsonb_build_array(extract(day from v_day)::integer)else'[]'::jsonb end,
  'personalLights',coalesce(v_wallet.personal_lights,0),'deliveries',coalesce(v_wallet.personal_lights,0),'communityLights',greatest(0,v_edition.total_lights-coalesce(v_wallet.personal_lights,0)),'totalLights',v_edition.total_lights,
  'participants',v_edition.participants,'ranking',v_ranking,'rank',v_rank,'runs',v_runs,'activeRun',v_active,'log',v_logs,'riders',v_riders,
  'rewardedToday',exists(select 1 from public.christmas_runs where edition_id=v_edition.id and user_id=v_user and day=v_day and status='finished'and not practice),
  'finalSettled',v_edition.final_settled_at is not null);
end;
$$;
revoke all on function public.get_current_christmas_state()from public,anon;
grant execute on function public.get_current_christmas_state()to authenticated,service_role;

create function public.settle_christmas_event()
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='500ms' as $$
declare v_edition public.christmas_editions%rowtype;v_member record;v_goal integer;v_prize text;v_count integer:=0;v_failed integer:=0;v_now timestamptz:=clock_timestamp();
begin
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('christmas-2026:settlement',0))then return jsonb_build_object('busy',true);end if;
 select * into strict v_edition from public.christmas_editions where id='christmas-2026';
 if not v_edition.enabled or clock_timestamp()<v_edition.ends_at+interval'5 minutes'then return jsonb_build_object('closed',true);end if;
 if v_edition.final_settled_at is not null then return jsonb_build_object('finalSettled',true,'processed',0);end if;
 if v_edition.rank_frozen_at is null then
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('christmas-2026:actions',0))then return jsonb_build_object('busy',true);end if;
  insert into public.christmas_final_ranks(edition_id,user_id,lights,rank)
   select edition_id,user_id,personal_lights,rank()over(order by personal_lights desc)from public.christmas_wallets where edition_id=v_edition.id and personal_lights>0
   on conflict do nothing;
  update public.christmas_editions set rank_frozen_at=clock_timestamp()where id=v_edition.id;
  return jsonb_build_object('snapshotFrozen',true,'processed',0);
 end if;
 for v_member in select final.user_id,final.rank from public.christmas_final_ranks final join public.christmas_wallets wallet on wallet.edition_id=final.edition_id and wallet.user_id=final.user_id
  where final.edition_id=v_edition.id and final.delivered_at is null and(final.last_attempt_at is null or final.last_attempt_at<=v_now-interval'1 hour')
  order by final.last_attempt_at nulls first,final.user_id limit 50 for update of final,wallet skip locked
 loop
  update public.christmas_final_ranks set settlement_attempts=settlement_attempts+1,last_attempt_at=v_now,last_error=null where edition_id=v_edition.id and user_id=v_member.user_id;
  -- A departed manager must not prevent everyone else's delivery. Each member's
  -- coins, native inventory and receipts commit together or roll back together;
  -- failed members remain pending and retry hourly, with a bounded diagnostic.
  begin
   for v_goal in select goal from public.christmas_milestones where goal<=v_edition.total_lights order by goal loop perform private.christmas_claim_tree(v_member.user_id,v_goal);end loop;
   select item_id into v_prize from public.christmas_contributor_prizes where v_member.rank between rank_from and rank_to;
   if v_prize is not null then perform private.christmas_gift(v_member.user_id,'final:rank:'||v_member.rank,v_prize,1);end if;
   update public.christmas_final_ranks set delivered_at=clock_timestamp()where edition_id=v_edition.id and user_id=v_member.user_id;
   v_count:=v_count+1;
  exception when others then
   update public.christmas_final_ranks set last_error=left(sqlstate||': '||sqlerrm,500)where edition_id=v_edition.id and user_id=v_member.user_id;
   v_failed:=v_failed+1;
  end;
 end loop;
 if not exists(select 1 from public.christmas_final_ranks where edition_id=v_edition.id and delivered_at is null)then
  update public.christmas_editions set final_settled_at=clock_timestamp()where id=v_edition.id;
 end if;
 return jsonb_build_object('processed',v_count,'failed',v_failed,'retryAfterSeconds',case when v_failed>0 then 3600 else null end,'finalSettled',(select final_settled_at is not null from public.christmas_editions where id=v_edition.id));
end;
$$;
revoke all on function public.settle_christmas_event()from public,anon,authenticated;
grant execute on function public.settle_christmas_event()to service_role;
revoke all on function private.christmas_credit(uuid,text,integer),private.christmas_gift(uuid,text,text,integer),private.christmas_claim_tree(uuid,integer)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
