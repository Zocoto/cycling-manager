begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create function public.get_registration_season_race_days_v2(
  p_season_id uuid,
  p_rider_ids uuid[]
)
returns table (
  rider_id uuid,
  season_race_days integer,
  projected_season_race_days integer,
  has_etapovore boolean
)
language sql
stable
set search_path = ''
as $$
  select days.rider_id, days.season_race_days, days.projected_season_race_days,
    exists (
      select 1 from public.rider_special_abilities as ability
      where ability.rider_id = days.rider_id and ability.ability_code = 'etapovore'
    )
  from public.get_registration_season_race_days(p_season_id, p_rider_ids) as days;
$$;

revoke all on function public.get_registration_season_race_days_v2(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.get_registration_season_race_days_v2(uuid, uuid[])
  to service_role;

notify pgrst, 'reload schema';
commit;
