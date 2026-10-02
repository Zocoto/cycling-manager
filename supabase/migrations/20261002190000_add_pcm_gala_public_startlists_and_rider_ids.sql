begin;

-- Une startlist PCM reference les coureurs par identifiant entier. Cet
-- identifiant doit rester stable entre l'export de la base et celui de la
-- startlist, y compris si l'effectif ou l'ordre alphabetique evolue.
alter table public.riders
  add column if not exists pcm_export_id integer;

with unassigned_riders as (
  select
    riders.id,
    row_number() over (order by riders.created_at, riders.id) as export_position
  from public.riders
  where riders.pcm_export_id is null
)
update public.riders
set pcm_export_id = (10000 + unassigned_riders.export_position)::integer
from unassigned_riders
where riders.id = unassigned_riders.id;

create sequence if not exists public.pcm_export_rider_id_seq;

select setval(
  'public.pcm_export_rider_id_seq',
  (select coalesce(max(pcm_export_id), 10000) + 1 from public.riders),
  false
);

alter sequence public.pcm_export_rider_id_seq
  owned by public.riders.pcm_export_id;

alter table public.riders
  alter column pcm_export_id
  set default nextval('public.pcm_export_rider_id_seq');

alter table public.riders
  alter column pcm_export_id set not null;

alter table public.riders
  drop constraint if exists riders_pcm_export_id_range;

alter table public.riders
  add constraint riders_pcm_export_id_range
  check (pcm_export_id >= 10001);

create unique index if not exists riders_pcm_export_id_key
  on public.riders (pcm_export_id);

comment on column public.riders.pcm_export_id is
  'Identifiant entier permanent du coureur dans les exports Pro Cycling Manager.';

create or replace function public.get_pcm_gala_public_startlists()
returns table (
  event_key text,
  team_id uuid,
  team_name text,
  team_short_name text,
  team_country_code text,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  rider_country_code text,
  rider_position integer,
  registered_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    events.event_key::text,
    registrations.team_id,
    team_seasons.display_name::text,
    coalesce(team_seasons.short_name, team_seasons.display_name)::text,
    coalesce(team_country.iso_alpha2, '')::text,
    registration_riders.rider_id,
    riders.first_name::text,
    riders.last_name::text,
    coalesce(rider_country.iso_alpha2, '')::text,
    registration_riders.position::integer,
    registrations.registered_at
  from public.pcm_gala_events as events
  inner join public.seasons
    on seasons.id = events.season_id
    and seasons.status = 'active'
  inner join public.pcm_gala_registrations as registrations
    on registrations.gala_event_id = events.id
    and registrations.season_id = events.season_id
  inner join public.team_seasons
    on team_seasons.team_id = registrations.team_id
    and team_seasons.season_id = events.season_id
    and team_seasons.status = 'active'
  left join public.countries as team_country
    on team_country.id = team_seasons.registration_country_id
  inner join public.pcm_gala_registration_riders as registration_riders
    on registration_riders.registration_id = registrations.id
  inner join public.riders
    on riders.id = registration_riders.rider_id
  left join public.countries as rider_country
    on rider_country.id = riders.country_id
  where auth.uid() is not null
  order by
    events.sort_order,
    team_seasons.display_name,
    registrations.team_id,
    registration_riders.position;
$$;

revoke all on function public.get_pcm_gala_public_startlists() from public, anon;
grant execute on function public.get_pcm_gala_public_startlists() to authenticated;

comment on function public.get_pcm_gala_public_startlists() is
  'Expose aux membres authentifies les equipes et coureurs deja inscrits aux courses gala de la saison active.';

notify pgrst, 'reload schema';

commit;
