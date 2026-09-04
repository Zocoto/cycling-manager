begin;

-- À compter de la prochaine saison, les trois Grands Tours privilégient la
-- moyenne et la haute montagne sans supprimer les journées de plaine. Les
-- saisons actives et les simulations historiques sont volontairement exclues.

create temporary table future_gt_profile_shape (
  shape_code text primary key,
  stage_type text not null check (
    stage_type in ('road', 'individual_time_trial')
  ),
  profile_type text not null check (
    profile_type in ('flat', 'hilly', 'mountain', 'time_trial')
  ),
  difficulty_band text not null check (
    difficulty_band in ('flat', 'hilly', 'medium_mountain', 'high_mountain', 'time_trial')
  ),
  segments jsonb not null check (
    jsonb_typeof(segments) = 'array'
    and jsonb_array_length(segments) between 1 and 24
  )
) on commit drop;

insert into future_gt_profile_shape (
  shape_code,
  stage_type,
  profile_type,
  difficulty_band,
  segments
)
values
  ('gt-flat-a-175', 'road', 'flat', 'flat',
   '[{"d":28,"t":"flat"},{"d":26,"t":"flat"},{"d":5,"t":"climb","g":2.8,"p":"4"},{"d":5,"t":"descent","g":-2.8},{"d":32,"t":"flat","p":"sprint"},{"d":24,"t":"flat"},{"d":30,"t":"flat"},{"d":25,"t":"flat"}]'),
  ('gt-flat-b-182', 'road', 'flat', 'flat',
   '[{"d":30,"t":"flat"},{"d":25,"t":"flat"},{"d":6,"t":"climb","g":3.2,"p":"4"},{"d":6,"t":"descent","g":-3.0},{"d":32,"t":"flat","p":"sprint"},{"d":28,"t":"flat"},{"d":30,"t":"flat"},{"d":25,"t":"flat"}]'),
  ('gt-hilly-a-168', 'road', 'hilly', 'hilly',
   '[{"d":30,"t":"flat"},{"d":8,"t":"climb","g":4.8,"p":"3"},{"d":7,"t":"descent","g":-4.6},{"d":16,"t":"flat","p":"sprint"},{"d":6,"t":"climb","g":6.5,"p":"2"},{"d":6,"t":"descent","g":-6.0},{"d":14,"t":"flat"},{"d":5,"t":"climb","g":8.0,"p":"2"},{"d":5,"t":"descent","g":-7.4},{"d":12,"t":"flat"},{"d":7,"t":"climb","g":5.8,"p":"2"},{"d":6,"t":"descent","g":-5.5},{"d":18,"t":"flat"},{"d":8,"t":"climb","g":7.2,"p":"2"},{"d":20,"t":"flat"}]'),
  ('gt-hilly-b-170', 'road', 'hilly', 'hilly',
   '[{"d":25,"t":"flat"},{"d":10,"t":"climb","g":4.5,"p":"2"},{"d":8,"t":"descent","g":-4.4},{"d":20,"t":"flat","p":"sprint"},{"d":8,"t":"climb","g":6.0,"p":"2"},{"d":7,"t":"descent","g":-5.8},{"d":15,"t":"flat"},{"d":6,"t":"climb","g":8.5,"p":"2"},{"d":6,"t":"descent","g":-8.0},{"d":12,"t":"flat"},{"d":10,"t":"climb","g":5.5,"p":"2"},{"d":8,"t":"descent","g":-5.3},{"d":15,"t":"flat"},{"d":5,"t":"climb","g":10.0,"p":"2"},{"d":15,"t":"flat"}]'),
  ('gt-medium-mountain-a-186', 'road', 'mountain', 'medium_mountain',
   '[{"d":20,"t":"flat"},{"d":14,"t":"climb","g":5.6,"p":"2"},{"d":12,"t":"descent","g":-5.3},{"d":10,"t":"flat"},{"d":16,"t":"climb","g":6.2,"p":"1"},{"d":14,"t":"descent","g":-6.0},{"d":15,"t":"flat","p":"sprint"},{"d":12,"t":"climb","g":6.8,"p":"1"},{"d":10,"t":"descent","g":-6.5},{"d":8,"t":"flat"},{"d":18,"t":"climb","g":6.4,"p":"1"},{"d":14,"t":"descent","g":-6.1},{"d":8,"t":"flat"},{"d":10,"t":"climb","g":7.5,"p":"1"},{"d":5,"t":"descent","g":-7.0}]'),
  ('gt-medium-mountain-b-184', 'road', 'mountain', 'medium_mountain',
   '[{"d":25,"t":"flat"},{"d":10,"t":"climb","g":5.0,"p":"2"},{"d":8,"t":"descent","g":-4.8},{"d":18,"t":"flat","p":"sprint"},{"d":14,"t":"climb","g":6.0,"p":"1"},{"d":12,"t":"descent","g":-5.8},{"d":10,"t":"flat"},{"d":12,"t":"climb","g":7.0,"p":"1"},{"d":10,"t":"descent","g":-6.7},{"d":10,"t":"flat"},{"d":16,"t":"climb","g":6.5,"p":"1"},{"d":14,"t":"descent","g":-6.2},{"d":14,"t":"flat"},{"d":11,"t":"climb","g":8.0,"p":"1"}]'),
  ('gt-high-mountain-a-180', 'road', 'mountain', 'high_mountain',
   '[{"d":20,"t":"flat"},{"d":18,"t":"climb","g":5.8,"p":"1"},{"d":15,"t":"descent","g":-5.6},{"d":12,"t":"flat","p":"sprint"},{"d":16,"t":"climb","g":7.2,"p":"HC"},{"d":14,"t":"descent","g":-6.8},{"d":10,"t":"flat"},{"d":20,"t":"climb","g":7.5,"p":"HC"},{"d":17,"t":"descent","g":-7.1},{"d":8,"t":"flat"},{"d":16,"t":"climb","g":8.6,"p":"HC"},{"d":14,"t":"descent","g":-8.0}]'),
  ('gt-high-mountain-b-186', 'road', 'mountain', 'high_mountain',
   '[{"d":18,"t":"flat"},{"d":20,"t":"climb","g":6.0,"p":"1"},{"d":16,"t":"descent","g":-5.8},{"d":10,"t":"flat"},{"d":15,"t":"flat","p":"sprint"},{"d":18,"t":"climb","g":7.5,"p":"HC"},{"d":15,"t":"descent","g":-7.1},{"d":8,"t":"flat"},{"d":22,"t":"climb","g":7.8,"p":"HC"},{"d":18,"t":"descent","g":-7.4},{"d":8,"t":"flat"},{"d":18,"t":"climb","g":9.0,"p":"HC"}]'),
  ('gt-itt-flat-36', 'individual_time_trial', 'time_trial', 'time_trial',
   '[{"d":6,"t":"flat"},{"d":6,"t":"flat"},{"d":6,"t":"flat"},{"d":6,"t":"flat"},{"d":6,"t":"flat"},{"d":6,"t":"flat"}]'),
  ('gt-itt-climbing-31', 'individual_time_trial', 'time_trial', 'time_trial',
   '[{"d":8,"t":"flat"},{"d":6,"t":"flat"},{"d":6,"t":"climb","g":4.5},{"d":6,"t":"climb","g":6.5},{"d":5,"t":"climb","g":8.0}]');

do $$
declare
  v_shape record;
  v_segment jsonb;
  v_distance numeric;
  v_ascent numeric;
begin
  if (select count(*) from future_gt_profile_shape) <> 10 then
    raise exception 'Le catalogue des Grands Tours doit contenir dix profils.';
  end if;

  for v_shape in select * from future_gt_profile_shape loop
    v_distance := 0;
    v_ascent := 0;

    for v_segment in select value from jsonb_array_elements(v_shape.segments) loop
      if coalesce((v_segment ->> 'd')::numeric, 0) <= 0
        or coalesce(v_segment ->> 't', '') not in ('flat', 'climb', 'descent')
        or (
          coalesce(v_segment ->> 't', '') = 'flat'
          and coalesce((v_segment ->> 'g')::numeric, 0) <> 0
        )
        or (
          coalesce(v_segment ->> 't', '') = 'climb'
          and coalesce((v_segment ->> 'g')::numeric, 0) <= 0
        )
        or (
          coalesce(v_segment ->> 't', '') = 'descent'
          and coalesce((v_segment ->> 'g')::numeric, 0) >= 0
        )
        or coalesce(v_segment ->> 'p', '1') not in ('sprint', 'HC', '1', '2', '3', '4')
      then
        raise exception 'Le profil % contient un tronçon invalide.', v_shape.shape_code;
      end if;

      v_distance := v_distance + (v_segment ->> 'd')::numeric;
      if v_segment ->> 't' = 'climb' then
        v_ascent := v_ascent
          + (v_segment ->> 'd')::numeric
          * (v_segment ->> 'g')::numeric
          * 10;
      end if;
    end loop;

    if v_distance not between 25 and 220 then
      raise exception 'La distance du profil % sort des bornes.', v_shape.shape_code;
    end if;
    if v_shape.difficulty_band = 'medium_mountain' and v_ascent < 4000 then
      raise exception 'La moyenne montagne % doit dépasser 4 000 m.', v_shape.shape_code;
    end if;
    if v_shape.difficulty_band = 'high_mountain' and v_ascent < 5000 then
      raise exception 'La haute montagne % doit dépasser 5 000 m.', v_shape.shape_code;
    end if;
  end loop;
end;
$$;

create temporary table future_gt_stage_target (
  race_slug text not null,
  stage_number smallint not null,
  shape_code text not null references future_gt_profile_shape(shape_code),
  primary key (race_slug, stage_number)
) on commit drop;

insert into future_gt_stage_target values
  -- Corsa : quatre montagnes (deux moyennes, deux hautes), quatre plaines,
  -- deux vallons et deux chronos.
  ('corsa-delle-regioni', 1, 'gt-flat-a-175'),
  ('corsa-delle-regioni', 2, 'gt-hilly-a-168'),
  ('corsa-delle-regioni', 3, 'gt-medium-mountain-a-186'),
  ('corsa-delle-regioni', 4, 'gt-itt-flat-36'),
  ('corsa-delle-regioni', 5, 'gt-high-mountain-a-180'),
  ('corsa-delle-regioni', 6, 'gt-flat-b-182'),
  ('corsa-delle-regioni', 7, 'gt-medium-mountain-b-184'),
  ('corsa-delle-regioni', 8, 'gt-hilly-b-170'),
  ('corsa-delle-regioni', 9, 'gt-flat-a-175'),
  ('corsa-delle-regioni', 10, 'gt-itt-climbing-31'),
  ('corsa-delle-regioni', 11, 'gt-high-mountain-b-186'),
  ('corsa-delle-regioni', 12, 'gt-flat-b-182'),

  -- Boucle : même équilibre, avec la haute montagne placée plus tôt et une
  -- dernière étape de moyenne montagne au lieu d'un sprint cérémonial.
  ('boucle-des-provinces', 1, 'gt-hilly-b-170'),
  ('boucle-des-provinces', 2, 'gt-flat-b-182'),
  ('boucle-des-provinces', 3, 'gt-high-mountain-a-180'),
  ('boucle-des-provinces', 4, 'gt-itt-flat-36'),
  ('boucle-des-provinces', 5, 'gt-flat-a-175'),
  ('boucle-des-provinces', 6, 'gt-medium-mountain-a-186'),
  ('boucle-des-provinces', 7, 'gt-flat-b-182'),
  ('boucle-des-provinces', 8, 'gt-hilly-a-168'),
  ('boucle-des-provinces', 9, 'gt-high-mountain-b-186'),
  ('boucle-des-provinces', 10, 'gt-flat-a-175'),
  ('boucle-des-provinces', 11, 'gt-itt-climbing-31'),
  ('boucle-des-provinces', 12, 'gt-medium-mountain-b-184'),

  -- Ruta : le GT le plus montagneux, avec cinq journées de montagne, trois
  -- vallons, trois plaines et un unique chrono en côte.
  ('ruta-de-las-sierras', 1, 'gt-hilly-a-168'),
  ('ruta-de-las-sierras', 2, 'gt-flat-b-182'),
  ('ruta-de-las-sierras', 3, 'gt-medium-mountain-b-184'),
  ('ruta-de-las-sierras', 4, 'gt-flat-a-175'),
  ('ruta-de-las-sierras', 5, 'gt-high-mountain-a-180'),
  ('ruta-de-las-sierras', 6, 'gt-itt-climbing-31'),
  ('ruta-de-las-sierras', 7, 'gt-hilly-b-170'),
  ('ruta-de-las-sierras', 8, 'gt-medium-mountain-a-186'),
  ('ruta-de-las-sierras', 9, 'gt-flat-b-182'),
  ('ruta-de-las-sierras', 10, 'gt-high-mountain-a-180'),
  ('ruta-de-las-sierras', 11, 'gt-high-mountain-b-186'),
  ('ruta-de-las-sierras', 12, 'gt-hilly-a-168');

do $$
begin
  if (select count(*) from future_gt_stage_target) <> 36 then
    raise exception 'Les trois Grands Tours doivent couvrir exactement 36 étapes.';
  end if;

  if exists (
    with distribution as (
      select
        target.race_slug,
        count(*) filter (where shape.profile_type = 'flat') as flat_count,
        count(*) filter (where shape.profile_type = 'hilly') as hilly_count,
        count(*) filter (where shape.profile_type = 'mountain') as mountain_count,
        count(*) filter (where shape.profile_type = 'time_trial') as time_trial_count,
        count(*) filter (where shape.difficulty_band = 'medium_mountain') as medium_count,
        count(*) filter (where shape.difficulty_band = 'high_mountain') as high_count
      from future_gt_stage_target as target
      join future_gt_profile_shape as shape on shape.shape_code = target.shape_code
      group by target.race_slug
    )
    select 1
    from distribution
    where case race_slug
      when 'ruta-de-las-sierras' then
        (flat_count, hilly_count, mountain_count, time_trial_count, medium_count, high_count)
          is distinct from (3::bigint, 3::bigint, 5::bigint, 1::bigint, 2::bigint, 3::bigint)
      else
        (flat_count, hilly_count, mountain_count, time_trial_count, medium_count, high_count)
          is distinct from (4::bigint, 2::bigint, 4::bigint, 2::bigint, 2::bigint, 2::bigint)
    end
  ) then
    raise exception 'La répartition sportive d’un Grand Tour est invalide.';
  end if;
end;
$$;

create temporary table resolved_future_gt_stage_target
on commit drop
as
with active_context as (
  select game_year
  from public.seasons
  where status = 'active'
  order by game_year desc
  limit 1
)
select
  stage.id as stage_id,
  edition.id as race_edition_id,
  target.race_slug,
  target.stage_number,
  target.shape_code
from future_gt_stage_target as target
join public.races as race on race.slug = target.race_slug
join public.race_editions as edition on edition.race_id = race.id
join public.seasons as season on season.id = edition.season_id
join public.stages as stage
  on stage.race_edition_id = edition.id
 and stage.stage_number = target.stage_number
cross join active_context
where season.status = 'planned'
  and season.game_year = active_context.game_year + 1
  and stage.status = 'planned'
  and not exists (
    select 1 from public.stage_results as result where result.stage_id = stage.id
  )
  and not exists (
    select 1
    from public.official_stage_simulations as simulation
    where simulation.stage_id = stage.id
  );

do $$
begin
  if (select count(*) from resolved_future_gt_stage_target) <> 36 then
    raise exception 'Les 36 étapes de la prochaine saison doivent être intactes et modifiables.';
  end if;
end;
$$;

update public.stages as stage
set
  stage_type = shape.stage_type,
  profile_type = shape.profile_type,
  distance_km = distance.total_distance
from resolved_future_gt_stage_target as target
join future_gt_profile_shape as shape on shape.shape_code = target.shape_code
cross join lateral (
  select sum((segment.value ->> 'd')::numeric) as total_distance
  from jsonb_array_elements(shape.segments) as segment(value)
) as distance
where stage.id = target.stage_id;

-- Les primes sont supprimées en cascade avec les anciens tronçons. Les plans de
-- course et les inscriptions, rattachés à l'étape elle-même, sont conservés.
delete from public.stage_segments as segment
using resolved_future_gt_stage_target as target
where segment.stage_id = target.stage_id;

with expanded_segments as (
  select
    target.stage_id,
    segment.ordinality::smallint as segment_number,
    (segment.value ->> 'd')::numeric(5, 2) as distance_km,
    segment.value ->> 't' as terrain_type,
    coalesce((segment.value ->> 'g')::numeric, 0)::numeric(5, 2)
      as average_gradient_pct
  from resolved_future_gt_stage_target as target
  join future_gt_profile_shape as shape on shape.shape_code = target.shape_code
  cross join lateral jsonb_array_elements(shape.segments)
    with ordinality as segment(value, ordinality)
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
  expanded.stage_id,
  expanded.segment_number,
  expanded.distance_km,
  expanded.terrain_type,
  'asphalt',
  expanded.average_gradient_pct
from expanded_segments as expanded
order by expanded.stage_id, expanded.segment_number;

with expanded_primes as (
  select
    target.stage_id,
    segment.ordinality::smallint as segment_number,
    segment.value ->> 'p' as prime_code
  from resolved_future_gt_stage_target as target
  join future_gt_profile_shape as shape on shape.shape_code = target.shape_code
  cross join lateral jsonb_array_elements(shape.segments)
    with ordinality as segment(value, ordinality)
  where segment.value ? 'p'
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  segment.id,
  case when prime.prime_code = 'sprint' then 'intermediate_sprint' else 'mountain' end,
  case when prime.prime_code = 'sprint' then null else prime.prime_code end,
  case prime.prime_code
    when 'sprint' then array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::smallint[]
    when 'HC' then array[20,15,12,10,8,6,4,2]::smallint[]
    when '1' then array[10,8,6,4,2,1]::smallint[]
    when '2' then array[5,3,2,1]::smallint[]
    when '3' then array[2,1]::smallint[]
    else array[1]::smallint[]
  end
from expanded_primes as prime
join public.stage_segments as segment
  on segment.stage_id = prime.stage_id
 and segment.segment_number = prime.segment_number;

do $$
begin
  if exists (
    select 1
    from resolved_future_gt_stage_target as target
    join public.stages as stage on stage.id = target.stage_id
    left join (
      select segment.stage_id, sum(segment.distance_km) as segment_distance
      from public.stage_segments as segment
      group by segment.stage_id
    ) as distance on distance.stage_id = stage.id
    where distance.segment_distance is distinct from stage.distance_km
  ) then
    raise exception 'Un profil de Grand Tour ne totalise pas la distance de son étape.';
  end if;

  if (
    select count(*)
    from public.stage_segments as segment
    join resolved_future_gt_stage_target as target on target.stage_id = segment.stage_id
  ) <> 391 then
    raise exception 'Les nouveaux profils des Grands Tours doivent contenir 391 tronçons.';
  end if;
end;
$$;

comment on table public.stages is
  'Étapes du calendrier ; à compter de la S3, les Grands Tours alternent plaine, moyenne montagne exigeante et haute montagne.';

notify pgrst, 'reload schema';

commit;
