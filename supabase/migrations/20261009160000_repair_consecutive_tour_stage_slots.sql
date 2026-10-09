-- Two stages per Paris calendar day, including across the October DST change.
-- Repair untouched tours only; keep stage IDs, entries, tactics and results.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select replace(pg_catalog.pg_get_functiondef(
    'private.ensure_local_race_calendar_for_country(uuid,uuid)'::regprocedure
  ), E'\r\n', E'\n') into v_definition;
  v_old := 'and day_number = v_start_day + v_stage_number - 1;';
  v_new := 'and day_number = v_start_day + ((v_stage_number - 1) / 2);';
  if position(v_old in v_definition) > 0 then
    v_definition := replace(v_definition, v_old, v_new);
  elsif position(v_new in v_definition) = 0 then
    raise exception 'Unexpected local tour day formula; migration aborted.';
  end if;
  v_old := E'      v_preferred_day,\n      v_duration,\n      v_edition_id';
  v_new := E'      v_preferred_day,\n      (v_duration + 1) / 2,\n      v_edition_id';
  if position(v_old in v_definition) > 0 then
    v_definition := replace(v_definition, v_old, v_new);
  elsif position(v_new in v_definition) = 0 then
    raise exception 'Unexpected local tour duration formula; migration aborted.';
  end if;
  execute v_definition;

  -- Adding UTC days to a timestamptz can shift the Paris departure by one hour.
  select replace(pg_catalog.pg_get_functiondef(
    'private.normalize_standard_race_country_spacing(uuid)'::regprocedure
  ), E'\r\n', E'\n') into v_definition;
  v_old := 'departure_at = stage.departure_at + make_interval(days => v_offset)';
  v_new := $replacement$departure_at = (
          target_day.calendar_date::timestamp + case stage.day_slot
            when 'early' then time '14:00' else time '18:00' end
        ) at time zone 'Europe/Paris'$replacement$;
  v_new := replace(v_new, E'\r\n', E'\n');
  if position(v_old in v_definition) > 0 then
    v_definition := replace(v_definition, v_old, v_new);
  elsif position(v_new in v_definition) = 0 then
    raise exception 'Unexpected spacing departure formula; migration aborted.';
  end if;
  v_old := 'registration_closes_at = registration_closes_at + make_interval(days => v_offset)';
  v_new := $replacement$registration_closes_at = (
      (registration_closes_at at time zone 'Europe/Paris') + make_interval(days => v_offset)
    ) at time zone 'Europe/Paris'$replacement$;
  v_new := replace(v_new, E'\r\n', E'\n');
  if position(v_old in v_definition) > 0 then
    v_definition := replace(v_definition, v_old, v_new);
  elsif position(v_new in v_definition) = 0 then
    raise exception 'Unexpected spacing registration deadline; migration aborted.';
  end if;
  v_old := 'withdrawal_closes_at = withdrawal_closes_at + make_interval(days => v_offset)';
  v_new := $replacement$withdrawal_closes_at = (
      (withdrawal_closes_at at time zone 'Europe/Paris') + make_interval(days => v_offset)
    ) at time zone 'Europe/Paris'$replacement$;
  v_new := replace(v_new, E'\r\n', E'\n');
  if position(v_old in v_definition) > 0 then
    v_definition := replace(v_definition, v_old, v_new);
  elsif position(v_new in v_definition) = 0 then
    raise exception 'Unexpected spacing withdrawal deadline; migration aborted.';
  end if;
  execute v_definition;
end;
$migration$;

-- The existing compactor guards in-progress/completed tours and any results.
-- Its Paris-local formula also repairs the DST-shifted departure times.
do $repair$
declare
  v_season record;
begin
  for v_season in
    select id from public.seasons
    where status in ('active', 'planned') and game_year >= 4
    order by game_year
  loop
    perform public.compact_planned_stage_races(v_season.id);
  end loop;
end;
$repair$;

commit;
