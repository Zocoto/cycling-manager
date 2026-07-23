begin;

create table public.race_live_messages (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null
    references public.stages(id)
    on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  author_display_name text not null,
  message text not null,
  created_at timestamptz not null default now(),

  constraint race_live_messages_author_not_empty
    check (btrim(author_display_name) <> ''),
  constraint race_live_messages_message_length
    check (
      char_length(btrim(message)) between 1 and 280
    )
);

create index race_live_messages_stage_created_idx
  on public.race_live_messages (stage_id, created_at desc);

create index race_live_messages_director_created_idx
  on public.race_live_messages (sporting_director_id, created_at desc);

alter table public.race_live_messages enable row level security;

create policy race_live_messages_select_authenticated
on public.race_live_messages
for select
to authenticated
using (true);

create policy race_live_messages_insert_own
on public.race_live_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id = sporting_director_id
      and director.auth_user_id = (select auth.uid())
      and director.status = 'active'
  )
);

grant select, insert on table public.race_live_messages
to authenticated, service_role;

create or replace function public.get_active_calendar_engaged_counts()
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
  where edition.status <> 'cancelled'
  group by edition.id
  order by edition.id;
$$;

create or replace function public.get_race_edition_engaged_riders(
  p_race_edition_id uuid
)
returns table (
  race_edition_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_id uuid,
  team_name text,
  team_primary_color text,
  team_secondary_color text,
  age integer,
  form integer,
  race_role text,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    rider.id,
    rider.first_name,
    rider.last_name,
    team.id,
    team_season.display_name,
    coalesce(team.amateur_jersey_primary_color, '#176951'),
    coalesce(team.amateur_jersey_secondary_color, '#FFFDF4'),
    coalesce(rating.age, 25)::integer,
    coalesce(roster.starting_form, condition.form, 75)::integer,
    roster.race_role,
    coalesce(rating.mountain, 50)::integer,
    coalesce(rating.hills, 50)::integer,
    coalesce(rating.flat, 50)::integer,
    coalesce(rating.time_trial, 50)::integer,
    coalesce(rating.cobbles, 50)::integer,
    coalesce(rating.sprint, 50)::integer,
    coalesce(rating.acceleration, 50)::integer,
    coalesce(rating.downhill, 50)::integer,
    coalesce(rating.endurance, 50)::integer,
    coalesce(rating.resistance, 50)::integer,
    coalesce(rating.recovery, 50)::integer,
    coalesce(rating.breakaway, 50)::integer,
    coalesce(rating.prologue, 50)::integer
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.teams as team
    on team.id = team_season.team_id
  join public.riders as rider
    on rider.id = roster.rider_id
  left join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = edition.season_id
  left join lateral (
    select state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
     and condition_day.season_id = edition.season_id
    where state.rider_id = rider.id
      and condition_day.day_number <= coalesce(season.current_day_number, 28)
    order by condition_day.day_number desc
    limit 1
  ) as condition on true
  where edition.id = p_race_edition_id
    and edition.status <> 'cancelled'
  order by
    team_season.display_name,
    roster.bib_number nulls last,
    rider.last_name,
    rider.first_name;
$$;

revoke all on function public.get_active_calendar_engaged_counts()
from public, anon;
revoke all on function public.get_race_edition_engaged_riders(uuid)
from public, anon;

grant execute on function public.get_active_calendar_engaged_counts()
to authenticated, service_role;
grant execute on function public.get_race_edition_engaged_riders(uuid)
to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'race_live_messages'
  ) then
    alter publication supabase_realtime
      add table public.race_live_messages;
  end if;
end;
$$;

comment on table public.race_live_messages is
  'Messages courts échangés entre Directeurs Sportifs pendant et après une étape.';

commit;
