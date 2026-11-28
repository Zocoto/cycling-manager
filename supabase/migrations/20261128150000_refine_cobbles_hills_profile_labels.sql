-- Presentation only: keep sporting profiles, routes, orders and results intact.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';
set local application_name = 'refine-cobbles-hills-labels-20261128';

create or replace function private.classify_cobbles_hills_profile_variant(
  p_profile_type text, p_current_variant text, p_distance_km numeric,
  p_cobbled_km numeric, p_ascent_m numeric, p_cobbled_ascent_m numeric,
  p_asphalt_ascent_m numeric, p_climb_blocks integer,
  p_asphalt_climb_blocks integer, p_asphalt_climb_km numeric,
  p_final_50_cobbled_km numeric
)
returns text language sql immutable set search_path = '' as $$
  select case
    -- Explicit sprint finishes and any future unrelated preset are retained.
    when p_profile_type not in ('hilly','cobbles')
      or p_current_variant = 'sprint_cobbles'
      or p_current_variant not in ('hilly_cobbles','selective_cobbles','sprint_cobbles')
      or p_distance_km is null or p_distance_km <= 0 then p_current_variant
    when p_cobbled_km * 3 >= p_distance_km
      or (p_cobbled_km >= 15 and p_ascent_m > 0
        and p_cobbled_ascent_m >= p_ascent_m * 0.8 and p_asphalt_ascent_m < 150)
      then 'selective_cobbles'
    -- A mixed label requires a meaningful road-climbing component and cobbles
    -- still present in the finale, rather than a few isolated early sectors.
    when p_cobbled_km >= 15 and p_cobbled_km >= p_distance_km * 0.12
      and p_ascent_m >= 450 and p_climb_blocks >= 3
      and p_asphalt_climb_blocks >= 2 and p_asphalt_climb_km >= 4
      and p_asphalt_ascent_m >= 150 and p_final_50_cobbled_km >= 5
      then 'hilly_cobbles'
    else null -- Also remove an obsolete mixed annotation.
  end;
$$;

create or replace function private.refresh_cobbles_hills_profile_labels(
  p_season_id uuid, p_stage_id uuid default null
)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_changed integer; v_altered integer;
begin
  with candidates as materialized (
    select t.id, t.distance_km, t.profile_type, t.profile_variant,
      to_jsonb(t) - 'profile_variant' as sporting_row
    from public.stages t
    join public.race_editions e on e.id = t.race_edition_id
    join public.seasons s on s.id = e.season_id
    join public.races r on r.id = e.race_id
    where e.season_id = p_season_id and (p_stage_id is null or t.id = p_stage_id)
      and s.game_year >= 5 and s.status in ('planned','active')
      and r.competition_type = 'standard' and t.stage_type = 'road'
      and t.profile_type in ('hilly','cobbles') and t.status = 'planned'
      and e.status in ('planned','registration_open','registration_closed')
      and (s.status = 'planned' or t.departure_at > now())
      and not exists(select 1 from public.stage_results z where z.stage_id = t.id)
      and not exists(select 1 from public.official_stage_simulations z where z.stage_id = t.id)
    for update of t
  ), positioned as (
    select t.id, t.distance_km as stage_distance, t.profile_type, t.profile_variant,
      x.segment_number, x.distance_km, x.terrain_type, x.surface_type, x.average_gradient_pct,
      sum(x.distance_km) over(partition by t.id order by x.segment_number) as end_km,
      lag(x.terrain_type) over(partition by t.id order by x.segment_number) as previous_terrain,
      lag(x.average_gradient_pct) over(partition by t.id order by x.segment_number) as previous_gradient
    from candidates t join public.stage_segments x on x.stage_id = t.id
  ), climb_blocks as (
    select positioned.*,
      sum(case when terrain_type = 'climb' and average_gradient_pct >= 3
        and (previous_terrain is distinct from 'climb' or coalesce(previous_gradient,0) < 3)
        then 1 else 0 end) over(partition by id order by segment_number) as climb_block_id
    from positioned
  ), assessed as (
    select id, max(stage_distance) as stage_distance,
      sum(distance_km) as route_km, bool_and(distance_km > 0) as positive_distances,
      coalesce(sum(distance_km) filter(where surface_type = 'cobbles'),0) as cobbled_km,
      coalesce(sum(distance_km * greatest(average_gradient_pct,0) * 10)
        filter(where terrain_type = 'climb'),0) as ascent_m,
      coalesce(sum(distance_km * greatest(average_gradient_pct,0) * 10)
        filter(where terrain_type = 'climb' and surface_type = 'cobbles'),0) as cobbled_ascent_m,
      coalesce(sum(distance_km * greatest(average_gradient_pct,0) * 10)
        filter(where terrain_type = 'climb' and surface_type = 'asphalt'),0) as asphalt_ascent_m,
      count(distinct climb_block_id) filter(where terrain_type = 'climb'
        and average_gradient_pct >= 3)::integer as climb_blocks,
      count(distinct climb_block_id) filter(where terrain_type = 'climb'
        and surface_type = 'asphalt' and average_gradient_pct >= 3)::integer as asphalt_climb_blocks,
      coalesce(sum(distance_km) filter(where terrain_type = 'climb'
        and surface_type = 'asphalt' and average_gradient_pct >= 3),0) as asphalt_climb_km,
      coalesce(sum(least(distance_km,greatest(0,end_km-(stage_distance-50))))
        filter(where surface_type = 'cobbles'),0) as final_50_cobbled_km
    from climb_blocks group by id
  ), wanted as (
    select t.id, t.sporting_row,
      private.classify_cobbles_hills_profile_variant(t.profile_type,t.profile_variant,
        a.stage_distance,a.cobbled_km,a.ascent_m,a.cobbled_ascent_m,a.asphalt_ascent_m,
        a.climb_blocks,a.asphalt_climb_blocks,a.asphalt_climb_km,a.final_50_cobbled_km) as variant
    from candidates t join assessed a on a.id = t.id
    -- Match the existing complete-route tolerance; do not repair sporting data.
    where a.positive_distances and abs(a.route_km-a.stage_distance) <= 0.05
  ), updated as (
    update public.stages t set profile_variant = w.variant from wanted w
    where t.id = w.id and t.profile_variant is distinct from w.variant
    returning to_jsonb(t) - 'profile_variant' as sporting_row, w.sporting_row as previous_row
  )
  select count(*)::integer,
    count(*) filter(where sporting_row is distinct from previous_row)::integer
    into v_changed, v_altered from updated;
  if v_altered > 0 then
    raise exception 'Profile-label refresh unexpectedly changed sporting or scheduling data.';
  end if;
  return v_changed;
end;
$$;

revoke all on function private.classify_cobbles_hills_profile_variant(text,text,numeric,numeric,numeric,numeric,numeric,integer,integer,numeric,numeric),
  private.refresh_cobbles_hills_profile_labels(uuid,uuid) from public, anon, authenticated;

-- Patch the live definitions, retaining every later calendar/scheduling fix.
-- Each exact anchor is checked once; unknown definitions abort atomically.
do $hooks$
declare v_definition text; v_old text; v_new text;
begin
  select replace(pg_get_functiondef('private.preserve_federation_race_stage_schedule()'::regprocedure),chr(13),'') into v_definition;
  if position('-- profile-label-only update: preserve every sporting field.' in v_definition) = 0 then
    v_old := E'begin\n  select project.* into v_project';
    v_new := E'begin\n  -- profile-label-only update: preserve every sporting field.\n  if tg_op = ''UPDATE'' and (to_jsonb(new) - ''profile_variant'')\n    is not distinct from (to_jsonb(old) - ''profile_variant'') then\n    return new;\n  end if;\n  select project.* into v_project';
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
      raise exception 'Unexpected federation stage-schedule guard definition.';
    end if;
    execute replace(v_definition,v_old,v_new);
  end if;

  select replace(pg_get_functiondef('private.write_s5_hybrid_classic_route(uuid,text)'::regprocedure),chr(13),'') into v_definition;
  if position('perform private.refresh_cobbles_hills_profile_labels(v_stage.season_id,p_stage_id);' in v_definition) = 0 then
    v_old := '    s.game_year,s.status season_status,t.departure_at into strict v_stage';
    v_new := '    s.game_year,s.status season_status,s.id season_id,t.departure_at into strict v_stage';
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
      raise exception 'Unexpected hybrid route-writer context.';
    end if;
    v_definition := replace(v_definition,v_old,v_new);
    v_old := E'  update public.stages set profile_variant=''hilly_cobbles''\n    where id=p_stage_id and profile_variant is distinct from ''hilly_cobbles'';';
    v_new := '  perform private.refresh_cobbles_hills_profile_labels(v_stage.season_id,p_stage_id);';
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
      raise exception 'Unexpected hybrid route-writer label assignment.';
    end if;
    execute replace(v_definition,v_old,v_new);
  end if;

  select replace(pg_get_functiondef('private.apply_s5_hybrid_calendar(uuid)'::regprocedure),chr(13),'') into v_definition;
  if position('perform private.refresh_cobbles_hills_profile_labels(p_season_id);' in v_definition) = 0 then
    v_old := $old$  -- Derive the label from actual terrain, including existing Arctic and Flanders
  -- routes. Never classify time trials, mountains or international championships.
  with assessed as (
    select t.id,sum(x.distance_km) distance,
      sum(case when x.surface_type='cobbles' then x.distance_km else 0 end) cobbled_km,
      sum(case when x.terrain_type='climb' then x.distance_km*greatest(x.average_gradient_pct,0)*10 else 0 end) ascent,
      count(*)filter(where x.terrain_type='climb' and x.average_gradient_pct>=3) hills
    from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.races r on r.id=e.race_id join public.stage_segments x on x.stage_id=t.id
    where e.season_id=p_season_id and r.competition_type='standard'
      and t.stage_type='road' and t.profile_type in ('hilly','cobbles') and t.status='planned'
      and e.status in ('planned','registration_open','registration_closed')
      and not exists(select 1 from public.stage_results z where z.stage_id=t.id)
      and not exists(select 1 from public.official_stage_simulations z where z.stage_id=t.id)
    group by t.id
  ) update public.stages t set profile_variant='hilly_cobbles' from assessed a
    where t.id=a.id and a.distance=t.distance_km and a.cobbled_km>=10 and a.ascent>=450 and a.hills>=2
      and t.profile_variant is distinct from 'hilly_cobbles';$old$;
    v_new := E'  -- Refresh presentation metadata after the complete season routes exist.\n  perform private.refresh_cobbles_hills_profile_labels(p_season_id);';
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
      raise exception 'Unexpected hybrid calendar assessment definition.';
    end if;
    execute replace(v_definition,v_old,v_new);
  end if;

  select replace(pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure),chr(13),'') into v_definition;
  if position('perform private.refresh_cobbles_hills_profile_labels(p_target_season_id);' in v_definition) = 0 then
    v_old := E'  perform private.apply_planned_championship_road_rotation(p_target_season_id, false);\nend;';
    v_new := E'  perform private.apply_planned_championship_road_rotation(p_target_season_id, false);\n  perform private.refresh_cobbles_hills_profile_labels(p_target_season_id);\nend;';
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
      raise exception 'Unexpected final calendar-provisioning hook.';
    end if;
    execute replace(v_definition,v_old,v_new);
  end if;

  select replace(pg_get_functiondef('private.materialize_national_federation_race(uuid)'::regprocedure),chr(13),'') into v_definition;
  if position('perform private.refresh_cobbles_hills_profile_labels(v_target_season.id,v_stage_id);' in v_definition) = 0 then
    v_old := E'      with ordinality as segment(value, ordinality);\n  end loop;';
    v_new := E'      with ordinality as segment(value, ordinality);\n    perform private.refresh_cobbles_hills_profile_labels(v_target_season.id,v_stage_id);\n  end loop;';
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
      raise exception 'Unexpected federation route-materialization hook.';
    end if;
    execute replace(v_definition,v_old,v_new);
  end if;
end;
$hooks$;

do $refresh$
declare v_season record; v_changed integer;
begin
  for v_season in select id,game_year from public.seasons
    where game_year >= 5 and status in ('planned','active') order by game_year
  loop
    v_changed := private.refresh_cobbles_hills_profile_labels(v_season.id);
    raise notice 'S%: % race profile labels refreshed (presentation only).',v_season.game_year,v_changed;
  end loop;
end;
$refresh$;
commit;
