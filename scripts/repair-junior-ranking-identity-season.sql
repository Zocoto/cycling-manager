-- Reviewed projection repair, one season per transaction. Run only after
-- 20261122120000_unify_junior_ranking_identity.sql, once for each affected
-- season (S3, S4, S5), before 20261122121000_guard_junior_ranking_identity.sql.
-- psql invocation: psql "$DATABASE_URL" --set=ON_ERROR_STOP=1
--   --set=season_id=<reviewed-season-uuid> --file=<this-file>
-- No source result, reward, championship title or finalized award is changed.
begin;
set local lock_timeout = '1s';
set local statement_timeout = '30s';
select set_config('app.junior_ranking_repair_season', :'season_id', true);

do $$
declare
  v_season_id uuid := current_setting('app.junior_ranking_repair_season')::uuid;
  v_game_year integer;
  v_status text;
  v_source_points bigint;
  v_ranking_points bigint;
  v_source_people integer;
  v_ranking_people integer;
begin
  select game_year, status into v_game_year, v_status
  from public.seasons where id = v_season_id;
  if coalesce(v_game_year, 0) < 3 or v_status not in ('active', 'completed') then
    raise exception 'Only a reviewed active or completed junior season may be repaired.';
  end if;

  -- Share the refresher's lock before measuring the source, so a competing
  -- refresh cannot interleave the pre/post projection checks.
  perform pg_advisory_xact_lock(
    hashtextextended('development-rankings:' || v_season_id::text, 0)
  );
  select coalesce(sum(result.points), 0),
    count(distinct coalesce('youth:' || result.academy_rider_id::text, result.competitor_key))::integer
  into v_source_points, v_source_people
  from public.development_race_results as result
  join public.development_race_editions as edition on edition.id = result.race_edition_id
  where edition.season_id = v_season_id and edition.status = 'completed';

  perform public.refresh_development_rankings(v_season_id);

  select coalesce(sum(points), 0), count(*)::integer
  into v_ranking_points, v_ranking_people
  from public.development_ranking_entries
  where season_id = v_season_id and entity_type = 'individual';
  if v_source_points <> v_ranking_points or v_source_people <> v_ranking_people then
    raise exception 'Junior ranking repair failed conservation checks for season %.', v_season_id;
  end if;
  if exists (
    select 1 from public.development_ranking_entries
    where season_id = v_season_id and entity_type = 'individual' and academy_rider_id is not null
    group by academy_rider_id having count(*) > 1
  ) then
    raise exception 'Junior ranking repair left a split academy identity in season %.', v_season_id;
  end if;
  if (select coalesce(sum(points), 0) from public.development_ranking_entries
      where season_id = v_season_id and entity_type = 'team') <> v_source_points then
    raise exception 'Junior ranking repair failed team-points conservation for season %.', v_season_id;
  end if;
  raise notice 'Repaired junior season %, % people, % points.', v_game_year, v_ranking_people, v_ranking_points;
end;
$$;
commit;
