begin;

set local lock_timeout = '3s';
set local statement_timeout = '8s';
set local application_name = 'cyclostratege-preparation-postcheck-20261020';

-- A federation call-up, transfer or other calendar cancellation can cancel the
-- source camp. Its temporary bonus and reserved facility place must follow it.
-- The partial index keeps the row-trigger lookup independent of old history.
create index if not exists rider_performance_preparations_camp_active_idx
  on public.rider_performance_preparations(form_camp_id)
  where status <> 'cancelled';

create or replace function public.cancel_performance_preparation_from_camp()
returns trigger
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
set statement_timeout = '5s'
as $$
begin
  update public.rider_performance_preparations as preparation
  set status = 'cancelled'
  where preparation.form_camp_id = new.id
    and preparation.status <> 'cancelled';
  return new;
end;
$$;

drop trigger if exists cancel_performance_preparation_after_camp_cancellation
  on public.rider_form_camps;
create trigger cancel_performance_preparation_after_camp_cancellation
after update of status on public.rider_form_camps
for each row
when (new.status = 'cancelled' and old.status is distinct from new.status)
execute function public.cancel_performance_preparation_from_camp();

revoke all on function public.cancel_performance_preparation_from_camp()
  from public, anon, authenticated;

-- Repair only currently applicable/future ghost bonuses, never historical
-- dates, ratings or locked race results. Abort rather than do a broad repair.
do $repair$
declare
  v_game_day integer;
  v_preparation_ids uuid[];
begin
  select season.game_year * 28 + season.current_day_number - 1
  into v_game_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;
  if v_game_day is null then
    return;
  end if;

  select coalesce(array_agg(candidate.id), array[]::uuid[])
  into v_preparation_ids
  from (
    select preparation.id
    from public.rider_performance_preparations as preparation
    join public.rider_form_camps as camp
      on camp.id = preparation.form_camp_id
     and camp.status = 'cancelled'
    where preparation.status <> 'cancelled'
      and preparation.bonus_end_game_day >= v_game_day
    limit 201
  ) as candidate;

  if cardinality(v_preparation_ids) > 200 then
    raise exception 'Too many cancelled preparations to repair; targeted audit required.';
  end if;
  update public.rider_performance_preparations as preparation
  set status = 'cancelled'
  where preparation.id = any(v_preparation_ids)
    and preparation.status <> 'cancelled';
end;
$repair$;

-- Match the existing form-camp scheduling rules: pending WildCards already
-- reserve their selected riders, but withdrawn rosters/cancelled stages do not.
-- Patch only the reviewed booking guard; retain all capacity/auth/locking rules.
do $booking_guard$
declare
  v_signature regprocedure :=
    'public.start_current_team_rider_performance_preparation(uuid,text)'::regprocedure;
  v_definition text;
  v_old constant text := E'    join public.race_registrations as registration\n      on registration.id = roster.race_registration_id\n     and registration.status = ''accepted''\n    join public.stages as stage\n      on stage.race_edition_id = registration.race_edition_id\n    join public.season_days as day on day.id = stage.season_day_id\n    where roster.rider_id = p_rider_id\n      and day.season_id = v_context.season_id';
  v_new constant text := E'    join public.race_registrations as registration\n      on registration.id = roster.race_registration_id\n     and registration.status in (''pending'', ''accepted'')\n    join public.stages as stage\n      on stage.race_edition_id = registration.race_edition_id\n     and stage.status <> ''cancelled''\n    join public.season_days as day on day.id = stage.season_day_id\n    where roster.rider_id = p_rider_id\n      and roster.status in (''selected'', ''confirmed'')\n      and day.season_id = v_context.season_id';
  v_count integer;
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
  into v_definition;
  if position('v_occupied >= v_policy.capacity' in v_definition) = 0
    or position('-- A transfer must not allow stacking' in v_definition) = 0
  then
    raise exception 'Unexpected preparation booking version; migration aborted.';
  end if;
  if position(v_new in v_definition) > 0 then
    return;
  end if;
  v_count := (length(v_definition) - length(replace(v_definition, v_old, '')))
    / length(v_old);
  if v_count <> 1 then
    raise exception 'Unexpected preparation race guard: % occurrences.', v_count;
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$booking_guard$;

comment on function public.cancel_performance_preparation_from_camp() is
  'Annule le bonus temporaire et libère la place de la préparation lorsque son stage source est annulé, notamment lors des convocations et transferts.';

commit;
