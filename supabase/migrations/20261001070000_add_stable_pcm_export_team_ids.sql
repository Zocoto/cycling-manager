-- Les identifiants PCM des equipes doivent survivre aux changements de sponsor,
-- de nom commercial, de division et de saison. L'equipe spectateur utilise 243 ;
-- les equipes du jeu commencent donc a 244.

alter table public.teams
  add column if not exists pcm_export_id integer;

with active_season as (
  select id
  from public.seasons
  where status = 'active'
  order by game_year desc
  limit 1
),
current_export as (
  select
    team_seasons.team_id,
    row_number() over (
      order by team_seasons.display_name, team_seasons.team_id
    ) as export_position
  from public.team_seasons
  join active_season
    on active_season.id = team_seasons.season_id
  where team_seasons.status = 'active'
)
update public.teams
set pcm_export_id = (243 + current_export.export_position)::integer
from current_export
where teams.id = current_export.team_id
  and teams.pcm_export_id is null;

with current_max as (
  select coalesce(max(pcm_export_id), 243) as value
  from public.teams
),
remaining_teams as (
  select
    teams.id,
    row_number() over (order by teams.created_at, teams.id) as export_position
  from public.teams
  where teams.pcm_export_id is null
)
update public.teams
set pcm_export_id = (current_max.value + remaining_teams.export_position)::integer
from current_max, remaining_teams
where teams.id = remaining_teams.id;

create sequence if not exists public.pcm_export_team_id_seq;

select setval(
  'public.pcm_export_team_id_seq',
  (select coalesce(max(pcm_export_id), 243) + 1 from public.teams),
  false
);

alter sequence public.pcm_export_team_id_seq
  owned by public.teams.pcm_export_id;

alter table public.teams
  alter column pcm_export_id
  set default nextval('public.pcm_export_team_id_seq');

alter table public.teams
  alter column pcm_export_id set not null;

alter table public.teams
  drop constraint if exists teams_pcm_export_id_range;

alter table public.teams
  add constraint teams_pcm_export_id_range
  check (pcm_export_id >= 244);

create unique index if not exists teams_pcm_export_id_key
  on public.teams (pcm_export_id);

comment on column public.teams.pcm_export_id is
  'Identifiant entier permanent de l equipe dans les exports Pro Cycling Manager.';
