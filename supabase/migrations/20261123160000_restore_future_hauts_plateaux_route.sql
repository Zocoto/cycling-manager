begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

create or replace function private.repair_hauts_plateaux_opening_route(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stage_id uuid;
  v_authored_route constant jsonb := '[
    [1,28,"flat","asphalt",0],
    [2,24,"flat","asphalt",0],
    [3,20,"flat","asphalt",0],
    [4,18,"flat","asphalt",0],
    [5,12,"climb","asphalt",4.5],
    [6,10,"climb","asphalt",6.5],
    [7,10,"climb","asphalt",8],
    [8,10,"climb","asphalt",9.5]
  ]';
begin
  select stage.id into v_stage_id
  from public.seasons season
  join public.race_editions edition on edition.season_id = season.id
  join public.races race on race.id = edition.race_id
  join public.stages stage on stage.race_edition_id = edition.id
  where season.id = p_season_id and season.game_year >= 6 and season.status = 'planned'
    and race.slug = 'tour-des-hauts-plateaux' and race.competition_type = 'standard'
    and edition.status in ('planned', 'registration_open', 'registration_closed')
    and stage.stage_number = 1 and stage.status = 'planned'
    and stage.stage_type = 'road' and stage.profile_type = 'mountain' and stage.distance_km = 132
    and not exists (select 1 from public.official_stage_simulations where stage_id = stage.id)
    and not exists (select 1 from public.stage_results where stage_id = stage.id)
  for update of stage;

  -- The authored Unipuerto route is already present as the eight starting sectors.
  -- A different future course must never be trimmed by this repair.
  if v_stage_id is null or (
    select jsonb_agg(jsonb_build_array(segment_number, distance_km, terrain_type,
        surface_type, average_gradient_pct) order by segment_number)
    from public.stage_segments
    where stage_id = v_stage_id and segment_number <= 8
  ) is distinct from v_authored_route then
    return;
  end if;

  delete from public.stage_segments
  where stage_id = v_stage_id and segment_number > 8;

  delete from public.stage_segment_primes prime
  using public.stage_segments segment
  where segment.stage_id = v_stage_id and prime.stage_segment_id = segment.id
    and not (
      (segment.segment_number = 2 and prime.prime_type = 'intermediate_sprint')
      or (segment.segment_number = 8 and prime.prime_type = 'mountain')
    );

  insert into public.stage_segment_primes as prime
    (stage_segment_id, prime_type, mountain_category, points_scale)
  select segment.id, expected.prime_type, expected.mountain_category, expected.points_scale
  from (values
    (2, 'intermediate_sprint', null, array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::smallint[]),
    (8, 'mountain', 'HC', array[20,15,12,10,8,6,4,2]::smallint[])
  ) as expected(segment_number, prime_type, mountain_category, points_scale)
  join public.stage_segments segment
    on segment.stage_id = v_stage_id and segment.segment_number = expected.segment_number
  on conflict (stage_segment_id, prime_type) do update
  set mountain_category = excluded.mountain_category, points_scale = excluded.points_scale
  where (prime.mountain_category, prime.points_scale)
    is distinct from (excluded.mountain_category, excluded.points_scale);
end;
$function$;

revoke all on function private.repair_hauts_plateaux_opening_route(uuid) from public, anon, authenticated;

do $hook$
declare
  v_definition text;
  v_anchor constant text := '  perform private.apply_s5_hybrid_calendar(p_target_season_id);';
  v_call constant text := '  perform private.repair_hauts_plateaux_opening_route(p_target_season_id);';
  v_season_id uuid;
begin
  select replace(pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure),
    E'\r\n', E'\n') into v_definition;
  if position(v_call in v_definition) = 0 then
    if length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor) then
      raise exception 'Expected one calendar provisioning hook for the Hauts Plateaux route repair.';
    end if;
    execute replace(v_definition, v_anchor, v_anchor || E'\n' || v_call);
  end if;

  for v_season_id in
    select id from public.seasons where game_year >= 6 and status = 'planned' order by game_year
  loop
    perform private.repair_hauts_plateaux_opening_route(v_season_id);
  end loop;
end;
$hook$;

commit;
