begin;

-- L'accueil public ne présente pas les titres des championnats nationaux dans
-- son compteur de victoires officielles. Le total est calculé en base pour ne
-- dépendre ni de la limite de lignes PostgREST ni d'un compteur HTTP absent.
create or replace function public.get_public_home_victories(
  p_limit integer default 6
)
returns table (
  id uuid,
  race_edition_id uuid,
  race_roster_id uuid,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    result.id,
    result.race_edition_id,
    result.race_roster_id,
    result.created_at,
    count(*) over ()::bigint as total_count
  from public.race_results as result
  join public.race_editions as edition
    on edition.id = result.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where result.final_rank = 1
    and race.competition_type not in (
      'national_road',
      'national_time_trial'
    )
  order by result.created_at desc, result.id
  limit least(12, greatest(1, coalesce(p_limit, 6)));
$$;

revoke all on function public.get_public_home_victories(integer)
  from public, anon, authenticated;

grant execute on function public.get_public_home_victories(integer)
  to service_role;

comment on function public.get_public_home_victories(integer) is
  'Retourne les victoires récentes et leur total exact hors championnats nationaux pour la page publique.';

notify pgrst, 'reload schema';

commit;
