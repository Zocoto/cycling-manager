begin;

-- ============================================================
-- PROFIL DE GÉNÉRATION DU DIRECTEUR SPORTIF CONNECTÉ
--
-- Les associations pays -> bibliothèque de noms sont protégées
-- par RLS. Cette fonction permet au serveur de récupérer
-- uniquement le profil correspondant au compte authentifié.
--
-- Elle ne donne accès :
--   - ni aux profils des autres Directeurs Sportifs ;
--   - ni à la totalité du référentiel des pays ;
--   - ni aux données internes de génération.
-- ============================================================

create or replace function
  public.get_current_rider_generation_profile()
returns table (
  name_profile_code text,
  avatar_profile_key text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    generation_profile.name_profile_code,
    generation_profile.avatar_profile_key
  from public.sporting_directors as sporting_director
  inner join public.country_rider_generation_profiles
    as generation_profile
    on generation_profile.country_id =
      sporting_director.country_id
  where sporting_director.auth_user_id = auth.uid()
  limit 1;
$$;


-- ============================================================
-- AUTORISATIONS
-- ============================================================

revoke all
on function public.get_current_rider_generation_profile()
from public;

revoke all
on function public.get_current_rider_generation_profile()
from anon;

grant execute
on function public.get_current_rider_generation_profile()
to authenticated;


-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on function
  public.get_current_rider_generation_profile()
is
  'Retourne la bibliothèque de noms et le profil visuel associés à la nationalité du Directeur Sportif authentifié.';

commit;