begin;

-- La dernière étape du Grand Tour français de la prochaine saison retrouve
-- une physionomie cérémoniale : une longue approche plate, deux ondulations
-- légères, puis des boucles urbaines avec quelques pavés simples. Le faible
-- kilométrage pavé maintient une arrivée favorable aux sprinteurs sans rendre
-- la compétence PAV inutile dans le final.

create temporary table next_french_gt_finale
on commit drop
as
with active_context as (
  select season.game_year
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1
)
select
  stage.id as stage_id,
  edition.id as race_edition_id,
  season.id as season_id,
  season.game_year
from public.races as race
join public.race_editions as edition on edition.race_id = race.id
join public.seasons as season on season.id = edition.season_id
join public.stages as stage on stage.race_edition_id = edition.id
cross join active_context
where race.slug = 'boucle-des-provinces'
  and season.status = 'planned'
  and season.game_year = active_context.game_year + 1
  and stage.stage_number = 12
  and stage.status = 'planned'
  and not exists (
    select 1
    from public.stage_results as result
    where result.stage_id = stage.id
  )
  and not exists (
    select 1
    from public.official_stage_simulations as simulation
    where simulation.stage_id = stage.id
  );

do $$
begin
  if (select count(*) from next_french_gt_finale) <> 1 then
    raise exception
      'La finale intacte de la Boucle des Provinces de la prochaine saison est introuvable.';
  end if;
end;
$$;

update public.stages as stage
set
  name = 'Paris · Champs-Élysées',
  stage_type = 'road',
  profile_type = 'flat',
  distance_km = 164
from next_french_gt_finale as target
where stage.id = target.stage_id;

-- Les primes liées aux anciens tronçons sont supprimées par cascade. Les
-- inscriptions, rôles et plans de course restent rattachés à l'étape.
delete from public.stage_segments as segment
using next_french_gt_finale as target
where segment.stage_id = target.stage_id;

insert into public.stage_segments (
  stage_id,
  segment_number,
  distance_km,
  terrain_type,
  surface_type,
  average_gradient_pct
)
select
  target.stage_id,
  shape.segment_number,
  shape.distance_km,
  shape.terrain_type,
  shape.surface_type,
  shape.average_gradient_pct
from next_french_gt_finale as target
cross join (
  values
    (1::smallint, 32.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (2::smallint, 18.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (3::smallint,  6.0::numeric, 'climb'::text,   'asphalt'::text,  2.4::numeric),
    (4::smallint,  6.0::numeric, 'descent'::text, 'asphalt'::text, -2.2::numeric),
    (5::smallint, 28.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (6::smallint,  5.0::numeric, 'climb'::text,   'asphalt'::text,  3.0::numeric),
    (7::smallint,  5.0::numeric, 'descent'::text, 'asphalt'::text, -2.8::numeric),
    (8::smallint, 20.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (9::smallint,  8.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (10::smallint, 3.0::numeric, 'flat'::text,    'cobbles'::text,  0.0::numeric),
    (11::smallint, 5.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (12::smallint, 3.0::numeric, 'flat'::text,    'cobbles'::text,  0.0::numeric),
    (13::smallint, 5.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (14::smallint, 3.0::numeric, 'flat'::text,    'cobbles'::text,  0.0::numeric),
    (15::smallint, 5.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (16::smallint, 3.0::numeric, 'flat'::text,    'cobbles'::text,  0.0::numeric),
    (17::smallint, 5.0::numeric, 'flat'::text,    'asphalt'::text,  0.0::numeric),
    (18::smallint, 4.0::numeric, 'flat'::text,    'cobbles'::text,  0.0::numeric)
) as shape(
  segment_number,
  distance_km,
  terrain_type,
  surface_type,
  average_gradient_pct
)
order by shape.segment_number;

with prime_targets as (
  select *
  from (
    values
      (3::smallint, 'mountain'::text, '4'::text, array[1]::smallint[]),
      (5::smallint, 'intermediate_sprint'::text, null::text,
        array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::smallint[]),
      (6::smallint, 'mountain'::text, '4'::text, array[1]::smallint[])
  ) as configured(segment_number, prime_type, mountain_category, points_scale)
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  segment.id,
  prime.prime_type,
  prime.mountain_category,
  prime.points_scale
from next_french_gt_finale as target
join public.stage_segments as segment on segment.stage_id = target.stage_id
join prime_targets as prime on prime.segment_number = segment.segment_number;

do $$
declare
  v_stage_id uuid;
  v_distance numeric;
  v_ascent numeric;
  v_cobbles numeric;
  v_segment_count integer;
  v_first_cobbled_segment integer;
begin
  select target.stage_id
  into strict v_stage_id
  from next_french_gt_finale as target;

  select
    sum(segment.distance_km),
    sum(
      case when segment.terrain_type = 'climb'
        then segment.distance_km * segment.average_gradient_pct * 10
        else 0
      end
    ),
    sum(
      case when segment.surface_type = 'cobbles'
        then segment.distance_km
        else 0
      end
    ),
    count(*),
    min(segment.segment_number) filter (where segment.surface_type = 'cobbles')
  into
    v_distance,
    v_ascent,
    v_cobbles,
    v_segment_count,
    v_first_cobbled_segment
  from public.stage_segments as segment
  where segment.stage_id = v_stage_id;

  if v_distance <> 164
    or v_ascent not between 250 and 350
    or v_cobbles <> 16
    or v_segment_count <> 18
    or v_first_cobbled_segment <> 10
    or exists (
      select 1
      from public.stage_segments as segment
      where segment.stage_id = v_stage_id
        and segment.surface_type = 'cobbles'
        and segment.terrain_type <> 'flat'
    )
  then
    raise exception
      'Le profil Paris · Champs-Élysées est invalide (distance %, D+ %, pavés %, tronçons %, premier pavé %).',
      v_distance,
      v_ascent,
      v_cobbles,
      v_segment_count,
      v_first_cobbled_segment;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
