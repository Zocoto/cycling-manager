begin;

-- La nationalité enrichit l'affichage, mais cette RPC reste optionnelle :
-- le chargement du salon retombe sur la RPC d'avatars si elle est indisponible.
create or replace function public.get_global_chat_director_profiles(
  p_sporting_director_ids uuid[]
)
returns table (
  sporting_director_id uuid,
  avatar_key text,
  avatar_frame_key text,
  country_name text,
  country_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    director.id,
    director.avatar_key,
    director.avatar_frame_key,
    country.name,
    country.iso_alpha2
  from public.sporting_directors as director
  left join public.countries as country
    on country.id = director.country_id
  where (select auth.uid()) is not null
    and director.id = any(coalesce(p_sporting_director_ids, array[]::uuid[]));
$$;

revoke all on function public.get_global_chat_director_profiles(uuid[])
  from public, anon;
grant execute on function public.get_global_chat_director_profiles(uuid[])
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
