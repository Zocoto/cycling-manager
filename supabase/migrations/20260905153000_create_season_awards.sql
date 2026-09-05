begin;

create table public.season_awards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  award_key text not null,
  title text not null,
  description text not null,
  recipient_type text not null,
  rider_id uuid references public.riders(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  sporting_director_id uuid references public.sporting_directors(id) on delete set null,
  recipient_name text not null,
  team_name text,
  stat_value integer,
  stat_label text,
  awarded_at timestamptz not null default now(),
  constraint season_awards_key_allowed check (
    award_key in ('rider_of_year', 'team_of_year', 'serial_winner', 'young_rider', 'director_of_year')
  ),
  constraint season_awards_recipient_type_allowed check (
    recipient_type in ('rider', 'team', 'director')
  ),
  constraint season_awards_recipient_name_not_empty check (btrim(recipient_name) <> ''),
  constraint season_awards_recipient_matches_type check (
    (recipient_type = 'rider' and rider_id is not null)
    or (recipient_type = 'team' and team_id is not null)
    or (recipient_type = 'director' and sporting_director_id is not null)
  ),
  unique (season_id, award_key)
);

create index season_awards_season_idx on public.season_awards (season_id, award_key);
create index season_awards_rider_idx on public.season_awards (rider_id, awarded_at desc);
create index season_awards_team_idx on public.season_awards (team_id, awarded_at desc);

alter table public.season_awards enable row level security;
create policy season_awards_select_authenticated
  on public.season_awards for select to authenticated using (true);
grant select on public.season_awards to authenticated;
grant all privileges on public.season_awards to service_role;

create or replace function private.create_season_awards_for_season(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season record;
  v_created integer := 0;
  v_rows integer := 0;
begin
  select id, name, game_year, status into v_season
  from public.seasons where id = p_season_id;
  if not found or v_season.status <> 'completed' then
    return 0;
  end if;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    rider_id, team_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'rider_of_year', 'Coureur de l’année',
    'La référence du peloton au classement individuel de la saison.', 'rider',
    summary.rider_id, rider_team.team_id,
    btrim(rider.first_name || ' ' || rider.last_name), rider_team.team_name,
    coalesce(summary.points, 0), 'points UCI'
  from public.rider_season_summaries as summary
  join public.riders as rider on rider.id = summary.rider_id
  left join lateral (
    select team_season.team_id, team_season.display_name as team_name
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    where roster.rider_id = summary.rider_id
      and result.status = 'classified'
      and team_season.season_id = p_season_id
    group by team_season.team_id, team_season.display_name
    order by count(*) desc, team_season.display_name
    limit 1
  ) as rider_team on true
  where summary.season_id = p_season_id
  order by coalesce(summary.points, 0) desc, summary.uci_rank nulls last,
    rider.last_name, rider.first_name, rider.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'team_of_year', 'Équipe de l’année',
    'Le collectif qui termine la saison au sommet du classement UCI.', 'team',
    team_season.team_id, team_season.display_name, team_season.display_name,
    team_season.points, 'points UCI'
  from public.team_seasons as team_season
  where team_season.season_id = p_season_id
    and team_season.status <> 'withdrawn'
  order by team_season.final_rank nulls last, team_season.points desc,
    team_season.display_name, team_season.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    rider_id, team_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'serial_winner', 'Chasseur de bouquets',
    'Le coureur qui a levé les bras le plus souvent cette saison.', 'rider',
    summary.rider_id, rider_team.team_id,
    btrim(rider.first_name || ' ' || rider.last_name), rider_team.team_name,
    coalesce(summary.victories, 0), 'victoires'
  from public.rider_season_summaries as summary
  join public.riders as rider on rider.id = summary.rider_id
  left join lateral (
    select team_season.team_id, team_season.display_name as team_name
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    where roster.rider_id = summary.rider_id
      and team_season.season_id = p_season_id
    group by team_season.team_id, team_season.display_name
    order by count(*) desc, team_season.display_name
    limit 1
  ) as rider_team on true
  where summary.season_id = p_season_id and coalesce(summary.victories, 0) > 0
  order by coalesce(summary.victories, 0) desc, coalesce(summary.points, 0) desc,
    rider.last_name, rider.first_name, rider.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    rider_id, team_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'young_rider', 'Révélation de l’année',
    'Le meilleur coureur de 23 ans ou moins au classement individuel.', 'rider',
    summary.rider_id, rider_team.team_id,
    btrim(rider.first_name || ' ' || rider.last_name), rider_team.team_name,
    coalesce(summary.points, 0), 'points UCI'
  from public.rider_season_summaries as summary
  join public.rider_season_ratings as rating
    on rating.rider_id = summary.rider_id and rating.season_id = summary.season_id
  join public.riders as rider on rider.id = summary.rider_id
  left join lateral (
    select team_season.team_id, team_season.display_name as team_name
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    where roster.rider_id = summary.rider_id
      and team_season.season_id = p_season_id
    group by team_season.team_id, team_season.display_name
    order by count(*) desc, team_season.display_name
    limit 1
  ) as rider_team on true
  where summary.season_id = p_season_id and rating.age <= 23
  order by coalesce(summary.points, 0) desc, summary.uci_rank nulls last,
    rider.last_name, rider.first_name, rider.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'director_of_year', 'Directeur Sportif de l’année',
    'Le DS du collectif numéro un au terme de la saison.', 'director',
    team_season.team_id, assignment.sporting_director_id,
    director.display_name, team_season.display_name,
    team_season.points, 'points équipe'
  from public.team_seasons as team_season
  join public.seasons as award_season on award_season.id = team_season.season_id
  join public.team_manager_assignments as assignment on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
  join public.seasons as start_season on start_season.id = assignment.start_season_id
  left join public.seasons as end_season on end_season.id = assignment.end_season_id
  join public.sporting_directors as director on director.id = assignment.sporting_director_id
  where team_season.season_id = p_season_id
    and team_season.status <> 'withdrawn'
    and award_season.game_year >= start_season.game_year
    and (end_season.game_year is null or award_season.game_year <= end_season.game_year)
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = assignment.sporting_director_id
    )
  order by team_season.final_rank nulls last, team_season.points desc,
    team_season.display_name, assignment.created_at desc
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  return v_created;
end;
$$;

revoke all on function private.create_season_awards_for_season(uuid)
  from public, anon, authenticated;
grant execute on function private.create_season_awards_for_season(uuid) to service_role;

create or replace function private.create_season_awards_after_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.create_season_awards_for_season(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.create_season_awards_after_completion()
  from public, anon, authenticated;
create trigger create_season_awards_after_completion
after update of status on public.seasons
for each row execute function private.create_season_awards_after_completion();

select private.create_season_awards_for_season(season.id)
from public.seasons as season
where season.status = 'completed';

commit;
