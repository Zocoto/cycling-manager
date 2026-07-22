begin;

-- Deux vagues de course structurent désormais chaque journée. Plusieurs
-- épreuves peuvent partager une vague, mais un coureur reste indisponible sur
-- toute la journée dès qu'il figure dans une startlist (contrôle déjà assuré
-- par save_current_team_race_roster).
alter table public.stages
add column day_slot text not null default 'late';

alter table public.stages
add constraint stages_day_slot_allowed
check (day_slot in ('early', 'late'));

create index stages_season_day_slot_idx
  on public.stages (season_day_id, day_slot);

comment on column public.stages.day_slot is
  'Vague quotidienne : early = départ 14 h / gel 8 h, late = départ 18 h / gel 12 h (Europe/Paris).';

-- Les départs historiques à 20 h appartiennent à l'ancienne vague tardive.
-- Ils restent intacts si le live a déjà commencé ou si un résultat existe.
update public.stages as stage
set day_slot = case
  when extract(hour from stage.departure_at at time zone 'Europe/Paris') < 16
    then 'early'
  else 'late'
end
where stage.departure_at is not null;

-- Les Grands Tours passent à 12 étapes. Les tours Mondiaux passent à cinq
-- étapes lorsqu'ils n'ont pas encore commencé, et la Volta das Serras gagne
-- une troisième étape. Une édition commencée ou déjà classée n'est jamais
-- réécrite rétroactivement.
create temporary table expanded_tour_seed (
  slug text primary key,
  start_day smallint not null,
  day_slot text not null check (day_slot in ('early', 'late')),
  profiles text[] not null,
  distances numeric[] not null,
  constraint expanded_tour_seed_same_length
    check (cardinality(profiles) = cardinality(distances))
) on commit drop;

insert into expanded_tour_seed (
  slug,
  start_day,
  day_slot,
  profiles,
  distances
)
values
  (
    'corsa-delle-regioni', 2, 'early',
    array['sprint','hilly','mountain','flat','mountain','time_trial','sprint','hilly','mountain','hilly','mountain','sprint'],
    array[172,186,192,165,205,42,178,188,198,174,212,181]::numeric[]
  ),
  (
    'boucle-des-provinces', 9, 'late',
    array['hilly','sprint','mountain','time_trial','flat','hilly','mountain','sprint','hilly','mountain','time_trial','sprint'],
    array[184,180,197,45,190,175,205,182,188,214,35,190]::numeric[]
  ),
  (
    'ruta-de-las-sierras', 17, 'early',
    array['sprint','hilly','mountain','flat','mountain','time_trial','hilly','sprint','mountain','hilly','mountain','sprint'],
    array[174,182,196,178,208,41,186,180,201,175,216,187]::numeric[]
  ),
  (
    'tour-du-sakura', 2, 'late',
    array['sprint','hilly','mountain','time_trial','mountain'],
    array[156,163,171,34,178]::numeric[]
  ),
  (
    'tour-du-saint-laurent', 6, 'early',
    array['flat','hilly','time_trial','sprint','mountain'],
    array[164,171,38,178,184]::numeric[]
  ),
  (
    'andes-del-sur', 11, 'late',
    array['hilly','mountain','mountain','time_trial','sprint'],
    array[159,173,188,39,166]::numeric[]
  ),
  (
    'tour-des-hauts-plateaux', 16, 'early',
    array['hilly','mountain','flat','mountain','time_trial'],
    array[168,181,174,194,41]::numeric[]
  ),
  (
    'southern-coast-tour', 23, 'late',
    array['sprint','hilly','mountain','time_trial','sprint'],
    array[171,178,186,40,183]::numeric[]
  ),
  (
    'volta-das-serras', 2, 'early',
    array['hilly','mountain','sprint'],
    array[147,161,154]::numeric[]
  );

create temporary table editable_tour_editions
on commit drop
as
select
  edition.id as race_edition_id,
  edition.season_id,
  race.slug,
  seed.start_day,
  seed.day_slot,
  seed.profiles,
  seed.distances
from expanded_tour_seed as seed
join public.races as race
  on race.slug = seed.slug
join public.race_editions as edition
  on edition.race_id = race.id
join public.seasons as season
  on season.id = edition.season_id
join public.season_days as first_day
  on first_day.season_id = edition.season_id
 and first_day.day_number = seed.start_day
where edition.status not in ('completed', 'cancelled', 'in_progress')
  and not exists (
    select 1
    from public.stages as existing_stage
    join public.stage_results as result
      on result.stage_id = existing_stage.id
    where existing_stage.race_edition_id = edition.id
  )
  and not exists (
    select 1
    from public.stages as existing_stage
    where existing_stage.race_edition_id = edition.id
      and existing_stage.status <> 'planned'
  )
  and (
    first_day.calendar_date::timestamp
    + case seed.day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris' > now()
  and seed.start_day + cardinality(seed.profiles) - 1 <= 28;

-- Le déplacement d'un tour peut temporairement échanger deux créneaux déjà
-- occupés par ses propres étapes. Une édition peut utiliser les deux vagues
-- d'une journée, mais jamais deux fois la même vague.
alter table public.stages
drop constraint stages_day_unique;

alter table public.stages
add constraint stages_day_slot_unique
unique (race_edition_id, season_day_id, day_slot)
deferrable initially immediate;

set constraints stages_day_slot_unique deferred;

-- Repositionnement et rééquilibrage des étapes déjà présentes.
update public.stages as stage
set
  season_day_id = season_day.id,
  name = 'Étape ' || stage.stage_number,
  stage_type = case
    when editable.profiles[stage.stage_number] = 'time_trial'
      then 'individual_time_trial'
    else 'road'
  end,
  distance_km = editable.distances[stage.stage_number],
  profile_type = editable.profiles[stage.stage_number],
  day_slot = editable.day_slot,
  departure_at = (
    season_day.calendar_date::timestamp
    + case editable.day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris'
from editable_tour_editions as editable
join public.season_days as season_day
  on season_day.season_id = editable.season_id
where stage.race_edition_id = editable.race_edition_id
  and stage.stage_number <= cardinality(editable.profiles)
  and season_day.day_number = editable.start_day + stage.stage_number - 1;

-- Ajout des nouvelles étapes sans toucher aux éditions déjà commencées.
insert into public.stages (
  race_edition_id,
  season_day_id,
  stage_number,
  name,
  stage_type,
  distance_km,
  status,
  departure_at,
  profile_type,
  day_slot
)
select
  editable.race_edition_id,
  season_day.id,
  generated.stage_number,
  'Étape ' || generated.stage_number,
  case
    when editable.profiles[generated.stage_number] = 'time_trial'
      then 'individual_time_trial'
    else 'road'
  end,
  editable.distances[generated.stage_number],
  'planned',
  (
    season_day.calendar_date::timestamp
    + case editable.day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris',
  editable.profiles[generated.stage_number],
  editable.day_slot
from editable_tour_editions as editable
cross join lateral generate_series(
  1,
  cardinality(editable.profiles)
) as generated(stage_number)
join public.season_days as season_day
  on season_day.season_id = editable.season_id
 and season_day.day_number = editable.start_day + generated.stage_number - 1
on conflict (race_edition_id, stage_number)
do nothing;

-- Attribution équilibrée des deux vagues aux autres épreuves futures. Un tour
-- garde toujours la même vague d'une étape à l'autre.
with desired_slots as (
  select
    edition.id as race_edition_id,
    case
      when mod(get_byte(decode(md5(race.slug), 'hex'), 0), 2) = 0
        then 'early'
      else 'late'
    end as day_slot
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  where not exists (
    select 1
    from editable_tour_editions as editable
    where editable.race_edition_id = edition.id
  )
), target_times as (
  select
    stage.id as stage_id,
    desired.day_slot,
    (
      season_day.calendar_date::timestamp
      + case desired.day_slot
          when 'early' then time '14:00'
          else time '18:00'
        end
    ) at time zone 'Europe/Paris' as departure_at
  from public.stages as stage
  join desired_slots as desired
    on desired.race_edition_id = stage.race_edition_id
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  where stage.status = 'planned'
    and not exists (
      select 1
      from public.stage_results as result
      where result.stage_id = stage.id
    )
)
update public.stages as stage
set
  day_slot = target.day_slot,
  departure_at = target.departure_at
from target_times as target
where stage.id = target.stage_id
  and target.departure_at > now();

-- Les profils des tours modifiés sont recréés en tronçons. Les étapes de
-- montagne terminent sur une ascension continue de 30 à 60 km et au sommet.
delete from public.stage_segments as segment
using public.stages as stage, editable_tour_editions as editable
where segment.stage_id = stage.id
  and stage.race_edition_id = editable.race_edition_id;

with target_stages as (
  select
    stage.id as stage_id,
    stage.stage_number,
    stage.profile_type,
    stage.distance_km,
    ceil(stage.distance_km / 10.0)::integer as segment_count,
    least(
      ceil(stage.distance_km / 10.0)::integer - 1,
      3 + stage.stage_number % 4
    )::integer as final_climb_length
  from public.stages as stage
  join editable_tour_editions as editable
    on editable.race_edition_id = stage.race_edition_id
), generated as (
  select
    target.*,
    generated.segment_number,
    least(
      10.0,
      target.distance_km - ((generated.segment_number - 1) * 10.0)
    )::numeric(5, 2) as segment_distance_km
  from target_stages as target
  cross join lateral generate_series(
    1,
    target.segment_count
  ) as generated(segment_number)
), shaped as (
  select
    generated.*,
    case
      when generated.profile_type in ('flat', 'sprint', 'time_trial') then
        case
          when generated.segment_number > 2
            and generated.segment_number < generated.segment_count - 1
            and generated.segment_number % 11 = 0 then 'climb'
          when generated.segment_number > 2
            and generated.segment_number < generated.segment_count - 1
            and generated.segment_number % 11 = 1 then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'hilly' then
        case generated.segment_number % 7
          when 2 then 'climb'
          when 3 then 'climb'
          when 4 then 'descent'
          when 6 then 'climb'
          when 0 then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'mountain' then
        case
          when generated.segment_number >= generated.segment_count - generated.final_climb_length + 1
            then 'climb'
          when generated.segment_number >= generated.segment_count - generated.final_climb_length - 1
            then 'descent'
          when generated.segment_number = 1 then 'flat'
          when generated.segment_number % 6 in (1, 2, 3) then 'climb'
          when generated.segment_number % 6 in (4, 5) then 'descent'
          else 'flat'
        end
      else
        case generated.segment_number % 7
          when 2 then 'climb'
          when 3 then 'descent'
          when 5 then 'climb'
          when 6 then 'climb'
          when 0 then 'descent'
          else 'flat'
        end
    end as terrain_type
  from generated
)
insert into public.stage_segments (
  stage_id,
  segment_number,
  distance_km,
  terrain_type,
  surface_type,
  average_gradient_pct
)
select
  shaped.stage_id,
  shaped.segment_number,
  shaped.segment_distance_km,
  shaped.terrain_type,
  'asphalt',
  case
    when shaped.terrain_type = 'flat' then 0
    when shaped.terrain_type = 'climb' then
      round((
        case
          when shaped.profile_type = 'mountain' then 5.8
          when shaped.profile_type = 'hilly' then 3.0
          else 1.5
        end
        + mod(shaped.stage_number * 17 + shaped.segment_number * 37, 36) / 10.0
      )::numeric, 2)
    else
      -round((
        case
          when shaped.profile_type = 'mountain' then 5.2
          when shaped.profile_type = 'hilly' then 2.8
          else 1.4
        end
        + mod(shaped.stage_number * 13 + shaped.segment_number * 29, 32) / 10.0
      )::numeric, 2)
  end
from shaped
order by shaped.stage_id, shaped.segment_number;

-- GPM à chaque sommet, avec barème lié à la difficulté de l'ascension.
with ordered_segments as (
  select
    segment.*,
    stage.race_edition_id,
    sum(case when segment.terrain_type <> 'climb' then 1 else 0 end)
      over (partition by segment.stage_id order by segment.segment_number) as climb_group
  from public.stage_segments as segment
  join public.stages as stage
    on stage.id = segment.stage_id
  join editable_tour_editions as editable
    on editable.race_edition_id = stage.race_edition_id
), climbs as (
  select
    ordered.stage_id,
    ordered.climb_group,
    max(ordered.segment_number) as summit_segment_number,
    sum(ordered.distance_km) as climb_distance_km,
    max(ordered.average_gradient_pct) as maximum_gradient_pct
  from ordered_segments as ordered
  where ordered.terrain_type = 'climb'
  group by ordered.stage_id, ordered.climb_group
), categorized as (
  select
    climbs.*,
    case
      when climbs.climb_distance_km * climbs.maximum_gradient_pct >= 260 then 'HC'
      when climbs.climb_distance_km * climbs.maximum_gradient_pct >= 180 then '1'
      when climbs.climb_distance_km * climbs.maximum_gradient_pct >= 110 then '2'
      when climbs.climb_distance_km * climbs.maximum_gradient_pct >= 55 then '3'
      else '4'
    end as category
  from climbs
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  summit.id,
  'mountain',
  categorized.category,
  case categorized.category
    when 'HC' then array[20,15,12,10,8,6,4,2]::smallint[]
    when '1' then array[10,8,6,4,2,1]::smallint[]
    when '2' then array[5,3,2,1]::smallint[]
    when '3' then array[2,1]::smallint[]
    else array[1]::smallint[]
  end
from categorized
join public.stage_segments as summit
  on summit.stage_id = categorized.stage_id
 and summit.segment_number = categorized.summit_segment_number;

-- Un SI par étape de route, sur le tronçon plat disponible le plus proche de
-- 42 % de la distance et jamais sur le dernier tronçon.
with eligible_segments as (
  select
    segment.id as stage_segment_id,
    segment.stage_id,
    segment.segment_number,
    max(segment.segment_number) over (partition by segment.stage_id) as segment_count
  from public.stage_segments as segment
  join public.stages as stage
    on stage.id = segment.stage_id
   and stage.stage_type = 'road'
  join editable_tour_editions as editable
    on editable.race_edition_id = stage.race_edition_id
  where segment.terrain_type = 'flat'
    and segment.segment_number > 1
    and not exists (
      select 1
      from public.stage_segment_primes as prime
      where prime.stage_segment_id = segment.id
    )
), candidates as (
  select
    eligible.stage_segment_id,
    eligible.stage_id,
    row_number() over (
      partition by eligible.stage_id
      order by
        abs(eligible.segment_number - eligible.segment_count * 0.42),
        eligible.segment_number
    ) as preference_rank
  from eligible_segments as eligible
  where eligible.segment_number < eligible.segment_count
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  candidates.stage_segment_id,
  'intermediate_sprint',
  null,
  array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::smallint[]
from candidates
where candidates.preference_rank = 1;

-- Le gel des inscriptions et des retraits est désormais commun : 8 h pour la
-- vague de 14 h, 12 h pour celle de 18 h. On se base toujours sur la première
-- étape du tour.
with first_stages as (
  select distinct on (stage.race_edition_id)
    stage.race_edition_id,
    stage.day_slot,
    season_day.calendar_date
  from public.stages as stage
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  order by stage.race_edition_id, stage.stage_number
), deadlines as (
  select
    first_stage.race_edition_id,
    (
      first_stage.calendar_date::timestamp
      + case first_stage.day_slot
          when 'early' then time '08:00'
          else time '12:00'
        end
    ) at time zone 'Europe/Paris' as closes_at
  from first_stages as first_stage
)
update public.race_editions as edition
set
  registration_closes_at = deadline.closes_at,
  withdrawal_closes_at = deadline.closes_at
from deadlines as deadline
where edition.id = deadline.race_edition_id
  and edition.status not in ('completed', 'cancelled');

comment on column public.race_editions.registration_closes_at is
  'Gel de la startlist : 8 h pour la vague de 14 h, 12 h pour la vague de 18 h.';

comment on column public.race_editions.withdrawal_closes_at is
  'Le retrait et la réinscription ferment au même instant que la startlist.';

-- Jusqu'ici, ensure_transfer_next_season créait les 28 journées mais pas le
-- calendrier associé. La saison suivante hérite désormais de toutes les
-- éditions, étapes, profils, GPM/SI et temps forts. La Corsa déjà commencée en
-- S1 reste historique à six étapes, mais son modèle futur est complété à 12.
create or replace function public.provision_season_race_calendar(
  p_source_season_id uuid,
  p_target_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_source_season_id = p_target_season_id then
    raise exception 'La saison source et la saison cible doivent être distinctes.';
  end if;

  if not exists (
    select 1 from public.season_days where season_id = p_target_season_id
  ) then
    raise exception 'Les journées de la saison cible doivent être créées avant son calendrier.';
  end if;

  insert into public.race_editions (
    race_id,
    season_id,
    race_category_id,
    edition_number,
    display_name,
    status,
    minimum_reputation,
    registration_policy,
    field_limit
  )
  select
    source.race_id,
    p_target_season_id,
    source.race_category_id,
    source.edition_number + 1,
    source.display_name,
    'registration_open',
    source.minimum_reputation,
    source.registration_policy,
    source.field_limit
  from public.race_editions as source
  where source.season_id = p_source_season_id
  on conflict (race_id, season_id)
  do update set
    race_category_id = excluded.race_category_id,
    edition_number = excluded.edition_number,
    display_name = excluded.display_name,
    minimum_reputation = excluded.minimum_reputation,
    registration_policy = excluded.registration_policy,
    field_limit = excluded.field_limit;

  with source_templates as (
    select
      race.id as race_id,
      race.slug,
      stage.stage_number,
      stage.name,
      stage.stage_type,
      stage.distance_km,
      stage.profile_type,
      case
        when race.slug = 'corsa-delle-regioni'
          then 2 + ((stage.stage_number - 1) / 2)
        else source_day.day_number
      end as target_day_number,
      case
        when race.slug = 'corsa-delle-regioni'
          then case when stage.stage_number % 2 = 1 then 'early' else 'late' end
        else stage.day_slot
      end as target_day_slot,
      stage.stage_number as source_stage_number
    from public.race_editions as source_edition
    join public.races as race
      on race.id = source_edition.race_id
    join public.stages as stage
      on stage.race_edition_id = source_edition.id
    join public.season_days as source_day
      on source_day.id = stage.season_day_id
    where source_edition.season_id = p_source_season_id

    union all

    select
      race.id,
      race.slug,
      extension.stage_number,
      'Étape ' || extension.stage_number,
      source_stage.stage_type,
      source_stage.distance_km,
      source_stage.profile_type,
      2 + ((extension.stage_number - 1) / 2),
      case when extension.stage_number % 2 = 1 then 'early' else 'late' end,
      extension.source_stage_number
    from public.races as race
    join public.race_editions as source_edition
      on source_edition.race_id = race.id
     and source_edition.season_id = p_source_season_id
    join (
      values
        (7, 1),
        (8, 2),
        (9, 3),
        (10, 2),
        (11, 5),
        (12, 6)
    ) as extension(stage_number, source_stage_number)
      on true
    join public.stages as source_stage
      on source_stage.race_edition_id = source_edition.id
     and source_stage.stage_number = extension.source_stage_number
    where race.slug = 'corsa-delle-regioni'
      and not exists (
        select 1
        from public.stages as existing_source_stage
        where existing_source_stage.race_edition_id = source_edition.id
          and existing_source_stage.stage_number = extension.stage_number
      )
  )
  insert into public.stages (
    race_edition_id,
    season_day_id,
    stage_number,
    name,
    stage_type,
    distance_km,
    status,
    departure_at,
    profile_type,
    day_slot
  )
  select
    target_edition.id,
    target_day.id,
    template.stage_number,
    case
      when race.race_format = 'one_day' then target_edition.display_name
      else 'Étape ' || template.stage_number
    end,
    template.stage_type,
    template.distance_km,
    'planned',
    (
      target_day.calendar_date::timestamp
      + case template.target_day_slot
          when 'early' then time '14:00'
          else time '18:00'
        end
    ) at time zone 'Europe/Paris',
    template.profile_type,
    template.target_day_slot
  from source_templates as template
  join public.races as race
    on race.id = template.race_id
  join public.race_editions as target_edition
    on target_edition.race_id = template.race_id
   and target_edition.season_id = p_target_season_id
  join public.season_days as target_day
    on target_day.season_id = p_target_season_id
   and target_day.day_number = template.target_day_number
  on conflict (race_edition_id, stage_number)
  do update set
    season_day_id = excluded.season_day_id,
    name = excluded.name,
    stage_type = excluded.stage_type,
    distance_km = excluded.distance_km,
    status = excluded.status,
    departure_at = excluded.departure_at,
    profile_type = excluded.profile_type,
    day_slot = excluded.day_slot;

  with stage_mapping as (
    select
      target_stage.id as target_stage_id,
      source_stage.id as source_stage_id
    from public.race_editions as target_edition
    join public.races as race
      on race.id = target_edition.race_id
    join public.race_editions as source_edition
      on source_edition.race_id = target_edition.race_id
     and source_edition.season_id = p_source_season_id
    join public.stages as target_stage
      on target_stage.race_edition_id = target_edition.id
    join public.stages as source_stage
      on source_stage.race_edition_id = source_edition.id
     and source_stage.stage_number = case
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 7 then 1
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 8 then 2
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 9 then 3
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 10 then 2
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 11 then 5
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 12 then 6
       else target_stage.stage_number
     end
    where target_edition.season_id = p_target_season_id
  )
  insert into public.stage_segments (
    stage_id,
    segment_number,
    distance_km,
    terrain_type,
    surface_type,
    average_gradient_pct
  )
  select
    mapping.target_stage_id,
    source_segment.segment_number,
    source_segment.distance_km,
    source_segment.terrain_type,
    source_segment.surface_type,
    source_segment.average_gradient_pct
  from stage_mapping as mapping
  join public.stage_segments as source_segment
    on source_segment.stage_id = mapping.source_stage_id
  on conflict (stage_id, segment_number)
  do update set
    distance_km = excluded.distance_km,
    terrain_type = excluded.terrain_type,
    surface_type = excluded.surface_type,
    average_gradient_pct = excluded.average_gradient_pct;

  with stage_mapping as (
    select
      target_stage.id as target_stage_id,
      source_stage.id as source_stage_id
    from public.race_editions as target_edition
    join public.races as race
      on race.id = target_edition.race_id
    join public.race_editions as source_edition
      on source_edition.race_id = target_edition.race_id
     and source_edition.season_id = p_source_season_id
    join public.stages as target_stage
      on target_stage.race_edition_id = target_edition.id
    join public.stages as source_stage
      on source_stage.race_edition_id = source_edition.id
     and source_stage.stage_number = case
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 7 then 1
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 8 then 2
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 9 then 3
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 10 then 2
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 11 then 5
       when race.slug = 'corsa-delle-regioni' and target_stage.stage_number = 12 then 6
       else target_stage.stage_number
     end
    where target_edition.season_id = p_target_season_id
  ), segment_mapping as (
    select
      target_segment.id as target_segment_id,
      source_segment.id as source_segment_id
    from stage_mapping as mapping
    join public.stage_segments as target_segment
      on target_segment.stage_id = mapping.target_stage_id
    join public.stage_segments as source_segment
      on source_segment.stage_id = mapping.source_stage_id
     and source_segment.segment_number = target_segment.segment_number
  )
  insert into public.stage_segment_primes (
    stage_segment_id,
    prime_type,
    mountain_category,
    points_scale
  )
  select
    mapping.target_segment_id,
    source_prime.prime_type,
    source_prime.mountain_category,
    source_prime.points_scale
  from segment_mapping as mapping
  join public.stage_segment_primes as source_prime
    on source_prime.stage_segment_id = mapping.source_segment_id
  on conflict (stage_segment_id, prime_type)
  do update set
    mountain_category = excluded.mountain_category,
    points_scale = excluded.points_scale;

  insert into public.season_events (
    season_day_id,
    event_type,
    title,
    description,
    href,
    is_filter_persistent,
    participation_rule
  )
  select
    target_day.id,
    source_event.event_type,
    source_event.title,
    source_event.description,
    source_event.href,
    source_event.is_filter_persistent,
    source_event.participation_rule
  from public.season_events as source_event
  join public.season_days as source_day
    on source_day.id = source_event.season_day_id
  join public.season_days as target_day
    on target_day.season_id = p_target_season_id
   and target_day.day_number = source_day.day_number
  where source_day.season_id = p_source_season_id
  on conflict (season_day_id, event_type)
  do update set
    title = excluded.title,
    description = excluded.description,
    href = excluded.href,
    is_filter_persistent = excluded.is_filter_persistent,
    participation_rule = excluded.participation_rule;

  with first_stages as (
    select distinct on (stage.race_edition_id)
      stage.race_edition_id,
      stage.day_slot,
      season_day.calendar_date
    from public.stages as stage
    join public.season_days as season_day
      on season_day.id = stage.season_day_id
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    where edition.season_id = p_target_season_id
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
end;
$$;

create or replace function public.ensure_transfer_next_season(
  p_active_season_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.seasons%rowtype;
  v_next_id uuid;
begin
  select * into v_current
  from public.seasons
  where id = p_active_season_id;

  if v_current is null then
    raise exception 'La saison active est introuvable.';
  end if;

  insert into public.seasons (
    game_year, name, starts_on, ends_on, status, current_day_number
  )
  values (
    v_current.game_year + 1,
    'Saison ' || (v_current.game_year + 1),
    v_current.ends_on + 1,
    v_current.ends_on + 28,
    'planned',
    1
  )
  on conflict (game_year) do update set
    name = excluded.name
  returning id into v_next_id;

  insert into public.season_days (season_id, day_number, calendar_date, label)
  select
    v_next_id,
    day_number,
    v_current.ends_on + day_number,
    'Jour ' || day_number
  from generate_series(1, 28) as day_number
  on conflict (season_id, day_number) do update set
    calendar_date = excluded.calendar_date,
    label = excluded.label;

  perform public.provision_season_race_calendar(v_current.id, v_next_id);

  return v_next_id;
end;
$$;

do $$
declare
  v_active_season_id uuid;
  v_planned_season record;
begin
  select id into v_active_season_id
  from public.seasons
  where status = 'active'
  limit 1;

  if v_active_season_id is null then
    return;
  end if;

  for v_planned_season in
    select id
    from public.seasons
    where status = 'planned'
  loop
    perform public.provision_season_race_calendar(
      v_active_season_id,
      v_planned_season.id
    );
  end loop;
end;
$$;

revoke all
on function public.provision_season_race_calendar(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.provision_season_race_calendar(uuid, uuid)
to service_role;

commit;
