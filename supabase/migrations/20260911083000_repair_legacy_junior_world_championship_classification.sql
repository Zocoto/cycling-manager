begin;

-- Some S3 editions were prepared before competition_type existed. The later
-- calendar seed used ON CONFLICT DO NOTHING, leaving the two world events open
-- to DevTeams and invisible to the federation calendar and selection jobs.
-- Keep their identities, dates, courses, financial settings and registrations.
create or replace function public.repair_legacy_junior_world_championships(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_repaired integer := 0;
begin
  update public.development_race_editions as edition
  set
    competition_type = case edition.slug
      when 'mondial-junior-clm' then 'world_time_trial'
      when 'mondial-junior-route' then 'world_road'
    end,
    selection_mode = 'automatic',
    points_scale = 'world',
    updated_at = now()
  from public.seasons as season
  where edition.season_id = p_season_id
    and season.id = edition.season_id
    and season.game_year >= 3
    and season.status in ('active', 'planned')
    and edition.status = 'planned'
    and edition.is_world_championship = true
    and edition.competition_type = 'open'
    and edition.slug in ('mondial-junior-clm', 'mondial-junior-route')
    and not exists (
      select 1
      from public.development_race_results as result
      where result.race_edition_id = edition.id
    );
  get diagnostics v_repaired = row_count;
  return v_repaired;
end;
$$;

revoke all
on function public.repair_legacy_junior_world_championships(uuid)
from public, anon, authenticated;
grant execute
on function public.repair_legacy_junior_world_championships(uuid)
to service_role;

-- The federation calendar is also ensured immediately before synchronizing
-- presidential choices and preparing automatic lineups. Repair there so a
-- legacy pre-generated season cannot silently keep the old classification.
do $migration$
declare
  v_definition text;
  v_anchor constant text := '  if coalesce(v_game_year, 0) < 3 then return 0; end if;';
  v_call constant text := '  v_inserted := public.repair_legacy_junior_world_championships(p_season_id);';
begin
  select pg_catalog.pg_get_functiondef(
    'public.ensure_federation_junior_championship_calendar(uuid)'::regprocedure
  ) into v_definition;

  if position(v_call in v_definition) = 0 then
    if position(v_anchor in v_definition) = 0
      or (length(v_definition) - length(replace(v_definition, v_anchor, '')))
        <> length(v_anchor) then
      raise exception 'Unexpected federation junior calendar definition; repair hook not applied.';
    end if;
    execute replace(v_definition, v_anchor, v_anchor || E'\n\n' || v_call);
  end if;
end;
$migration$;

-- Only correct affected upcoming editions; do not rerun the complete calendar
-- seed, which may touch unrelated international events or completed seasons.
select public.repair_legacy_junior_world_championships(season.id)
from public.seasons as season
where season.game_year >= 3
  and season.status in ('active', 'planned');

notify pgrst, 'reload schema';

commit;
