-- Additional hybrid classics from S5. Sporting domains and simulation stay intact.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

alter table public.stages drop constraint if exists stages_profile_variant_check;
alter table public.stages add constraint stages_profile_variant_check
  check(profile_variant in ('sprint_cobbles','selective_cobbles','hilly_cobbles'));

create or replace function private.s5_hybrid_classic_plan()
returns table(slug text,race_name text,short_name text,country_code text,category_code text,
  preferred_day integer,first_slot text,distance numeric,shape text)
language sql immutable set search_path='' as $$
  values
    ('classique-des-paves-de-bratislava','Classique des Pavés de Bratislava','CPB','SK','elite',28,'early',226::numeric,'endurance'),
    ('baltijos-gristos-kalvos','Baltijos Grįstos Kalvos','BGK','LT','world',11,'late',212::numeric,'endurance'),
    ('tartu-munakiviklassik','Tartu Munakiviklassik','TMK','EE','continental',17,'early',192::numeric,'walls'),
    ('vidzemes-bruga-klasika','Vidzemes Bruģa Klasika','VBK','LV','national',23,'early',172::numeric,'rolling'),
    ('klasik-kamenih-brezuljaka','Klasik Kamenih Brežuljaka','KKB','BA','regional',14,'late',148::numeric,'walls');
$$;

create or replace function private.s5_hybrid_classic_segments(p_distance numeric,p_shape text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  v_laps integer; v_lap integer; v_grade numeric; v_length numeric;
  v_tail jsonb := '[]'::jsonb;
begin
  v_laps:=case p_shape when 'rolling' then 5 when 'walls' then 6 when 'endurance' then 8 end;
  if v_laps is null then raise exception 'Unknown hybrid route shape.'; end if;
  for v_lap in 1..v_laps loop
    v_grade:=case p_shape when 'rolling' then 4+(v_lap%3)*0.5
      when 'walls' then 5.5+(v_lap%3)*0.75 else 4.5+(v_lap%3)*0.5 end;
    v_length:=case when p_shape='endurance' then 3 else 2 end;
    v_tail:=v_tail||jsonb_build_array(
      jsonb_build_array(case when p_shape='endurance' then 6 else 5 end,'flat','asphalt',0),
      jsonb_build_array(case when p_shape='rolling' then 4 else 5 end,'flat','cobbles',0),
      jsonb_build_array(v_length,'climb',case when v_lap%2=0 then 'asphalt' else 'cobbles' end,v_grade),
      jsonb_build_array(v_length,'descent','asphalt',-v_grade),
      jsonb_build_array(case when p_shape='walls' then 7 else 6 end,'flat','asphalt',0));
  end loop;
  select sum((x->>0)::numeric) into v_length from jsonb_array_elements(v_tail) x;
  if p_distance<=v_length or p_distance>300 then raise exception 'Invalid hybrid route distance.'; end if;
  return jsonb_build_array(jsonb_build_array(p_distance-v_length,'flat','asphalt',0))||v_tail;
end;
$$;

-- Used only for newly added classics and one existing local classic per country.
-- Comparing the full route first preserves sector IDs on repeat provisioning.
create or replace function private.write_s5_hybrid_classic_route(p_stage_id uuid,p_shape text)
returns void language plpgsql security definer set search_path='' as $$
declare v_stage record; v_wanted jsonb; v_existing jsonb;
begin
  select t.distance_km,t.stage_type,t.status,e.status edition_status,r.race_format,
    s.game_year,s.status season_status,t.departure_at into strict v_stage
  from public.stages t join public.race_editions e on e.id=t.race_edition_id
  join public.races r on r.id=e.race_id join public.seasons s on s.id=e.season_id
  where t.id=p_stage_id and r.competition_type='standard';
  if v_stage.game_year<5 or v_stage.season_status not in ('planned','active') then return; end if;
  if v_stage.status<>'planned' or v_stage.stage_type<>'road' or v_stage.race_format<>'one_day'
    or v_stage.edition_status not in ('planned','registration_open','registration_closed')
    or(v_stage.season_status='active' and v_stage.departure_at<=now())
    or exists(select 1 from public.stage_results where stage_id=p_stage_id)
    or exists(select 1 from public.official_stage_simulations where stage_id=p_stage_id) then
    raise exception 'Hybrid classic is already frozen; route update refused.';
  end if;
  v_wanted:=private.s5_hybrid_classic_segments(v_stage.distance_km,p_shape);
  select jsonb_agg(jsonb_build_array(distance_km,terrain_type,surface_type,average_gradient_pct)
    order by segment_number) into v_existing from public.stage_segments where stage_id=p_stage_id;
  if v_existing is distinct from v_wanted then
    delete from public.stage_segments where stage_id=p_stage_id;
    insert into public.stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)
    select p_stage_id,n::integer,(x->>0)::numeric,x->>1,x->>2,(x->>3)::numeric
    from jsonb_array_elements(v_wanted) with ordinality a(x,n);
  end if;
  update public.stages set profile_variant='hilly_cobbles'
    where id=p_stage_id and profile_variant is distinct from 'hilly_cobbles';
end;
$$;

create or replace function private.apply_s5_local_hybrid_profiles(p_season_id uuid,p_country_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_stage record;
begin
  if not exists(select 1 from public.seasons where id=p_season_id and game_year>=5 and status in ('planned','active')) then return; end if;
  for v_stage in
    select t.id from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.races r on r.id=e.race_id join public.race_categories c on c.id=e.race_category_id
    join public.countries country on country.id=r.country_id
    where e.season_id=p_season_id and c.code='local' and r.competition_type='standard'
      and (p_country_id is null or r.country_id=p_country_id)
      and r.slug='local-'||lower(country.iso_alpha2)||'-classic-2' and t.stage_number=1
    order by t.id
  loop
    perform private.write_s5_hybrid_classic_route(v_stage.id,'rolling');
  end loop;
end;
$$;

create or replace function private.apply_s5_hybrid_calendar(p_season_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_year integer; v_plan record; v_race uuid; v_edition uuid; v_stage uuid;
  v_country uuid; v_category uuid; v_start integer;
begin
  select game_year into v_year from public.seasons
  where id=p_season_id and game_year>=5 and status='planned' for update;
  if not found then return; end if;
  if (select count(*) from public.season_days where season_id=p_season_id)<>28 then
    raise exception 'Hybrid calendar requires all 28 season days.';
  end if;
  for v_plan in select * from private.s5_hybrid_classic_plan() order by preferred_day,slug loop
    select id into strict v_country from public.countries where iso_alpha2=v_plan.country_code;
    select id into strict v_category from public.race_categories where code=v_plan.category_code;
    insert into public.races(country_id,name,short_name,race_format,status,slug,competition_type,is_monument,is_grand_tour)
    values(v_country,v_plan.race_name,v_plan.short_name,'one_day','active',v_plan.slug,'standard',false,false)
    on conflict(slug) do nothing;
    select id into strict v_race from public.races where slug=v_plan.slug and country_id=v_country
      and race_format='one_day' and competition_type='standard' and not is_monument and not is_grand_tour;
    insert into public.race_editions(race_id,season_id,race_category_id,edition_number,display_name,status,minimum_reputation,registration_policy,field_limit)
    values(v_race,p_season_id,v_category,v_year,v_plan.race_name,'registration_open',0,'open',24)
    on conflict(race_id,season_id) do nothing;
    select id into strict v_edition from public.race_editions where race_id=v_race and season_id=p_season_id
      and race_category_id=v_category and status in ('planned','registration_open','registration_closed');
    v_start:=private.find_free_standard_race_start_day(p_season_id,v_country,v_plan.preferred_day,1,v_edition);
    if v_start is null or v_start<2 or(v_plan.category_code='elite' and v_start<>28) then
      raise exception 'No safe hybrid calendar slot for %.',v_plan.slug;
    end if;
    insert into public.stages(race_edition_id,season_day_id,stage_number,name,stage_type,distance_km,status,departure_at,profile_type,day_slot)
    select v_edition,d.id,1,v_plan.race_name,'road',v_plan.distance,'planned',
      (d.calendar_date::timestamp+case v_plan.first_slot when 'early' then time '14:00' else time '18:00' end) at time zone 'Europe/Paris',
      'hilly',v_plan.first_slot from public.season_days d where d.season_id=p_season_id and d.day_number=v_start
    on conflict(race_edition_id,stage_number) do nothing;
    select id into strict v_stage from public.stages where race_edition_id=v_edition and stage_number=1
      and profile_type='hilly' and distance_km=v_plan.distance;
    if (select count(*) from public.stages where race_edition_id=v_edition)<>1 then raise exception 'Unexpected hybrid stage count.'; end if;
    perform private.write_s5_hybrid_classic_route(v_stage,v_plan.shape);
    -- The general deadline repair scans all standard editions. Fill only these
    -- new editions here; preserve every pre-existing deadline, including nulls.
    update public.race_editions e set
      registration_closes_at=coalesce(e.registration_closes_at,t.departure_at-interval '6 hours'),
      withdrawal_closes_at=coalesce(e.withdrawal_closes_at,t.departure_at-interval '6 hours')
    from public.stages t where e.id=v_edition and t.id=v_stage
      and(e.registration_closes_at is null or e.withdrawal_closes_at is null);
  end loop;
  -- Retain 4 classics + 1 tour per country, with one genuine hybrid classic.
  perform private.apply_s5_local_hybrid_profiles(p_season_id);

  -- Derive the label from actual terrain, including existing Arctic and Flanders
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
      and t.profile_variant is distinct from 'hilly_cobbles';
end;
$$;

revoke all on function private.s5_hybrid_classic_plan(),private.s5_hybrid_classic_segments(numeric,text),
  private.write_s5_hybrid_classic_route(uuid,text),private.apply_s5_local_hybrid_profiles(uuid,uuid),
  private.apply_s5_hybrid_calendar(uuid) from public,anon,authenticated;

do $hooks$
declare v_definition text; v_anchor text; v_season record;
begin
  select replace(pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure),E'\r\n',E'\n') into v_definition;
  v_anchor:='  perform private.apply_s5_cobbled_profiles(p_target_season_id);';
  if position('perform private.apply_s5_hybrid_calendar(p_target_season_id);' in v_definition)=0 then
    if position(v_anchor in v_definition)=0 then raise exception 'Hybrid calendar provisioning hook not found.'; end if;
    execute replace(v_definition,v_anchor,v_anchor||E'\n  perform private.apply_s5_hybrid_calendar(p_target_season_id);');
  end if;
  select replace(pg_get_functiondef('private.ensure_local_race_calendar_for_country(uuid,uuid)'::regprocedure),E'\r\n',E'\n') into v_definition;
  v_anchor:='  return 5;';
  if position('perform private.apply_s5_local_hybrid_profiles(p_season_id,p_country_id);' in v_definition)=0 then
    if position(v_anchor in v_definition)=0 then raise exception 'Local hybrid generation hook not found.'; end if;
    execute replace(v_definition,v_anchor,E'  perform private.apply_s5_local_hybrid_profiles(p_season_id,p_country_id);\n'||v_anchor);
  end if;
  for v_season in select s.id from public.seasons s where s.game_year>=5 and s.status='planned'
    and (select count(*) from public.season_days where season_id=s.id)=28
    and exists(select 1 from public.race_editions e where e.season_id=s.id)
    order by s.game_year loop
    perform private.apply_s5_hybrid_calendar(v_season.id);
  end loop;
end;
$hooks$;
notify pgrst,'reload schema';
commit;
