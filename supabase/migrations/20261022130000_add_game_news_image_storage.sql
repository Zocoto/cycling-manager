begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';
set local application_name = 'game-news-image-storage-20261022130000';

-- Public editorial assets, never documents or drafts. No browser write policy:
-- only the authenticated game-staff upload endpoint uses the server credential.
-- Existing news documents and their validation remain unchanged.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('game-news-images', 'game-news-images', true, 786432, array['image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from storage.buckets where id = 'game-news-images'
    and name = 'game-news-images' and public and file_size_limit = 786432
    and allowed_mime_types = array['image/webp']) then
    raise exception 'Unexpected game-news-images bucket configuration.';
  end if;
end $$;
commit;
