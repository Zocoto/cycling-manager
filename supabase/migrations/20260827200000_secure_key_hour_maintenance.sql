-- Keep recurring maintenance cheap when there is no junior race to settle.
-- The former wrapper rebuilt the full calendar, refreshed world selections twice,
-- then called a legacy function which rebuilt the calendar a second time.

create index if not exists development_race_editions_due_idx
  on public.development_race_editions (season_id, end_day_number, id)
  where status = 'planned';

create or replace function public.settle_due_development_races()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season_id uuid;
  v_game_year integer;
  v_current_day_number integer;
  v_edition record;
  v_settled integer := 0;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('settle-due-development-races', 0)
  ) then
    return 0;
  end if;

  select id, game_year, coalesce(current_day_number, 1)
  into v_season_id, v_game_year, v_current_day_number
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season_id is null then return 0; end if;

  -- Provision only once for a newly-created season. Normal no-op runs never
  -- touch the calendar, virtual pool, selections or rankings.
  if not exists (
    select 1
    from public.development_race_editions
    where season_id = v_season_id
  ) then
    perform public.ensure_development_race_calendar(v_season_id);
  end if;

  for v_edition in
    select edition.id
    from public.development_race_editions as edition
    where edition.season_id = v_season_id
      and edition.status = 'planned'
      and edition.end_day_number <= v_current_day_number
    order by edition.end_day_number, edition.id
    limit 2
  loop
    perform public.simulate_development_race(v_edition.id);
    v_settled := v_settled + 1;
  end loop;

  -- Rankings are refreshed by the completion trigger. Rebuild future world
  -- selections once, and only after a race really changed those rankings.
  if v_settled > 0 and v_game_year >= 3 then
    perform public.prepare_development_world_selections(v_season_id);
  end if;

  return v_settled;
end;
$$;

revoke all on function public.settle_due_development_races()
  from public, anon, authenticated;
grant execute on function public.settle_due_development_races()
  to service_role;
