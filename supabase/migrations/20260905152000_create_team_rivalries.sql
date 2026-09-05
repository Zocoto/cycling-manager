begin;

alter table public.reward_events
  drop constraint if exists reward_events_source_type_allowed;
alter table public.reward_events
  add constraint reward_events_source_type_allowed check (
    source_type in (
      'race_result', 'stage_result', 'mountain_prime',
      'intermediate_sprint', 'secondary_classification',
      'game_objective', 'sponsor_objective', 'division_bonus',
      'special_ability', 'staff_daily', 'mixed_zone_event',
      'gazette_game', 'pre_race_press', 'team_rivalry'
    )
  );

create table public.team_rivalries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_a_id uuid not null references public.teams(id) on delete cascade,
  team_b_id uuid not null references public.teams(id) on delete cascade,
  team_a_season_id uuid not null references public.team_seasons(id) on delete cascade,
  team_b_season_id uuid not null references public.team_seasons(id) on delete cascade,
  team_a_director_id uuid not null references public.sporting_directors(id) on delete restrict,
  team_b_director_id uuid not null references public.sporting_directors(id) on delete restrict,
  team_a_name text not null,
  team_b_name text not null,
  team_a_director_name text not null,
  team_b_director_name text not null,
  status text not null default 'active',
  shared_races integer not null default 0,
  team_a_wins integer not null default 0,
  team_b_wins integer not null default 0,
  draws integer not null default 0,
  intensity integer not null default 0,
  last_race_edition_id uuid references public.race_editions(id) on delete set null,
  winner_team_id uuid references public.teams(id) on delete set null,
  team_a_reputation_delta integer,
  team_b_reputation_delta integer,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint team_rivalries_distinct_teams check (team_a_id <> team_b_id),
  constraint team_rivalries_status_allowed check (status in ('active', 'completed', 'cancelled')),
  constraint team_rivalries_scores_non_negative check (
    shared_races >= 0 and team_a_wins >= 0 and team_b_wins >= 0
    and draws >= 0 and intensity >= 0
  ),
  constraint team_rivalries_scores_consistent check (
    shared_races = team_a_wins + team_b_wins + draws
  ),
  constraint team_rivalries_resolution_valid check (
    (status = 'active' and settled_at is null and team_a_reputation_delta is null and team_b_reputation_delta is null)
    or (status = 'completed' and settled_at is not null and team_a_reputation_delta is not null and team_b_reputation_delta is not null)
    or status = 'cancelled'
  ),
  unique (season_id, team_a_id, team_b_id)
);

create index team_rivalries_team_a_idx on public.team_rivalries (team_a_id, created_at desc);
create index team_rivalries_team_b_idx on public.team_rivalries (team_b_id, created_at desc);
create index team_rivalries_season_status_idx on public.team_rivalries (season_id, status);

alter table public.team_rivalries enable row level security;
create policy team_rivalries_select_authenticated
  on public.team_rivalries for select to authenticated using (true);
grant select on public.team_rivalries to authenticated;
grant all privileges on public.team_rivalries to service_role;

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
      b.director_name as b_director_name
    from eligible as a
    join eligible as b on b.pairing_rank = a.pairing_rank + 1
    where mod(a.pairing_rank, 2) = 1
  )
  insert into public.team_rivalries (
    season_id, team_a_id, team_b_id, team_a_season_id, team_b_season_id,
    team_a_director_id, team_b_director_id, team_a_name, team_b_name,
    team_a_director_name, team_b_director_name
  )
  select p_season_id, paired.team_id, paired.b_team_id,
    paired.team_season_id, paired.b_team_season_id,
    paired.sporting_director_id, paired.b_director_id,
    paired.team_name, paired.b_team_name,
    paired.director_name, paired.b_director_name
  from paired
  on conflict (season_id, team_a_id, team_b_id) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function private.initialize_team_rivalries_for_season(uuid)
  from public, anon, authenticated;
grant execute on function private.initialize_team_rivalries_for_season(uuid) to service_role;

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

    update public.team_rivalries
    set shared_races = shared_races + 1,
        team_a_wins = team_a_wins + case when v_team_a_rank < v_team_b_rank then 1 else 0 end,
        team_b_wins = team_b_wins + case when v_team_b_rank < v_team_a_rank then 1 else 0 end,
        draws = draws + case when v_team_a_rank = v_team_b_rank then 1 else 0 end,
        intensity = intensity + greatest(1, 11 - least(10, abs(v_team_a_rank - v_team_b_rank))),
        last_race_edition_id = p_race_edition_id
    where id = v_rivalry.id;
    v_updated := v_updated + 1;
  end loop;
  return v_updated;
end;
$$;

revoke all on function private.update_team_rivalries_after_race(uuid)
  from public, anon, authenticated;
grant execute on function private.update_team_rivalries_after_race(uuid) to service_role;

create or replace function private.apply_team_rivalry_reputation(
  p_rivalry_id uuid,
  p_team_side text,
  p_director_id uuid,
  p_team_season_id uuid,
  p_requested_delta integer,
  p_description text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous integer;
  v_applied integer;
begin
  select reputation_points into v_previous
  from public.sporting_directors
  where id = p_director_id
  for update;

  update public.sporting_directors
  set reputation_points = least(1000, greatest(0, reputation_points + p_requested_delta))
  where id = p_director_id;

  v_applied := least(1000, greatest(0, v_previous + p_requested_delta)) - v_previous;
  insert into public.reward_events (
    source_reference, source_type, sporting_director_id, team_season_id,
    reputation_points, description
  ) values (
    'team-rivalry:' || p_rivalry_id || ':' || p_team_side,
    'team_rivalry', p_director_id, p_team_season_id, v_applied, p_description
  ) on conflict (source_reference) do nothing;
  return v_applied;
end;
$$;

revoke all on function private.apply_team_rivalry_reputation(uuid, text, uuid, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function private.apply_team_rivalry_reputation(uuid, text, uuid, uuid, integer, text)
  to service_role;

create or replace function private.settle_team_rivalries_for_season(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rivalry record;
  v_winner uuid;
  v_team_a_requested integer;
  v_team_b_requested integer;
  v_team_a_applied integer;
  v_team_b_applied integer;
  v_settled integer := 0;
begin
  for v_rivalry in
    select * from public.team_rivalries
    where season_id = p_season_id and status = 'active'
    for update
  loop
    v_winner := case
      when v_rivalry.team_a_wins > v_rivalry.team_b_wins then v_rivalry.team_a_id
      when v_rivalry.team_b_wins > v_rivalry.team_a_wins then v_rivalry.team_b_id
      else null end;
    v_team_a_requested := case when v_winner is null then 4 when v_winner = v_rivalry.team_a_id then 6 else 2 end;
    v_team_b_requested := case when v_winner is null then 4 when v_winner = v_rivalry.team_b_id then 6 else 2 end;

    v_team_a_applied := private.apply_team_rivalry_reputation(
      v_rivalry.id, 'a', v_rivalry.team_a_director_id, v_rivalry.team_a_season_id,
      v_team_a_requested, 'Bilan de rivalité contre ' || v_rivalry.team_b_name
    );
    v_team_b_applied := private.apply_team_rivalry_reputation(
      v_rivalry.id, 'b', v_rivalry.team_b_director_id, v_rivalry.team_b_season_id,
      v_team_b_requested, 'Bilan de rivalité contre ' || v_rivalry.team_a_name
    );

    update public.team_rivalries
    set status = 'completed', winner_team_id = v_winner,
        team_a_reputation_delta = v_team_a_applied,
        team_b_reputation_delta = v_team_b_applied,
        settled_at = now()
    where id = v_rivalry.id;
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;

revoke all on function private.settle_team_rivalries_for_season(uuid)
  from public, anon, authenticated;
grant execute on function private.settle_team_rivalries_for_season(uuid) to service_role;

create or replace function public.get_current_team_rivalries()
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
  team_b_id uuid,
  team_b_name text,
  team_b_director_name text,
  team_b_wins integer,
  draws integer,
  shared_races integer,
  intensity integer,
  winner_team_id uuid,
  own_reputation_delta integer,
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
    rivalry.team_a_id, rivalry.team_a_name, rivalry.team_a_director_name, rivalry.team_a_wins,
    rivalry.team_b_id, rivalry.team_b_name, rivalry.team_b_director_name, rivalry.team_b_wins,
    rivalry.draws, rivalry.shared_races, rivalry.intensity,
    rivalry.winner_team_id,
    case when own_team.team_id = rivalry.team_a_id
      then rivalry.team_a_reputation_delta else rivalry.team_b_reputation_delta end,
    rivalry.settled_at
  from own_team
  join public.team_rivalries as rivalry
    on own_team.team_id in (rivalry.team_a_id, rivalry.team_b_id)
  join public.seasons as season on season.id = rivalry.season_id
  order by season.game_year desc, rivalry.created_at desc;
$$;

revoke all on function public.get_current_team_rivalries() from public, anon;
grant execute on function public.get_current_team_rivalries() to authenticated;

create or replace function private.team_rivalries_after_race_completion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.update_team_rivalries_after_race(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.team_rivalries_after_race_completion()
  from public, anon, authenticated;
create trigger team_rivalries_after_race_completion
after update of status on public.race_editions
for each row execute function private.team_rivalries_after_race_completion();

create or replace function private.team_rivalries_after_season_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    perform private.initialize_team_rivalries_for_season(new.id);
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.settle_team_rivalries_for_season(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.team_rivalries_after_season_status()
  from public, anon, authenticated;
create trigger team_rivalries_after_season_status
after update of status on public.seasons
for each row execute function private.team_rivalries_after_season_status();

create or replace function private.initialize_rivalries_after_manager_activation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_season_id uuid;
begin
  if new.status = 'active' and new.role = 'general_manager' then
    if tg_op = 'UPDATE' then
      if old.status = 'active' then
        return new;
      end if;
    end if;
    select team_season.season_id into v_season_id
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id
    where team_season.team_id = new.team_id
      and team_season.status = 'active'
      and season.status = 'active'
    limit 1;
    if v_season_id is not null then
      perform private.initialize_team_rivalries_for_season(v_season_id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.initialize_rivalries_after_manager_activation()
  from public, anon, authenticated;
create trigger initialize_rivalries_after_manager_activation
after insert or update of status on public.team_manager_assignments
for each row execute function private.initialize_rivalries_after_manager_activation();

create or replace function private.initialize_rivalries_after_team_season_activation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'active' then
    if tg_op = 'UPDATE' then
      if old.status = 'active' then
        return new;
      end if;
    end if;
    if exists (select 1 from public.seasons where id = new.season_id and status = 'active') then
    perform private.initialize_team_rivalries_for_season(new.season_id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.initialize_rivalries_after_team_season_activation()
  from public, anon, authenticated;
create trigger initialize_rivalries_after_team_season_activation
after insert or update of status on public.team_seasons
for each row execute function private.initialize_rivalries_after_team_season_activation();

select private.initialize_team_rivalries_for_season(season.id)
from public.seasons as season
where season.status = 'active';

commit;
