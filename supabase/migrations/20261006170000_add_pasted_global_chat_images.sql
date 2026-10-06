begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

alter table public.global_chat_messages
  add column if not exists image_path text,
  add column if not exists image_width integer,
  add column if not exists image_height integer;
alter table public.global_chat_messages add constraint global_chat_image_complete check (
  (image_path is null and image_width is null and image_height is null)
  or (image_path is not null and image_width is not null and image_height is not null
    and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    and image_width between 1 and 1600 and image_height between 1 and 1600)
) not valid;
create unique index if not exists global_chat_image_path_idx
  on public.global_chat_messages(image_path) where image_path is not null;

-- Only the authenticated application server may upload, after decoding/re-encoding.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('global-chat-images', 'global-chat-images', false, 786432, array['image/webp'])
on conflict(id) do update set public=false, file_size_limit=786432, allowed_mime_types=array['image/webp'];
create policy global_chat_image_read on storage.objects for select to authenticated
using (bucket_id = 'global-chat-images' and exists (
  select 1 from public.global_chat_messages m where m.image_path = storage.objects.name
    and m.created_at > now() - interval '30 days'
));

create table public.global_chat_image_uploads (
  id uuid primary key,
  -- Keep this opaque owner ID after account deletion so Storage files can still be cleaned.
  auth_user_id uuid not null,
  message_id uuid references public.global_chat_messages(id) on delete set null,
  width integer check (width between 1 and 1600),
  height integer check (height between 1 and 1600),
  attempts integer not null default 1 check (attempts between 1 and 3),
  created_at timestamptz not null default now()
);
create index global_chat_image_uploads_user_created_idx on public.global_chat_image_uploads(auth_user_id, created_at);
create index global_chat_image_uploads_created_idx on public.global_chat_image_uploads(created_at);
alter table public.global_chat_image_uploads enable row level security;
revoke all on public.global_chat_image_uploads from anon, authenticated;
grant select, insert, update, delete on public.global_chat_image_uploads to service_role;

create function public.reserve_global_chat_image_upload(p_user_id uuid, p_request_id uuid)
returns public.global_chat_image_uploads language plpgsql security definer set search_path = '' as $$
declare v_upload public.global_chat_image_uploads;
begin
  if not exists (
    select 1 from public.sporting_directors d join public.team_manager_assignments a
      on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
    join public.teams t on t.id=a.team_id and t.status='active'
    where d.auth_user_id=p_user_id and d.status='active'
  ) then raise exception 'Vous devez diriger une équipe active pour partager une image.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-image:' || p_user_id::text, 0));
  select * into v_upload from public.global_chat_image_uploads where id=p_request_id for update;
  if found then
    if v_upload.auth_user_id<>p_user_id or v_upload.created_at < now()-interval '24 hours' then
      raise exception 'Cet envoi d’image n’est plus valide.';
    end if;
    if v_upload.message_id is not null then return v_upload; end if;
    if v_upload.attempts>=3 then raise exception 'Trop de tentatives pour cette image. Retirez-la puis collez-la à nouveau.'; end if;
    update public.global_chat_image_uploads set attempts=attempts+1 where id=p_request_id returning * into v_upload;
    return v_upload;
  end if;
  if (select count(*) from public.global_chat_image_uploads
      where auth_user_id=p_user_id and created_at>now()-interval '1 hour')>=10 then
    raise exception 'Limite de 10 images par heure atteinte. Réessayez plus tard.';
  end if;
  insert into public.global_chat_image_uploads(id, auth_user_id) values(p_request_id,p_user_id) returning * into v_upload;
  return v_upload;
end; $$;

create function public.post_global_chat_image_message(
  p_request_id uuid, p_message text,
  p_preview_type text default null, p_preview_entity_identifier text default null,
  p_reply_to_message_id uuid default null, p_mentioned_sporting_director_ids uuid[] default array[]::uuid[],
  p_preview_team_primary_color text default null, p_preview_team_secondary_color text default null,
  p_preview_team_accent_color text default null, p_preview_jersey_pattern text default null,
  p_preview_jersey_status text default null
) returns public.global_chat_messages language plpgsql security definer set search_path = '' as $$
declare v_upload public.global_chat_image_uploads; v_result public.global_chat_messages; v_path text;
begin
  if auth.uid() is null then raise exception 'Vous devez être connecté pour partager une image.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-image:' || auth.uid()::text, 0));
  select * into v_upload from public.global_chat_image_uploads
    where id=p_request_id and auth_user_id=auth.uid() for update;
  if not found then raise exception 'Cette image ne vous appartient pas.'; end if;
  if v_upload.message_id is not null then
    select * into v_result from public.global_chat_messages where id=v_upload.message_id;
    return v_result; -- A retried network request must never publish twice.
  end if;
  v_path := v_upload.auth_user_id::text || '/' || v_upload.id::text || '.webp';
  if v_upload.created_at < now()-interval '24 hours' or v_upload.width is null or v_upload.height is null
    or not exists(select 1 from storage.objects where bucket_id='global-chat-images' and name=v_path) then
    raise exception 'L’image n’est pas prête. Réessayez son envoi.';
  end if;
  -- Preserve all existing link, mention, reply, identity and anti-spam checks.
  v_result := public.post_global_chat_message_v4(
    coalesce(nullif(btrim(p_message), ''), 'Image jointe'), p_preview_type, p_preview_entity_identifier,
    p_reply_to_message_id, p_mentioned_sporting_director_ids, p_preview_team_primary_color,
    p_preview_team_secondary_color, p_preview_team_accent_color, p_preview_jersey_pattern, p_preview_jersey_status
  );
  update public.global_chat_messages set image_path=v_path, image_width=v_upload.width, image_height=v_upload.height
    where id=v_result.id returning * into v_result;
  update public.global_chat_image_uploads set message_id=v_result.id where id=v_upload.id;
  return v_result;
end; $$;

-- Bounded cleanup through the Storage API (never SQL-delete storage.objects).
create function public.get_expired_global_chat_images(p_limit integer default 100)
returns table(id uuid, path text) language sql security definer set search_path = '' as $$
  select u.id, u.auth_user_id::text || '/' || u.id::text || '.webp'
  from public.global_chat_image_uploads u
  where u.created_at < now()-interval '24 hours'
    and (u.message_id is null or u.created_at < now()-interval '30 days')
  order by u.created_at limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;
create function public.finish_global_chat_image_cleanup(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  with expired as (
    delete from public.global_chat_image_uploads where id=any(p_ids)
      and created_at < now()-interval '24 hours'
      and (message_id is null or created_at < now()-interval '30 days') returning message_id
  ) update public.global_chat_messages set image_path=null, image_width=null, image_height=null
    where id in (select message_id from expired);
end; $$;

revoke all on function public.reserve_global_chat_image_upload(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_expired_global_chat_images(integer) from public,anon,authenticated;
revoke all on function public.finish_global_chat_image_cleanup(uuid[]) from public,anon,authenticated;
grant execute on function public.reserve_global_chat_image_upload(uuid,uuid),
  public.get_expired_global_chat_images(integer), public.finish_global_chat_image_cleanup(uuid[]) to service_role;
revoke all on function public.post_global_chat_image_message(uuid,text,text,text,uuid,uuid[],text,text,text,text,text) from public,anon;
grant execute on function public.post_global_chat_image_message(uuid,text,text,text,uuid,uuid[],text,text,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
