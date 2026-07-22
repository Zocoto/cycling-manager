begin;

-- La migration des deux vagues quotidiennes a créé les créneaux early/late.
-- Ici, une même édition peut désormais occuper les deux vagues du même jour.
alter table public.stages
  drop constraint stages_day_unique;

-- E1 le matin, E2 l'après-midi, puis J+1. Une édition déjà commencée ou
-- dotée de résultats conserve son calendrier historique intact.
with compactable_editions as (
  select
    edition.id as race_edition_id,
    min(season_day.day_number)::integer as start_day
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
   and race.race_format = 'stage_race'
  join public.stages as stage
    on stage.race_edition_id = edition.id
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  where not exists (
    select 1
    from public.stages as started_stage
    where started_stage.race_edition_id = edition.id
      and started_stage.status <> 'planned'
  )
    and not exists (
      select 1
      from public.stage_results as result
      join public.stages as result_stage
        on result_stage.id = result.stage_id
      where result_stage.race_edition_id = edition.id
    )
  group by edition.id
), compacted_stages as (
  select
    stage.id as stage_id,
    target_day.id as season_day_id,
    case mod(stage.stage_number - 1, 2)
      when 0 then 'early'
      else 'late'
    end as day_slot,
    target_day.calendar_date
  from compactable_editions as compactable
  join public.stages as stage
    on stage.race_edition_id = compactable.race_edition_id
  join public.race_editions as edition
    on edition.id = compactable.race_edition_id
  join public.season_days as target_day
    on target_day.season_id = edition.season_id
   and target_day.day_number =
     compactable.start_day + ((stage.stage_number - 1) / 2)
)
update public.stages as stage
set
  season_day_id = compacted.season_day_id,
  day_slot = compacted.day_slot,
  departure_at = (
    compacted.calendar_date::timestamp
    + case compacted.day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris'
from compacted_stages as compacted
where stage.id = compacted.stage_id;

alter table public.stages
  add constraint stages_day_slot_unique
    unique (race_edition_id, season_day_id, day_slot);

comment on column public.stages.day_slot is
  'Vague intra-journalière : early = départ 14 h, late = départ 18 h ; une édition peut utiliser les deux.';

-- Les délais suivent le nouveau départ de la première étape des tours encore
-- planifiés. Les éditions commencées sont exclues par les mêmes garde-fous.
update public.race_editions as edition
set
  registration_closes_at = first_stage.closes_at,
  withdrawal_closes_at = first_stage.closes_at
from (
  select distinct on (stage.race_edition_id)
    stage.race_edition_id,
    (
      season_day.calendar_date::timestamp
      + case stage.day_slot
          when 'early' then time '08:00'
          else time '12:00'
        end
    ) at time zone 'Europe/Paris' as closes_at
  from public.stages as stage
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  join public.race_editions as target_edition
    on target_edition.id = stage.race_edition_id
  join public.races as race
    on race.id = target_edition.race_id
   and race.race_format = 'stage_race'
  where not exists (
    select 1
    from public.stages as started_stage
    where started_stage.race_edition_id = stage.race_edition_id
      and started_stage.status <> 'planned'
  )
    and not exists (
      select 1
      from public.stage_results as result
      join public.stages as result_stage
        on result_stage.id = result.stage_id
      where result_stage.race_edition_id = stage.race_edition_id
    )
  order by stage.race_edition_id, stage.stage_number
) as first_stage
where edition.id = first_stage.race_edition_id;

commit;
