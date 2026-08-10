-- Ajoute le Mondial CLM à J26 14 h, avant la course en ligne de 18 h.
-- Les deux épreuves conservent des sélections nationales indépendantes.

begin;

alter function public.ensure_international_championship_editions(uuid)
rename to ensure_international_championship_editions_base;

revoke all
on function public.ensure_international_championship_editions_base(uuid)
from public, anon, authenticated;

create or replace function public.ensure_world_time_trial_championship(
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_host_country_id uuid;
  v_category_id uuid;
  v_day_id uuid;
  v_departure_at timestamptz;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_distance numeric(6, 2) := 48;
begin
  select season.*
  into v_season
  from public.seasons as season
  where season.id = p_season_id;

  if not found then
    return;
  end if;

  select country.id
  into v_host_country_id
  from public.countries as country
  where country.iso_alpha2 = 'FR';

  select category.id
  into v_category_id
  from public.race_categories as category
  where category.code = 'world'
    and category.is_active = true;

  select
    day.id,
    (
      day.calendar_date::timestamp + interval '14 hours'
    ) at time zone 'Europe/Paris'
  into v_day_id, v_departure_at
  from public.season_days as day
  where day.season_id = v_season.id
    and day.day_number = 26;

  if v_host_country_id is null
    or v_category_id is null
    or v_day_id is null
  then
    raise exception 'Impossible de préparer le Championnat du monde CLM.';
  end if;

  insert into public.races (
    country_id,
    name,
    short_name,
    race_format,
    status,
    slug,
    competition_type,
    championship_continent_code
  )
  values (
    v_host_country_id,
    'Championnats du monde CLM',
    'CM CLM',
    'one_day',
    'active',
    'championnats-du-monde-contre-la-montre',
    'world_championship',
    null
  )
  on conflict (slug)
  do update set
    country_id = excluded.country_id,
    name = excluded.name,
    short_name = excluded.short_name,
    race_format = excluded.race_format,
    status = excluded.status,
    competition_type = excluded.competition_type,
    championship_continent_code = excluded.championship_continent_code
  returning id into v_race_id;

  insert into public.race_editions (
    race_id,
    season_id,
    race_category_id,
    edition_number,
    display_name,
    status,
    registration_closes_at,
    withdrawal_closes_at,
    minimum_reputation,
    registration_policy,
    field_limit
  )
  values (
    v_race_id,
    v_season.id,
    v_category_id,
    greatest(1, v_season.game_year),
    'Championnats du monde CLM',
    'registration_open',
    v_departure_at - interval '24 hours',
    v_departure_at - interval '24 hours',
    0,
    'closed',
    200
  )
  on conflict (race_id, season_id)
  do update set
    race_category_id = excluded.race_category_id,
    edition_number = excluded.edition_number,
    display_name = excluded.display_name,
    registration_closes_at = excluded.registration_closes_at,
    withdrawal_closes_at = excluded.withdrawal_closes_at,
    minimum_reputation = excluded.minimum_reputation,
    registration_policy = excluded.registration_policy,
    field_limit = excluded.field_limit
  returning id into v_edition_id;

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
  values (
    v_edition_id,
    v_day_id,
    1,
    'Championnats du monde CLM',
    'individual_time_trial',
    v_distance,
    'planned',
    v_departure_at,
    'time_trial',
    'early'
  )
  on conflict (race_edition_id, stage_number)
  do update set
    season_day_id = excluded.season_day_id,
    name = excluded.name,
    stage_type = excluded.stage_type,
    distance_km = excluded.distance_km,
    departure_at = excluded.departure_at,
    profile_type = excluded.profile_type,
    day_slot = excluded.day_slot
  returning id into v_stage_id;

  delete from public.stage_segments
  where stage_id = v_stage_id;

  insert into public.stage_segments (
    stage_id,
    segment_number,
    distance_km,
    terrain_type,
    surface_type,
    average_gradient_pct
  )
  select
    v_stage_id,
    generated.segment_number,
    least(6, v_distance - ((generated.segment_number - 1) * 6)),
    case generated.segment_number
      when 3 then 'climb'
      when 4 then 'descent'
      when 6 then 'climb'
      when 7 then 'descent'
      else 'flat'
    end,
    'asphalt',
    case generated.segment_number
      when 3 then 3.2
      when 4 then -3.0
      when 6 then 2.8
      when 7 then -2.6
      else 0
    end
  from generate_series(1, ceil(v_distance / 6.0)::integer)
    as generated(segment_number);
end;
$$;

revoke all
on function public.ensure_world_time_trial_championship(uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_world_time_trial_championship(uuid)
to service_role;

create or replace function public.ensure_international_championship_editions(
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_international_championship_editions_base(p_season_id);
  perform public.ensure_world_time_trial_championship(p_season_id);

  update public.races
  set
    name = 'Championnats du monde en ligne',
    short_name = 'CM route'
  where slug = 'championnats-du-monde';

  update public.race_editions as edition
  set display_name = 'Championnats du monde en ligne'
  from public.races as race
  where race.id = edition.race_id
    and race.slug = 'championnats-du-monde'
    and edition.season_id = p_season_id;

  update public.stages as stage
  set name = 'Championnats du monde en ligne'
  from public.race_editions as edition,
       public.races as race
  where edition.id = stage.race_edition_id
    and race.id = edition.race_id
    and race.slug = 'championnats-du-monde'
    and edition.season_id = p_season_id;
end;
$$;

revoke all
on function public.ensure_international_championship_editions(uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_international_championship_editions(uuid)
to service_role;

create or replace function public.rerank_world_time_trial_selection(
  p_nation_selection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.international_championship_nation_selections as selection
    join public.race_editions as edition
      on edition.id = selection.race_edition_id
    join public.races as race
      on race.id = edition.race_id
    join public.stages as stage
      on stage.race_edition_id = edition.id
    where selection.id = p_nation_selection_id
      and race.slug = 'championnats-du-monde-contre-la-montre'
      and stage.stage_type = 'individual_time_trial'
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.international_championship_rider_selections as candidate
    join public.international_championship_nation_selections as selection
      on selection.id = candidate.nation_selection_id
    join public.race_editions as edition
      on edition.id = selection.race_edition_id
    join public.rider_season_ratings as rating
      on rating.rider_id = candidate.rider_id
     and rating.season_id = edition.season_id
    where candidate.nation_selection_id = p_nation_selection_id
      and candidate.overall_rating is distinct from round(
        (
          rating.time_trial * 0.62
          + rating.prologue * 0.13
          + rating.flat * 0.10
          + rating.endurance * 0.10
          + rating.recovery * 0.05
        )::numeric,
        2
      )
  ) then
    return false;
  end if;

  update public.international_championship_rider_selections
  set rider_rank = rider_rank + 10000
  where nation_selection_id = p_nation_selection_id;

  with ranked as (
    select
      candidate.id,
      (
        row_number() over (
          order by
            rating.time_trial desc,
            rating.prologue desc,
            rating.flat desc,
            rating.endurance desc,
            candidate.uci_points desc,
            rider.last_name,
            rider.first_name,
            rider.id
        )
      )::integer as new_rank,
      round(
        (
          rating.time_trial * 0.62
          + rating.prologue * 0.13
          + rating.flat * 0.10
          + rating.endurance * 0.10
          + rating.recovery * 0.05
        )::numeric,
        2
      ) as time_trial_rating
    from public.international_championship_rider_selections as candidate
    join public.international_championship_nation_selections as selection
      on selection.id = candidate.nation_selection_id
    join public.race_editions as edition
      on edition.id = selection.race_edition_id
    join public.riders as rider
      on rider.id = candidate.rider_id
    join public.rider_season_ratings as rating
      on rating.rider_id = rider.id
     and rating.season_id = edition.season_id
    where candidate.nation_selection_id = p_nation_selection_id
  )
  update public.international_championship_rider_selections as candidate
  set
    rider_rank = ranked.new_rank,
    overall_rating = ranked.time_trial_rating
  from ranked
  where candidate.id = ranked.id;

  return true;
end;
$$;

revoke all
on function public.rerank_world_time_trial_selection(uuid)
from public, anon, authenticated;

grant execute
on function public.rerank_world_time_trial_selection(uuid)
to service_role;

alter function public.prioritize_international_championship_rider(uuid, uuid)
rename to prioritize_international_championship_rider_base;

revoke all
on function public.prioritize_international_championship_rider_base(uuid, uuid)
from public, anon, authenticated;

create or replace function public.prioritize_international_championship_rider(
  p_nation_selection_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_world_championship boolean := false;
begin
  select race.competition_type = 'world_championship'
  into v_is_world_championship
  from public.international_championship_nation_selections as selection
  join public.race_editions as edition
    on edition.id = selection.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where selection.id = p_nation_selection_id;

  perform public.prioritize_international_championship_rider_base(
    p_nation_selection_id,
    p_rider_id
  );

  if coalesce(v_is_world_championship, false) then
    update public.race_rosters as roster
    set status = 'confirmed'
    from public.race_registrations as registration,
         public.race_editions as edition,
         public.races as race,
         public.international_championship_nation_selections as selection,
         public.international_championship_rider_selections as candidate
    where registration.id = roster.race_registration_id
      and edition.id = registration.race_edition_id
      and race.id = edition.race_id
      and race.competition_type = 'world_championship'
      and selection.race_edition_id = edition.id
      and candidate.nation_selection_id = selection.id
      and candidate.rider_id = p_rider_id
      and candidate.rider_id = roster.rider_id
      and candidate.is_selected = true
      and candidate.response_status not in (
        'declined',
        'ineligible_injury',
        'unavailable'
      );

    update public.race_registrations as registration
    set
      status = 'accepted',
      decided_at = now()
    where registration.entry_method = 'automatic'
      and exists (
        select 1
        from public.race_editions as edition
        join public.races as race
          on race.id = edition.race_id
        where edition.id = registration.race_edition_id
          and race.competition_type = 'world_championship'
      )
      and exists (
        select 1
        from public.race_rosters as roster
        where roster.race_registration_id = registration.id
          and roster.rider_id = p_rider_id
          and roster.status = 'confirmed'
      );
  end if;
end;
$$;

revoke all
on function public.prioritize_international_championship_rider(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.prioritize_international_championship_rider(uuid, uuid)
to service_role;

-- Le classement CLM est appliqué dans la même transaction que la création
-- des candidats, avant que le moteur ne compose les huit titulaires.
create or replace function public.rerank_world_time_trial_candidates_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nation_selection_id uuid;
begin
  for v_nation_selection_id in
    select distinct candidate.nation_selection_id
    from inserted_candidates as candidate
  loop
    perform public.rerank_world_time_trial_selection(v_nation_selection_id);
  end loop;

  return null;
end;
$$;

revoke all
on function public.rerank_world_time_trial_candidates_after_insert()
from public, anon, authenticated;

drop trigger if exists rerank_world_time_trial_candidates_after_insert
on public.international_championship_rider_selections;

create trigger rerank_world_time_trial_candidates_after_insert
after insert
on public.international_championship_rider_selections
referencing new table as inserted_candidates
for each statement
execute function public.rerank_world_time_trial_candidates_after_insert();

alter function public.process_due_international_championship_selections(timestamptz)
rename to process_due_international_championship_selections_base;

revoke all
on function public.process_due_international_championship_selections_base(timestamptz)
from public, anon, authenticated;

create or replace function public.process_due_international_championship_selections(
  p_now timestamptz default now()
)
returns table (
  created_nation_selections integer,
  finalized_nation_selections integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_selection record;
  v_selected_rider_id uuid;
  v_was_reranked boolean;
begin
  select *
  into v_result
  from public.process_due_international_championship_selections_base(p_now);

  for v_selection in
    select
      selection.id,
      stage.departure_at
    from public.international_championship_nation_selections as selection
    join public.race_editions as edition
      on edition.id = selection.race_edition_id
    join public.seasons as season
      on season.id = edition.season_id
     and season.status = 'active'
    join public.races as race
      on race.id = edition.race_id
     and race.slug = 'championnats-du-monde-contre-la-montre'
    join public.stages as stage
      on stage.race_edition_id = edition.id
    where stage.departure_at <= p_now + interval '24 hours'
    order by selection.nation_rank
  loop
    v_was_reranked :=
      public.rerank_world_time_trial_selection(v_selection.id);

    if v_was_reranked then
      perform public.sync_international_championship_lineup(v_selection.id);
    end if;

    if v_was_reranked and v_selection.departure_at <= p_now then
      update public.international_championship_rider_selections
      set
        response_status = 'automatic',
        responded_at = coalesce(responded_at, p_now)
      where nation_selection_id = v_selection.id
        and is_selected = true
        and response_status = 'pending';

      for v_selected_rider_id in
        select candidate.rider_id
        from public.international_championship_rider_selections as candidate
        where candidate.nation_selection_id = v_selection.id
          and candidate.is_selected = true
          and candidate.response_status in ('confirmed', 'automatic')
      loop
        perform public.prioritize_international_championship_rider(
          v_selection.id,
          v_selected_rider_id
        );
      end loop;
    end if;
  end loop;

  return query
  select
    coalesce(v_result.created_nation_selections, 0),
    coalesce(v_result.finalized_nation_selections, 0);
end;
$$;

revoke all
on function public.process_due_international_championship_selections(timestamptz)
from public, anon, authenticated;

grant execute
on function public.process_due_international_championship_selections(timestamptz)
to service_role;

do $$
declare
  v_season_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status = 'active'
  loop
    perform public.ensure_international_championship_editions(v_season_id);
  end loop;
end;
$$;

update public.season_events
set
  title = 'Championnats du monde — CLM & course en ligne',
  description = 'Le CLM mondial se dispute à 14 h, puis la course en ligne à 18 h. Les 20 meilleures nations sélectionnent automatiquement leurs huit meilleurs coureurs à H-24.',
  href = '/jeu/selections-internationales'
where event_type = 'world_championships';

commit;
