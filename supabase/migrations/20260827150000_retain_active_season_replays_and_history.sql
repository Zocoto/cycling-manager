begin;

-- Les résultats officiels restent archivés dans race_results/stage_results.
-- Seuls les scénarios graphiques lourds sont limités à la saison active.
create or replace function public.purge_inactive_season_official_replays()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  delete from public.official_stage_simulations as simulation
  using public.race_editions as edition
  where edition.id = simulation.race_edition_id
    and edition.season_id <> new.id;

  delete from public.official_stage_simulation_claims as claim
  using public.race_editions as edition
  where edition.id = claim.race_edition_id
    and edition.season_id <> new.id;

  return new;
end;
$$;

drop trigger if exists seasons_purge_inactive_official_replays
on public.seasons;

create trigger seasons_purge_inactive_official_replays
after insert or update of status on public.seasons
for each row
when (new.status = 'active')
execute function public.purge_inactive_season_official_replays();

-- Nettoyage immédiat et idempotent des saisons déjà archivées.
delete from public.official_stage_simulations as simulation
using public.race_editions as edition
where edition.id = simulation.race_edition_id
  and not exists (
    select 1
    from public.seasons as season
    where season.id = edition.season_id
      and season.status = 'active'
  );

delete from public.official_stage_simulation_claims as claim
using public.race_editions as edition
where edition.id = claim.race_edition_id
  and not exists (
    select 1
    from public.seasons as season
    where season.id = edition.season_id
      and season.status = 'active'
  );

create or replace function public.get_race_historical_classification(
  p_race_id uuid,
  p_game_year integer
)
returns table (
  race_name text,
  season_name text,
  game_year integer,
  race_format text,
  final_rank integer,
  status text,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_name text,
  total_time_ms bigint,
  gap_to_winner_ms bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    race.name,
    season.name,
    season.game_year,
    race.race_format,
    result.final_rank::integer,
    result.status,
    rider.id,
    rider.first_name,
    rider.last_name,
    coalesce(
      team_season.display_name,
      registration.historical_team_name,
      'Équipe historique'
    ),
    result.total_time_ms,
    result.gap_to_winner_ms
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  join public.seasons as season
    on season.id = edition.season_id
  join public.race_results as result
    on result.race_edition_id = edition.id
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
  left join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  where edition.race_id = p_race_id
    and season.game_year = p_game_year
    and edition.status = 'completed'
  order by
    case when result.final_rank is null then 1 else 0 end,
    result.final_rank,
    rider.last_name,
    rider.first_name;
$$;

revoke all
on function public.purge_inactive_season_official_replays()
from public, anon, authenticated;

revoke all
on function public.get_race_historical_classification(uuid, integer)
from public, anon;

grant execute
on function public.get_race_historical_classification(uuid, integer)
to authenticated;

comment on function public.purge_inactive_season_official_replays() is
  'Conserve les scénarios graphiques uniquement pour la saison active, sans supprimer les résultats officiels historiques.';

comment on function public.get_race_historical_classification(uuid, integer) is
  'Retourne le classement final textuel et léger d’une édition passée.';

notify pgrst, 'reload schema';

commit;
