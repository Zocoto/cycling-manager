begin;

alter table public.team_rivalries
  add column if not exists pairing_reason text not null default
    'Deux équipes humaines voisines dans l’ordre sportif au moment de l’appariement.',
  add column if not exists team_a_pairing_rank integer,
  add column if not exists team_b_pairing_rank integer;

create table if not exists public.team_rivalry_events (
  id uuid primary key default gen_random_uuid(),
  rivalry_id uuid not null references public.team_rivalries(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  race_edition_id uuid not null references public.race_editions(id) on delete cascade,
  team_a_rank integer not null,
  team_b_rank integer not null,
  team_a_points integer not null default 0,
  team_b_points integer not null default 0,
  is_draw boolean not null default false,
  winner_team_id uuid references public.teams(id) on delete set null,
  intensity_delta integer not null,
  team_a_score_after integer not null,
  team_b_score_after integer not null,
  draws_after integer not null,
  intensity_after integer not null,
  decided_at timestamptz not null default now(),
  constraint team_rivalry_events_one_per_race unique (rivalry_id, race_edition_id),
  constraint team_rivalry_events_ranks_positive check (
    team_a_rank > 0 and team_b_rank > 0
  ),
  constraint team_rivalry_events_points_valid check (
    team_a_points in (0, 1) and team_b_points in (0, 1)
    and team_a_points + team_b_points <= 1
  ),
  constraint team_rivalry_events_outcome_consistent check (
    (is_draw and team_a_points = 0 and team_b_points = 0 and winner_team_id is null)
    or
    (not is_draw and team_a_points + team_b_points = 1 and winner_team_id is not null)
  ),
  constraint team_rivalry_events_intensity_positive check (
    intensity_delta between 1 and 10 and intensity_after >= intensity_delta
  )
);

create index if not exists team_rivalry_events_rivalry_idx
  on public.team_rivalry_events (rivalry_id, decided_at desc);
create index if not exists team_rivalry_events_season_idx
  on public.team_rivalry_events (season_id, decided_at desc);

alter table public.team_rivalry_events enable row level security;
drop policy if exists team_rivalry_events_select_authenticated
  on public.team_rivalry_events;
create policy team_rivalry_events_select_authenticated
  on public.team_rivalry_events for select to authenticated using (true);
grant select on public.team_rivalry_events to authenticated;
grant all privileges on public.team_rivalry_events to service_role;

create or replace function private.initialize_team_rivalries_for_season(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created integer := 0;
begin
  with eligible as (
    select
      team_season.id as team_season_id,
      team_season.team_id,
      team_season.display_name as team_name,
      assignment.sporting_director_id,
      director.display_name as director_name,
      row_number() over (
        order by team_season.final_rank nulls last,
          team_season.points desc, team_season.display_name, team_season.team_id
      ) as pairing_rank
    from public.team_seasons as team_season
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    where team_season.season_id = p_season_id
      and team_season.status = 'active'
      and not exists (
        select 1 from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
      and not exists (
        select 1 from public.team_rivalries as rivalry
        where rivalry.season_id = p_season_id
          and rivalry.status = 'active'
          and team_season.team_id in (rivalry.team_a_id, rivalry.team_b_id)
      )
  ), paired as (
    select a.*, b.team_season_id as b_team_season_id,
      b.team_id as b_team_id, b.team_name as b_team_name,
      b.sporting_director_id as b_director_id,
      b.director_name as b_director_name,
      b.pairing_rank as b_pairing_rank
    from eligible as a
    join eligible as b on b.pairing_rank = a.pairing_rank + 1
    where mod(a.pairing_rank, 2) = 1
  )
  insert into public.team_rivalries (
    season_id, team_a_id, team_b_id, team_a_season_id, team_b_season_id,
    team_a_director_id, team_b_director_id, team_a_name, team_b_name,
    team_a_director_name, team_b_director_name,
    pairing_reason, team_a_pairing_rank, team_b_pairing_rank
  )
  select p_season_id, paired.team_id, paired.b_team_id,
    paired.team_season_id, paired.b_team_season_id,
    paired.sporting_director_id, paired.b_director_id,
    paired.team_name, paired.b_team_name,
    paired.director_name, paired.b_director_name,
    'Équipes humaines voisines dans l’ordre sportif : rangs d’appariement '
      || paired.pairing_rank || ' et ' || paired.b_pairing_rank || '.',
    paired.pairing_rank, paired.b_pairing_rank
  from paired
  on conflict (season_id, team_a_id, team_b_id) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function private.initialize_team_rivalries_for_season(uuid)
  from public, anon, authenticated;
grant execute on function private.initialize_team_rivalries_for_season(uuid)
  to service_role;

create or replace function private.update_team_rivalries_after_race(
  p_race_edition_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rivalry record;
  v_team_a_rank integer;
  v_team_b_rank integer;
  v_team_a_points integer;
  v_team_b_points integer;
  v_is_draw boolean;
  v_winner_team_id uuid;
  v_intensity_delta integer;
  v_inserted_id uuid;
  v_updated integer := 0;
begin
  for v_rivalry in
    select rivalry.*
    from public.team_rivalries as rivalry
    join public.race_editions as edition
      on edition.id = p_race_edition_id
     and edition.season_id = rivalry.season_id
    where rivalry.status = 'active'
    for update
  loop
    select min(result.final_rank) filter (where registration.team_season_id = v_rivalry.team_a_season_id),
           min(result.final_rank) filter (where registration.team_season_id = v_rivalry.team_b_season_id)
    into v_team_a_rank, v_team_b_rank
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    where result.race_edition_id = p_race_edition_id
      and result.status = 'classified'
      and registration.team_season_id in (
        v_rivalry.team_a_season_id, v_rivalry.team_b_season_id
      );

    if v_team_a_rank is null or v_team_b_rank is null then
      continue;
    end if;

    v_team_a_points := case when v_team_a_rank < v_team_b_rank then 1 else 0 end;
    v_team_b_points := case when v_team_b_rank < v_team_a_rank then 1 else 0 end;
    v_is_draw := v_team_a_rank = v_team_b_rank;
    v_winner_team_id := case
      when v_team_a_points = 1 then v_rivalry.team_a_id
      when v_team_b_points = 1 then v_rivalry.team_b_id
      else null
    end;
    v_intensity_delta := greatest(
      1,
      11 - least(10, abs(v_team_a_rank - v_team_b_rank))
    );
    v_inserted_id := null;

    insert into public.team_rivalry_events (
      rivalry_id, season_id, race_edition_id,
      team_a_rank, team_b_rank, team_a_points, team_b_points,
      is_draw, winner_team_id, intensity_delta,
      team_a_score_after, team_b_score_after, draws_after, intensity_after
    ) values (
      v_rivalry.id, v_rivalry.season_id, p_race_edition_id,
      v_team_a_rank, v_team_b_rank, v_team_a_points, v_team_b_points,
      v_is_draw, v_winner_team_id, v_intensity_delta,
      v_rivalry.team_a_wins + v_team_a_points,
      v_rivalry.team_b_wins + v_team_b_points,
      v_rivalry.draws + case when v_is_draw then 1 else 0 end,
      v_rivalry.intensity + v_intensity_delta
    )
    on conflict (rivalry_id, race_edition_id) do nothing
    returning id into v_inserted_id;

    if v_inserted_id is null then
      continue;
    end if;

    update public.team_rivalries
    set shared_races = shared_races + 1,
        team_a_wins = team_a_wins + v_team_a_points,
        team_b_wins = team_b_wins + v_team_b_points,
        draws = draws + case when v_is_draw then 1 else 0 end,
        intensity = intensity + v_intensity_delta,
        last_race_edition_id = p_race_edition_id
    where id = v_rivalry.id;
    v_updated := v_updated + 1;
  end loop;
  return v_updated;
end;
$$;

revoke all on function private.update_team_rivalries_after_race(uuid)
  from public, anon, authenticated;
grant execute on function private.update_team_rivalries_after_race(uuid)
  to service_role;

-- The feature was enabled during an active race window. Preserve and explain
-- any single confrontation scored between the original trigger and this ledger
-- without changing its score, its intensity or any race result.
insert into public.team_rivalry_events (
  rivalry_id, season_id, race_edition_id,
  team_a_rank, team_b_rank, team_a_points, team_b_points,
  is_draw, winner_team_id, intensity_delta,
  team_a_score_after, team_b_score_after, draws_after, intensity_after,
  decided_at
)
select
  rivalry.id, rivalry.season_id, rivalry.last_race_edition_id,
  ranks.team_a_rank, ranks.team_b_rank,
  rivalry.team_a_wins, rivalry.team_b_wins,
  rivalry.draws = 1,
  case
    when rivalry.team_a_wins = 1 then rivalry.team_a_id
    when rivalry.team_b_wins = 1 then rivalry.team_b_id
    else null
  end,
  rivalry.intensity,
  rivalry.team_a_wins, rivalry.team_b_wins, rivalry.draws, rivalry.intensity,
  now()
from public.team_rivalries as rivalry
join lateral (
  select
    min(result.final_rank) filter (
      where registration.team_season_id = rivalry.team_a_season_id
    ) as team_a_rank,
    min(result.final_rank) filter (
      where registration.team_season_id = rivalry.team_b_season_id
    ) as team_b_rank
  from public.race_results as result
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
  where result.race_edition_id = rivalry.last_race_edition_id
    and result.status = 'classified'
) as ranks on ranks.team_a_rank is not null and ranks.team_b_rank is not null
where rivalry.shared_races = 1
  and rivalry.last_race_edition_id is not null
  and rivalry.intensity between 1 and 10
  and not exists (
    select 1
    from public.team_rivalry_events as existing
    where existing.rivalry_id = rivalry.id
      and existing.race_edition_id = rivalry.last_race_edition_id
  )
on conflict (rivalry_id, race_edition_id) do nothing;

create or replace function public.get_current_team_rivalry_dossiers()
returns table (
  rivalry_id uuid,
  season_id uuid,
  season_name text,
  game_year integer,
  status text,
  own_team_id uuid,
  team_a_id uuid,
  team_a_name text,
  team_a_director_name text,
  team_a_wins integer,
  team_a_reputation_delta integer,
  team_b_id uuid,
  team_b_name text,
  team_b_director_name text,
  team_b_wins integer,
  team_b_reputation_delta integer,
  draws integer,
  shared_races integer,
  intensity integer,
  winner_team_id uuid,
  pairing_reason text,
  team_a_pairing_rank integer,
  team_b_pairing_rank integer,
  events jsonb,
  settled_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with own_team as (
    select assignment.team_id
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    where director.auth_user_id = auth.uid()
    limit 1
  )
  select rivalry.id, rivalry.season_id, season.name, season.game_year,
    rivalry.status, own_team.team_id,
    rivalry.team_a_id, rivalry.team_a_name, rivalry.team_a_director_name,
    rivalry.team_a_wins, rivalry.team_a_reputation_delta,
    rivalry.team_b_id, rivalry.team_b_name, rivalry.team_b_director_name,
    rivalry.team_b_wins, rivalry.team_b_reputation_delta,
    rivalry.draws, rivalry.shared_races, rivalry.intensity,
    rivalry.winner_team_id, rivalry.pairing_reason,
    rivalry.team_a_pairing_rank, rivalry.team_b_pairing_rank,
    coalesce(event_log.events, '[]'::jsonb), rivalry.settled_at
  from own_team
  join public.team_rivalries as rivalry
    on own_team.team_id in (rivalry.team_a_id, rivalry.team_b_id)
  join public.seasons as season on season.id = rivalry.season_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'raceEditionId', event.race_edition_id,
        'raceName', edition.display_name,
        'raceSlug', race.slug,
        'teamARank', event.team_a_rank,
        'teamBRank', event.team_b_rank,
        'teamAPoints', event.team_a_points,
        'teamBPoints', event.team_b_points,
        'isDraw', event.is_draw,
        'winnerTeamId', event.winner_team_id,
        'intensityDelta', event.intensity_delta,
        'teamAScoreAfter', event.team_a_score_after,
        'teamBScoreAfter', event.team_b_score_after,
        'drawsAfter', event.draws_after,
        'intensityAfter', event.intensity_after,
        'decidedAt', event.decided_at
      ) order by event.decided_at desc, event.id desc
    ) as events
    from public.team_rivalry_events as event
    join public.race_editions as edition on edition.id = event.race_edition_id
    join public.races as race on race.id = edition.race_id
    where event.rivalry_id = rivalry.id
  ) as event_log on true
  order by season.game_year desc, rivalry.created_at desc;
$$;

revoke all on function public.get_current_team_rivalry_dossiers()
  from public, anon;
grant execute on function public.get_current_team_rivalry_dossiers()
  to authenticated;

commit;
