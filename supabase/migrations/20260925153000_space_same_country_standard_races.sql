begin;

create or replace function private.standard_race_country_overlap_allowed(
  p_season_id uuid,
  p_country_id uuid,
  p_left_edition_id uuid,
  p_right_edition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with country_depth as (
    select count(distinct edition.id)::integer as race_count
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    where edition.season_id = p_season_id
      and edition.status <> 'cancelled'
      and race.status = 'active'
      and race.competition_type = 'standard'
      and race.country_id = p_country_id
  ), edition_context as (
    select
      edition.id,
      race.is_grand_tour,
      race.race_format,
      exists (
        select 1
        from public.stages as stage
        where stage.race_edition_id = edition.id
          and stage.profile_type = 'cobbles'
      ) as has_cobbles
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    where edition.id in (p_left_edition_id, p_right_edition_id)
      and edition.season_id = p_season_id
      and edition.status <> 'cancelled'
      and race.status = 'active'
      and race.competition_type = 'standard'
      and race.country_id = p_country_id
  )
  select coalesce(
    (select race_count >= 8 from country_depth)
    and (
      (
        exists (
          select 1 from edition_context
          where id = p_left_edition_id and is_grand_tour
        )
        and exists (
          select 1 from edition_context
          where id = p_right_edition_id
            and race_format = 'one_day'
            and has_cobbles
        )
      )
      or (
        exists (
          select 1 from edition_context
          where id = p_right_edition_id and is_grand_tour
        )
        and exists (
          select 1 from edition_context
          where id = p_left_edition_id
            and race_format = 'one_day'
            and has_cobbles
        )
      )
    ),
    false
  );
$$;

comment on function private.standard_race_country_overlap_allowed(uuid, uuid, uuid, uuid) is
  'Autorise exceptionnellement un grand tour et une classique pavee du meme pays le meme jour si ce pays compte au moins huit courses standard dans la saison.';

create or replace function private.normalize_standard_race_country_spacing(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_season_status text;
  v_conflict record;
  v_move_edition_id uuid;
  v_move_race_id uuid;
  v_country_id uuid;
  v_min_day integer;
  v_max_day integer;
  v_distance integer;
  v_direction integer;
  v_candidate_offset integer;
  v_offset integer;
  v_moved integer := 0;
  v_iterations integer := 0;
begin
  select season.status into v_season_status
  from public.seasons as season
  where season.id = p_season_id;

  if v_season_status is distinct from 'planned' then
    return 0;
  end if;

  loop
    v_iterations := v_iterations + 1;
    if v_iterations > 250 then
      raise exception
        'Le rééquilibrage de la saison % ne converge pas après le déplacement de % (conflit J% entre % et %).',
        p_season_id,
        v_move_edition_id,
        v_conflict.day_number,
        v_conflict.left_slug,
        v_conflict.right_slug;
    end if;

    with edition_days as (
      select distinct
        edition.id as edition_id,
        edition.race_id,
        race.slug,
        race.country_id,
        race.race_format,
        race.is_grand_tour,
        day.day_number,
        (
          case when race.slug = 'mur-de-catalogne' or exists (
            select 1
            from public.national_federation_race_projects as project
            where project.race_id = edition.race_id
              and project.status in ('scheduled', 'active')
          ) then 100 else 0 end
          + case when race.is_grand_tour then 30 else 0 end
          + case when race.race_format = 'stage_race' then 20 else 10 end
        )::integer as keep_priority
      from public.race_editions as edition
      join public.races as race on race.id = edition.race_id
      join public.stages as stage on stage.race_edition_id = edition.id
      join public.season_days as day on day.id = stage.season_day_id
      where edition.season_id = p_season_id
        and edition.status <> 'cancelled'
        and race.status = 'active'
        and race.competition_type = 'standard'
        and race.country_id is not null
    )
    select
      left_day.edition_id as left_edition_id,
      left_day.race_id as left_race_id,
      left_day.slug as left_slug,
      left_day.keep_priority as left_priority,
      right_day.edition_id as right_edition_id,
      right_day.race_id as right_race_id,
      right_day.slug as right_slug,
      right_day.keep_priority as right_priority,
      left_day.country_id,
      left_day.day_number
    into v_conflict
    from edition_days as left_day
    join edition_days as right_day
      on right_day.country_id = left_day.country_id
     and right_day.day_number = left_day.day_number
     and right_day.edition_id > left_day.edition_id
    where not private.standard_race_country_overlap_allowed(
      p_season_id,
      left_day.country_id,
      left_day.edition_id,
      right_day.edition_id
    )
    order by left_day.day_number, left_day.country_id,
      least(left_day.slug, right_day.slug), greatest(left_day.slug, right_day.slug)
    limit 1;

    exit when not found;

    if v_conflict.left_priority < v_conflict.right_priority
      or (
        v_conflict.left_priority = v_conflict.right_priority
        and v_conflict.left_slug > v_conflict.right_slug
      ) then
      v_move_edition_id := v_conflict.left_edition_id;
      v_move_race_id := v_conflict.left_race_id;
    else
      v_move_edition_id := v_conflict.right_edition_id;
      v_move_race_id := v_conflict.right_race_id;
    end if;
    v_country_id := v_conflict.country_id;

    select min(day.day_number), max(day.day_number)
    into v_min_day, v_max_day
    from public.stages as stage
    join public.season_days as day on day.id = stage.season_day_id
    where stage.race_edition_id = v_move_edition_id;

    v_offset := null;
    for v_distance in 1..27 loop
      foreach v_direction in array array[-1, 1] loop
        v_candidate_offset := v_distance * v_direction;
        continue when v_min_day + v_candidate_offset < 1
          or v_max_day + v_candidate_offset > 28;

        continue when exists (
          select 1
          from public.stages as moving_stage
          join public.season_days as moving_day
            on moving_day.id = moving_stage.season_day_id
          join public.season_days as target_day
            on target_day.season_id = p_season_id
           and target_day.day_number = moving_day.day_number + v_candidate_offset
          join public.stages as protected_stage
            on protected_stage.season_day_id = target_day.id
          join public.race_editions as protected_edition
            on protected_edition.id = protected_stage.race_edition_id
          join public.races as protected_race
            on protected_race.id = protected_edition.race_id
          where moving_stage.race_edition_id = v_move_edition_id
            and protected_edition.id <> v_move_edition_id
            and protected_edition.status <> 'cancelled'
            and protected_race.status = 'active'
            and protected_race.competition_type in (
              'national_road', 'national_time_trial', 'continental_championship',
              'world_championship', 'nations_cup'
            )
        );

        continue when exists (
          select 1
          from public.stages as moving_stage
          join public.season_days as moving_day
            on moving_day.id = moving_stage.season_day_id
          join public.development_race_editions as protected_development
            on protected_development.season_id = p_season_id
           and moving_day.day_number + v_candidate_offset between
             protected_development.start_day_number and protected_development.end_day_number
          where moving_stage.race_edition_id = v_move_edition_id
            and protected_development.status <> 'cancelled'
            and protected_development.competition_type in (
              'national_road', 'national_time_trial', 'continental_road',
              'continental_time_trial', 'world_road', 'world_time_trial',
              'nations_cup_junior'
            )
        );

        continue when exists (
          select 1
          from public.stages as moving_stage
          join public.season_days as moving_day
            on moving_day.id = moving_stage.season_day_id
          join public.season_days as target_day
            on target_day.season_id = p_season_id
           and target_day.day_number = moving_day.day_number + v_candidate_offset
          join public.stages as other_stage
            on other_stage.season_day_id = target_day.id
          join public.race_editions as other_edition
            on other_edition.id = other_stage.race_edition_id
          join public.races as other_race on other_race.id = other_edition.race_id
          where moving_stage.race_edition_id = v_move_edition_id
            and other_edition.id <> v_move_edition_id
            and other_edition.season_id = p_season_id
            and other_edition.status <> 'cancelled'
            and other_race.status = 'active'
            and other_race.competition_type = 'standard'
            and other_race.country_id = v_country_id
            and not private.standard_race_country_overlap_allowed(
              p_season_id,
              v_country_id,
              v_move_edition_id,
              other_edition.id
            )
        );

        continue when exists (
          select 1
          from public.stages as moving_stage
          join public.season_days as moving_day
            on moving_day.id = moving_stage.season_day_id
          join public.national_federation_race_projects as reserved_project
            on reserved_project.country_id = v_country_id
           and reserved_project.status in ('voting', 'scheduled', 'active')
           and reserved_project.race_id is distinct from v_move_race_id
          join public.seasons as reserved_season
            on reserved_season.game_year = reserved_project.activation_game_year
           and reserved_season.id = p_season_id
          where moving_stage.race_edition_id = v_move_edition_id
            and moving_day.day_number + v_candidate_offset between
              floor((
                (reserved_project.start_day_number - 1) * 2
                + case reserved_project.start_day_slot when 'late' then 1 else 0 end
              ) / 2.0)::integer + 1
              and floor((
                (reserved_project.start_day_number - 1) * 2
                + case reserved_project.start_day_slot when 'late' then 1 else 0 end
                + jsonb_array_length(reserved_project.stage_blueprint) - 1
              ) / 2.0)::integer + 1
        );

        v_offset := v_candidate_offset;
        exit;
      end loop;
      exit when v_offset is not null;
    end loop;

    if v_offset is null then
      raise exception
        'Aucune journée sans course du même pays n’est disponible pour déplacer l’édition %.',
        v_move_edition_id;
    end if;

    update public.stages as stage
    set season_day_id = target_day.id,
        departure_at = stage.departure_at + make_interval(days => v_offset)
    from public.season_days as current_day,
         public.season_days as target_day
    where stage.race_edition_id = v_move_edition_id
      and current_day.id = stage.season_day_id
      and target_day.season_id = p_season_id
      and target_day.day_number = current_day.day_number + v_offset;

    update public.race_editions
    set registration_closes_at = registration_closes_at + make_interval(days => v_offset),
        withdrawal_closes_at = withdrawal_closes_at + make_interval(days => v_offset)
    where id = v_move_edition_id;

    v_moved := v_moved + 1;
  end loop;

  return v_moved;
end;
$$;

comment on function private.normalize_standard_race_country_spacing(uuid) is
  'Décale les courses standard d’une saison planifiée afin que deux épreuves du même pays ne partagent pas une journée, hors exception grand tour/classique pavée.';

do $$
declare
  v_season record;
begin
  for v_season in
    select season.id
    from public.seasons as season
    where season.status = 'planned'
    order by season.game_year
  loop
    perform private.normalize_standard_race_country_spacing(v_season.id);
  end loop;
end;
$$;

create or replace function private.enforce_standard_race_country_spacing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_season_status text;
  v_country_id uuid;
  v_competition_type text;
  v_race_status text;
  v_other_edition_id uuid;
  v_other_race_name text;
  v_day_number integer;
  v_race_name text;
begin
  select
    edition.season_id,
    season.status,
    race.country_id,
    race.competition_type,
    race.status,
    race.name,
    day.day_number
  into
    v_season_id,
    v_season_status,
    v_country_id,
    v_competition_type,
    v_race_status,
    v_race_name,
    v_day_number
  from public.race_editions as edition
  join public.seasons as season on season.id = edition.season_id
  join public.races as race on race.id = edition.race_id
  join public.season_days as day on day.id = new.season_day_id
  where edition.id = new.race_edition_id;

  if v_season_status is distinct from 'planned'
    or v_country_id is null
    or v_competition_type is distinct from 'standard'
    or v_race_status is distinct from 'active' then
    return null;
  end if;

  select other_edition.id, other_race.name
  into v_other_edition_id, v_other_race_name
  from public.stages as other_stage
  join public.race_editions as other_edition
    on other_edition.id = other_stage.race_edition_id
  join public.races as other_race on other_race.id = other_edition.race_id
  where other_stage.season_day_id = new.season_day_id
    and other_edition.id <> new.race_edition_id
    and other_edition.season_id = v_season_id
    and other_edition.status <> 'cancelled'
    and other_race.status = 'active'
    and other_race.competition_type = 'standard'
    and other_race.country_id = v_country_id
    and not private.standard_race_country_overlap_allowed(
      v_season_id,
      v_country_id,
      new.race_edition_id,
      other_edition.id
    )
  order by other_race.name
  limit 1;

  if v_other_edition_id is not null then
    raise exception
      'Calendrier national invalide : % et % ne peuvent pas partager la J%.',
      v_race_name,
      v_other_race_name,
      v_day_number;
  end if;

  return null;
end;
$$;

drop trigger if exists enforce_standard_race_country_spacing on public.stages;
create constraint trigger enforce_standard_race_country_spacing
after insert or update of race_edition_id, season_day_id on public.stages
deferrable initially deferred
for each row execute function private.enforce_standard_race_country_spacing();

create or replace function private.enforce_federation_race_project_country_spacing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_season_id uuid;
  v_stage record;
  v_slot_index integer;
  v_day_number integer;
  v_country_race_count integer;
  v_new_is_cobbled_classic boolean;
  v_conflicting_race_name text;
begin
  if new.status not in ('draft', 'voting', 'scheduled', 'active')
    or jsonb_typeof(new.stage_blueprint) is distinct from 'array' then
    return new;
  end if;

  select season.id into v_target_season_id
  from public.seasons as season
  where season.game_year = new.activation_game_year
    and season.status = 'planned';

  if v_target_season_id is null then
    return new;
  end if;

  select count(distinct edition.id)::integer
  into v_country_race_count
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  where edition.season_id = v_target_season_id
    and edition.status <> 'cancelled'
    and race.status = 'active'
    and race.competition_type = 'standard'
    and race.country_id = new.country_id;

  v_new_is_cobbled_classic := new.race_format = 'one_day'
    and jsonb_array_length(new.stage_blueprint) = 1
    and new.stage_blueprint -> 0 ->> 'profileType' = 'cobbles';

  for v_stage in
    select ordinality::integer as stage_number
    from jsonb_array_elements(new.stage_blueprint) with ordinality
  loop
    v_slot_index := (new.start_day_number - 1) * 2
      + case new.start_day_slot when 'late' then 1 else 0 end
      + v_stage.stage_number - 1;
    v_day_number := floor(v_slot_index / 2.0)::integer + 1;

    select race.name into v_conflicting_race_name
    from public.stages as stage
    join public.season_days as day on day.id = stage.season_day_id
    join public.race_editions as edition on edition.id = stage.race_edition_id
    join public.races as race on race.id = edition.race_id
    where edition.season_id = v_target_season_id
      and day.day_number = v_day_number
      and edition.status <> 'cancelled'
      and race.status = 'active'
      and race.competition_type = 'standard'
      and race.country_id = new.country_id
      and race.id is distinct from new.race_id
      and not (
        v_country_race_count >= 8
        and v_new_is_cobbled_classic
        and race.is_grand_tour
      )
    order by race.name
    limit 1;

    if v_conflicting_race_name is not null then
      raise exception
        'Une course du même pays (%) occupe déjà la J%. Choisissez une autre journée.',
        v_conflicting_race_name,
        v_day_number;
    end if;

    if exists (
      select 1
      from public.national_federation_race_projects as reserved_project
      where reserved_project.country_id = new.country_id
        and reserved_project.id is distinct from new.id
        and reserved_project.status in ('voting', 'scheduled', 'active')
        and reserved_project.activation_game_year = new.activation_game_year
        and v_day_number between
          floor((
            (reserved_project.start_day_number - 1) * 2
            + case reserved_project.start_day_slot when 'late' then 1 else 0 end
          ) / 2.0)::integer + 1
          and floor((
            (reserved_project.start_day_number - 1) * 2
            + case reserved_project.start_day_slot when 'late' then 1 else 0 end
            + jsonb_array_length(reserved_project.stage_blueprint) - 1
          ) / 2.0)::integer + 1
    ) then
      raise exception
        'Un autre projet de course du même pays réserve déjà la J%.',
        v_day_number;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists enforce_federation_race_project_country_spacing
  on public.national_federation_race_projects;
create trigger enforce_federation_race_project_country_spacing
before insert or update of
  country_id,
  activation_game_year,
  start_day_number,
  start_day_slot,
  race_format,
  stage_blueprint,
  status
on public.national_federation_race_projects
for each row execute function private.enforce_federation_race_project_country_spacing();

do $$
begin
  if exists (
    with edition_days as (
      select distinct
        edition.season_id,
        edition.id as edition_id,
        race.country_id,
        day.day_number
      from public.race_editions as edition
      join public.seasons as season on season.id = edition.season_id
      join public.races as race on race.id = edition.race_id
      join public.stages as stage on stage.race_edition_id = edition.id
      join public.season_days as day on day.id = stage.season_day_id
      where season.status = 'planned'
        and edition.status <> 'cancelled'
        and race.status = 'active'
        and race.competition_type = 'standard'
        and race.country_id is not null
    )
    select 1
    from edition_days as left_day
    join edition_days as right_day
      on right_day.season_id = left_day.season_id
     and right_day.country_id = left_day.country_id
     and right_day.day_number = left_day.day_number
     and right_day.edition_id > left_day.edition_id
    where not private.standard_race_country_overlap_allowed(
      left_day.season_id,
      left_day.country_id,
      left_day.edition_id,
      right_day.edition_id
    )
  ) then
    raise exception 'Des collisions entre courses du même pays subsistent dans une saison planifiée.';
  end if;
end;
$$;

revoke all on function private.standard_race_country_overlap_allowed(uuid, uuid, uuid, uuid),
  private.normalize_standard_race_country_spacing(uuid),
  private.enforce_standard_race_country_spacing(),
  private.enforce_federation_race_project_country_spacing()
from public, anon, authenticated;

grant execute on function private.standard_race_country_overlap_allowed(uuid, uuid, uuid, uuid),
  private.normalize_standard_race_country_spacing(uuid)
to service_role;

notify pgrst, 'reload schema';

commit;
