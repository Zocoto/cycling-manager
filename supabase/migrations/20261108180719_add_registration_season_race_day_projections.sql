begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

create function public.get_registration_season_race_days(
  p_season_id uuid,
  p_rider_ids uuid[]
)
returns table (
  rider_id uuid,
  season_race_days integer,
  projected_season_race_days integer
)
language sql
stable
set search_path = ''
as $$
  with season_riders as materialized (
    select rating.rider_id, rating.season_race_days,
           coalesce(season.current_day_number, 1) as current_day_number
    from public.rider_season_ratings as rating
    join public.seasons as season on season.id = rating.season_id
    where rating.season_id = p_season_id
      and rating.rider_id = any(p_rider_ids)
  ), remaining_starts as (
    select rider.rider_id, count(distinct stage.id)::integer as stage_count
    from season_riders as rider
    join public.race_rosters as roster
      on roster.rider_id = rider.rider_id
     and roster.status in ('selected', 'confirmed')
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status in ('pending', 'accepted')
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
     and edition.season_id = p_season_id
     and edition.status not in ('completed', 'cancelled')
    join public.stages as stage on stage.race_edition_id = edition.id
    join public.season_days as day on day.id = stage.season_day_id
    where (stage.status = 'in_progress'
      or (stage.status = 'planned' and day.day_number >= rider.current_day_number))
      and not exists (
        select 1
        from public.race_rosters as result_roster
        join public.race_registrations as result_registration
          on result_registration.id = result_roster.race_registration_id
         and result_registration.race_edition_id = edition.id
        join public.stage_results as result
          on result.race_roster_id = result_roster.id
        join public.stages as result_stage on result_stage.id = result.stage_id
        where result_roster.rider_id = rider.rider_id
          and result_stage.race_edition_id = edition.id
          and (result_stage.id = stage.id or (
            result_stage.stage_number < stage.stage_number
            and result.status in ('did_not_start', 'did_not_finish', 'disqualified', 'outside_time_limit')
          ))
      )
    group by rider.rider_id
  )
  select rider.rider_id, rider.season_race_days,
         rider.season_race_days + coalesce(remaining.stage_count, 0)
  from season_riders as rider
  left join remaining_starts as remaining using (rider_id);
$$;

revoke all on function public.get_registration_season_race_days(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.get_registration_season_race_days(uuid, uuid[])
  to service_role;

notify pgrst, 'reload schema';
commit;
