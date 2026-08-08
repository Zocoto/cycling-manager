begin;

create or replace function public.date_daily_nutrition_effect_on_game_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calendar_date date;
begin
  select day.calendar_date
  into v_calendar_date
  from public.season_days as day
  where day.id = new.season_day_id;

  if v_calendar_date is null then
    raise exception 'Journee introuvable pour dater le bonus nutritionnel.';
  end if;

  new.applied_at := (
    v_calendar_date::timestamp + interval '1 day'
  ) at time zone 'Europe/Paris';

  return new;
end;
$$;

drop trigger if exists date_daily_nutrition_effect_on_game_day
  on public.rider_daily_nutrition_effects;
create trigger date_daily_nutrition_effect_on_game_day
before insert or update of season_day_id
on public.rider_daily_nutrition_effects
for each row execute function public.date_daily_nutrition_effect_on_game_day();

update public.rider_daily_nutrition_effects as effect
set applied_at = (
  day.calendar_date::timestamp + interval '1 day'
) at time zone 'Europe/Paris'
from public.season_days as day
where day.id = effect.season_day_id
  and effect.applied_at is distinct from (
    day.calendar_date::timestamp + interval '1 day'
  ) at time zone 'Europe/Paris';

revoke all on function public.date_daily_nutrition_effect_on_game_day()
  from public, anon, authenticated;

comment on function public.date_daily_nutrition_effect_on_game_day() is
  'Date chaque bonus nutritionnel au changement du jour concerne.';

notify pgrst, 'reload schema';

commit;
