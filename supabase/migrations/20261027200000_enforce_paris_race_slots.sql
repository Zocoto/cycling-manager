begin;
set local application_name = 'cyclostratege-paris-race-slots-20261027';
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- Validate the final schedule rather than correcting it silently. Existing
-- generators and BEFORE triggers keep computing Paris-local 14:00 / 18:00.
-- Completed/in-progress history, race results and simulations are untouched.
create or replace function private.assert_paris_race_stage_departure(
  p_stage_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_stage record;
begin
  select stage.id, stage.departure_at, stage.day_slot,
    day.season_id as day_season_id, edition.season_id as edition_season_id,
    (
      day.calendar_date::timestamp
      + case stage.day_slot
          when 'early' then time '14:00'
          when 'late' then time '18:00'
        end
    ) at time zone 'Europe/Paris' as expected_departure_at
  into v_stage
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.seasons as season on season.id = edition.season_id
  join public.season_days as day on day.id = stage.season_day_id
  where stage.id = p_stage_id and stage.status = 'planned'
    and season.game_year >= 4 and season.status in ('active', 'planned')
    and edition.status not in ('completed', 'cancelled');
  if not found then return; end if;

  if v_stage.day_season_id is distinct from v_stage.edition_season_id
    or v_stage.expected_departure_at is null
    or v_stage.departure_at is distinct from v_stage.expected_departure_at
  then
    raise exception using errcode = '23514',
      constraint = 'race_stage_paris_slot',
      message = 'Le départ doit être programmé à 14 h ou 18 h, heure de Paris, à la date de la course.',
      detail = format('stage_id=%s; day_slot=%s; departure_at=%s; expected_departure_at=%s',
        v_stage.id, v_stage.day_slot, v_stage.departure_at, v_stage.expected_departure_at);
  end if;
end;
$$;

create or replace function private.enforce_paris_race_stage_schedule()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
begin
  -- Re-read the final row: an earlier queued NEW value can be transitional.
  perform private.assert_paris_race_stage_departure(new.id);
  return null;
end;
$$;

create or replace function private.enforce_paris_race_day_schedule()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare v_stage_id uuid;
begin
  for v_stage_id in
    select stage.id from public.stages as stage
    where stage.season_day_id = new.id and stage.status = 'planned'
    order by stage.id
  loop
    perform private.assert_paris_race_stage_departure(v_stage_id);
  end loop;
  return null;
end;
$$;

create or replace function private.enforce_paris_race_edition_schedule()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare v_stage_id uuid;
begin
  for v_stage_id in
    select stage.id from public.stages as stage
    where stage.race_edition_id = new.id and stage.status = 'planned'
    order by stage.id
  loop
    perform private.assert_paris_race_stage_departure(v_stage_id);
  end loop;
  return null;
end;
$$;

create or replace function private.enforce_paris_race_season_schedule()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare v_stage_id uuid;
begin
  for v_stage_id in
    select stage.id from public.race_editions as edition
    join public.stages as stage on stage.race_edition_id = edition.id
    where edition.season_id = new.id and stage.status = 'planned'
    order by stage.id
  loop
    perform private.assert_paris_race_stage_departure(v_stage_id);
  end loop;
  return null;
end;
$$;

revoke all on function private.assert_paris_race_stage_departure(uuid) from public, anon, authenticated;
revoke all on function private.enforce_paris_race_stage_schedule() from public, anon, authenticated;
revoke all on function private.enforce_paris_race_day_schedule() from public, anon, authenticated;
revoke all on function private.enforce_paris_race_edition_schedule() from public, anon, authenticated;
revoke all on function private.enforce_paris_race_season_schedule() from public, anon, authenticated;

drop trigger if exists enforce_paris_race_stage_schedule on public.stages;
create constraint trigger enforce_paris_race_stage_schedule
after insert or update of race_edition_id, season_day_id, day_slot, departure_at, status on public.stages
deferrable initially deferred for each row
execute function private.enforce_paris_race_stage_schedule();

drop trigger if exists enforce_paris_race_day_schedule on public.season_days;
create constraint trigger enforce_paris_race_day_schedule
after update of calendar_date, season_id on public.season_days
deferrable initially deferred for each row
when (old.calendar_date is distinct from new.calendar_date or old.season_id is distinct from new.season_id)
execute function private.enforce_paris_race_day_schedule();

drop trigger if exists enforce_paris_race_edition_schedule on public.race_editions;
create constraint trigger enforce_paris_race_edition_schedule
after update of status, season_id on public.race_editions
deferrable initially deferred for each row
when (old.status is distinct from new.status or old.season_id is distinct from new.season_id)
execute function private.enforce_paris_race_edition_schedule();

drop trigger if exists enforce_paris_race_season_schedule on public.seasons;
create constraint trigger enforce_paris_race_season_schedule
after update of status, game_year on public.seasons
deferrable initially deferred for each row
when (old.status is distinct from new.status or old.game_year is distinct from new.game_year)
execute function private.enforce_paris_race_season_schedule();

comment on function private.assert_paris_race_stage_departure(uuid) is
  'Checks the final planned-stage departure against its Paris calendar date and 14:00/18:00 slot; no schedule or historical data is modified.';

-- No repair/backfill is needed: the live S4/S5 planned-stage audit was clean.
-- Validate after acquiring all trigger-installation DDL locks, so another
-- calendar write cannot commit between this scan and protection installation.
-- Fail atomically instead of rewriting dates, history or any simulated race.
do $validate_existing$
declare v_stage_id uuid;
begin
  for v_stage_id in
    select stage.id from public.stages as stage
    join public.race_editions as edition on edition.id = stage.race_edition_id
    join public.seasons as season on season.id = edition.season_id
    where stage.status = 'planned' and season.game_year >= 4
      and season.status in ('active', 'planned')
      and edition.status not in ('completed', 'cancelled')
    order by stage.id
  loop
    perform private.assert_paris_race_stage_departure(v_stage_id);
  end loop;
end;
$validate_existing$;

commit;
