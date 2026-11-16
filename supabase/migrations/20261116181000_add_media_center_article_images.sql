begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Objects are served by the Storage CDN at opaque, immutable addresses.
-- Only the application server may write this bucket, after decoding the image.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('media-center-images', 'media-center-images', true, 786432, array['image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from storage.buckets where id = 'media-center-images'
      and name = 'media-center-images' and public and file_size_limit = 786432
      and allowed_mime_types = array['image/webp']
  ) then
    raise exception 'Unexpected media-center-images bucket configuration.';
  end if;
end $$;

create table public.media_center_article_images (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  sporting_director_id uuid not null,
  width integer check (width between 1 and 1600),
  height integer check (height between 1 and 1600),
  article_id uuid references public.media_center_articles(id) on delete set null,
  created_at timestamptz not null default now(),
  cleanup_started_at timestamptz,
  check ((width is null) = (height is null)),
  check (article_id is null or (width is not null and cleanup_started_at is null))
);

create index media_center_article_images_team_time_idx
  on public.media_center_article_images(team_id, created_at);
create index media_center_article_images_cleanup_idx
  on public.media_center_article_images(created_at, id) where article_id is null;
create index media_center_article_images_article_idx
  on public.media_center_article_images(article_id) where article_id is not null;

alter table public.media_center_article_images enable row level security;
revoke all on public.media_center_article_images from public, anon, authenticated;
grant select, update, delete on public.media_center_article_images to service_role;

create function public.reserve_media_center_article_image(p_auth_user_id uuid)
returns public.media_center_article_images
language plpgsql security definer set search_path = ''
as $$
declare
  v_team_id uuid;
  v_director_id uuid;
  v_image public.media_center_article_images;
begin
  select assignment.team_id, director.id into v_team_id, v_director_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.team_infrastructures as infrastructure
    on infrastructure.team_id = assignment.team_id
    and infrastructure.infrastructure_code = 'media_center' and infrastructure.level >= 1
  join public.teams as team on team.id = assignment.team_id and team.status = 'active'
  where director.auth_user_id = p_auth_user_id and director.status = 'active'
    and exists (
      select 1 from public.team_seasons as team_season
      join public.seasons as season on season.id = team_season.season_id and season.status = 'active'
      where team_season.team_id = assignment.team_id
    )
  order by assignment.team_id
  limit 1;

  if v_team_id is null then
    raise exception using errcode = '42501', message = 'Accès au Média Center requis.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('media-center-image:' || v_team_id::text, 0));
  if (select count(*) from public.media_center_article_images
    where team_id = v_team_id and created_at > now() - interval '24 hours') >= 12 then
    raise exception using errcode = 'PT429', message = 'Limite d’illustrations atteinte.';
  end if;

  insert into public.media_center_article_images(team_id, sporting_director_id)
  values (v_team_id, v_director_id) returning * into v_image;
  return v_image;
end;
$$;

-- Mark rows before talking to Storage so publishing and cleanup cannot claim
-- the same image. A failed Storage deletion becomes eligible again later.
create function public.claim_expired_media_center_article_images()
returns table(id uuid, path text)
language sql security definer set search_path = ''
as $$
  with expired as (
    select image.id
    from public.media_center_article_images as image
    where image.article_id is null and image.created_at < now() - interval '7 days'
      and (image.cleanup_started_at is null or image.cleanup_started_at < now() - interval '1 hour')
    order by image.created_at, image.id
    limit 100
    for update skip locked
  )
  update public.media_center_article_images as image
  set cleanup_started_at = now()
  from expired where image.id = expired.id
  returning image.id, image.team_id::text || '/' || image.id::text || '.webp';
$$;

revoke all on function public.reserve_media_center_article_image(uuid) from public, anon, authenticated;
grant execute on function public.reserve_media_center_article_image(uuid) to service_role;
revoke all on function public.claim_expired_media_center_article_images() from public, anon, authenticated;
grant execute on function public.claim_expired_media_center_article_images() to service_role;

notify pgrst, 'reload schema';
commit;
