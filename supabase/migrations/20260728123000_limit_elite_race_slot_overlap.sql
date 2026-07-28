begin;

-- Les tours restent compacts sur deux demi-journées par jour. Lorsqu'un
-- monument tombe sur un créneau déjà occupé par deux tours, on déplace donc
-- uniquement la course d'un jour vers le créneau libre le plus proche.
create temporary table elite_slot_rebalance (
  race_slug text primary key,
  target_day_number smallint not null check (target_day_number between 1 and 28),
  target_day_slot text not null check (target_day_slot in ('early', 'late'))
) on commit drop;

insert into elite_slot_rebalance (
  race_slug,
  target_day_number,
  target_day_slot
)
values
  ('paves-de-zelande', 9, 'late'),
  ('classique-des-lacs', 17, 'late');

with movable_stages as (
  select
    stage.id as stage_id,
    target_day.id as target_day_id,
    target_day.calendar_date,
    target.target_day_slot
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
   and race.race_format = 'one_day'
  join public.race_categories as category
    on category.id = edition.race_category_id
   and category.code = 'elite'
  join public.seasons as season
    on season.id = edition.season_id
   and season.status in ('active', 'planned')
  join elite_slot_rebalance as target
    on target.race_slug = race.slug
  join public.season_days as target_day
    on target_day.season_id = edition.season_id
   and target_day.day_number = target.target_day_number
  where stage.status = 'planned'
    and edition.status not in ('in_progress', 'completed', 'cancelled')
    and target.target_day_number >= coalesce(season.current_day_number, 1)
    and not exists (
      select 1
      from public.stage_results as result
      where result.stage_id = stage.id
    )
)
update public.stages as stage
set
  season_day_id = movable.target_day_id,
  day_slot = movable.target_day_slot,
  departure_at = (
    movable.calendar_date::timestamp
    + case movable.target_day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris'
from movable_stages as movable
where stage.id = movable.stage_id;

-- Le déplacement d'une course met aussi à jour le gel de sa composition.
with affected_editions as (
  select edition.id
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status in ('active', 'planned')
  join elite_slot_rebalance as target
    on target.race_slug = race.slug
  where edition.status not in ('in_progress', 'completed', 'cancelled')
), first_stages as (
  select distinct on (stage.race_edition_id)
    stage.race_edition_id,
    day.calendar_date,
    stage.day_slot
  from public.stages as stage
  join affected_editions as affected
    on affected.id = stage.race_edition_id
  join public.season_days as day
    on day.id = stage.season_day_id
  order by stage.race_edition_id, stage.stage_number
)
update public.race_editions as edition
set
  registration_closes_at = (
    first_stage.calendar_date::timestamp
    + case first_stage.day_slot
        when 'early' then time '08:00'
        else time '12:00'
      end
  ) at time zone 'Europe/Paris',
  withdrawal_closes_at = (
    first_stage.calendar_date::timestamp
    + case first_stage.day_slot
        when 'early' then time '08:00'
        else time '12:00'
      end
  ) at time zone 'Europe/Paris'
from first_stages as first_stage
where edition.id = first_stage.race_edition_id;

-- La migration échoue explicitement si un autre conflit futur à trois courses
-- Élites subsiste : une nouvelle course devra alors être positionnée
-- volontairement au lieu de recréer une contrainte d'effectif invisible.
do $$
declare
  overloaded_slot record;
begin
  select
    season.name as season_name,
    day.day_number,
    stage.day_slot,
    count(*)::integer as race_count
  into overloaded_slot
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.race_categories as category
    on category.id = edition.race_category_id
   and category.code = 'elite'
  join public.seasons as season
    on season.id = edition.season_id
   and season.status in ('active', 'planned')
  join public.season_days as day
    on day.id = stage.season_day_id
  where stage.status = 'planned'
    and edition.status not in ('in_progress', 'completed', 'cancelled')
    and day.day_number >= coalesce(season.current_day_number, 1)
  group by season.id, season.name, day.day_number, stage.day_slot
  having count(*) > 2
  order by day.day_number, stage.day_slot
  limit 1;

  if found then
    raise exception
      'Le créneau Elite de % J% % contient encore % courses.',
      overloaded_slot.season_name,
      overloaded_slot.day_number,
      overloaded_slot.day_slot,
      overloaded_slot.race_count;
  end if;
end;
$$;

commit;
