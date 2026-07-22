begin;

-- Une édition peut occuper les deux vagues d'une même journée. Le contrôle
-- différé autorise le déplacement atomique de plusieurs étapes d'un tour.
alter table public.stages
  drop constraint if exists stages_day_unique;

alter table public.stages
  drop constraint if exists stages_day_slot_unique;

alter table public.stages
  add constraint stages_day_slot_unique
    unique (race_edition_id, season_day_id, day_slot)
    deferrable initially deferred;

create or replace function public.compact_planned_stage_races(
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  set constraints public.stages_day_slot_unique deferred;

  with compactable_editions as (
    select
      edition.id as race_edition_id,
      edition.season_id,
      min(season_day.day_number)::integer as start_day,
      max(stage.stage_number)::integer as last_stage_number
    from public.race_editions as edition
    join public.races as race
      on race.id = edition.race_id
     and race.race_format = 'stage_race'
    join public.stages as stage
      on stage.race_edition_id = edition.id
    join public.season_days as season_day
      on season_day.id = stage.season_day_id
    where edition.season_id = p_season_id
      and edition.status not in ('completed', 'cancelled', 'in_progress')
      and not exists (
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
    group by edition.id, edition.season_id
    having min(season_day.day_number) + ((max(stage.stage_number) - 1) / 2) <= 28
  ), compacted_stages as (
    select
      stage.id as stage_id,
      target_day.id as season_day_id,
      target_day.calendar_date,
      case mod(stage.stage_number - 1, 2)
        when 0 then 'early'
        else 'late'
      end as day_slot
    from compactable_editions as compactable
    join public.stages as stage
      on stage.race_edition_id = compactable.race_edition_id
    join public.season_days as target_day
      on target_day.season_id = compactable.season_id
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
    where target_edition.season_id = p_season_id
      and target_edition.status not in ('completed', 'cancelled', 'in_progress')
      and not exists (
        select 1
        from public.stages as started_stage
        where started_stage.race_edition_id = target_edition.id
          and started_stage.status <> 'planned'
      )
      and not exists (
        select 1
        from public.stage_results as result
        join public.stages as result_stage
          on result_stage.id = result.stage_id
        where result_stage.race_edition_id = target_edition.id
      )
    order by stage.race_edition_id, stage.stage_number
  ) as first_stage
  where edition.id = first_stage.race_edition_id;
end;
$$;

comment on function public.compact_planned_stage_races(uuid) is
  'Packs every untouched stage race into consecutive AM/PM half-day slots.';

do $$
declare
  target_season record;
begin
  for target_season in
    select id
    from public.seasons
    where status in ('active', 'planned')
  loop
    perform public.compact_planned_stage_races(target_season.id);
  end loop;
end;
$$;

-- La provision est redéfinie dans une nouvelle migration : certaines bases
-- avaient enregistré une ancienne version de la migration initiale, dépourvue
-- de cette fonction. La copie est donc autonome et reproductible ici.
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
    select 1
    from public.season_days
    where season_id = p_target_season_id
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
    display_name = excluded.display_name,
    minimum_reputation = excluded.minimum_reputation,
    registration_policy = excluded.registration_policy,
    field_limit = excluded.field_limit;

  with source_contexts as (
    select
      source_edition.id as source_edition_id,
      source_edition.race_id,
      race.slug,
      race.race_format,
      min(source_day.day_number)::integer as start_day,
      max(source_stage.stage_number)::integer as source_stage_count,
      case
        when race.slug in (
          'corsa-delle-regioni',
          'boucle-des-provinces',
          'ruta-de-las-sierras'
        ) then 12
        else max(source_stage.stage_number)::integer
      end as target_stage_count
    from public.race_editions as source_edition
    join public.races as race
      on race.id = source_edition.race_id
    join public.stages as source_stage
      on source_stage.race_edition_id = source_edition.id
    join public.season_days as source_day
      on source_day.id = source_stage.season_day_id
    where source_edition.season_id = p_source_season_id
    group by source_edition.id, source_edition.race_id, race.slug, race.race_format
  ), stage_templates as (
    select
      context.race_id,
      context.race_format,
      context.start_day,
      generated.stage_number,
      source_stage.id as source_stage_id,
      source_stage.stage_type,
      source_stage.distance_km,
      source_stage.profile_type,
      source_stage.day_slot as source_day_slot,
      source_day.day_number as source_day_number
    from source_contexts as context
    cross join lateral generate_series(
      1,
      context.target_stage_count
    ) as generated(stage_number)
    join public.stages as source_stage
      on source_stage.race_edition_id = context.source_edition_id
     and source_stage.stage_number = case
       when generated.stage_number <= context.source_stage_count
         then generated.stage_number
       else ((generated.stage_number - 1) % context.source_stage_count) + 1
     end
    join public.season_days as source_day
      on source_day.id = source_stage.season_day_id
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
      when template.race_format = 'one_day' then target_edition.display_name
      else 'Étape ' || template.stage_number
    end,
    template.stage_type,
    template.distance_km,
    'planned',
    (
      target_day.calendar_date::timestamp
      + case schedule.day_slot
          when 'early' then time '14:00'
          else time '18:00'
        end
    ) at time zone 'Europe/Paris',
    template.profile_type,
    schedule.day_slot
  from stage_templates as template
  join public.race_editions as target_edition
    on target_edition.race_id = template.race_id
   and target_edition.season_id = p_target_season_id
  cross join lateral (
    select
      case
        when template.race_format = 'stage_race'
          then template.start_day + ((template.stage_number - 1) / 2)
        else template.source_day_number
      end as day_number,
      case
        when template.race_format = 'stage_race'
          then case mod(template.stage_number - 1, 2)
            when 0 then 'early'
            else 'late'
          end
        else template.source_day_slot
      end as day_slot
  ) as schedule
  join public.season_days as target_day
    on target_day.season_id = p_target_season_id
   and target_day.day_number = schedule.day_number
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

  with source_contexts as (
    select
      source_edition.id as source_edition_id,
      source_edition.race_id,
      max(source_stage.stage_number)::integer as source_stage_count
    from public.race_editions as source_edition
    join public.stages as source_stage
      on source_stage.race_edition_id = source_edition.id
    where source_edition.season_id = p_source_season_id
    group by source_edition.id, source_edition.race_id
  ), stage_mapping as (
    select
      target_stage.id as target_stage_id,
      source_stage.id as source_stage_id
    from source_contexts as context
    join public.race_editions as target_edition
      on target_edition.race_id = context.race_id
     and target_edition.season_id = p_target_season_id
    join public.stages as target_stage
      on target_stage.race_edition_id = target_edition.id
    join public.stages as source_stage
      on source_stage.race_edition_id = context.source_edition_id
     and source_stage.stage_number = case
       when target_stage.stage_number <= context.source_stage_count
         then target_stage.stage_number
       else ((target_stage.stage_number - 1) % context.source_stage_count) + 1
     end
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

  with source_contexts as (
    select
      source_edition.id as source_edition_id,
      source_edition.race_id,
      max(source_stage.stage_number)::integer as source_stage_count
    from public.race_editions as source_edition
    join public.stages as source_stage
      on source_stage.race_edition_id = source_edition.id
    where source_edition.season_id = p_source_season_id
    group by source_edition.id, source_edition.race_id
  ), stage_mapping as (
    select
      target_stage.id as target_stage_id,
      source_stage.id as source_stage_id
    from source_contexts as context
    join public.race_editions as target_edition
      on target_edition.race_id = context.race_id
     and target_edition.season_id = p_target_season_id
    join public.stages as target_stage
      on target_stage.race_edition_id = target_edition.id
    join public.stages as source_stage
      on source_stage.race_edition_id = context.source_edition_id
     and source_stage.stage_number = case
       when target_stage.stage_number <= context.source_stage_count
         then target_stage.stage_number
       else ((target_stage.stage_number - 1) % context.source_stage_count) + 1
     end
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

  perform public.compact_planned_stage_races(p_target_season_id);
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
  order by game_year desc
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
on function public.compact_planned_stage_races(uuid)
from public, anon, authenticated;

revoke all
on function public.provision_season_race_calendar(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.compact_planned_stage_races(uuid)
to service_role;

grant execute
on function public.provision_season_race_calendar(uuid, uuid)
to service_role;

revoke all
on function public.ensure_transfer_next_season(uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_transfer_next_season(uuid)
to service_role;

comment on constraint stages_day_slot_unique on public.stages is
  'Une édition ne peut occuper qu’une fois chaque sous-colonne AM ou PM d’une journée.';

commit;
