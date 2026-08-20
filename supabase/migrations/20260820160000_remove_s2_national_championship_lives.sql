begin;

-- À partir de la saison 2, les championnats nationaux ne publient plus de
-- direct/replay. Les classements déjà consolidés dans stage_results et
-- race_results sont conservés ; seuls les artefacts propres au live partent.
delete from public.stage_attack_participants as participant
using
  public.stages as stage,
  public.race_editions as edition,
  public.races as race,
  public.seasons as season
where participant.stage_id = stage.id
  and stage.race_edition_id = edition.id
  and edition.race_id = race.id
  and edition.season_id = season.id
  and season.game_year >= 2
  and race.competition_type in ('national_road', 'national_time_trial');

delete from public.official_stage_simulation_claims as claim
using
  public.stages as stage,
  public.race_editions as edition,
  public.races as race,
  public.seasons as season
where claim.stage_id = stage.id
  and stage.race_edition_id = edition.id
  and edition.race_id = race.id
  and edition.season_id = season.id
  and season.game_year >= 2
  and race.competition_type in ('national_road', 'national_time_trial');

delete from public.official_stage_simulations as simulation
using
  public.stages as stage,
  public.race_editions as edition,
  public.races as race,
  public.seasons as season
where simulation.stage_id = stage.id
  and stage.race_edition_id = edition.id
  and edition.race_id = race.id
  and edition.season_id = season.id
  and season.game_year >= 2
  and race.competition_type in ('national_road', 'national_time_trial');

comment on table public.official_stage_simulations is
  'Scénario officiel immuable des courses avec direct/replay. Les championnats nationaux de saison 2 et suivantes n’en créent pas.';

commit;
