begin;
set local lock_timeout='1s';
set local statement_timeout='10s';

-- Independent staging for the new three-race programmes. No old event,
-- registration, reward, permission or public registration RPC is changed.
create table public.season_gala_registrations (
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null references public.seasons(id) on delete restrict,
 team_id uuid not null references public.teams(id) on delete restrict,
 program text not null check(program in ('world-tour','continental')),
 created_at timestamptz not null default now(),
 unique(season_id,team_id)
);
create table public.season_gala_registration_riders (
 registration_id uuid not null references public.season_gala_registrations(id) on delete cascade,
 profile text not null check(profile in ('mountain','hills','cobbles','sprint')),
 rider_id uuid not null references public.riders(id) on delete restrict,
 position smallint not null check(position between 1 and 8),
 primary key(registration_id,profile,rider_id),
 unique(registration_id,profile,position)
);
create index season_gala_registration_riders_rider_idx on public.season_gala_registration_riders(rider_id);
alter table public.season_gala_registrations enable row level security;
alter table public.season_gala_registration_riders enable row level security;
revoke all on public.season_gala_registrations,public.season_gala_registration_riders from public,anon,authenticated;
grant select,insert,update,delete on public.season_gala_registrations,public.season_gala_registration_riders to service_role;
comment on table public.season_gala_registrations is 'One programme per team and season. Private staging only; no public registration endpoint is opened.';
comment on table public.season_gala_registration_riders is 'Independent compositions for the three profiles. Exports require 7-8 riders, team membership, primary native ratings <=75 for Continental, and source PCM capacity minus the observer.';
notify pgrst,'reload schema';
commit;
