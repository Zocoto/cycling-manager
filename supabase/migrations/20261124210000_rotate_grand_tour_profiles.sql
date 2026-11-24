begin;

set local lock_timeout = '2s';
set local statement_timeout = '8s';

create table private.grand_tour_profile_rotations (
  race_edition_id uuid primary key references public.race_editions(id) on delete cascade,
  variant text not null
);

revoke all on private.grand_tour_profile_rotations from public, anon, authenticated, service_role;

create function private.grand_tour_rotation_plan(p_slug text, p_game_year integer)
returns table (
  variant text, stage_number smallint, stage_type text, profile_type text, segments jsonb
)
language sql immutable strict set search_path = ''
as $$
  with event_offset(slug, season_offset) as (
    values ('corsa-delle-regioni', 0), ('boucle-des-provinces', 3), ('ruta-de-las-sierras', 2)
  ), variants(number, name, route) as (
    values
      (0, 'mountain', array['flat_a','hilly','medium','flat_b','high','itt_climb','flat_a','high','hilly','medium','high']),
      (1, 'time_trials', array['flat_b','hilly','medium','itt_flat','flat_a','high','hilly','flat_b','medium','itt_climb','flat_a']),
      (2, 'team_time_trial', array['flat_a','ttt','hilly','medium','flat_b','high','flat_a','hilly','high','itt_flat','medium']),
      (3, 'prologue', array['prologue','flat_a','medium','hilly','flat_b','high','flat_a','medium','hilly','itt_flat','high'])
  ), shapes(key, stage_type, profile_type, segments) as (
    -- [distance in km, terrain, gradient in %, optional prime]. Keep sustained
    -- mountain gradients selective without repeating the old >5,000 m days.
    values
      ('flat_a', 'road', 'flat',
       '[[28,"flat",0],[26,"flat",0],[5,"climb",2.8,"4"],[5,"descent",-2.8],[32,"flat",0,"sprint"],[24,"flat",0],[30,"flat",0],[25,"flat",0]]'::jsonb),
      ('flat_b', 'road', 'flat',
       '[[30,"flat",0],[25,"flat",0],[6,"climb",3.2,"4"],[6,"descent",-3],[32,"flat",0,"sprint"],[28,"flat",0],[30,"flat",0],[25,"flat",0]]'::jsonb),
      ('hilly', 'road', 'hilly',
       '[[30,"flat",0],[8,"climb",4.8,"3"],[7,"descent",-4.6],[16,"flat",0,"sprint"],[6,"climb",6.5,"2"],[6,"descent",-6],[14,"flat",0],[5,"climb",8,"2"],[5,"descent",-7.4],[12,"flat",0],[7,"climb",5.8,"2"],[6,"descent",-5.5],[18,"flat",0],[8,"climb",7.2,"2"],[20,"flat",0]]'::jsonb),
      ('medium', 'road', 'mountain',
       '[[20,"flat",0],[15,"climb",5.6,"1"],[13,"descent",-5],[18,"flat",0,"sprint"],[19,"climb",6.2,"1"],[18,"descent",-5.7],[24,"flat",0],[16,"climb",7.2,"1"],[10,"descent",-6.2],[17,"flat",0]]'::jsonb),
      ('high', 'road', 'mountain',
       '[[31,"flat",0],[19,"climb",5.8,"1"],[17,"descent",-5.2],[20,"flat",0,"sprint"],[19,"climb",6.7,"1"],[19,"descent",-6],[17,"flat",0],[20,"climb",6.9],[8,"climb",7.8,"HC"]]'::jsonb),
      ('itt_flat', 'individual_time_trial', 'time_trial',
       '[[6,"flat",0],[6,"flat",0],[6,"flat",0],[6,"flat",0],[6,"flat",0],[6,"flat",0]]'::jsonb),
      ('itt_climb', 'individual_time_trial', 'time_trial',
       '[[8,"flat",0],[6,"flat",0],[6,"climb",4.5],[6,"climb",6.5],[5,"climb",8]]'::jsonb),
      ('ttt', 'team_time_trial', 'time_trial',
       '[[4,"flat",0],[4,"flat",0],[4,"flat",0],[4,"flat",0],[4,"flat",0],[4,"flat",0]]'::jsonb),
      ('prologue', 'prologue', 'time_trial', '[[3,"flat",0],[4,"flat",0]]'::jsonb)
  )
  select selected.name, step.ordinality::smallint, shape.stage_type, shape.profile_type,
    case when shape.stage_type = 'road' then
      -- Vary the flat approach by up to 6 km. Repeated stage families within
      -- the same tour have distinct distances without moving climbs or primes.
      jsonb_set(shape.segments, '{0,0}', to_jsonb((shape.segments #>> '{0,0}')::numeric
        + mod(step.ordinality * 7 + cycle.season_offset * 3 + (p_game_year - 6) * 2, 13) - 6))
    else shape.segments end
  from event_offset cycle
  join variants selected on selected.number = mod(p_game_year - 6 + cycle.season_offset, 4)
  cross join lateral unnest(selected.route) with ordinality as step(key, ordinality)
  join shapes shape on shape.key = step.key
  where cycle.slug = p_slug and p_game_year >= 6;
$$;

create function private.apply_grand_tour_profile_rotation(p_season_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_edition record;
  v_stage record;
  v_distance numeric;
  v_variant text;
begin
  for v_edition in
    select edition.id, race.slug, season.game_year
    from public.seasons season
    join public.race_editions edition on edition.season_id = season.id
    join public.races race on race.id = edition.race_id
    where season.id = p_season_id and season.status = 'planned' and season.game_year >= 6
      and race.slug in ('corsa-delle-regioni', 'boucle-des-provinces', 'ruta-de-las-sierras')
      and race.is_grand_tour and race.competition_type = 'standard' and race.race_format = 'stage_race'
      and edition.status in ('planned', 'registration_open')
      and not exists (
        select 1 from private.grand_tour_profile_rotations rotation where rotation.race_edition_id = edition.id
      )
    order by edition.id
    for update of edition for share of season
  loop
    -- Stage-level preparations also have foreign keys to the stages.
    perform stage.id from public.stages stage
    where stage.race_edition_id = v_edition.id order by stage.id for update;

    if exists (select 1 from private.grand_tour_profile_rotations where race_edition_id = v_edition.id)
      or (select count(*) from public.stages where race_edition_id = v_edition.id) <> 12 then
      continue;
    end if;

    if exists (select 1 from public.race_registrations where race_edition_id = v_edition.id)
      or exists (select 1 from public.race_results where race_edition_id = v_edition.id)
      or exists (
        select 1 from public.stages stage where stage.race_edition_id = v_edition.id
        and (
          stage.status <> 'planned' or stage.stage_number not between 1 and 12
          or stage.departure_at is null or stage.departure_at <= clock_timestamp()
          or exists (select 1 from public.stage_results where stage_id = stage.id)
          or exists (select 1 from public.official_stage_simulations where stage_id = stage.id)
          or exists (select 1 from public.race_stage_strategies where stage_id = stage.id)
          or exists (select 1 from public.race_time_trial_rider_plans where stage_id = stage.id)
          or exists (select 1 from public.race_roster_stage_roles where stage_id = stage.id)
          or exists (select 1 from public.race_stage_equipment_assignments where stage_id = stage.id)
          or exists (select 1 from public.stage_reconnaissances where target_stage_id = stage.id)
        )
      ) then
      -- A provision retry must also keep editions skipped because plans exist.
      insert into private.grand_tour_profile_rotations (race_edition_id, variant)
      values (v_edition.id, 'preserved');
      continue;
    end if;

    if (select count(*) from private.grand_tour_rotation_plan(v_edition.slug, v_edition.game_year)) <> 11 then
      raise exception 'Incomplete Grand Tour profile plan for % (season %)', v_edition.slug, v_edition.game_year;
    end if;

    -- Stage 12 retains the course's inherited finale, including Paris.
    for v_stage in
      select stage.id, plan.*
      from private.grand_tour_rotation_plan(v_edition.slug, v_edition.game_year) plan
      join public.stages stage on stage.race_edition_id = v_edition.id and stage.stage_number = plan.stage_number
      order by plan.stage_number
    loop
      v_variant := v_stage.variant;
      select sum((sector.value->>0)::numeric)
      into v_distance
      from jsonb_array_elements(v_stage.segments) sector;

      update public.stages
      set stage_type = v_stage.stage_type, profile_type = v_stage.profile_type,
        profile_variant = null, distance_km = v_distance
      where id = v_stage.id;

      delete from public.stage_segments where stage_id = v_stage.id;
      with route as (
        select part.value, part.ordinality::smallint as segment_number
        from jsonb_array_elements(v_stage.segments) with ordinality as part(value, ordinality)
      ), sector as (
        insert into public.stage_segments (
          stage_id, segment_number, distance_km, terrain_type, surface_type, average_gradient_pct
        )
        select v_stage.id, route.segment_number, (route.value->>0)::numeric,
          route.value->>1, 'asphalt', (route.value->>2)::numeric
        from route
        returning id, segment_number
      )
      insert into public.stage_segment_primes (stage_segment_id, prime_type, mountain_category, points_scale)
      select sector.id,
        case when prime.key = 'sprint' then 'intermediate_sprint' else 'mountain' end,
        nullif(prime.key, 'sprint'),
        case prime.key
          when 'sprint' then array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::smallint[]
          when 'HC' then array[20,15,12,10,8,6,4,2]::smallint[]
          when '1' then array[10,8,6,4,2,1]::smallint[]
          when '2' then array[5,3,2,1]::smallint[]
          when '3' then array[2,1]::smallint[]
          when '4' then array[1]::smallint[]
        end
      from sector join route using (segment_number)
      cross join lateral (select route.value->>3 as key) prime
      where prime.key is not null;
    end loop;

    insert into private.grand_tour_profile_rotations (race_edition_id, variant)
    values (v_edition.id, v_variant);
  end loop;
end;
$$;

revoke all on function private.grand_tour_rotation_plan(text, integer),
  private.apply_grand_tour_profile_rotation(uuid) from public, anon, authenticated, service_role;

do $patch$
declare
  v_definition text;
  v_season_id uuid;
  v_clone_join constant text := 'and target_edition.season_id = p_target_season_id';
  v_cleanup_where constant text := 'where t.status=''planned'' and e.status in(''planned'',''registration_open'',''registration_closed'')';
  v_hook constant text := '  perform private.repair_hauts_plateaux_opening_route(p_target_season_id);';
begin
  select replace(pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure), E'\r\n', E'\n')
  into v_definition;
  if length(v_definition) - length(replace(v_definition, v_clone_join, '')) <> 3 * length(v_clone_join)
    or length(v_definition) - length(replace(v_definition, v_hook, '')) <> length(v_hook) then
    raise exception 'Grand Tour rotation could not identify the calendar clone and provisioning hooks';
  end if;
  -- Skip already published route data before a manual retry can overwrite it.
  v_definition := replace(v_definition, v_clone_join, v_clone_join ||
    E'\n   and not exists (select 1 from private.grand_tour_profile_rotations rotation where rotation.race_edition_id = target_edition.id)');
  execute replace(v_definition, v_hook, v_hook || E'\n  perform private.apply_grand_tour_profile_rotation(p_target_season_id);');

  select replace(pg_get_functiondef('private.remove_obsolete_cloned_stage_segments(uuid,uuid)'::regprocedure), E'\r\n', E'\n')
  into v_definition;
  if length(v_definition) - length(replace(v_definition, v_cleanup_where, '')) <> length(v_cleanup_where) then
    raise exception 'Grand Tour rotation could not identify the obsolete segment cleanup hook';
  end if;
  execute replace(v_definition, v_cleanup_where, v_cleanup_where ||
    E'\n      and not exists (select 1 from private.grand_tour_profile_rotations rotation where rotation.race_edition_id = e.id)');

  for v_season_id in select id from public.seasons where status = 'planned' and game_year >= 6 order by game_year loop
    perform private.apply_grand_tour_profile_rotation(v_season_id);
  end loop;
end;
$patch$;

commit;
