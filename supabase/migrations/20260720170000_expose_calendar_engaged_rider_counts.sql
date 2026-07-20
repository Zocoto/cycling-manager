begin;

create or replace function public.get_active_calendar_engaged_rider_counts()
returns table (
  race_edition_id uuid,
  engaged_rider_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    count(roster.id)::integer
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  left join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  left join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  group by edition.id;
$$;

comment on function public.get_active_calendar_engaged_rider_counts() is
  'Retourne le nombre total de coureurs engagés par édition de la saison active.';

revoke all
on function public.get_active_calendar_engaged_rider_counts()
from public, anon;

grant execute
on function public.get_active_calendar_engaged_rider_counts()
to authenticated;

commit;
