-- From S6, leave international selection days to the federations and REG/LOC.
-- Two non-Monument flat classics become World races, preserving the Elite cap.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

create or replace function private.elite_calendar_plan_for_year(p_game_year integer)
returns table(slug text, start_day integer, first_slot text, stage_count integer,
  race_name text, short_name text, country_code text, race_format text,
  monument boolean, profiles jsonb)
language sql stable security definer set search_path = '' as $$
  select plan.slug,
    case when p_game_year >= 6 then case plan.slug
      when 'tour-des-plaines' then 9 when 'cime-du-tyrol' then 2
      when 'couronne-des-ardennes' then 6 when 'enfer-des-dunes' then 7
      else plan.start_day end else plan.start_day end,
    plan.first_slot, plan.stage_count, plan.race_name, plan.short_name,
    plan.country_code, plan.race_format, plan.monument, plan.profiles
  from private.s5_elite_calendar_plan() plan
  where p_game_year < 6 or plan.slug not in ('circuit-des-salines','gp-des-plaines-du-danube');
$$;
revoke all on function private.elite_calendar_plan_for_year(integer) from public, anon, authenticated;

-- Keep the existing placement/deadline/country-spacing machinery. Only its
-- season-specific plan changes; all pre-S6 calls receive the original plan.
do $elite_plan$
declare v_definition text;
begin
  select replace(pg_get_functiondef('public.enforce_international_elite_stage_calendar()'::regprocedure),chr(13),'') into v_definition;
  if position('private.elite_calendar_plan_for_year(v_game_year)' in v_definition) = 0 then
    if position('private.s5_elite_calendar_plan()' in v_definition) = 0 then
      raise exception 'Unexpected Elite stage placement function.';
    end if;
    execute replace(v_definition,'private.s5_elite_calendar_plan()','private.elite_calendar_plan_for_year(v_game_year)');
  end if;
  select replace(pg_get_functiondef('private.apply_s5_elite_calendar(uuid)'::regprocedure),chr(13),'') into v_definition;
  if position('private.elite_calendar_plan_for_year(v_year)' in v_definition) = 0 then
    if position('private.s5_elite_calendar_plan()' in v_definition) = 0 then
      raise exception 'Unexpected Elite calendar provisioning function.';
    end if;
    execute replace(v_definition,'private.s5_elite_calendar_plan()','private.elite_calendar_plan_for_year(v_year)');
  end if;
end;
$elite_plan$;

create or replace function private.prepare_s6_international_elite_categories(p_season_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.seasons where id=p_season_id and game_year>=6 and status='planned') then return; end if;
  if exists(select 1 from public.race_editions edition
    join public.races race on race.id=edition.race_id
    join public.stages stage on stage.race_edition_id=edition.id
    where edition.season_id=p_season_id
      and race.slug in ('circuit-des-salines','gp-des-plaines-du-danube')
      and (edition.status not in ('planned','registration_open') or stage.status<>'planned'
        or exists(select 1 from public.stage_results result where result.stage_id=stage.id)
        or exists(select 1 from public.official_stage_simulations simulation where simulation.stage_id=stage.id))) then
    raise exception 'A running race cannot be reclassified for the international calendar.';
  end if;
  update public.race_editions edition set
    race_category_id=world.id, minimum_reputation=200
  from public.races race, public.race_categories elite, public.race_categories world
  where edition.race_id=race.id and edition.season_id=p_season_id
    and race.slug in ('circuit-des-salines','gp-des-plaines-du-danube')
    and elite.code='elite' and world.code='world' and edition.race_category_id=elite.id;
end;
$$;
revoke all on function private.prepare_s6_international_elite_categories(uuid) from public, anon, authenticated;

create or replace function private.s6_protected_calendar_days(p_season_id uuid)
returns table(day_number integer)
language sql stable security definer set search_path = '' as $$
  select distinct slot.day_number::integer
  from public.seasons season
  join public.national_federation_selection_slots slot
    on slot.active_from_game_year <= season.game_year
   and slot.rider_category = 'professional'
   and slot.competition_code in ('continental_championship','world_championship','nations_cup')
  where season.id = p_season_id and season.game_year >= 6
  union
  -- CN are canonically J8; reserve them even before their editions are seeded.
  select 8 from public.seasons where id=p_season_id and game_year>=6
  union
  select distinct day.day_number::integer
  from public.seasons season
  join public.race_editions edition on edition.season_id = season.id and edition.status <> 'cancelled'
  join public.races race on race.id = edition.race_id
    and race.competition_type in ('national_road','national_time_trial','continental_championship','world_championship','nations_cup')
  join public.stages stage on stage.race_edition_id = edition.id and stage.status <> 'cancelled'
  join public.season_days day on day.id = stage.season_day_id and day.season_id = season.id
  where season.id = p_season_id and season.game_year >= 6;
$$;
revoke all on function private.s6_protected_calendar_days(uuid) from public, anon, authenticated;

create or replace function private.reserve_s6_international_calendar_days(p_season_id uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_edition record;
  v_offset integer;
  v_moved integer := 0;
begin
  -- Never rewrite a running season or its results.
  if not exists(select 1 from public.seasons
    where id = p_season_id and game_year >= 6 and status = 'planned') then
    return 0;
  end if;
  if (select count(*) from public.season_days where season_id = p_season_id) <> 28 then
    raise exception 'The international calendar requires all 28 season days.';
  end if;

  set constraints public.stages_day_slot_unique deferred;
  for v_edition in
    select edition.id, race.id as race_id, race.country_id, race.slug,
      edition.registration_closes_at, edition.withdrawal_closes_at, edition.wildcard_closes_at,
      min(day.day_number)::integer as first_day,
      max(day.day_number)::integer as last_day
    from public.race_editions edition
    join public.races race on race.id = edition.race_id and race.competition_type = 'standard'
    join public.race_categories category on category.id = edition.race_category_id
      and category.code not in ('local','regional')
    join public.stages stage on stage.race_edition_id = edition.id and stage.status <> 'cancelled'
    join public.season_days day on day.id = stage.season_day_id
    where edition.season_id = p_season_id and edition.status <> 'cancelled'
    group by edition.id, race.id, race.country_id, race.slug
    having bool_or(day.day_number in (select protected.day_number
      from private.s6_protected_calendar_days(p_season_id) protected))
    order by min(day.day_number), race.slug, edition.id
  loop
    if exists(select 1 from public.race_editions e
      where e.id = v_edition.id and e.status not in ('planned','registration_open'))
      or exists(select 1 from public.stages s where s.race_edition_id = v_edition.id and s.status <> 'planned')
      or exists(select 1 from public.stage_results result join public.stages s on s.id = result.stage_id
        where s.race_edition_id = v_edition.id)
      or exists(select 1 from public.official_stage_simulations simulation join public.stages s on s.id = simulation.stage_id
        where s.race_edition_id = v_edition.id)
      or exists(select 1 from public.national_federation_race_projects project
        where project.race_id = v_edition.race_id and project.status in ('scheduled','active')) then
      raise exception 'An international-day conflict requires arbitration for edition %.', v_edition.id;
    end if;

    -- Move the whole edition, retaining stage offsets, slots and every child ID.
    -- Nearest valid date first; prefer the less crowded date in a distance tie.
    select candidate.offset_days into v_offset
    from generate_series(2 - v_edition.first_day, 28 - v_edition.last_day) candidate(offset_days)
    where candidate.offset_days <> 0
      and not exists(
        select 1 from public.stages moving
        join public.season_days day on day.id = moving.season_day_id
        join private.s6_protected_calendar_days(p_season_id) protected
          on protected.day_number = day.day_number + candidate.offset_days
        where moving.race_edition_id = v_edition.id and moving.status <> 'cancelled'
      )
      and not exists(
        select 1 from public.stages moving
        join public.season_days day on day.id = moving.season_day_id
        join public.season_days target on target.season_id = p_season_id
          and target.day_number = day.day_number + candidate.offset_days
        join public.stages other on other.season_day_id = target.id and other.status <> 'cancelled'
        join public.race_editions other_edition on other_edition.id = other.race_edition_id
          and other_edition.season_id = p_season_id and other_edition.id <> v_edition.id
          and other_edition.status <> 'cancelled'
        join public.races other_race on other_race.id = other_edition.race_id
          and other_race.competition_type = 'standard' and other_race.status = 'active'
          and other_race.country_id = v_edition.country_id
        where moving.race_edition_id = v_edition.id
          and not private.standard_race_country_overlap_allowed(
            p_season_id, v_edition.country_id, v_edition.id, other_edition.id)
      )
      and not exists(
        select 1 from public.stages moving
        join public.season_days day on day.id = moving.season_day_id
        join public.national_federation_race_projects project
          on project.country_id = v_edition.country_id
         and project.status in ('voting','scheduled','active')
         and project.race_id is distinct from v_edition.race_id
        join public.seasons reserved on reserved.id = p_season_id
          and reserved.game_year = project.activation_game_year
        where moving.race_edition_id = v_edition.id
          and day.day_number + candidate.offset_days between project.start_day_number
            and project.start_day_number + (
              case project.start_day_slot when 'late' then 1 else 0 end
              + jsonb_array_length(project.stage_blueprint) - 1) / 2
      )
    order by abs(candidate.offset_days), (
      select count(distinct (other.race_edition_id, target.day_number))
      from public.stages moving
      join public.season_days day on day.id = moving.season_day_id
      join public.season_days target on target.season_id = p_season_id
        and target.day_number = day.day_number + candidate.offset_days
      join public.stages other on other.season_day_id = target.id and other.status <> 'cancelled'
      join public.race_editions other_edition on other_edition.id = other.race_edition_id
        and other_edition.id <> v_edition.id and other_edition.status <> 'cancelled'
      join public.races other_race on other_race.id = other_edition.race_id and other_race.competition_type = 'standard'
      join public.race_categories category on category.id = other_edition.race_category_id
        and category.code not in ('local','regional')
      where moving.race_edition_id = v_edition.id
    ), candidate.offset_days
    limit 1;

    if v_offset is null then
      raise exception 'No safe replacement date for international-day edition %.', v_edition.id;
    end if;

    update public.stages stage
    set season_day_id = target.id,
      departure_at = (target.calendar_date::timestamp +
        (stage.departure_at at time zone 'Europe/Paris')::time) at time zone 'Europe/Paris'
    from public.season_days original, public.season_days target
    where stage.race_edition_id = v_edition.id and original.id = stage.season_day_id
      and target.season_id = p_season_id and target.day_number = original.day_number + v_offset;

    update public.race_editions set
      registration_closes_at = ((v_edition.registration_closes_at at time zone 'Europe/Paris')
        + make_interval(days => v_offset)) at time zone 'Europe/Paris',
      withdrawal_closes_at = ((v_edition.withdrawal_closes_at at time zone 'Europe/Paris')
        + make_interval(days => v_offset)) at time zone 'Europe/Paris',
      wildcard_closes_at = ((v_edition.wildcard_closes_at at time zone 'Europe/Paris')
        + make_interval(days => v_offset)) at time zone 'Europe/Paris'
    where id = v_edition.id;
    v_moved := v_moved + 1;
  end loop;
  return v_moved;
end;
$$;
revoke all on function private.reserve_s6_international_calendar_days(uuid) from public, anon, authenticated;

create or replace function private.guard_s6_international_calendar_day()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_season uuid; v_day integer; v_competition text; v_category text; v_edition uuid;
begin
  -- Resolve the final row: provisioning can relocate a stage several times.
  if tg_table_name = 'stages' then
    select edition.season_id, day.day_number, race.competition_type, category.code, edition.id
      into v_season, v_day, v_competition, v_category, v_edition
    from public.stages stage
    join public.race_editions edition on edition.id = stage.race_edition_id and edition.status <> 'cancelled'
    join public.seasons season on season.id = edition.season_id
      and season.game_year >= 6 and season.status in ('planned','active')
    join public.season_days day on day.id = stage.season_day_id
    join public.races race on race.id = edition.race_id
    join public.race_categories category on category.id = edition.race_category_id
    where stage.id = new.id and stage.status <> 'cancelled';
    if not found then return null; end if;
    if v_competition = 'standard' and v_category in ('local','regional') then return null; end if;
    if v_competition = 'standard' then
      if v_day in (select day_number from private.s6_protected_calendar_days(v_season)) then
        raise exception 'J% est réservée aux sélections internationales et aux courses régionales/locales.', v_day;
      end if;
      return null;
    end if;
    if v_competition not in ('national_road','national_time_trial','continental_championship','world_championship','nations_cup') then return null; end if;
  else
    select edition.season_id into v_season
    from public.race_editions edition join public.seasons season on season.id = edition.season_id
      and season.game_year >= 6 and season.status in ('planned','active')
    where edition.id = new.id and edition.status <> 'cancelled';
    if not found then return null; end if;
    v_edition := new.id;
  end if;
  if exists(
    select 1 from public.stages stage
    join public.race_editions edition on edition.id = stage.race_edition_id and edition.status <> 'cancelled'
    join public.races race on race.id = edition.race_id and race.competition_type = 'standard'
    join public.race_categories category on category.id = edition.race_category_id and category.code not in ('local','regional')
    join public.season_days day on day.id = stage.season_day_id
    join private.s6_protected_calendar_days(v_season) protected on protected.day_number = day.day_number
    where edition.season_id = v_season and stage.status <> 'cancelled'
      and (tg_table_name = 'stages' and day.day_number = v_day or edition.id = v_edition)
  ) then
    raise exception 'Une course hors REG/LOC chevauche une journée internationale en S6 ou ultérieure.';
  end if;
  return null;
end;
$$;
revoke all on function private.guard_s6_international_calendar_day() from public, anon, authenticated;

drop trigger if exists guard_s6_international_calendar_day on public.stages;
create constraint trigger guard_s6_international_calendar_day after insert or update on public.stages
  deferrable initially deferred for each row execute function private.guard_s6_international_calendar_day();
drop trigger if exists guard_s6_international_edition_day on public.race_editions;
create constraint trigger guard_s6_international_edition_day after insert or update on public.race_editions
  deferrable initially deferred for each row execute function private.guard_s6_international_calendar_day();

do $provision$
declare v_definition text; v_marker text := '  perform public.repair_missing_standard_race_deadlines(p_target_season_id);'; v_season record;
begin
  select replace(pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure),chr(13),'') into v_definition;
  if position('perform private.prepare_s6_international_elite_categories(p_target_season_id);' in v_definition) = 0 then
    if position('  perform private.apply_s5_elite_calendar(p_target_season_id);' in v_definition) = 0 then
      raise exception 'Unexpected Elite provisioning hook.';
    end if;
    v_definition := replace(v_definition,'  perform private.apply_s5_elite_calendar(p_target_season_id);',
      E'  perform private.prepare_s6_international_elite_categories(p_target_season_id);\n  perform private.apply_s5_elite_calendar(p_target_season_id);');
  end if;
  if position('perform private.reserve_s6_international_calendar_days(p_target_season_id);' in v_definition) = 0 then
    if position(v_marker in v_definition) = 0 then raise exception 'Unexpected calendar provisioning hook.'; end if;
    v_definition := replace(v_definition, v_marker,
      E'  perform private.reserve_s6_international_calendar_days(p_target_season_id);\n' || v_marker);
  end if;
  execute v_definition;
  for v_season in select id from public.seasons
    where game_year >= 6 and status = 'planned'
      and (select count(*) from public.season_days where season_id = seasons.id) = 28
    order by game_year loop
    perform private.prepare_s6_international_elite_categories(v_season.id);
    if exists(select 1 from public.race_editions edition
      join public.race_categories category on category.id=edition.race_category_id and category.code='elite'
      where edition.season_id=v_season.id and edition.status<>'cancelled') then
      perform private.apply_s5_elite_calendar(v_season.id);
    end if;
    perform private.reserve_s6_international_calendar_days(v_season.id);
  end loop;
end;
$provision$;
commit;
