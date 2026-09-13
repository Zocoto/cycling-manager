begin;

-- Conserve toute la logique de disponibilité et de forme déjà accumulée,
-- puis expose la note baroudeur utilisée par le tri de la startlist.
alter function public.get_current_team_race_roster_options(uuid)
  rename to get_current_team_race_roster_options_before_breakaway;

revoke all
on function public.get_current_team_race_roster_options_before_breakaway(uuid)
from public, anon, authenticated;

grant execute
on function public.get_current_team_race_roster_options_before_breakaway(uuid)
to service_role;

create function public.get_current_team_race_roster_options(
  p_race_edition_id uuid
)
returns table (
  rider_id uuid,
  first_name text,
  last_name text,
  country_name text,
  country_iso_alpha2 text,
  avatar_profile_key text,
  avatar_seed bigint,
  age integer,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  breakaway integer,
  current_form numeric,
  is_selected boolean,
  is_available boolean,
  unavailability_type text,
  unavailability_label text,
  unavailable_until timestamptz,
  conflicting_race_slug text,
  conflicting_race_name text,
  conflicting_start_day integer,
  conflicting_end_day integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    option.rider_id,
    option.first_name,
    option.last_name,
    option.country_name,
    option.country_iso_alpha2,
    option.avatar_profile_key,
    option.avatar_seed,
    option.age,
    option.mountain,
    option.hills,
    option.flat,
    option.time_trial,
    option.cobbles,
    option.sprint,
    coalesce(rating.breakaway, 50)::integer as breakaway,
    option.current_form,
    option.is_selected,
    option.is_available,
    option.unavailability_type,
    option.unavailability_label,
    option.unavailable_until,
    option.conflicting_race_slug,
    option.conflicting_race_name,
    option.conflicting_start_day,
    option.conflicting_end_day
  from public.get_current_team_race_roster_options_before_breakaway(
    p_race_edition_id
  ) as option
  join public.race_editions as edition
    on edition.id = p_race_edition_id
  left join public.rider_season_ratings as rating
    on rating.rider_id = option.rider_id
   and rating.season_id = edition.season_id;
$$;

revoke all
on function public.get_current_team_race_roster_options(uuid)
from public, anon;

grant execute
on function public.get_current_team_race_roster_options(uuid)
to authenticated, service_role;

comment on function public.get_current_team_race_roster_options(uuid) is
  'Retourne les coureurs éligibles à une inscription avec leurs notes principales, la note baroudeur, leur disponibilité et leur forme actuelle.';

notify pgrst, 'reload schema';

commit;
