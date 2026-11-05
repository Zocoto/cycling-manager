-- Transactional album infrastructure only. NO edition, card, pack or reward is
-- granted by this migration. A reviewed completed-S4 export must be installed
-- separately by service_role. Public approval defaults to false.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

create table public.cyclo_stickers_editions (
  edition_id text primary key check (edition_id ~ '^[a-z0-9][a-z0-9_-]{2,100}$'),
  source_season_id uuid not null references public.seasons(id) on delete restrict,
  collection_season_id uuid not null unique references public.seasons(id) on delete restrict,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null,
  configuration jsonb not null default '{"enabled":false,"publicApproved":false}'::jsonb,
  installed_at timestamptz not null default now(),
  check (source_season_id<>collection_season_id)
);
create table public.cyclo_stickers_cards (
  edition_id text not null references public.cyclo_stickers_editions on delete restrict,
  card_number smallint not null check (card_number between 1 and 69),
  card_id text not null,
  rarity text not null check (rarity in ('bronze','silver','gold','holographic')),
  profile_key text not null,
  kind text check (kind in ('team','continental','world','games','legend')),
  primary key (edition_id,card_number), unique(edition_id,card_id)
);
-- Gala attendance is verified outside this transaction by the trusted event
-- producer. The database accepts an explicit reviewed viewer list only; no
-- race-result or page-visit inference and no grant on an ordinary page read.
create table public.cyclo_stickers_edition_boosters (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null references public.cyclo_stickers_editions on delete restrict,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  collection_season_id uuid not null references public.seasons(id) on delete restrict,
  source_season_id uuid not null references public.seasons(id) on delete restrict,
  acquisition_source text not null check(acquisition_source='gala'),
  source_reference text not null check(length(btrim(source_reference)) between 1 and 160),
  copy_number smallint not null check(copy_number between 1 and 2),
  acquired_at timestamptz not null default now(),
  opened_at timestamptz,
  unique(edition_id,sporting_director_id,acquisition_source,copy_number),
  check(opened_at is null or opened_at>=acquired_at)
);
create index cyclo_stickers_edition_boosters_owner_idx
  on public.cyclo_stickers_edition_boosters(sporting_director_id,edition_id,acquired_at) where opened_at is null;
alter table public.cyclo_stickers_edition_boosters enable row level security;
create policy cyclo_stickers_edition_boosters_own on public.cyclo_stickers_edition_boosters for select to authenticated
  using (sporting_director_id in (select id from public.sporting_directors where auth_user_id=(select auth.uid()) and status='active'));
revoke all on public.cyclo_stickers_edition_boosters from public,anon,authenticated;
grant select on public.cyclo_stickers_edition_boosters to authenticated;
grant all on public.cyclo_stickers_edition_boosters to service_role;
create or replace view public.cyclo_stickers_booster_inventory with(security_invoker=true) as
  select pack.id,pack.sporting_director_id,pack.collection_season_id,source.id source_season_id,
    pack.acquisition_source,pack.source_reference,pack.acquired_at,pack.opened_at,'login'::text inventory_source
  from public.cyclo_stickers_boosters pack
  join public.seasons collection on collection.id=pack.collection_season_id
  join public.seasons source on source.game_year=collection.game_year-1
  union all
  select pack.id,pack.sporting_director_id,pack.collection_season_id,pack.source_season_id,
    'referral'::text,pack.source_referral_id::text||':'||pack.copy_number,pack.granted_at,pack.opened_at,'referral'::text
  from public.cyclo_sticker_boosters pack
  union all
  select pack.id,pack.sporting_director_id,pack.collection_season_id,pack.source_season_id,
    pack.acquisition_source,pack.source_reference||':'||pack.copy_number,pack.acquired_at,pack.opened_at,'edition'::text
  from public.cyclo_stickers_edition_boosters pack;
create table public.cyclo_stickers_collections (
  edition_id text not null references public.cyclo_stickers_editions on delete restrict,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  accepted_trade_count integer not null default 0 check (accepted_trade_count>=0),
  primary key(edition_id,sporting_director_id)
);
create table public.cyclo_stickers_card_inventory (
  edition_id text not null,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  card_number smallint not null,
  quantity integer not null default 0,
  pasted boolean not null default false,
  reserved integer not null default 0,
  primary key(edition_id,sporting_director_id,card_number),
  foreign key(edition_id,card_number) references public.cyclo_stickers_cards on delete restrict,
  check (quantity>=0 and reserved>=0 and quantity>=reserved+pasted::integer)
);
create index cyclo_stickers_inventory_card_owner_idx
  on public.cyclo_stickers_card_inventory(edition_id,card_number,sporting_director_id) where quantity>0;
create table public.cyclo_stickers_openings (
  inventory_source text not null check (inventory_source in ('login','referral','edition')),
  booster_id uuid not null,
  edition_id text not null references public.cyclo_stickers_editions on delete restrict,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  card_numbers integer[] not null check (cardinality(card_numbers)=2 and array_position(card_numbers,null) is null),
  opened_at timestamptz not null default now(),
  primary key(inventory_source,booster_id)
);
create index cyclo_stickers_openings_owner_idx
  on public.cyclo_stickers_openings(edition_id,sporting_director_id,opened_at desc);
create table public.cyclo_stickers_trade_offers (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null references public.cyclo_stickers_editions on delete restrict,
  from_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  to_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  request_id uuid not null,
  give_cards integer[] not null check (cardinality(give_cards) between 1 and 3 and array_position(give_cards,null) is null),
  receive_card smallint not null,
  status text not null default 'pending' check(status in ('pending','accepted','cancelled','declined','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  foreign key(edition_id,receive_card) references public.cyclo_stickers_cards on delete restrict,
  unique(edition_id,from_director_id,request_id),
  check(from_director_id<>to_director_id), check(expires_at>created_at),
  check(array_position(give_cards,receive_card::integer) is null)
);
create unique index cyclo_stickers_one_outgoing_offer_idx
  on public.cyclo_stickers_trade_offers(edition_id,from_director_id) where status='pending';
create index cyclo_stickers_offer_recipient_idx
  on public.cyclo_stickers_trade_offers(edition_id,to_director_id,created_at desc);
create index cyclo_stickers_offer_sender_history_idx
  on public.cyclo_stickers_trade_offers(edition_id,from_director_id,created_at desc);
create index cyclo_stickers_offer_sender_daily_idx
  on public.cyclo_stickers_trade_offers(from_director_id,created_at desc);
create table public.cyclo_stickers_achievement_claims (
  edition_id text not null references public.cyclo_stickers_editions on delete restrict,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  achievement_id text not null,
  reward_event_id uuid not null references public.reward_events(id) on delete restrict,
  claimed_at timestamptz not null default now(),
  primary key(edition_id,sporting_director_id,achievement_id)
);

-- No table writes are available to players. RLS also protects the owner data
-- if a future read projection is granted; all current reads use bounded RPCs.
alter table public.cyclo_stickers_editions enable row level security;
alter table public.cyclo_stickers_cards enable row level security;
alter table public.cyclo_stickers_collections enable row level security;
alter table public.cyclo_stickers_card_inventory enable row level security;
alter table public.cyclo_stickers_openings enable row level security;
alter table public.cyclo_stickers_trade_offers enable row level security;
alter table public.cyclo_stickers_achievement_claims enable row level security;
create policy cyclo_stickers_collections_own on public.cyclo_stickers_collections for select to authenticated
  using (sporting_director_id in (select id from public.sporting_directors where auth_user_id=(select auth.uid())));
create policy cyclo_stickers_cards_own on public.cyclo_stickers_card_inventory for select to authenticated
  using (sporting_director_id in (select id from public.sporting_directors where auth_user_id=(select auth.uid())));
create policy cyclo_stickers_openings_own on public.cyclo_stickers_openings for select to authenticated
  using (sporting_director_id in (select id from public.sporting_directors where auth_user_id=(select auth.uid())));
create policy cyclo_stickers_offers_own on public.cyclo_stickers_trade_offers for select to authenticated
  using (exists(select 1 from public.sporting_directors d where d.auth_user_id=(select auth.uid()) and d.id in (from_director_id,to_director_id)));
create policy cyclo_stickers_claims_own on public.cyclo_stickers_achievement_claims for select to authenticated
  using (sporting_director_id in (select id from public.sporting_directors where auth_user_id=(select auth.uid())));
revoke all on public.cyclo_stickers_editions,public.cyclo_stickers_cards,public.cyclo_stickers_collections,
  public.cyclo_stickers_card_inventory,public.cyclo_stickers_openings,public.cyclo_stickers_trade_offers,
  public.cyclo_stickers_achievement_claims from public,anon,authenticated;
grant all on public.cyclo_stickers_editions,public.cyclo_stickers_cards,public.cyclo_stickers_collections,
  public.cyclo_stickers_card_inventory,public.cyclo_stickers_openings,public.cyclo_stickers_trade_offers,
  public.cyclo_stickers_achievement_claims to service_role;

create function private.cyclo_stickers_default_configuration()
returns jsonb language sql immutable set search_path='' as $$
select '{"enabled":false,"publicApproved":false,"tradeExpiryHours":48,"maxOffersPerDay":10,"maxIncomingOffers":20,
"odds":{"bronze":80,"silver":16.9,"gold":3,"holographic":0.1},"achievements":[
{"id":"count-1","name":"La première vignette","kind":"count","target":1,"cash":2500,"xp":100,"reputation":0},
{"id":"count-5","name":"Le début de la passion","kind":"count","target":5,"cash":10000,"xp":150,"reputation":0},
{"id":"count-10","name":"Les pages prennent vie","kind":"count","target":10,"cash":20000,"xp":200,"reputation":5},
{"id":"count-20","name":"Un beau peloton","kind":"count","target":20,"cash":40000,"xp":300,"reputation":10},
{"id":"count-30","name":"Collectionneur du dimanche","kind":"count","target":30,"cash":60000,"xp":400,"reputation":15},
{"id":"count-40","name":"La dernière ligne droite","kind":"count","target":40,"cash":90000,"xp":600,"reputation":20},
{"id":"count-50","name":"Mémoire du peloton","kind":"count","target":69,"cash":250000,"xp":1000,"reputation":100,"trophy":true},
{"id":"profile-tours","name":"Chapitre complet · Coureurs de tour","kind":"profile","profile":"tours","cash":15000,"xp":100,"reputation":5},
{"id":"profile-mountain","name":"Chapitre complet · Grimpeurs","kind":"profile","profile":"mountain","cash":15000,"xp":100,"reputation":5},
{"id":"profile-hills","name":"Chapitre complet · Puncheurs","kind":"profile","profile":"hills","cash":15000,"xp":100,"reputation":5},
{"id":"profile-sprint","name":"Chapitre complet · Sprinteurs","kind":"profile","profile":"sprint","cash":15000,"xp":100,"reputation":5},
{"id":"profile-cobbles","name":"Chapitre complet · Classiques & pavés","kind":"profile","profile":"cobbles","cash":15000,"xp":100,"reputation":5},
{"id":"profile-timeTrial","name":"Chapitre complet · Rouleurs","kind":"profile","profile":"timeTrial","cash":15000,"xp":100,"reputation":5},
{"id":"profile-breakaway","name":"Chapitre complet · Baroudeurs","kind":"profile","profile":"breakaway","cash":15000,"xp":100,"reputation":5},
{"id":"rarity-bronze","name":"Le charme du bronze","kind":"rarity","rarity":"bronze","cash":25000,"xp":200,"reputation":5},
{"id":"rarity-silver","name":"Les reflets d’argent","kind":"rarity","rarity":"silver","cash":40000,"xp":200,"reputation":10},
{"id":"rarity-gold","name":"Le club des légendes","kind":"rarity","rarity":"gold","cash":60000,"xp":200,"reputation":15},
{"id":"mixed","name":"Toutes les couleurs du vélo","kind":"mixed","cash":5000,"xp":50,"reputation":5},
{"id":"trade","name":"À la récré","kind":"trade","cash":5000,"xp":50,"reputation":0}]}'::jsonb;
$$;

create function private.preserve_cyclo_stickers_snapshot()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name='cyclo_stickers_cards' or tg_op='DELETE' then raise exception 'Le catalogue scellé est immuable.'; end if;
  if new.edition_id is distinct from old.edition_id or new.source_season_id is distinct from old.source_season_id
    or new.collection_season_id is distinct from old.collection_season_id or new.snapshot_sha256 is distinct from old.snapshot_sha256
    or new.snapshot is distinct from old.snapshot then raise exception 'Le catalogue scellé est immuable.'; end if;
  return new;
end;
$$;
create trigger preserve_cyclo_stickers_edition before update or delete on public.cyclo_stickers_editions
  for each row execute function private.preserve_cyclo_stickers_snapshot();
create trigger preserve_cyclo_stickers_cards before update or delete on public.cyclo_stickers_cards
  for each row execute function private.preserve_cyclo_stickers_snapshot();

-- Only service_role can install a reviewed catalogue. A same-edition replay
-- may change approval flags but never the sealed catalogue or used economics.
create function public.install_cyclo_stickers_edition(p_edition text,p_snapshot jsonb,p_sha256 text,p_configuration jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_source public.seasons%rowtype; v_collection public.seasons%rowtype;
  v_existing public.cyclo_stickers_editions%rowtype; v_config jsonb; v_card jsonb; v_count integer; v_weight numeric;
begin
  select * into v_source from public.seasons where id=(p_snapshot->>'sourceSeasonId')::uuid;
  select * into v_collection from public.seasons where game_year=(p_snapshot->>'collectionSeason')::integer;
  if v_source.id is null or v_source.game_year<>4 or v_source.status<>'completed' or v_collection.id is null or v_collection.game_year<>5
    or v_collection.status='cancelled'
    or p_snapshot->>'sourceSeason' is distinct from '4' or p_snapshot->>'ratingsFrozenFromSeason' is distinct from '4'
    or p_snapshot->>'presentationSeason' is distinct from '4' or p_snapshot->>'launchSeason' is distinct from '5'
    or p_snapshot->>'edition' is distinct from p_edition or jsonb_typeof(p_snapshot->'cards')<>'array'
    or jsonb_array_length(p_snapshot->'cards')<>69 then raise exception 'Catalogue final S4 incomplet ou saison non terminée.'; end if;
  select count(distinct card->>'id') into v_count from jsonb_array_elements(p_snapshot->'cards') card;
  if v_count<>69 or exists(select 1 from jsonb_array_elements(p_snapshot->'cards') with ordinality c(card,n)
    where coalesce(card->>'specimen','false')<>'false' or card->>'number' is distinct from n::text
      or coalesce(card->>'id','')='' or coalesce(card->>'name','')=''
      or (n<=50 and coalesce(card->>'profileKey','') not in ('tours','mountain','hills','sprint','cobbles','timeTrial','breakaway'))
      or (n<=50 and (card ? 'kind' or card->>'rank' is distinct from n::text))
      or coalesce(card->>'rarityOverride',case when (card->>'rank')::integer<=5 then 'gold' when (card->>'rank')::integer<=20 then 'silver' else 'bronze' end)
        is distinct from case when n<=5 or n between 66 and 67 then 'gold' when n between 6 and 20 or n between 51 and 65 then 'silver' when n>=68 then 'holographic' else 'bronze' end
      or (n between 51 and 55 and card->>'kind' is distinct from 'team')
      or (n between 56 and 65 and card->>'kind' is distinct from 'continental')
      or (n between 66 and 67 and card->>'kind' is distinct from 'world')
      or (n=68 and card->>'kind' is distinct from 'games')
      or (n=69 and (card->>'kind' is distinct from 'legend' or card->>'id' is distinct from 'intro:legend:headless-s4')))
    then raise exception 'Les 69 emplacements de collection doivent être uniques et définitifs.'; end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'cards') card where
      (card->>'kind'='world' and (card->'jersey'->>'status' is distinct from 'world-champion' or coalesce(card->'jersey'->>'championshipType','') not in ('road','time_trial')))
      or (card->>'kind'='continental' and (card->'jersey'->>'status' is distinct from 'continental-champion' or coalesce(card->'jersey'->>'championshipType','') not in ('road','time_trial')
        or coalesce(card->'jersey'->>'continentCode','') not in ('africa','america','asia','europe','oceania')))
      or (card->>'kind'='games' and (card->'jersey'->>'status' is distinct from 'quadrennial-champion' or card->'jersey'->>'championshipType' is distinct from 'road')))
    or (select count(distinct (card->>'kind')||':'||coalesce(card->'jersey'->>'continentCode','world')||':'||(card->'jersey'->>'championshipType'))
      from jsonb_array_elements(p_snapshot->'cards') card where card->>'kind' in ('continental','world'))<>12
    then raise exception 'Titres de championnat incomplets ou dupliqués.'; end if;
  v_config:=private.cyclo_stickers_default_configuration()||coalesce(p_configuration,'{}'::jsonb);
  if jsonb_typeof(v_config->'enabled') is distinct from 'boolean' or jsonb_typeof(v_config->'publicApproved') is distinct from 'boolean'
    or jsonb_typeof(v_config->'odds') is distinct from 'object' or jsonb_typeof(v_config->'achievements') is distinct from 'array'
    or jsonb_array_length(v_config->'achievements')<>19 or coalesce((v_config->>'tradeExpiryHours')::integer,0) not between 1 and 168
    or coalesce((v_config->>'maxOffersPerDay')::integer,0) not between 1 and 50 or coalesce((v_config->>'maxIncomingOffers')::integer,0) not between 1 and 100
    then raise exception 'Configuration de collection invalide.'; end if;
  select sum((v_config->'odds'->>r)::numeric) into v_weight from unnest(array['bronze','silver','gold','holographic']) r;
  if v_weight is distinct from 100::numeric or exists(select 1 from unnest(array['bronze','silver','gold','holographic']) r
    where (v_config->'odds'->>r)::numeric<0 or v_config->'odds'->>r is null) then raise exception 'Les probabilités doivent totaliser 100.'; end if;
  if exists(select 1 from jsonb_array_elements(v_config->'achievements') a
    where a->>'cash' is null or a->>'xp' is null or a->>'reputation' is null or coalesce(a->>'name','')=''
      or (a->>'cash')::numeric<0 or (a->>'xp')::integer<0 or (a->>'reputation')::integer<0
      or not exists(select 1 from jsonb_array_elements(private.cyclo_stickers_default_configuration()->'achievements') d where d->>'id'=a->>'id'))
    or (select count(distinct a->>'id') from jsonb_array_elements(v_config->'achievements') a)<>19 then raise exception 'Barème de succès invalide.'; end if;
  -- IDs, completion rules and the 69-sticker trophy cannot be changed by a
  -- partial JSON configuration. Award amounts remain explicit trusted config.
  if exists(select 1 from jsonb_array_elements(v_config->'achievements') a
    join jsonb_array_elements(private.cyclo_stickers_default_configuration()->'achievements') d on d->>'id'=a->>'id'
    where (a->'kind') is distinct from (d->'kind') or (a->'profile') is distinct from (d->'profile')
      or (a->'rarity') is distinct from (d->'rarity') or coalesce(a->>'trophy','false') is distinct from coalesce(d->>'trophy','false')
      or (d->>'kind'='count' and a->>'target' is distinct from d->>'target')) then raise exception 'Conditions de succès invalides.'; end if;
  select * into v_existing from public.cyclo_stickers_editions where edition_id=p_edition for update;
  if found then
    if v_existing.snapshot is distinct from p_snapshot or v_existing.snapshot_sha256 is distinct from p_sha256 then raise exception 'Un instantané scellé ne peut pas être remplacé.'; end if;
    if (v_existing.configuration-'enabled'-'publicApproved') is distinct from (v_config-'enabled'-'publicApproved') and
      (exists(select 1 from public.cyclo_stickers_openings where edition_id=p_edition) or exists(select 1 from public.cyclo_stickers_achievement_claims where edition_id=p_edition))
      then raise exception 'Le barème utilisé par une collection est figé.'; end if;
    update public.cyclo_stickers_editions set configuration=v_config where edition_id=p_edition;
    return;
  end if;
  insert into public.cyclo_stickers_editions(edition_id,source_season_id,collection_season_id,snapshot_sha256,snapshot,configuration)
    values(p_edition,v_source.id,v_collection.id,p_sha256,p_snapshot,v_config);
  for v_card in select value from jsonb_array_elements(p_snapshot->'cards') loop
    insert into public.cyclo_stickers_cards(edition_id,card_number,card_id,rarity,profile_key,kind)
    values(p_edition,(v_card->>'number')::smallint,v_card->>'id',coalesce(v_card->>'rarityOverride',
      case when (v_card->>'rank')::integer<=5 then 'gold' when (v_card->>'rank')::integer<=20 then 'silver' else 'bronze' end),
      coalesce(v_card->>'profileKey',''),v_card->>'kind');
  end loop;
  if exists(select 1 from unnest(array['bronze','silver','gold','holographic']) r where (v_config->'odds'->>r)::numeric>0
    and not exists(select 1 from public.cyclo_stickers_cards where edition_id=p_edition and rarity=r)) then raise exception 'Finition absente du catalogue.'; end if;
end;
$$;

create function private.require_cyclo_stickers_edition(p_edition text)
returns public.cyclo_stickers_editions language plpgsql stable security definer set search_path='' as $$
declare v_edition public.cyclo_stickers_editions%rowtype;
begin
  select e.* into v_edition from public.cyclo_stickers_editions e
    join public.seasons source on source.id=e.source_season_id and source.status='completed'
    join public.seasons collection on collection.id=e.collection_season_id
    where e.edition_id=p_edition and e.configuration->>'enabled'='true' and e.configuration->>'publicApproved'='true'
      and exists(select 1 from public.seasons active where active.status='active' and active.game_year>=collection.game_year);
  if not found then raise exception 'Cette édition de Cyclo-Stickers n’est pas encore disponible.'; end if;
  return v_edition;
end;
$$;
create function public.grant_cyclo_stickers_gala_boosters(p_edition text,p_verified_director_ids uuid[],p_source_reference text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer; v_edition public.cyclo_stickers_editions%rowtype;
begin
  select * into v_edition from public.cyclo_stickers_editions where edition_id=p_edition;
  if p_verified_director_ids is null or cardinality(p_verified_director_ids)>5000 or array_position(p_verified_director_ids,null) is not null
    or p_source_reference is null or length(btrim(p_source_reference)) not between 1 and 160
    or not exists(select 1 from public.cyclo_stickers_editions where edition_id=p_edition)
    or exists(select 1 from unnest(p_verified_director_ids) id where not exists(select 1 from public.sporting_directors d where d.id=id and d.auth_user_id is not null))
    then raise exception 'Liste vérifiée des spectateurs du gala invalide.'; end if;
  insert into public.cyclo_stickers_edition_boosters(edition_id,sporting_director_id,collection_season_id,source_season_id,acquisition_source,source_reference,copy_number)
    select p_edition,director,v_edition.collection_season_id,v_edition.source_season_id,'gala',btrim(p_source_reference),copy from (select distinct unnest(p_verified_director_ids) director) viewers cross join generate_series(1,2) copy
    on conflict(edition_id,sporting_director_id,acquisition_source,copy_number) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
create function private.current_cyclo_stickers_director()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_id uuid;
begin
  select id into v_id from public.sporting_directors where auth_user_id=auth.uid() and status='active';
  if v_id is null then raise exception 'Une connexion de directeur actif est nécessaire.'; end if;
  return v_id;
end;
$$;
create function private.lock_cyclo_stickers_collections(p_edition text,p_directors uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  -- Serialize configuration changes with all mutations. Configuration is
  -- reread after taking this lock, before any inventory or reward effect.
  perform 1 from public.cyclo_stickers_editions where edition_id=p_edition for share;
  -- Every mutation uses the same edition/owner locks, including both sides of
  -- a trade in UUID order. No catalogue-wide or source-stock-wide lock.
  for v_id in select distinct x from unnest(p_directors) x order by x loop
    insert into public.cyclo_stickers_collections(edition_id,sporting_director_id) values(p_edition,v_id) on conflict do nothing;
    perform 1 from public.cyclo_stickers_collections where edition_id=p_edition and sporting_director_id=v_id for update;
  end loop;
end;
$$;
create function private.expire_cyclo_stickers_offers(p_edition text,p_director uuid)
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
end;
$$;
create function private.cyclo_stickers_trade_json(p_offer public.cyclo_stickers_trade_offers)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p_offer.id,'fromDirectorId',p_offer.from_director_id,'fromName',f.display_name,
    'toDirectorId',p_offer.to_director_id,'toName',t.display_name,'give',p_offer.give_cards,'receive',p_offer.receive_card,
    'status',case when p_offer.status='pending' and p_offer.expires_at<=now() then 'expired' else p_offer.status end,
    'createdAt',p_offer.created_at,'expiresAt',p_offer.expires_at)
  from public.sporting_directors f,public.sporting_directors t where f.id=p_offer.from_director_id and t.id=p_offer.to_director_id;
$$;
create function private.cyclo_stickers_state(p_edition text,p_director uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'edition',jsonb_build_object('id',e.edition_id,'sourceSeason',s.game_year,'collectionSeason',c.game_year,
      'sourceSeasonId',e.source_season_id,'collectionSeasonId',e.collection_season_id,'enabled',true,'odds',e.configuration->'odds','achievements',e.configuration->'achievements'),
    'directorId',p_director,
    'owner',jsonb_build_object('directorId',p_director,'displayName',(select display_name from public.sporting_directors where id=p_director)),
    'owned',coalesce((select jsonb_agg(jsonb_build_object('cardNumber',i.card_number,'quantity',i.quantity,'pasted',i.pasted,
      'reserved',coalesce((select count(*) from public.cyclo_stickers_trade_offers o cross join lateral unnest(o.give_cards) n
        where o.edition_id=p_edition and o.from_director_id=p_director and o.status='pending' and o.expires_at>now() and n=i.card_number),0)) order by i.card_number)
      from public.cyclo_stickers_card_inventory i where i.edition_id=p_edition and i.sporting_director_id=p_director and i.quantity>0),'[]'::jsonb),
    'boosterCount',(select count(*) from public.cyclo_stickers_booster_inventory b where b.sporting_director_id=p_director and b.collection_season_id=e.collection_season_id and b.source_season_id=e.source_season_id and b.opened_at is null),
    'boosters',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'inventorySource',b.inventory_source,'acquiredAt',b.acquired_at,
      'openedAt',b.opened_at,'collectionSeasonId',b.collection_season_id,'sourceSeasonId',b.source_season_id) order by b.acquired_at,b.inventory_source,b.id)
      from (select * from public.cyclo_stickers_booster_inventory b where b.sporting_director_id=p_director and b.collection_season_id=e.collection_season_id
        and b.source_season_id=e.source_season_id and b.opened_at is null order by b.acquired_at,b.inventory_source,b.id limit 100) b),'[]'::jsonb),
    'totalOpenedCount',(select count(*) from public.cyclo_stickers_openings where edition_id=p_edition and sporting_director_id=p_director),
    'openedPacks',coalesce((select jsonb_agg(jsonb_build_object('id',o.booster_id,'inventorySource',o.inventory_source,'cards',o.card_numbers) order by o.opened_at desc,o.booster_id)
      from (select * from public.cyclo_stickers_openings where edition_id=p_edition and sporting_director_id=p_director order by opened_at desc,booster_id limit 10) o),'[]'::jsonb),
    'claimedAchievements',coalesce((select jsonb_agg(achievement_id order by achievement_id) from public.cyclo_stickers_achievement_claims where edition_id=p_edition and sporting_director_id=p_director),'[]'::jsonb),
    'acceptedTradeCount',coalesce((select accepted_trade_count from public.cyclo_stickers_collections where edition_id=p_edition and sporting_director_id=p_director),0),
    'outgoingOffers',coalesce((select jsonb_agg(private.cyclo_stickers_trade_json(o) order by o.created_at desc) from public.cyclo_stickers_trade_offers o
      where o.edition_id=p_edition and o.from_director_id=p_director and o.status='pending' and o.expires_at>now()),'[]'::jsonb),
    'incomingOffers',coalesce((select jsonb_agg(private.cyclo_stickers_trade_json(o) order by o.created_at desc) from public.cyclo_stickers_trade_offers o
      where o.edition_id=p_edition and o.to_director_id=p_director and o.status='pending' and o.expires_at>now()),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(private.cyclo_stickers_trade_json(o) order by o.created_at desc) from
      (select * from public.cyclo_stickers_trade_offers where edition_id=p_edition and p_director in (from_director_id,to_director_id)
        and (status<>'pending' or expires_at<=now()) order by created_at desc,id limit 10) o),'[]'::jsonb))
  from public.cyclo_stickers_editions e join public.seasons s on s.id=e.source_season_id join public.seasons c on c.id=e.collection_season_id where e.edition_id=p_edition;
$$;
create function public.get_current_cyclo_stickers_catalogue(p_edition text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_catalogue jsonb;
begin
  select jsonb_build_object('snapshot',e.snapshot,'sha256',e.snapshot_sha256,'editionId',e.edition_id) into v_catalogue
    from public.cyclo_stickers_editions e join public.seasons source on source.id=e.source_season_id and source.status='completed'
    join public.seasons collection on collection.id=e.collection_season_id
    where (p_edition is null or e.edition_id=p_edition) and e.configuration->>'enabled'='true' and e.configuration->>'publicApproved'='true'
      and exists(select 1 from public.seasons active where active.status='active' and active.game_year>=collection.game_year)
    order by collection.game_year desc limit 1;
  return v_catalogue;
end;
$$;
create function public.get_current_cyclo_stickers_state(p_edition text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director();
begin
  perform private.require_cyclo_stickers_edition(p_edition);
  return private.cyclo_stickers_state(p_edition,v_director);
end;
$$;

create function public.open_current_cyclo_stickers_booster(p_edition text,p_inventory_source text,p_booster_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_edition public.cyclo_stickers_editions%rowtype;
  v_opening public.cyclo_stickers_openings%rowtype; v_pack record; v_cards integer[]:='{}'; v_card integer;
  v_rarity text; v_roll numeric; v_bronze numeric; v_silver numeric; v_gold numeric; v_i integer; v_source uuid;
begin
  v_edition:=private.require_cyclo_stickers_edition(p_edition);
  if p_inventory_source not in ('login','referral','edition') or p_inventory_source is null or p_booster_id is null then raise exception 'Sachet invalide.'; end if;
  perform private.lock_cyclo_stickers_collections(p_edition,array[v_director]);
  v_edition:=private.require_cyclo_stickers_edition(p_edition);
  select * into v_opening from public.cyclo_stickers_openings where inventory_source=p_inventory_source and booster_id=p_booster_id;
  if found then
    if v_opening.sporting_director_id<>v_director or v_opening.edition_id<>p_edition then raise exception 'Ce sachet ne vous appartient pas.'; end if;
    return jsonb_build_object('cards',v_opening.card_numbers,'alreadyOpened',true,'state',private.cyclo_stickers_state(p_edition,v_director));
  end if;
  if p_inventory_source='login' then
    select * into v_pack from public.cyclo_stickers_boosters where id=p_booster_id and sporting_director_id=v_director for update;
    if not found then raise exception 'Ce sachet ne vous appartient pas.'; end if;
    select source.id into v_source from public.seasons collection join public.seasons source on source.game_year=collection.game_year-1 where collection.id=v_pack.collection_season_id;
  elsif p_inventory_source='referral' then
    select * into v_pack from public.cyclo_sticker_boosters where id=p_booster_id and sporting_director_id=v_director for update;
    if not found then raise exception 'Ce sachet ne vous appartient pas.'; end if;
    v_source:=v_pack.source_season_id;
  else
    select * into v_pack from public.cyclo_stickers_edition_boosters where id=p_booster_id and sporting_director_id=v_director for update;
    if not found then raise exception 'Ce sachet ne vous appartient pas.'; end if;
    v_source:=v_pack.source_season_id;
  end if;
  if v_pack.collection_season_id<>v_edition.collection_season_id or v_source is distinct from v_edition.source_season_id or v_pack.opened_at is not null
    then raise exception 'Le sachet ne correspond pas à cette édition ou a déjà été consommé.'; end if;
  v_bronze:=(v_edition.configuration->'odds'->>'bronze')::numeric;
  v_silver:=(v_edition.configuration->'odds'->>'silver')::numeric;
  v_gold:=(v_edition.configuration->'odds'->>'gold')::numeric;
  for v_i in 1..2 loop
    -- Entropy is generated by PostgreSQL; clients cannot submit rolls/cards.
    -- A random UUID supplies 48 random bits without adding a DB extension.
    v_roll:=(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,12))::bit(48)::bigint)::numeric/281474976710656*100;
    v_rarity:=case when v_roll<v_bronze then 'bronze' when v_roll<v_bronze+v_silver then 'silver' when v_roll<v_bronze+v_silver+v_gold then 'gold' else 'holographic' end;
    select card_number into v_card from public.cyclo_stickers_cards where edition_id=p_edition and rarity=v_rarity
      order by gen_random_uuid() limit 1;
    if v_card is null then raise exception 'Le catalogue de cette finition est incomplet.'; end if;
    v_cards:=array_append(v_cards,v_card);
    insert into public.cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity) values(p_edition,v_director,v_card,1)
      on conflict(edition_id,sporting_director_id,card_number) do update set quantity=public.cyclo_stickers_card_inventory.quantity+1;
  end loop;
  insert into public.cyclo_stickers_openings(inventory_source,booster_id,edition_id,sporting_director_id,card_numbers)
    values(p_inventory_source,p_booster_id,p_edition,v_director,v_cards);
  if p_inventory_source='login' then update public.cyclo_stickers_boosters set opened_at=now() where id=p_booster_id;
  elsif p_inventory_source='referral' then update public.cyclo_sticker_boosters set opened_at=now() where id=p_booster_id;
  else update public.cyclo_stickers_edition_boosters set opened_at=now() where id=p_booster_id; end if;
  return jsonb_build_object('cards',v_cards,'alreadyOpened',false,'state',private.cyclo_stickers_state(p_edition,v_director));
end;
$$;
create function public.paste_current_cyclo_stickers_card(p_edition text,p_card_number integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_inventory public.cyclo_stickers_card_inventory%rowtype;
begin
  perform private.require_cyclo_stickers_edition(p_edition);
  perform private.lock_cyclo_stickers_collections(p_edition,array[v_director]);
  perform private.require_cyclo_stickers_edition(p_edition);
  perform private.expire_cyclo_stickers_offers(p_edition,v_director);
  select * into v_inventory from public.cyclo_stickers_card_inventory where edition_id=p_edition and sporting_director_id=v_director and card_number=p_card_number;
  if not found or (not v_inventory.pasted and v_inventory.quantity-v_inventory.reserved<1) then raise exception 'Aucune copie disponible à coller.'; end if;
  update public.cyclo_stickers_card_inventory set pasted=true where edition_id=p_edition and sporting_director_id=v_director and card_number=p_card_number;
  return jsonb_build_object('state',private.cyclo_stickers_state(p_edition,v_director));
end;
$$;

create function public.propose_current_cyclo_stickers_trade(p_edition text,p_request_id uuid,p_recipient_id uuid,p_give integer[],p_receive integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_edition public.cyclo_stickers_editions%rowtype;
  v_offer public.cyclo_stickers_trade_offers%rowtype; v_copy record; v_available integer;
begin
  v_edition:=private.require_cyclo_stickers_edition(p_edition);
  if p_request_id is null or p_recipient_id is null or p_recipient_id=v_director or cardinality(p_give) not between 1 and 3
    or p_give is null or array_position(p_give,null) is not null or p_receive is null or p_receive=any(p_give)
    or not exists(select 1 from public.sporting_directors where id=p_recipient_id and status='active' and auth_user_id is not null)
    or exists(select 1 from unnest(p_give) n where not exists(select 1 from public.cyclo_stickers_cards where edition_id=p_edition and card_number=n))
    then raise exception 'Proposition d’échange invalide.'; end if;
  perform private.lock_cyclo_stickers_collections(p_edition,array[v_director,p_recipient_id]);
  v_edition:=private.require_cyclo_stickers_edition(p_edition);
  perform private.expire_cyclo_stickers_offers(p_edition,v_director);
  perform private.expire_cyclo_stickers_offers(p_edition,p_recipient_id);
  select * into v_offer from public.cyclo_stickers_trade_offers where edition_id=p_edition and from_director_id=v_director and request_id=p_request_id;
  if found then
    if v_offer.to_director_id<>p_recipient_id or v_offer.give_cards<>p_give or v_offer.receive_card<>p_receive then raise exception 'Identifiant de proposition déjà utilisé.'; end if;
    return jsonb_build_object('offerId',v_offer.id,'state',private.cyclo_stickers_state(p_edition,v_director));
  end if;
  if exists(select 1 from public.cyclo_stickers_trade_offers where edition_id=p_edition and from_director_id=v_director and status='pending')
    then raise exception 'Une seule proposition sortante peut rester active.'; end if;
  if (select count(*) from public.cyclo_stickers_trade_offers where from_director_id=v_director and created_at>now()-interval '24 hours')>=(v_edition.configuration->>'maxOffersPerDay')::integer
    or (select count(*) from public.cyclo_stickers_trade_offers where edition_id=p_edition and to_director_id=p_recipient_id and status='pending' and expires_at>now())>=(v_edition.configuration->>'maxIncomingOffers')::integer
    then raise exception 'La limite de propositions est atteinte. Réessayez plus tard.'; end if;
  for v_copy in select n,count(*)::integer quantity from unnest(p_give) n group by n loop
    select quantity-reserved-pasted::integer into v_available from public.cyclo_stickers_card_inventory where edition_id=p_edition and sporting_director_id=v_director and card_number=v_copy.n;
    if coalesce(v_available,0)<v_copy.quantity then raise exception 'Exemplaires proposés indisponibles ou collés.'; end if;
  end loop;
  select quantity-reserved-pasted::integer into v_available from public.cyclo_stickers_card_inventory where edition_id=p_edition and sporting_director_id=p_recipient_id and card_number=p_receive;
  if coalesce(v_available,0)<1 then raise exception 'La carte demandée n’est plus disponible.'; end if;
  for v_copy in select n,count(*)::integer quantity from unnest(p_give) n group by n loop
    update public.cyclo_stickers_card_inventory set reserved=reserved+v_copy.quantity where edition_id=p_edition and sporting_director_id=v_director and card_number=v_copy.n;
  end loop;
  insert into public.cyclo_stickers_trade_offers(edition_id,from_director_id,to_director_id,request_id,give_cards,receive_card,expires_at)
    values(p_edition,v_director,p_recipient_id,p_request_id,p_give,p_receive,now()+make_interval(hours=>(v_edition.configuration->>'tradeExpiryHours')::integer)) returning * into v_offer;
  -- Internal durable mail shares the transaction and its source idempotency;
  -- no external email or independently replayed notification is sent.
  insert into public.sporting_director_messages(sporting_director_id,season_id,message_type,sender_name,subject,preview,body,action_href,action_label,source_reference)
    values(p_recipient_id,v_edition.collection_season_id,'system','La Cyclogazette','Une proposition de Cyclo-Stickers',
      'Un autre directeur vous propose un échange de vignettes.','Consultez la proposition dans votre album. Les exemplaires proposés sont réservés jusqu’à la réponse ou l’expiration.',
      '/jeu/album?saison=4&onglet=echanges','Voir la proposition','cyclo-stickers:trade:'||v_offer.id::text||':proposed') on conflict(sporting_director_id,source_reference) do nothing;
  return jsonb_build_object('offerId',v_offer.id,'state',private.cyclo_stickers_state(p_edition,v_director));
end;
$$;
create function public.respond_current_cyclo_stickers_trade(p_edition text,p_offer_id uuid,p_response text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_offer public.cyclo_stickers_trade_offers%rowtype;
  v_copy record; v_available integer; v_status text;
begin
  perform private.require_cyclo_stickers_edition(p_edition);
  select * into v_offer from public.cyclo_stickers_trade_offers where id=p_offer_id and edition_id=p_edition;
  if not found or p_response is null or p_response not in ('accept','cancel','decline')
    or (p_response='cancel' and v_offer.from_director_id<>v_director)
    or (p_response in ('accept','decline') and v_offer.to_director_id<>v_director) then raise exception 'Cette réponse à l’échange n’est pas autorisée.'; end if;
  perform private.lock_cyclo_stickers_collections(p_edition,array[v_offer.from_director_id,v_offer.to_director_id]);
  perform private.require_cyclo_stickers_edition(p_edition);
  perform private.expire_cyclo_stickers_offers(p_edition,v_offer.from_director_id);
  perform private.expire_cyclo_stickers_offers(p_edition,v_offer.to_director_id);
  select * into v_offer from public.cyclo_stickers_trade_offers where id=p_offer_id for update;
  if v_offer.status<>'pending' then return jsonb_build_object('status',v_offer.status,'state',private.cyclo_stickers_state(p_edition,v_director)); end if;
  v_status:=case p_response when 'accept' then 'accepted' when 'cancel' then 'cancelled' else 'declined' end;
  if p_response='accept' then
    if not exists(select 1 from public.sporting_directors where id=v_offer.from_director_id and status='active') then raise exception 'Ce collectionneur n’est plus actif.'; end if;
    for v_copy in select n,count(*)::integer quantity from unnest(v_offer.give_cards) n group by n loop
      if not exists(select 1 from public.cyclo_stickers_card_inventory where edition_id=p_edition and sporting_director_id=v_offer.from_director_id
        and card_number=v_copy.n and reserved>=v_copy.quantity and quantity>=pasted::integer+reserved)
        then raise exception 'Les copies réservées de cette proposition sont indisponibles.'; end if;
    end loop;
    select quantity-reserved-pasted::integer into v_available from public.cyclo_stickers_card_inventory
      where edition_id=p_edition and sporting_director_id=v_offer.to_director_id and card_number=v_offer.receive_card;
    if coalesce(v_available,0)<1 then raise exception 'La carte demandée n’est plus disponible.'; end if;
    update public.cyclo_stickers_card_inventory set quantity=quantity-1 where edition_id=p_edition and sporting_director_id=v_offer.to_director_id and card_number=v_offer.receive_card;
    insert into public.cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity) values(p_edition,v_offer.from_director_id,v_offer.receive_card,1)
      on conflict(edition_id,sporting_director_id,card_number) do update set quantity=public.cyclo_stickers_card_inventory.quantity+1;
  end if;
  for v_copy in select n,count(*)::integer quantity from unnest(v_offer.give_cards) n group by n loop
    update public.cyclo_stickers_card_inventory set reserved=reserved-v_copy.quantity,
      quantity=quantity-case when p_response='accept' then v_copy.quantity else 0 end
      where edition_id=p_edition and sporting_director_id=v_offer.from_director_id and card_number=v_copy.n;
    if p_response='accept' then
      insert into public.cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity) values(p_edition,v_offer.to_director_id,v_copy.n,v_copy.quantity)
        on conflict(edition_id,sporting_director_id,card_number) do update set quantity=public.cyclo_stickers_card_inventory.quantity+excluded.quantity;
    end if;
  end loop;
  update public.cyclo_stickers_trade_offers set status=v_status,responded_at=now() where id=v_offer.id;
  if p_response='accept' then update public.cyclo_stickers_collections set accepted_trade_count=accepted_trade_count+1
    where edition_id=p_edition and sporting_director_id in (v_offer.from_director_id,v_offer.to_director_id); end if;
  return jsonb_build_object('status',v_status,'state',private.cyclo_stickers_state(p_edition,v_director));
end;
$$;

create function public.search_current_cyclo_stickers_collectors(p_edition text,p_query text default '',p_card_number integer default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_result jsonb;
begin
  perform private.require_cyclo_stickers_edition(p_edition);
  if length(coalesce(p_query,''))>80 or (p_card_number is not null and not exists(select 1 from public.cyclo_stickers_cards where edition_id=p_edition and card_number=p_card_number)) then raise exception 'Recherche invalide.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('directorId',d.id,'displayName',d.display_name,'availableCards',d.cards)),'[]'::jsonb) into v_result from (
    select director.id,director.display_name,jsonb_agg(jsonb_build_object('cardNumber',i.card_number,'quantity',i.quantity-i.pasted::integer-
      coalesce((select count(*)::integer from public.cyclo_stickers_trade_offers o cross join lateral unnest(o.give_cards) n
        where o.edition_id=p_edition and o.from_director_id=director.id and o.status='pending' and o.expires_at>now() and n=i.card_number),0)) order by i.card_number) cards
    from (select director.id,director.display_name from public.sporting_directors director
      where director.status='active' and director.auth_user_id is not null and director.id<>v_director
        and position(lower(coalesce(p_query,'')) in lower(director.display_name))>0
        and exists(select 1 from public.cyclo_stickers_card_inventory i where i.edition_id=p_edition and i.sporting_director_id=director.id and (p_card_number is null or i.card_number=p_card_number)
          and i.quantity-i.pasted::integer-coalesce((select count(*)::integer from public.cyclo_stickers_trade_offers o cross join lateral unnest(o.give_cards) n
            where o.edition_id=p_edition and o.from_director_id=director.id and o.status='pending' and o.expires_at>now() and n=i.card_number),0)>0)
      order by director.display_name,director.id limit greatest(1,least(20,coalesce(p_limit,20)))) director
    join public.cyclo_stickers_card_inventory i on i.edition_id=p_edition and i.sporting_director_id=director.id
    where i.quantity-i.pasted::integer-coalesce((select count(*)::integer from public.cyclo_stickers_trade_offers o cross join lateral unnest(o.give_cards) n
      where o.edition_id=p_edition and o.from_director_id=director.id and o.status='pending' and o.expires_at>now() and n=i.card_number),0)>0
    group by director.id,director.display_name) d;
  return v_result;
end;
$$;

create function public.claim_current_cyclo_stickers_achievement(p_edition text,p_achievement_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_director uuid:=private.current_cyclo_stickers_director(); v_edition public.cyclo_stickers_editions%rowtype;
  v_achievement jsonb; v_value integer; v_target integer; v_context record; v_reward_id uuid; v_reference text; v_reward jsonb;
begin
  v_edition:=private.require_cyclo_stickers_edition(p_edition);
  perform private.lock_cyclo_stickers_collections(p_edition,array[v_director]);
  v_edition:=private.require_cyclo_stickers_edition(p_edition);
  select a into v_achievement from jsonb_array_elements(v_edition.configuration->'achievements') a where a->>'id'=p_achievement_id;
  if v_achievement is null then raise exception 'Succès de collection inconnu.'; end if;
  v_reward:=jsonb_build_object('cash',(v_achievement->>'cash')::numeric,'xp',(v_achievement->>'xp')::integer,'reputation',(v_achievement->>'reputation')::integer);
  if exists(select 1 from public.cyclo_stickers_achievement_claims where edition_id=p_edition and sporting_director_id=v_director and achievement_id=p_achievement_id)
    then return jsonb_build_object('alreadyClaimed',true,'reward',v_reward,'state',private.cyclo_stickers_state(p_edition,v_director)); end if;
  if v_achievement->>'kind'='trade' then
    select accepted_trade_count into v_value from public.cyclo_stickers_collections where edition_id=p_edition and sporting_director_id=v_director; v_target:=1;
  elsif v_achievement->>'kind'='mixed' then
    select count(distinct c.rarity)::integer into v_value from public.cyclo_stickers_card_inventory i join public.cyclo_stickers_cards c using(edition_id,card_number)
      where i.edition_id=p_edition and i.sporting_director_id=v_director and i.pasted and c.rarity in ('bronze','silver','gold'); v_target:=3;
  else
    select count(*) filter(where i.pasted)::integer,count(*)::integer into v_value,v_target
      from public.cyclo_stickers_cards c left join public.cyclo_stickers_card_inventory i on i.edition_id=c.edition_id and i.card_number=c.card_number and i.sporting_director_id=v_director
      where c.edition_id=p_edition and (v_achievement->>'kind'='count' or (v_achievement->>'kind'='profile' and c.kind is null and c.profile_key=v_achievement->>'profile')
        or (v_achievement->>'kind'='rarity' and c.rarity=v_achievement->>'rarity'));
    if v_achievement->>'kind'='count' and coalesce(v_achievement->>'trophy','false')<>'true' then v_target:=(v_achievement->>'target')::integer; end if;
  end if;
  if coalesce(v_target,0)<=0 or coalesce(v_value,0)<v_target then raise exception 'Ce succès n’est pas encore terminé.'; end if;
  -- Same ledger/effects as the existing atomic objective claim. Deliberately
  -- do not call the rider race-reward function (it refreshes UCI rankings).
  select ts.id team_season_id,s.id season_id,s.current_day_number,sd.id season_day_id into v_context
    from public.team_manager_assignments a join public.seasons s on s.status='active'
    join public.team_seasons ts on ts.team_id=a.team_id and ts.season_id=s.id
    left join public.season_days sd on sd.season_id=s.id and sd.day_number=s.current_day_number
    where a.sporting_director_id=v_director and a.role='general_manager' and a.status='active'
    order by a.created_at desc limit 1 for update of ts;
  if not found then raise exception 'Une équipe active est nécessaire pour récupérer cette récompense.'; end if;
  v_reference:='cyclo-stickers:'||p_edition||':'||v_director::text||':'||p_achievement_id;
  insert into public.reward_events(source_reference,source_type,sporting_director_id,team_season_id,reputation_points,experience_points,cash_prize,description)
    values(v_reference,'game_objective',v_director,v_context.team_season_id,(v_achievement->>'reputation')::integer,(v_achievement->>'xp')::integer,(v_achievement->>'cash')::numeric,
      'Cyclo-Stickers · '||(v_achievement->>'name')) returning id into v_reward_id;
  insert into public.cyclo_stickers_achievement_claims(edition_id,sporting_director_id,achievement_id,reward_event_id) values(p_edition,v_director,p_achievement_id,v_reward_id);
  update public.sporting_directors set experience_points=experience_points+(v_achievement->>'xp')::integer,
    reputation_points=reputation_points+(v_achievement->>'reputation')::integer where id=v_director;
  if (v_achievement->>'cash')::numeric>0 then
    update public.team_seasons set cash_balance=cash_balance+(v_achievement->>'cash')::numeric where id=v_context.team_season_id;
    insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at)
      values(v_context.team_season_id,v_context.season_day_id,greatest(1,least(28,v_context.current_day_number)),(v_achievement->>'cash')::numeric,'other','posted',
        'Cyclo-Stickers · '||(v_achievement->>'name'),v_reference,now());
  end if;
  if v_achievement->>'trophy'='true' then
    insert into public.sporting_director_trophies(sporting_director_id,trophy_key,available_at,claimed_at)
      values(v_director,'cyclo_stickers_s4',now(),now()) on conflict(sporting_director_id,trophy_key) do nothing;
  end if;
  return jsonb_build_object('alreadyClaimed',false,'reward',v_reward,'state',private.cyclo_stickers_state(p_edition,v_director));
end;
$$;

revoke all on function private.cyclo_stickers_default_configuration(),private.require_cyclo_stickers_edition(text),
  private.preserve_cyclo_stickers_snapshot(),
  private.current_cyclo_stickers_director(),private.lock_cyclo_stickers_collections(text,uuid[]),private.expire_cyclo_stickers_offers(text,uuid),
  private.cyclo_stickers_trade_json(public.cyclo_stickers_trade_offers),private.cyclo_stickers_state(text,uuid) from public,anon,authenticated;
revoke all on function public.install_cyclo_stickers_edition(text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.install_cyclo_stickers_edition(text,jsonb,text,jsonb) to service_role;
revoke all on function public.grant_cyclo_stickers_gala_boosters(text,uuid[],text) from public,anon,authenticated;
grant execute on function public.grant_cyclo_stickers_gala_boosters(text,uuid[],text) to service_role;
revoke all on function public.get_current_cyclo_stickers_catalogue(text),public.get_current_cyclo_stickers_state(text),public.open_current_cyclo_stickers_booster(text,text,uuid),
  public.paste_current_cyclo_stickers_card(text,integer),public.propose_current_cyclo_stickers_trade(text,uuid,uuid,integer[],integer),
  public.respond_current_cyclo_stickers_trade(text,uuid,text),public.search_current_cyclo_stickers_collectors(text,text,integer,integer),
  public.claim_current_cyclo_stickers_achievement(text,text) from public,anon;
grant execute on function public.get_current_cyclo_stickers_catalogue(text),public.get_current_cyclo_stickers_state(text),public.open_current_cyclo_stickers_booster(text,text,uuid),
  public.paste_current_cyclo_stickers_card(text,integer),public.propose_current_cyclo_stickers_trade(text,uuid,uuid,integer[],integer),
  public.respond_current_cyclo_stickers_trade(text,uuid,text),public.search_current_cyclo_stickers_collectors(text,text,integer,integer),
  public.claim_current_cyclo_stickers_achievement(text,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
