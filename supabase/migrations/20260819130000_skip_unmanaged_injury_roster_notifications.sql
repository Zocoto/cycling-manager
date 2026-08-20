begin;

-- Les inscriptions portées par une sélection nationale ou une invitation
-- automatique n'ont pas de team_season_id. Une blessure ne doit donc pas
-- tenter de créer une alerte destinée à un manager inexistant : l'échec de
-- cette alerte annulait aussi la blessure et bloquait tous les résultats.
create or replace function public.withdraw_injured_rider_from_future_races()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_active_roster_count integer;
  v_minimum_roster_size integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  for v_entry in
    select
      roster.id as roster_id,
      registration.id as registration_id,
      registration.team_season_id,
      edition.id as race_edition_id,
      edition.display_name as race_name,
      rider.first_name || ' ' || rider.last_name as rider_name,
      race.competition_type as national_championship_type,
      category.minimum_roster_size,
      first_stage.departure_at
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
     and edition.status not in ('completed', 'cancelled', 'in_progress')
    join public.races as race
      on race.id = edition.race_id
    join public.riders as rider
      on rider.id = roster.rider_id
    left join public.race_categories as category
      on category.id = edition.race_category_id
    join lateral (
      select coalesce(
        stage.departure_at,
        ((season_day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
      ) as departure_at
      from public.stages as stage
      join public.season_days as season_day
        on season_day.id = stage.season_day_id
      where stage.race_edition_id = edition.id
      order by stage.stage_number, stage.id
      limit 1
    ) as first_stage on true
    where roster.rider_id = new.rider_id
      and roster.status in ('selected', 'confirmed')
      and first_stage.departure_at > now()
      and new.started_at < first_stage.departure_at
      and new.expected_recovery_at > first_stage.departure_at
    order by first_stage.departure_at, roster.id
  loop
    update public.race_rosters
    set
      status = 'withdrawn',
      withdrawn_by_injury_id = new.id
    where id = v_entry.roster_id;

    select count(*)::integer
    into v_active_roster_count
    from public.race_rosters as roster
    where roster.race_registration_id = v_entry.registration_id
      and roster.status in ('selected', 'confirmed');

    v_minimum_roster_size := case
      when v_entry.national_championship_type in (
        'national_road',
        'national_time_trial'
      ) then 1
      else greatest(coalesce(v_entry.minimum_roster_size, 1), 1)
    end;

    if v_entry.team_season_id is not null then
      insert into public.race_roster_notifications (
        team_season_id,
        race_registration_id,
        rider_id,
        injury_id,
        title,
        message,
        requires_action,
        active_roster_count,
        minimum_roster_size,
        read_at,
        updated_at
      )
      values (
        v_entry.team_season_id,
        v_entry.registration_id,
        new.rider_id,
        new.id,
        'Coureur retiré de ' || v_entry.race_name,
        v_entry.rider_name || ' est indisponible au départ de ' ||
          v_entry.race_name || ' et a été retiré automatiquement de la start-list.',
        v_active_roster_count < v_minimum_roster_size,
        v_active_roster_count,
        v_minimum_roster_size,
        case
          when v_active_roster_count < v_minimum_roster_size then null
          else now()
        end,
        now()
      )
      on conflict (race_registration_id, rider_id, injury_id)
      do update set
        title = excluded.title,
        message = excluded.message,
        requires_action = excluded.requires_action,
        active_roster_count = excluded.active_roster_count,
        minimum_roster_size = excluded.minimum_roster_size,
        read_at = excluded.read_at,
        updated_at = now();
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.withdraw_injured_rider_from_future_races() is
  'Retire un coureur blessé des départs futurs et alerte uniquement les équipes disposant d un manager.';

commit;
