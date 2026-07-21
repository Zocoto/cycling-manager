begin;

-- Lectures minimales du calendrier nécessaires au consolidateur autonome.
grant select
on table
  public.seasons,
  public.season_days,
  public.season_events,
  public.races,
  public.race_categories,
  public.race_editions,
  public.stages,
  public.stage_segments,
  public.stage_segment_primes,
  public.countries,
  public.race_registrations,
  public.race_rosters,
  public.team_seasons
to service_role;

commit;
