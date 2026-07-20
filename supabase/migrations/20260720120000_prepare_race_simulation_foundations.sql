begin;

-- ============================================================
-- RÔLES DE COURSE
-- Le rôle « auto » est résolu par le moteur selon les notes du coureur et
-- le profil de l'étape. Les rôles explicites sont conservés avec l'engagement.
-- ============================================================

alter table public.race_rosters
add column race_role text not null default 'auto';

alter table public.race_rosters
add constraint race_rosters_role_allowed
check (
  race_role in (
    'auto',
    'leader',
    'sprinter',
    'leadout',
    'free_agent',
    'domestique',
    'mountain_classification'
  )
);

comment on column public.race_rosters.race_role is
  'Rôle tactique du coureur pour la course ; auto délègue le choix au moteur.';

-- ============================================================
-- POINTS DE PASSAGE : GPM ET SPRINTS INTERMÉDIAIRES
-- Le barème est stocké sur l'événement afin qu'un résultat historique reste
-- explicable même si l'équilibrage global évolue plus tard.
-- ============================================================

create table public.stage_segment_primes (
  id uuid primary key default gen_random_uuid(),

  stage_segment_id uuid not null
    references public.stage_segments(id)
    on delete cascade,

  prime_type text not null,
  mountain_category text,
  points_scale smallint[] not null,

  created_at timestamptz not null default now(),

  constraint stage_segment_primes_type_allowed
    check (prime_type in ('mountain', 'intermediate_sprint')),

  constraint stage_segment_primes_category_matches_type
    check (
      (
        prime_type = 'mountain'
        and mountain_category in ('HC', '1', '2', '3', '4')
      )
      or (
        prime_type = 'intermediate_sprint'
        and mountain_category is null
      )
    ),

  constraint stage_segment_primes_points_not_empty
    check (cardinality(points_scale) > 0),

  constraint stage_segment_primes_points_positive
    check (0 < all(points_scale)),

  constraint stage_segment_primes_unique
    unique (stage_segment_id, prime_type)
);

create index stage_segment_primes_segment_id_idx
  on public.stage_segment_primes (stage_segment_id);

alter table public.stage_segment_primes enable row level security;

grant select on public.stage_segment_primes to authenticated;

create policy stage_segment_primes_select_authenticated
on public.stage_segment_primes
for select
to authenticated
using (true);

comment on table public.stage_segment_primes is
  'GPM et sprints intermédiaires placés à la fin d’un tronçon de course.';

-- ============================================================
-- PROFILS DÉTAILLÉS DU CALENDRIER
-- Toutes les étapes encore planifiées et sans résultat sont reconstruites en
-- tronçons de 10 km. Le dernier tronçon conserve le reliquat exact.
-- ============================================================

delete from public.stage_segments as segment
using public.stages as stage
where stage.id = segment.stage_id
  and stage.status = 'planned'
  and not exists (
    select 1
    from public.stage_results as result
    where result.stage_id = stage.id
  );

with target_stages as (
  select
    stage.id as stage_id,
    stage.profile_type,
    stage.distance_km,
    ceil(stage.distance_km / 10.0)::integer as segment_count
  from public.stages as stage
  where stage.status = 'planned'
    and not exists (
      select 1
      from public.stage_results as result
      where result.stage_id = stage.id
    )
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
            and generated.segment_number % 11 = 0
          then 'climb'
          when generated.segment_number > 2
            and generated.segment_number < generated.segment_count - 1
            and generated.segment_number % 11 = 1
          then 'descent'
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
          when generated.segment_number = 1 then 'flat'
          when generated.segment_number = generated.segment_count then 'climb'
          when generated.segment_number % 6 in (1, 2, 3) then 'climb'
          when generated.segment_number % 6 in (4, 5) then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'cobbles' then
        case generated.segment_number % 5
          when 3 then 'climb'
          when 4 then 'descent'
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
    end as terrain_type,
    case
      when generated.profile_type = 'cobbles'
        and generated.segment_number not in (1, generated.segment_count)
        and generated.segment_number % 3 <> 0
      then 'cobbles'
      else 'asphalt'
    end as surface_type
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
  shaped.surface_type,
  case
    when shaped.terrain_type = 'flat' then 0
    when shaped.terrain_type = 'climb' then
      round((
        case
          when shaped.profile_type = 'mountain' then 5.2
          when shaped.profile_type in ('hilly', 'mixed') then 2.8
          else 1.5
        end
        + ((shaped.segment_number * 37) % 40) / 10.0
      )::numeric, 2)
    else
      -round((
        case
          when shaped.profile_type = 'mountain' then 5.0
          when shaped.profile_type in ('hilly', 'mixed') then 2.6
          else 1.4
        end
        + ((shaped.segment_number * 29) % 32) / 10.0
      )::numeric, 2)
  end
from shaped
order by shaped.stage_id, shaped.segment_number;

-- Sommets : la difficulté associe longueur de l'ascension et pente maximale.
with ordered_segments as (
  select
    segment.*,
    stage.race_edition_id,
    sum(
      case when segment.terrain_type <> 'climb' then 1 else 0 end
    ) over (
      partition by segment.stage_id
      order by segment.segment_number
    ) as climb_group
  from public.stage_segments as segment
  join public.stages as stage
    on stage.id = segment.stage_id
), climbs as (
  select
    ordered.stage_id,
    ordered.race_edition_id,
    ordered.climb_group,
    max(ordered.segment_number) as summit_segment_number,
    sum(ordered.distance_km) as climb_distance_km,
    max(ordered.average_gradient_pct) as maximum_gradient_pct
  from ordered_segments as ordered
  where ordered.terrain_type = 'climb'
  group by
    ordered.stage_id,
    ordered.race_edition_id,
    ordered.climb_group
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
    when 'HC' then array[20, 15, 12, 10, 8, 6, 4, 2]::smallint[]
    when '1' then array[10, 8, 6, 4, 2, 1]::smallint[]
    when '2' then array[5, 3, 2, 1]::smallint[]
    when '3' then array[2, 1]::smallint[]
    else array[1]::smallint[]
  end
from categorized
join public.stage_segments as summit
  on summit.stage_id = categorized.stage_id
 and summit.segment_number = categorized.summit_segment_number
join public.race_editions as edition
  on edition.id = categorized.race_edition_id
join public.races as race
  on race.id = edition.race_id
where race.race_format = 'stage_race';

-- Un sprint intermédiaire est placé près de 42 % de l'étape, sur le tronçon
-- plat disponible le plus proche et jamais sur le dernier tronçon.
with eligible_segments as (
  select
    segment.id as stage_segment_id,
    segment.stage_id,
    segment.segment_number,
    max(segment.segment_number) over (
      partition by segment.stage_id
    ) as segment_count
  from public.stage_segments as segment
  join public.stages as stage
    on stage.id = segment.stage_id
   and stage.stage_type = 'road'
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
   and race.race_format = 'stage_race'
  where segment.terrain_type = 'flat'
    and segment.segment_number > 1
    and not exists (
      select 1
      from public.stage_segment_primes as existing_prime
      where existing_prime.stage_segment_id = segment.id
    )
), candidates as (
  select
    eligible.stage_segment_id,
    eligible.stage_id,
    row_number() over (
      partition by eligible.stage_id
      order by
        abs(
          eligible.segment_number - eligible.segment_count * 0.42
        ),
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
  array[20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]::smallint[]
from candidates
where candidates.preference_rank = 1;

-- ============================================================
-- SAUVEGARDE TRANSACTIONNELLE DE LA COMPOSITION ET DES RÔLES
-- La fonction existante continue d'appliquer les contrôles d'effectif,
-- d'éligibilité, de conflit et de délai. Cette enveloppe ajoute les rôles
-- dans la même transaction.
-- ============================================================

create function public.save_current_team_race_roster_with_roles(
  p_race_edition_id uuid,
  p_roster jsonb
)
returns table (
  registration_id uuid,
  registration_status text,
  registered_rider_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_ids uuid[];
  v_registration_id uuid;
  v_registration_status text;
  v_registered_rider_count integer;
  v_race_format text;
begin
  if p_roster is null
    or jsonb_typeof(p_roster) <> 'array'
    or jsonb_array_length(p_roster) = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'La composition et les rôles transmis sont invalides.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_roster) as entry(value)
    where not (entry.value ->> 'riderId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or coalesce(entry.value ->> 'role', 'auto') not in (
        'auto',
        'leader',
        'sprinter',
        'leadout',
        'free_agent',
        'domestique',
        'mountain_classification'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un coureur ou un rôle transmis est invalide.';
  end if;

  select array_agg((entry.value ->> 'riderId')::uuid order by entry.ordinality)
  into v_rider_ids
  from jsonb_array_elements(p_roster) with ordinality as entry(value, ordinality);

  if cardinality(v_rider_ids) <> (
    select count(distinct rider_id)
    from unnest(v_rider_ids) as selected(rider_id)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'La composition contient un coureur en double.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_roster) as entry(value)
    where entry.value ->> 'role' = 'leader'
  ) > 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Vous ne pouvez désigner qu un seul leader.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_roster) as entry(value)
    where entry.value ->> 'role' = 'sprinter'
  ) > 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Vous ne pouvez désigner qu un seul sprinteur.';
  end if;

  select race.race_format
  into v_race_format
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  where edition.id = p_race_edition_id;

  if v_race_format is distinct from 'stage_race'
    and exists (
      select 1
      from jsonb_array_elements(p_roster) as entry(value)
      where entry.value ->> 'role' = 'mountain_classification'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Le rôle classement montagne est réservé aux tours.';
  end if;

  select
    saved.registration_id,
    saved.registration_status,
    saved.registered_rider_count
  into
    v_registration_id,
    v_registration_status,
    v_registered_rider_count
  from public.save_current_team_race_roster(
    p_race_edition_id,
    v_rider_ids
  ) as saved;

  update public.race_rosters as roster
  set race_role = coalesce(assigned.role, 'auto')
  from (
    select
      (entry.value ->> 'riderId')::uuid as rider_id,
      coalesce(entry.value ->> 'role', 'auto') as role
    from jsonb_array_elements(p_roster) as entry(value)
  ) as assigned
  where roster.race_registration_id = v_registration_id
    and roster.rider_id = assigned.rider_id
    and roster.status = 'confirmed';

  return query
  select
    v_registration_id,
    v_registration_status,
    v_registered_rider_count;
end;
$$;

revoke all
on function public.save_current_team_race_roster_with_roles(uuid, jsonb)
from public, anon;

grant execute
on function public.save_current_team_race_roster_with_roles(uuid, jsonb)
to authenticated;

commit;
