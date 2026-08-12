begin;
-- Les Mondiaux de S1 restent figés. Le nouveau cycle de titres commence
-- exclusivement avec les éditions de S2 et suivantes.
alter table public.rider_national_championship_titles
drop constraint if exists rider_national_titles_type_allowed;
alter table public.rider_national_championship_titles
add constraint rider_national_titles_type_allowed
check (
  championship_type in (
    'road',
    'time_trial',
    'world_road',
    'world_time_trial'
  )
);
create unique index if not exists
  rider_world_titles_one_active_per_discipline_idx
on public.rider_national_championship_titles (championship_type)
where relinquished_at is null
  and championship_type in ('world_road', 'world_time_trial');
create or replace function public.assign_world_championship_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
  v_country_id uuid;
  v_season_id uuid;
  v_game_year integer;
  v_competition_type text;
  v_championship_type text;
begin
  if new.status <> 'classified' or new.final_rank <> 1 then
    return new;
  end if;

  select
    roster.rider_id,
    rider.country_id,
    edition.season_id,
    season.game_year,
    race.competition_type,
    case
      when exists (
        select 1
        from public.race_stages as stage
        where stage.race_edition_id = edition.id
          and stage.stage_type in (
            'individual_time_trial',
            'team_time_trial',
            'prologue'
          )
      ) then 'world_time_trial'
      else 'world_road'
    end
  into
    v_rider_id,
    v_country_id,
    v_season_id,
    v_game_year,
    v_competition_type,
    v_championship_type
  from public.race_rosters as roster
  join public.riders as rider on rider.id = roster.rider_id
  join public.race_editions as edition on edition.id = new.race_edition_id
  join public.seasons as season on season.id = edition.season_id
  join public.races as race on race.id = edition.race_id
  where roster.id = new.race_roster_id;

  if v_competition_type <> 'world_championship' or v_game_year < 2 then
    return new;
  end if;

  update public.rider_national_championship_titles
  set relinquished_at = coalesce(relinquished_at, now())
  where championship_type = v_championship_type
    and relinquished_at is null
    and (
      rider_id <> v_rider_id
      or race_edition_id <> new.race_edition_id
    );

  insert into public.rider_national_championship_titles (
    rider_id,
    country_id,
    season_id,
    race_edition_id,
    championship_type,
    won_at,
    relinquished_at
  )
  values (
    v_rider_id,
    v_country_id,
    v_season_id,
    new.race_edition_id,
    v_championship_type,
    now(),
    null
  )
  on conflict (race_edition_id, championship_type)
  do update set
    rider_id = excluded.rider_id,
    country_id = excluded.country_id,
    season_id = excluded.season_id,
    won_at = excluded.won_at,
    relinquished_at = null;

  return new;
end;
$$;
drop trigger if exists assign_world_championship_title
on public.race_results;
create trigger assign_world_championship_title
after insert or update of status, final_rank
on public.race_results
for each row
execute function public.assign_world_championship_title();
commit;
