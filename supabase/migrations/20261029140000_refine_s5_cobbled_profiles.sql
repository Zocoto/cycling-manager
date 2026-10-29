begin;
set local lock_timeout='1s';
set local statement_timeout='5s';

-- Optional presentation metadata; the sporting domain remains "cobbles".
alter table public.stages add column if not exists profile_variant text
  check(profile_variant in('sprint_cobbles','selective_cobbles'));

create or replace function private.s5_cobbled_profile_plan()
returns table(slug text,stage_number integer,shape text)
language sql immutable set search_path='' as $$
  values
    ('enfer-des-dunes',1,'hilly'),
    ('classique-des-routes-de-basalte',1,'flat'),
    ('ronde-du-jutland',1,'flat'),
    ('tour-de-la-voie-royale-de-boheme',4,'flat'),
    ('tour-des-paves-baltiques',5,'flat'),
    ('vuelta-de-los-caminos-blancos',6,'flat'),
    ('vuelta-de-los-caminos-rojos',4,'flat'),
    ('traversee-des-flandres',1,'hilly'),
    ('strade-del-monferrato',1,'hilly'),
    ('gotland-gravel-classic',1,'hilly'),
    ('routes-blanches-de-maurice',1,'hilly'),
    ('clasica-de-barichara',1,'hilly'),
    ('route-de-pierre-du-the',1,'hilly'),
    ('mur-de-kigali',1,'hilly');
$$;

create or replace function private.s5_cobbled_finale(p_shape text)
returns jsonb language sql immutable set search_path='' as $$
  -- [distance, terrain, surface, gradient], exactly 50 km in both cases.
  select case p_shape when 'flat' then
    '[[6,"flat","asphalt",0],[8,"flat","cobbles",0],[4,"flat","asphalt",0],[10,"flat","cobbles",0],[4,"flat","asphalt",0],[8,"flat","cobbles",0],[4,"flat","asphalt",0],[3,"flat","cobbles",0],[3,"flat","asphalt",0]]'::jsonb
  when 'hilly' then
    '[[5,"flat","asphalt",0],[3,"climb","cobbles",6],[3,"descent","asphalt",-5.5],[5,"flat","cobbles",0],[4,"flat","asphalt",0],[2.5,"climb","cobbles",7],[2.5,"descent","cobbles",-6],[4,"flat","asphalt",0],[2,"climb","cobbles",8],[2,"descent","asphalt",-7],[12,"flat","cobbles",0],[5,"flat","asphalt",0]]'::jsonb end;
$$;

create or replace function private.remove_obsolete_cloned_stage_segments(p_source_season_id uuid,p_target_season_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.seasons where id=p_target_season_id and game_year>=5 and status='planned') then return; end if;
  -- An upsert alone retains old trailing sectors when the source has fewer
  -- sectors. Remove only those obsolete keys in an unstarted target edition.
  with sources as (
    select e.id,e.race_id,max(t.stage_number)::integer stage_count from public.race_editions e
    join public.stages t on t.race_edition_id=e.id where e.season_id=p_source_season_id group by e.id
  ), mapping as (
    select t.id target_id,original.id source_id from sources s
    join public.race_editions e on e.race_id=s.race_id and e.season_id=p_target_season_id
    join public.races race on race.id=e.race_id and race.competition_type='standard'
    join public.stages t on t.race_edition_id=e.id
    join public.stages original on original.race_edition_id=s.id
      and original.stage_number=case when t.stage_number<=s.stage_count then t.stage_number else ((t.stage_number-1)%s.stage_count)+1 end
    where t.status='planned' and e.status in('planned','registration_open','registration_closed')
      and exists(select 1 from public.stage_segments x where x.stage_id=original.id)
      and not exists(select 1 from public.stage_results x where x.stage_id=t.id)
      and not exists(select 1 from public.official_stage_simulations x where x.stage_id=t.id)
  )
  delete from public.stage_segments x using mapping m where x.stage_id=m.target_id
    and not exists(select 1 from public.stage_segments source where source.stage_id=m.source_id and source.segment_number=x.segment_number);
end;
$$;

create or replace function private.apply_s5_cobbled_profiles(p_season_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_stage record; v_segment record; v_tail jsonb; v_existing jsonb; v_part jsonb;
  v_cut numeric; v_end numeric; v_start numeric; v_number integer; v_id uuid;
begin
  if not exists(select 1 from public.seasons where id=p_season_id and game_year>=5 and status='planned') then return; end if;
  if exists(select 1 from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.races r on r.id=e.race_id join private.s5_cobbled_profile_plan() p on p.slug=r.slug and p.stage_number=t.stage_number
    where e.season_id=p_season_id and (t.status<>'planned' or e.status not in('planned','registration_open','registration_closed')
      or t.stage_type<>'road' or t.profile_type<>'cobbles'
      or exists(select 1 from public.stage_results x where x.stage_id=t.id)
      or exists(select 1 from public.official_stage_simulations x where x.stage_id=t.id))) then
    raise exception 'A cobbled event is already frozen or has an unexpected profile; update refused.';
  end if;
  for v_stage in
    select t.id,t.distance_km,t.profile_variant,r.race_format,p.shape from public.stages t
    join public.race_editions e on e.id=t.race_edition_id join public.races r on r.id=e.race_id
    join private.s5_cobbled_profile_plan() p on p.slug=r.slug and p.stage_number=t.stage_number
    where e.season_id=p_season_id and r.competition_type='standard'
    order by t.id
  loop
    v_tail:=private.s5_cobbled_finale(v_stage.shape);
    v_cut:=v_stage.distance_km-50;
    if v_cut<=0 or (select sum((x->>0)::numeric) from jsonb_array_elements(v_tail)x)<>50 then raise exception 'Invalid cobbled finale'; end if;
    -- Repair the two already prepared routes with obsolete trailing sectors.
    -- Preserve the authored prefix and exact advertised distance; no scaling.
    v_end:=0;
    for v_segment in select * from public.stage_segments where stage_id=v_stage.id order by segment_number loop
      v_start:=v_end; v_end:=v_end+v_segment.distance_km;
      if v_start>=v_stage.distance_km then
        delete from public.stage_segments where id=v_segment.id;
      elsif v_end>v_stage.distance_km then
        update public.stage_segments set distance_km=v_stage.distance_km-v_start where id=v_segment.id;
      end if;
    end loop;
    if coalesce((select sum(distance_km) from public.stage_segments where stage_id=v_stage.id),0)<>v_stage.distance_km then
      raise exception 'Incomplete cobbled route %',v_stage.id;
    end if;
    with positioned as (
      select *,sum(distance_km)over(order by segment_number) finish_km from public.stage_segments where stage_id=v_stage.id
    ) select jsonb_agg(jsonb_build_array(least(distance_km,finish_km-v_cut),terrain_type,surface_type,average_gradient_pct)order by segment_number)
      into v_existing from positioned where finish_km>v_cut;
    if v_existing is distinct from v_tail then
      v_end:=0; v_number:=0;
      for v_segment in select * from public.stage_segments where stage_id=v_stage.id order by segment_number loop
        v_start:=v_end; v_end:=v_end+v_segment.distance_km;
        if v_start>=v_cut then delete from public.stage_segments where id=v_segment.id;
        else
          v_number:=v_segment.segment_number;
          if v_end>v_cut then update public.stage_segments set distance_km=v_cut-v_start where id=v_segment.id; end if;
        end if;
      end loop;
      for v_part in select value from jsonb_array_elements(v_tail) loop
        v_number:=v_number+1;
        insert into public.stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)
          values(v_stage.id,v_number,(v_part->>0)::numeric,v_part->>1,v_part->>2,(v_part->>3)::numeric) returning id into v_id;
        if v_stage.race_format='stage_race' and v_part->>1='climb' then
          insert into public.stage_segment_primes(stage_segment_id,prime_type,mountain_category,points_scale)
            values(v_id,'mountain','3',array[2,1]::smallint[]);
        end if;
      end loop;
    end if;
    update public.stages set profile_variant='selective_cobbles'
      where id=v_stage.id and profile_variant is distinct from 'selective_cobbles';
  end loop;

  -- Labels describe the route rather than guaranteeing a particular finish.
  -- Keep flat, less demanding cobbled races for fast cobbled specialists.
  with positioned as (
    select t.id,t.distance_km stage_distance,x.terrain_type,x.surface_type,x.distance_km,x.average_gradient_pct,
      sum(x.distance_km)over(partition by t.id order by x.segment_number) finish_km
    from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.races r on r.id=e.race_id join public.stage_segments x on x.stage_id=t.id
    where e.season_id=p_season_id and r.competition_type='standard' and t.profile_type='cobbles' and t.stage_type='road'
      and t.status='planned' and e.status in('planned','registration_open','registration_closed')
      and not exists(select 1 from private.s5_cobbled_profile_plan() p where p.slug=r.slug and p.stage_number=t.stage_number)
      and not exists(select 1 from public.official_stage_simulations f where f.stage_id=t.id)
      and not exists(select 1 from public.stage_results z where z.stage_id=t.id)
  ), assessed as (
    select id,case when sum(distance_km)=max(stage_distance) and max(stage_distance)>=100
      and sum(case when terrain_type='climb' then distance_km*greatest(average_gradient_pct,0)*10 else 0 end)<=800
      and sum(case when surface_type='cobbles' then distance_km else 0 end)>=10
      and max(stage_distance)-max(finish_km)filter(where surface_type='cobbles')>=15
      then 'sprint_cobbles' else null end variant from positioned group by id
  ) update public.stages t set profile_variant=a.variant from assessed a where t.id=a.id and t.profile_variant is distinct from a.variant;
end;
$$;

revoke all on function private.s5_cobbled_profile_plan(),private.s5_cobbled_finale(text),
  private.remove_obsolete_cloned_stage_segments(uuid,uuid),private.apply_s5_cobbled_profiles(uuid) from public,anon,authenticated;

do $hook$
declare v_definition text; v_anchor text:='  perform private.apply_s5_elite_calendar(p_target_season_id);'; v_season record;
begin
  select replace(pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure),E'\r\n',E'\n') into v_definition;
  if position('perform private.apply_s5_cobbled_profiles(p_target_season_id);' in v_definition)=0 then
    if position(v_anchor in v_definition)=0 then raise exception 'Calendar provisioning hook not found'; end if;
    execute replace(v_definition,v_anchor,
      E'  perform private.remove_obsolete_cloned_stage_segments(p_source_season_id,p_target_season_id);\n'||v_anchor||E'\n  perform private.apply_s5_cobbled_profiles(p_target_season_id);');
  end if;
  for v_season in select id from public.seasons where game_year>=5 and status='planned' order by game_year loop
    perform private.apply_s5_cobbled_profiles(v_season.id);
  end loop;
end;
$hook$;
notify pgrst,'reload schema';
commit;
