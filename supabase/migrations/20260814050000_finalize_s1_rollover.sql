-- Recovery for the first production rollover. National road and time-trial
-- championships share a calendar day but use two distinct start slots.
begin;

create or replace function public.enforce_pending_race_roster_conflicts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target_edition_id uuid;
  v_target_competition_type text;
  v_target_continent_code text;
  v_target_country_id uuid;
  v_conflicting_race_name text;
begin
  if new.status not in ('selected', 'confirmed') then
    return new;
  end if;

  select
    registration.race_edition_id,
    race.competition_type,
    race.championship_continent_code,
    race.country_id
  into
    v_target_edition_id,
    v_target_competition_type,
    v_target_continent_code,
    v_target_country_id
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where registration.id = new.race_registration_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.rider_id::text, 0)
  );

  select other_edition.display_name
  into v_conflicting_race_name
  from public.race_rosters as other_roster
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status in ('accepted', 'pending')
  join public.race_editions as other_edition
    on other_edition.id = other_registration.race_edition_id
   and other_edition.id <> v_target_edition_id
  join public.races as other_race
    on other_race.id = other_edition.race_id
  where other_roster.rider_id = new.rider_id
    and other_roster.status in ('selected', 'confirmed')
    and not (
      (
        v_target_competition_type = 'world_championship'
        and other_race.competition_type = 'world_championship'
      )
      or (
        v_target_competition_type = 'continental_championship'
        and other_race.competition_type = 'continental_championship'
        and other_race.championship_continent_code = v_target_continent_code
      )
      or (
        v_target_country_id = other_race.country_id
        and (
          (
            v_target_competition_type = 'national_road'
            and other_race.competition_type = 'national_time_trial'
          )
          or (
            v_target_competition_type = 'national_time_trial'
            and other_race.competition_type = 'national_road'
          )
        )
      )
    )
    and exists (
      select 1
      from public.stages as target_stage
      join public.stages as other_stage
        on other_stage.season_day_id = target_stage.season_day_id
       and other_stage.race_edition_id = other_edition.id
      where target_stage.race_edition_id = v_target_edition_id
    )
  limit 1;

  if v_conflicting_race_name is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce coureur est deja reserve pour %s sur le meme creneau.',
        v_conflicting_race_name
      );
  end if;

  return new;
end;
$$;

-- The Data API timeout is bypassed only for this migration statement. It is
-- restored automatically when this transaction ends.
set local statement_timeout = '5min';

select public.settle_due_season_rollovers();

commit;
