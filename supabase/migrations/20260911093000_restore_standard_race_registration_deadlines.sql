begin;

-- The compact-calendar provisioner recalculated deadlines only for tours.
-- Copied one-day races could therefore keep NULL deadlines, which the roster
-- RPC interpreted as an expired deadline. Fill only missing values, using the
-- existing Paris startlist freeze (08:00 / 12:00), not the obsolete H-8 rule.
create or replace function public.repair_missing_standard_race_deadlines(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_repaired integer;
begin
  with first_stages as (
    select distinct on (edition.id)
      edition.id as race_edition_id,
      category.code as category_code,
      stage.departure_at,
      (
        day.calendar_date::timestamp
        + case stage.day_slot
            when 'early' then time '08:00'
            else time '12:00'
          end
      ) at time zone 'Europe/Paris' as closes_at
    from public.race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    join public.races as race on race.id = edition.race_id
    join public.race_categories as category on category.id = edition.race_category_id
    join public.stages as stage on stage.race_edition_id = edition.id
    join public.season_days as day on day.id = stage.season_day_id
    where edition.season_id = p_season_id
      and season.status in ('active', 'planned')
      and edition.status not in ('completed', 'cancelled', 'in_progress')
      and race.competition_type = 'standard'
      and stage.status <> 'cancelled'
    order by edition.id, stage.stage_number
  )
  update public.race_editions as edition
  set
    registration_closes_at = coalesce(edition.registration_closes_at, first_stage.closes_at),
    withdrawal_closes_at = coalesce(edition.withdrawal_closes_at, first_stage.closes_at),
    wildcard_closes_at = case
      when first_stage.category_code = 'elite' then
        coalesce(edition.wildcard_closes_at, first_stage.departure_at - interval '24 hours')
      else edition.wildcard_closes_at
    end
  from first_stages as first_stage
  where edition.id = first_stage.race_edition_id
    and first_stage.departure_at is not null
    and (
      edition.registration_closes_at is null
      or edition.withdrawal_closes_at is null
      or (first_stage.category_code = 'elite' and edition.wildcard_closes_at is null)
    );
  get diagnostics v_repaired = row_count;
  return v_repaired;
end;
$$;

revoke all on function public.repair_missing_standard_race_deadlines(uuid)
from public, anon, authenticated;
grant execute on function public.repair_missing_standard_race_deadlines(uuid)
to service_role;

-- Run after all copied stages and the tour compaction exist. Patch the live
-- definition, preserving every intervening calendar fix; fail on drift.
do $migration$
declare
  v_definition text;
  v_anchor constant text := '  perform public.compact_planned_stage_races(p_target_season_id);';
  v_call constant text := '  perform public.repair_missing_standard_race_deadlines(p_target_season_id);';
begin
  select pg_catalog.pg_get_functiondef(
    'public.provision_season_race_calendar(uuid,uuid)'::regprocedure
  ) into v_definition;
  if position(v_call in v_definition) = 0 then
    if (length(v_definition) - length(replace(v_definition, v_anchor, '')))
      <> length(v_anchor) then
      raise exception 'Unexpected calendar provisioner; deadline repair not installed.';
    end if;
    execute replace(v_definition, v_anchor, v_anchor || E'\n' || v_call);
  end if;
end;
$migration$;

-- An absent configuration is not an expired date. Keep both checks closed
-- safely, but do not tell players a misleading eight-hour rule any longer.
do $migration$
declare
  v_definition text;
  v_old text := $old$  if v_edition.registration_closes_at is null
    or now() >= v_edition.registration_closes_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'La limite de huit heures avant le départ est dépassée.';
  end if;$old$;
  v_new constant text := $new$  if v_edition.registration_closes_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'La clôture des inscriptions n''est pas encore définie pour cette course.';
  end if;

  if now() >= v_edition.registration_closes_at then
    raise exception using
      errcode = 'P0001',
      message = 'La date limite d''inscription est dépassée.';
  end if;$new$;
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.save_current_team_race_roster(uuid,uuid[])'::regprocedure
  ), chr(13), '') into v_definition;
  v_old := replace(v_old, chr(13), '');
  if (length(v_definition) - length(replace(v_definition, v_old, '')))
    <> length(v_old) then
    raise exception 'Unexpected roster deadline guard; migration aborted.';
  end if;
  execute replace(v_definition, v_old, replace(v_new, chr(13), ''));
end;
$migration$;

-- No season rollover, calendar reseed or player registrations are replayed.
select public.repair_missing_standard_race_deadlines(season.id)
from public.seasons as season
where season.status in ('active', 'planned');

notify pgrst, 'reload schema';

commit;
