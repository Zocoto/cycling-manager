begin;

-- L'ancien SQL assemblait toutes les étapes dans un CTE, puis réinterrogeait
-- ce même CTE plusieurs fois derrière des OR corrélés. Avec le calendrier S4
-- élargi, PostgreSQL choisissait un plan qui dépassait le statement_timeout,
-- alors que chaque branche prise séparément restait rapide. Les deux modes
-- sont désormais isolés et le règlement ne matérialise que les éditions dues.
create or replace function public.get_due_race_job_edition_ids(
  p_clock timestamptz,
  p_mode text
)
returns table (race_edition_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_mode = 'simulation' then
    return query
    with active_season as (
      select season.id
      from public.seasons as season
      where season.status = 'active'
      limit 1
    )
    select distinct edition.id
    from active_season
    join public.race_editions as edition
      on edition.season_id = active_season.id
     and edition.status <> 'cancelled'
    join public.races as race
      on race.id = edition.race_id
    join public.stages as stage
      on stage.race_edition_id = edition.id
     and stage.status <> 'cancelled'
    where stage.departure_at <= p_clock
      and stage.departure_at + make_interval(mins => greatest(
        8,
        least(48, round(stage.distance_km / 6.0)::integer)
      )) > p_clock
      and stage.status <> 'completed'
      and (
        race.slug = 'criterium-de-namur'
        or exists (
          select 1
          from public.race_registrations as registration
          join public.race_rosters as roster
            on roster.race_registration_id = registration.id
           and roster.status in ('selected', 'confirmed')
          where registration.race_edition_id = edition.id
            and registration.status = 'accepted'
        )
      );

    return;
  end if;

  if p_mode = 'settlement' then
    return query
    with active_season as (
      select season.id
      from public.seasons as season
      where season.status = 'active'
      limit 1
    ), temporal_due as (
      select distinct edition.id as race_edition_id
      from active_season
      join public.race_editions as edition
        on edition.season_id = active_season.id
       and edition.status <> 'cancelled'
      join public.stages as stage
        on stage.race_edition_id = edition.id
       and stage.status <> 'cancelled'
      where (
        stage.status <> 'completed'
        and stage.departure_at + make_interval(mins => greatest(
          8,
          least(48, round(stage.distance_km / 6.0)::integer)
        )) <= p_clock
      ) or (
        edition.status <> 'completed'
        and not exists (
          select 1
          from public.stages as pending
          where pending.race_edition_id = edition.id
            and pending.status <> 'cancelled'
            and pending.departure_at + make_interval(mins => greatest(
              8,
              least(48, round(pending.distance_km / 6.0)::integer)
            )) > p_clock
        )
      )
    ), repairable as (
      select incomplete.race_edition_id
      from active_season
      cross join lateral public.get_incomplete_completed_race_edition_ids(
        active_season.id
      ) as incomplete
    )
    select due.race_edition_id
    from (
      select temporal_due.race_edition_id
      from temporal_due
      union
      select repairable.race_edition_id
      from repairable
    ) as due;
  end if;
end;
$$;

revoke all
on function public.get_due_race_job_edition_ids(timestamptz, text)
from public, anon, authenticated;

grant execute
on function public.get_due_race_job_edition_ids(timestamptz, text)
to service_role;

comment on function public.get_due_race_job_edition_ids(timestamptz, text) is
  'Préfiltre les éditions dues sans rescanner un CTE corrélé pour chaque étape.';

commit;
