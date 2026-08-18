begin;

-- Une sélection aux championnats nationaux est prioritaire sur une course
-- ordinaire qui occupe le même jour. Si ce retrait fait tomber l'équipe sous
-- le contingent minimal, conserver une inscription partielle est inutile :
-- la composition est verrouillée et ne peut plus être complétée normalement.
create or replace function public.withdraw_underfilled_race_registration_after_cn_conflict(
  p_registration_id uuid,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_status text;
  v_competition_type text;
  v_minimum_roster_size integer;
  v_active_roster_size integer;
begin
  select
    registration.status,
    race.competition_type,
    coalesce(category.minimum_roster_size, 1)
  into
    v_registration_status,
    v_competition_type,
    v_minimum_roster_size
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join public.race_categories as category
    on category.id = edition.race_category_id
  where registration.id = p_registration_id
  for update of registration;

  if not found
    or v_registration_status not in ('accepted', 'pending')
    or v_competition_type in ('national_road', 'national_time_trial')
  then
    return false;
  end if;

  select count(*)::integer
  into v_active_roster_size
  from public.race_rosters as roster
  where roster.race_registration_id = p_registration_id
    and roster.status in ('selected', 'confirmed');

  if v_active_roster_size >= v_minimum_roster_size then
    return false;
  end if;

  update public.race_rosters
  set status = 'withdrawn'
  where race_registration_id = p_registration_id
    and status in ('selected', 'confirmed');

  update public.race_registrations
  set
    status = 'withdrawn',
    decided_at = p_now
  where id = p_registration_id
    and status in ('accepted', 'pending');

  return found;
end;
$$;

revoke all
on function public.withdraw_underfilled_race_registration_after_cn_conflict(uuid, timestamptz)
from public, anon, authenticated;

grant execute
on function public.withdraw_underfilled_race_registration_after_cn_conflict(uuid, timestamptz)
to service_role;

comment on function public.withdraw_underfilled_race_registration_after_cn_conflict(uuid, timestamptz)
  is 'Retire complètement une inscription ordinaire devenue inférieure au contingent minimum après une priorité CN.';

create or replace function public.prioritize_national_championship_rider(
  p_race_edition_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_country_id uuid;
  v_target_competition_type text;
  v_affected_registration_id uuid;
begin
  select
    race.country_id,
    race.competition_type
  into
    v_target_country_id,
    v_target_competition_type
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  where edition.id = p_race_edition_id;

  if not found
    or v_target_competition_type not in ('national_road', 'national_time_trial')
  then
    return;
  end if;

  for v_affected_registration_id in
    with conflicting_rosters as (
      select roster.id
      from public.race_rosters as roster
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
       and registration.status in ('accepted', 'pending')
      join public.race_editions as other_edition
        on other_edition.id = registration.race_edition_id
       and other_edition.id <> p_race_edition_id
      join public.races as other_race
        on other_race.id = other_edition.race_id
      where roster.rider_id = p_rider_id
        and roster.status in ('selected', 'confirmed')
        and not (
          other_race.country_id = v_target_country_id
          and other_race.competition_type in (
            'national_road',
            'national_time_trial'
          )
        )
        and exists (
          select 1
          from public.stages as target_stage
          join public.stages as other_stage
            on other_stage.season_day_id = target_stage.season_day_id
           and other_stage.race_edition_id = other_edition.id
          where target_stage.race_edition_id = p_race_edition_id
        )
    ), withdrawn_overlaps as (
      update public.race_rosters as roster
      set status = 'withdrawn'
      from conflicting_rosters as conflict
      where roster.id = conflict.id
      returning roster.race_registration_id
    )
    select distinct withdrawn.race_registration_id
    from withdrawn_overlaps as withdrawn
  loop
    perform public.withdraw_underfilled_race_registration_after_cn_conflict(
      v_affected_registration_id,
      now()
    );
  end loop;

  update public.rider_form_camps as camp
  set
    status = 'cancelled',
    completed_at = now()
  where camp.rider_id = p_rider_id
    and camp.status in ('planned', 'active')
    and exists (
      select 1
      from public.stages as target_stage
      join public.season_days as target_day
        on target_day.id = target_stage.season_day_id
      where target_stage.race_edition_id = p_race_edition_id
        and target_day.season_id = camp.season_id
        and target_day.day_number between camp.start_day_number and camp.end_day_number
    );
end;
$$;

revoke all
on function public.prioritize_national_championship_rider(uuid, uuid)
from public, anon, authenticated;

-- Régularise uniquement les inscriptions de la saison active qui :
--   * comprennent une étape en J8 ;
--   * sont devenues inférieures au minimum ;
--   * possèdent un coureur retiré désormais engagé sur un CN en J8.
-- Les CN eux-mêmes et les compositions ordinaires encore valides sont exclus.
with affected_registrations as materialized (
  select distinct ordinary_registration.id
  from public.seasons as season
  join public.season_days as ordinary_day
    on ordinary_day.season_id = season.id
   and ordinary_day.day_number = 8
  join public.stages as ordinary_stage
    on ordinary_stage.season_day_id = ordinary_day.id
  join public.race_editions as ordinary_edition
    on ordinary_edition.id = ordinary_stage.race_edition_id
  join public.races as ordinary_race
    on ordinary_race.id = ordinary_edition.race_id
   and ordinary_race.competition_type not in (
     'national_road',
     'national_time_trial'
   )
  join public.race_categories as category
    on category.id = ordinary_edition.race_category_id
  join public.race_registrations as ordinary_registration
    on ordinary_registration.race_edition_id = ordinary_edition.id
   and ordinary_registration.status in ('accepted', 'pending')
  where season.status = 'active'
    and (
      select count(*)
      from public.race_rosters as active_roster
      where active_roster.race_registration_id = ordinary_registration.id
        and active_roster.status in ('selected', 'confirmed')
    ) < coalesce(category.minimum_roster_size, 1)
    and exists (
      select 1
      from public.race_rosters as withdrawn_roster
      join public.race_rosters as cn_roster
        on cn_roster.rider_id = withdrawn_roster.rider_id
       and cn_roster.status in ('selected', 'confirmed')
      join public.race_registrations as cn_registration
        on cn_registration.id = cn_roster.race_registration_id
       and cn_registration.status in ('accepted', 'pending')
      join public.race_editions as cn_edition
        on cn_edition.id = cn_registration.race_edition_id
       and cn_edition.season_id = season.id
      join public.races as cn_race
        on cn_race.id = cn_edition.race_id
       and cn_race.competition_type in (
         'national_road',
         'national_time_trial'
       )
      join public.stages as cn_stage
        on cn_stage.race_edition_id = cn_edition.id
       and cn_stage.season_day_id = ordinary_day.id
      where withdrawn_roster.race_registration_id = ordinary_registration.id
        and withdrawn_roster.status = 'withdrawn'
    )
), withdrawn_remaining_rosters as (
  update public.race_rosters as roster
  set status = 'withdrawn'
  from affected_registrations as affected
  where roster.race_registration_id = affected.id
    and roster.status in ('selected', 'confirmed')
  returning roster.id
)
update public.race_registrations as registration
set
  status = 'withdrawn',
  decided_at = now()
from affected_registrations as affected
where registration.id = affected.id
  and registration.status in ('accepted', 'pending');

commit;
