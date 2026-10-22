begin;
set local application_name = 'game-news-schema-migration-20261022120000';
set local lock_timeout = '2s';
set local statement_timeout = '15s';

-- Delegated game operations are deliberately separate from the private owner
-- administration. No permission is derived from editable user metadata or JWT.
create table private.user_game_roles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'game_staff')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (role <> 'owner' or revoked_at is null)
);

-- Exactly one founder account; delegated staff can never create another one.
create unique index user_game_roles_single_owner
  on private.user_game_roles (role) where role = 'owner';

create table private.user_game_role_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('owner_bootstrap', 'staff_granted', 'staff_revoked')),
  recorded_at timestamptz not null default now()
);

create table private.game_product_news (
  id uuid primary key default gen_random_uuid(),
  draft jsonb not null,
  published jsonb,
  revision integer not null default 1 check (revision > 0),
  published_revision integer,
  published_at timestamptz,
  published_updated_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_product_news_publication_consistent check (
    (published is null and published_revision is null and published_at is null and published_updated_at is null)
    or (published is not null and published_revision between 1 and revision
      and published_at is not null and published_updated_at is not null)
  ),
  check (jsonb_typeof(draft) = 'object'),
  check (published is null or jsonb_typeof(published) = 'object')
);

create index game_product_news_published_idx
  on private.game_product_news (published_at desc, id desc)
  where published is not null;

create table private.game_product_news_events (
  id bigint generated always as identity primary key,
  news_id uuid not null references private.game_product_news(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('draft_saved', 'published', 'legacy_import')),
  revision integer not null check (revision > 0),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  recorded_at timestamptz not null default now(),
  unique (news_id, revision)
);

create index game_product_news_events_news_idx
  on private.game_product_news_events(news_id, recorded_at desc);

alter table private.user_game_roles enable row level security;
alter table private.user_game_role_events enable row level security;
alter table private.game_product_news enable row level security;
alter table private.game_product_news_events enable row level security;
revoke all on table private.user_game_roles, private.user_game_role_events,
  private.game_product_news, private.game_product_news_events from public, anon, authenticated, service_role;
revoke all on sequence private.user_game_role_events_id_seq,
  private.game_product_news_events_id_seq from public, anon, authenticated, service_role;

-- Only the already-authorized owner is bootstrapped. No other existing member
-- is promoted and future registrations never gain an operational role.
with owner_account as (
  select account.id
  from auth.users as account
  join public.sporting_directors as director on director.auth_user_id = account.id
  where lower(btrim(account.email)) = 'paul.leblanc22@gmail.com'
    and lower(btrim(director.username)) = 'zocoto'
    and director.status = 'active'
), inserted as (
  insert into private.user_game_roles(auth_user_id, role, granted_by)
  select id, 'owner', id from owner_account
  returning auth_user_id
)
insert into private.user_game_role_events(actor_user_id, target_user_id, action)
select auth_user_id, auth_user_id, 'owner_bootstrap' from inserted;

-- Fail the whole transaction if the known principal account cannot be found.
-- This invariant also protects an application outside the release script.
do $$
begin
  if (select count(*) from private.user_game_roles where role = 'owner') <> 1 then
    raise exception 'Exactly one existing Zocoto founder account is required.';
  end if;
end;
$$;

create function private.current_game_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select membership.role
  from private.user_game_roles as membership
  join public.sporting_directors as director on director.auth_user_id = membership.auth_user_id
  where membership.auth_user_id = auth.uid()
    and membership.revoked_at is null and director.status = 'active'
  limit 1;
$$;

create function public.get_current_user_game_role()
returns text
language sql stable security definer set search_path = ''
as $$ select private.current_game_role(); $$;

-- Reuse the existing consolidated header query: exposing the role must not
-- introduce another request on every game page or alter any unread counters.
create function public.get_current_game_header_indicators_v3()
returns table (
  current_sporting_director_id uuid,
  mailbox_unread_count integer,
  direct_message_unread_count integer,
  has_unread_global_chat boolean,
  has_unread_cyclogazette boolean,
  game_role text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  return query select indicators.current_sporting_director_id,
    indicators.mailbox_unread_count, indicators.direct_message_unread_count,
    indicators.has_unread_global_chat, indicators.has_unread_cyclogazette,
    private.current_game_role()
  from public.get_current_game_header_indicators_v2() as indicators;
end;
$$;

create function public.get_game_staff_directory()
returns table (sporting_director_id uuid)
language sql stable security definer set search_path = ''
as $$
  select director.id
  from private.user_game_roles as membership
  join public.sporting_directors as director on director.auth_user_id = membership.auth_user_id
  where membership.revoked_at is null and director.status = 'active'
  order by director.id;
$$;

create function public.get_game_staff_members()
returns table (user_id uuid, sporting_director_id uuid, display_name text, role text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.current_game_role() is distinct from 'owner' then
    raise exception 'Accès réservé au responsable du jeu.' using errcode = '42501';
  end if;
  return query select membership.auth_user_id, director.id, director.display_name, membership.role
  from private.user_game_roles as membership
  join public.sporting_directors as director on director.auth_user_id = membership.auth_user_id
  where membership.revoked_at is null and director.status = 'active'
  order by membership.role, lower(director.display_name), director.id;
end;
$$;

create function public.search_game_staff_candidates(p_query text, p_limit integer default 10)
returns table (user_id uuid, director_id uuid, display_name text, username text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
begin
  if private.current_game_role() is distinct from 'owner' then
    raise exception 'Accès réservé au responsable du jeu.' using errcode = '42501';
  end if;
  if char_length(v_query) < 2 or char_length(v_query) > 60 then
    return;
  end if;
  -- Literal substring rather than LIKE: '%' and '_' never enumerate all users.
  return query select director.auth_user_id, director.id, director.display_name, director.username
  from public.sporting_directors as director
  where director.auth_user_id is not null and director.status = 'active'
    and (position(lower(v_query) in lower(director.username)) > 0
      or position(lower(v_query) in lower(director.display_name)) > 0)
  order by lower(director.display_name), director.id
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
end;
$$;

create function public.set_game_staff_role(p_auth_user_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_current private.user_game_roles%rowtype;
begin
  if private.current_game_role() is distinct from 'owner' then
    raise exception 'Accès réservé au responsable du jeu.' using errcode = '42501';
  end if;
  if p_auth_user_id is null or p_enabled is null then
    raise exception 'Membre et état requis.' using errcode = '22023';
  end if;
  -- Serialize owner changes for one member, including the absent-row case.
  perform 1 from public.sporting_directors as director
  where director.auth_user_id = p_auth_user_id and director.status = 'active'
  for update;
  if not found then
    raise exception 'Directeur sportif actif introuvable.' using errcode = '22023';
  end if;
  select membership.* into v_current from private.user_game_roles as membership
  where membership.auth_user_id = p_auth_user_id for update;
  if v_current.role = 'owner' then
    raise exception 'Le rôle du responsable ne peut pas être modifié.' using errcode = '42501';
  end if;
  if p_enabled then
    if v_current.auth_user_id is not null and v_current.revoked_at is null then return; end if;
    insert into private.user_game_roles(auth_user_id, role, granted_by)
    values(p_auth_user_id, 'game_staff', auth.uid())
    on conflict (auth_user_id) do update set role = 'game_staff', granted_by = auth.uid(),
      granted_at = now(), revoked_at = null;
    insert into private.user_game_role_events(actor_user_id, target_user_id, action)
    values(auth.uid(), p_auth_user_id, 'staff_granted');
  else
    if v_current.auth_user_id is null or v_current.revoked_at is not null then return; end if;
    update private.user_game_roles set revoked_at = now() where auth_user_id = p_auth_user_id;
    insert into private.user_game_role_events(actor_user_id, target_user_id, action)
    values(auth.uid(), p_auth_user_id, 'staff_revoked');
  end if;
end;
$$;

-- Shared SQL validation is authoritative even when a caller bypasses the UI.
-- The document contains plain Unicode/Markdown text, never executable HTML.
create function private.validate_game_news_document(p_document jsonb, p_for_publication boolean)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_key text;
  v_value text;
  v_min integer;
  v_max integer;
  v_document jsonb := '{}'::jsonb;
begin
  if p_document is null or jsonb_typeof(p_document) is distinct from 'object'
    or char_length(p_document::text) > 90000 then
    raise exception 'Document de nouveauté invalide.' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_document) loop
    if v_key not in ('title', 'category', 'summary', 'body', 'title_en', 'category_en',
      'summary_en', 'body_en', 'image_path', 'image_alt', 'link_url', 'link_label')
      or jsonb_typeof(p_document -> v_key) is distinct from 'string' then
      raise exception 'Champ de nouveauté invalide : %.', v_key using errcode = '22023';
    end if;
  end loop;
  foreach v_key in array array['title', 'category', 'summary', 'body', 'title_en',
    'category_en', 'summary_en', 'body_en', 'image_path', 'image_alt', 'link_url', 'link_label'] loop
    v_value := coalesce(p_document ->> v_key, '');
    if v_key not in ('body', 'body_en') then v_value := btrim(v_value); end if;
    v_max := case when v_key in ('title', 'title_en') then 160
      when v_key in ('category', 'category_en') then 60
      when v_key in ('summary', 'summary_en') then 500
      when v_key in ('body', 'body_en') then 30000
      when v_key = 'image_alt' then 250 when v_key = 'link_label' then 100 else 500 end;
    v_min := case when v_key in ('title', 'title_en') then 5
      when v_key in ('category', 'category_en') then 2
      when v_key in ('summary', 'summary_en', 'body', 'body_en') then 10 else 1 end;
    if char_length(v_value) > v_max then
      raise exception 'Champ trop long : % (maximum %).', v_key, v_max using errcode = '22023';
    end if;
    if p_for_publication and (
      (v_key in ('title', 'category', 'summary', 'body') and char_length(btrim(v_value)) < v_min)
      or (v_key in ('title_en', 'category_en', 'summary_en', 'body_en')
        and btrim(v_value) <> '' and char_length(btrim(v_value)) < v_min)
    ) then
      raise exception 'Champ trop court : % (minimum %).', v_key, v_min using errcode = '22023';
    end if;
    if v_key in ('title', 'category', 'summary', 'body') or btrim(v_value) <> '' then
      v_document := v_document || jsonb_build_object(v_key, v_value);
    end if;
  end loop;
  v_value := v_document ->> 'image_path';
  if v_value is not null and (v_value !~ '^/images/[A-Za-z0-9_./-]+$'
    or position('..' in v_value) > 0 or position('//' in v_value) > 0) then
    raise exception 'Illustration : chemin /images/ requis.' using errcode = '22023';
  end if;
  v_value := v_document ->> 'link_url';
  if v_value is not null and (
    not (v_value ~ '^https://[A-Za-z0-9]' or (left(v_value, 1) = '/' and left(v_value, 2) <> '//'))
    or v_value ~ '[[:space:][:cntrl:]]' or position(chr(92) in v_value) > 0
    or lower(v_value) ~ '^/(%2f|%5c)'
  ) then
    raise exception 'Lien : URL HTTPS ou chemin interne requis.' using errcode = '22023';
  end if;
  return v_document;
end;
$$;

create function public.get_published_game_news(p_limit integer default 20, p_id uuid default null)
returns table (id uuid, document jsonb, published_at timestamptz, updated_at timestamptz, revision integer)
language sql stable security definer set search_path = ''
as $$
  select news.id, news.published, news.published_at, news.published_updated_at, news.published_revision
  from private.game_product_news as news
  where news.published is not null and (p_id is null or news.id = p_id)
  order by news.published_at desc, news.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create function public.get_game_news_editor(p_id uuid default null)
returns table (id uuid, draft jsonb, published jsonb, published_at timestamptz,
  updated_at timestamptz, revision integer, has_unpublished_changes boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.current_game_role() is null then
    raise exception 'Accès réservé à l’équipe du jeu.' using errcode = '42501';
  end if;
  return query select news.id, news.draft, news.published, news.published_at,
    news.updated_at, news.revision, news.draft is distinct from news.published
  from private.game_product_news as news
  where p_id is null or news.id = p_id
  order by news.updated_at desc, news.id desc
  limit 100;
end;
$$;

create function public.save_game_news_draft(p_id uuid, p_expected_revision integer, p_document jsonb)
returns table (id uuid, draft jsonb, published jsonb, published_at timestamptz,
  updated_at timestamptz, revision integer, has_unpublished_changes boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_document jsonb;
  v_revision integer;
begin
  if private.current_game_role() is null then
    raise exception 'Accès réservé à l’équipe du jeu.' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Version attendue requise.' using errcode = '22023';
  end if;
  v_document := private.validate_game_news_document(p_document, false);
  if p_expected_revision = 0 then
    insert into private.game_product_news(id, draft, created_by, updated_by)
    values(v_id, v_document, auth.uid(), auth.uid())
    on conflict on constraint game_product_news_pkey do nothing
    returning game_product_news.revision into v_revision;
    if v_revision is null and exists (
      select 1 from private.game_product_news as existing
      where existing.id = v_id and existing.created_by = auth.uid()
        and existing.revision = 1 and existing.published is null
        and existing.draft = v_document
    ) then
      -- A creation response may be lost. Retrying the same client-generated
      -- UUID/content is a read, never a second draft or audit event. Once the
      -- article changes, or for another actor, the normal CAS conflict applies.
      return query select * from public.get_game_news_editor(v_id);
      return;
    end if;
  else
    update private.game_product_news as news
    set draft = v_document, revision = news.revision + 1, updated_by = auth.uid(), updated_at = now()
    where news.id = v_id and news.revision = p_expected_revision
    returning news.revision into v_revision;
  end if;
  if v_revision is null then
    raise exception 'Cette nouveauté a été modifiée entre-temps. Rechargez-la avant de réessayer.'
      using errcode = '40001';
  end if;
  insert into private.game_product_news_events(news_id, actor_user_id, action, revision, document)
  values(v_id, auth.uid(), 'draft_saved', v_revision, v_document);
  return query select * from public.get_game_news_editor(v_id);
end;
$$;

create function public.publish_game_news(p_id uuid, p_expected_revision integer)
returns table (id uuid, draft jsonb, published jsonb, published_at timestamptz,
  updated_at timestamptz, revision integer, has_unpublished_changes boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_current private.game_product_news%rowtype;
  v_document jsonb;
  v_revision integer;
begin
  if private.current_game_role() is null then
    raise exception 'Accès réservé à l’équipe du jeu.' using errcode = '42501';
  end if;
  if p_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Nouveauté et version attendue requises.' using errcode = '22023';
  end if;
  select news.* into v_current from private.game_product_news as news
  where news.id = p_id and news.revision = p_expected_revision for update;
  if not found then
    raise exception 'Cette nouveauté a été modifiée entre-temps. Rechargez-la avant de réessayer.'
      using errcode = '40001';
  end if;
  v_document := private.validate_game_news_document(v_current.draft, true);
  update private.game_product_news as news
  set draft = v_document, published = v_document, published_revision = news.revision + 1,
    revision = news.revision + 1, published_at = coalesce(news.published_at, now()),
    published_updated_at = now(), updated_at = now(), updated_by = auth.uid()
  where news.id = p_id and news.revision = p_expected_revision
  returning news.revision into v_revision;
  if v_revision is null then
    raise exception 'Version de nouveauté obsolète.' using errcode = '40001';
  end if;
  insert into private.game_product_news_events(news_id, actor_user_id, action, revision, document)
  values(p_id, auth.uid(), 'published', v_revision, v_document);
  return query select * from public.get_game_news_editor(p_id);
end;
$$;

revoke all on function private.current_game_role(), private.validate_game_news_document(jsonb, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.get_current_user_game_role(), public.get_current_game_header_indicators_v3(), public.get_game_staff_directory(),
  public.get_game_staff_members(), public.search_game_staff_candidates(text, integer),
  public.set_game_staff_role(uuid, boolean), public.get_game_news_editor(uuid),
  public.save_game_news_draft(uuid, integer, jsonb), public.publish_game_news(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_current_user_game_role(), public.get_current_game_header_indicators_v3(), public.get_game_staff_directory()
  to authenticated, service_role;
grant execute on function public.get_game_staff_members(), public.search_game_staff_candidates(text, integer),
  public.set_game_staff_role(uuid, boolean), public.get_game_news_editor(uuid),
  public.save_game_news_draft(uuid, integer, jsonb), public.publish_game_news(uuid, integer)
  to authenticated;
revoke all on function public.get_published_game_news(integer, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_published_game_news(integer, uuid) to anon, authenticated, service_role;

comment on table private.user_game_roles is
  'Owner and explicitly delegated game staff. Never grants private administration or raw database access.';
comment on table private.game_product_news is
  'Independent private draft and public snapshot; public readers never observe unfinished edits.';
comment on table private.game_product_news_events is
  'Append-only editorial audit, inaccessible through client database roles.';
notify pgrst, 'reload schema';
commit;
