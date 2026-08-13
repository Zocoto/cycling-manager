-- Training settings remain editable after the last 08:00 session of a season.
-- Day 29 is an internal pending slot: no session is ever settled on that day.
-- The atomic season rollover already copies the latest source-season settings
-- to day 1 of the following season, so these choices become active at its next
-- 08:00 session without rewriting the completed season.

alter table public.team_training_setting_versions
  drop constraint team_training_settings_day_range;

alter table public.team_training_setting_versions
  add constraint team_training_settings_day_range
  check (effective_from_day_number between 1 and 29);

alter table public.rider_training_plan_versions
  drop constraint rider_training_plans_day_range;

alter table public.rider_training_plan_versions
  add constraint rider_training_plans_day_range
  check (effective_from_day_number between 1 and 29);

create or replace function public.get_training_effective_day_number(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_day record;
begin
  perform public.sync_active_season_day();

  select day.day_number, day.calendar_date
  into v_day
  from public.seasons as season
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where season.id = p_season_id
    and season.status = 'active';

  if v_day is null then
    raise exception 'La saison active est introuvable.';
  end if;

  if now() < (
    (v_day.calendar_date::timestamp + time '08:00')
      at time zone 'Europe/Paris'
  ) then
    return v_day.day_number;
  end if;

  -- The season rollover carries this pending version to the following J1.
  return least(v_day.day_number + 1, 29);
end;
$$;

comment on function public.get_training_effective_day_number(uuid) is
  'Returns the next editable session; J29 represents next season day 1 at 08:00.';
