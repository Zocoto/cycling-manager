begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Add independent course edits without changing the legacy three-course RPC,
-- registration guards, raw table permissions, prizes or existing lineups.
create function public.save_current_season_four_gala_course(p_program text,p_profile text,p_rider_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '1s' set statement_timeout = '5s' as $$
declare v_team uuid; v_season uuid; v_id uuid; v_program text; v_valid integer;
begin
 v_team:=private.current_season_four_gala_team();
 if v_team is null then raise exception 'Aucune équipe de saison 4 à inscrire.'; end if;
 if not private.season_four_gala_is_open() then raise exception 'Les inscriptions du gala sont closes.'; end if;
 if p_program is null or p_program not in ('world-tour','continental') or p_profile is null
  or p_profile not in ('mountain','hills',case when p_program='world-tour' then 'cobbles' else 'sprint' end) then
  raise exception 'Course du gala invalide.';
 end if;
 if p_rider_ids is null or coalesce(array_ndims(p_rider_ids),1)<>1 or cardinality(p_rider_ids) not in (0,7,8)
  or (select count(distinct id) from unnest(p_rider_ids) id)<>cardinality(p_rider_ids) then
  raise exception 'Chaque course exige 7 à 8 coureurs distincts.';
 end if;
 if not pg_try_advisory_xact_lock(hashtextextended('gala-s4:'||v_team::text,0)) then
  raise exception using errcode='40001',message='Une inscription est déjà en cours. Réessayez.';
 end if;
 select id into v_season from public.seasons where game_year=4;
 if exists(select 1 from public.season_gala_result_imports where season_id=v_season and split_part(event_key,':',1)=p_program) then
  raise exception 'Les inscriptions de ce programme sont figées après import des résultats.';
 end if;
 select id,program into v_id,v_program from public.season_gala_registrations where season_id=v_season and team_id=v_team for update;
 if v_program is not null and v_program<>p_program then
  raise exception 'Votre format a changé. Rechargez la page avant de modifier cette course.';
 end if;
 if cardinality(p_rider_ids)>0 then
  select count(*) into v_valid from private.season_four_gala_roster(v_team) r where rider_id=any(p_rider_ids)
   and (p_program='world-tour' or (mountain between 1 and 75 and hills between 1 and 75 and flat between 1 and 75 and time_trial between 1 and 75 and cobbles between 1 and 75 and sprint between 1 and 75));
  if v_valid<>cardinality(p_rider_ids) then
   raise exception 'Coureur hors effectif ou inéligible : en Continental, chaque note primaire native doit être de 75 maximum, sans équipement.';
  end if;
  if v_id is null then
   insert into public.season_gala_registrations(season_id,team_id,program) values(v_season,v_team,p_program) returning id into v_id;
  end if;
 end if;
 -- Empty means withdrawal from this course alone. Other profiles are untouched.
 delete from public.season_gala_registration_riders where registration_id=v_id and profile=p_profile;
 insert into public.season_gala_registration_riders(registration_id,profile,rider_id,position)
  select v_id,p_profile,id,position::smallint from unnest(p_rider_ids) with ordinality selected(id,position);
 return v_id;
end;$$;

create function public.change_current_season_four_gala_program(p_program text,p_previous_program text)
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '1s' set statement_timeout = '5s' as $$
declare v_team uuid; v_season uuid; v_id uuid; v_program text;
begin
 v_team:=private.current_season_four_gala_team();
 if v_team is null then raise exception 'Aucune équipe de saison 4 à inscrire.'; end if;
 if not private.season_four_gala_is_open() then raise exception 'Les inscriptions du gala sont closes.'; end if;
 if p_program is null or p_program not in ('world-tour','continental') then raise exception 'Programme du gala invalide.'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('gala-s4:'||v_team::text,0)) then
  raise exception using errcode='40001',message='Une inscription est déjà en cours. Réessayez.';
 end if;
 select id into v_season from public.seasons where game_year=4;
 select id,program into v_id,v_program from public.season_gala_registrations where season_id=v_season and team_id=v_team for update;
 if v_program is distinct from p_previous_program then raise exception 'Votre format a changé. Rechargez la page avant de continuer.'; end if;
 if exists(select 1 from public.season_gala_result_imports where season_id=v_season and split_part(event_key,':',1) in (p_program,v_program)) then
  raise exception 'Les inscriptions de ce programme sont figées après import des résultats.';
 end if;
 if v_id is null then
  insert into public.season_gala_registrations(season_id,team_id,program) values(v_season,v_team,p_program) returning id into v_id;
 elsif v_program<>p_program then
  -- Reached only after the player explicitly confirms changing format.
  delete from public.season_gala_registration_riders where registration_id=v_id;
  update public.season_gala_registrations set program=p_program where id=v_id;
 end if;
 return v_id;
end;$$;

revoke all on function public.save_current_season_four_gala_course(text,text,uuid[]),public.change_current_season_four_gala_program(text,text) from public,anon;
grant execute on function public.save_current_season_four_gala_course(text,text,uuid[]),public.change_current_season_four_gala_program(text,text) to authenticated;


create or replace function public.get_current_season_four_gala_context()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_team uuid; v_season uuid; v_registration public.season_gala_registrations%rowtype;
begin
 v_team:=private.current_season_four_gala_team();
 select id into v_season from public.seasons where game_year=4;
 select * into v_registration from public.season_gala_registrations where season_id=v_season and team_id=v_team;
 return jsonb_build_object(
  'isOpen',private.season_four_gala_is_open(),
  'team',(select jsonb_build_object('id',team_id,'name',display_name) from public.team_seasons where team_id=v_team and season_id=v_season),
  'program',v_registration.program,
  'selections',coalesce((select jsonb_object_agg(profile,ids) from (
    select profile,jsonb_agg(rider_id order by position) ids from public.season_gala_registration_riders where registration_id=v_registration.id group by profile
  ) groups),'{}'::jsonb),
  'riders',coalesce((select jsonb_agg(to_jsonb(r) order by last_name,first_name,rider_id) from private.season_four_gala_roster(v_team) r),'[]'::jsonb),
  'courseCounts',coalesce((select jsonb_object_agg(program||':'||profile,team_count) from (
    select r.program,rr.profile,count(distinct r.id) team_count
    from public.season_gala_registrations r
    join public.season_gala_registration_riders rr on rr.registration_id=r.id
    where r.season_id=v_season group by r.program,rr.profile
  ) course_counts),'{}'::jsonb),
  'counts',jsonb_build_object(
    'world-tour',(select count(*) from public.season_gala_registrations where season_id=v_season and program='world-tour'),
    'continental',(select count(*) from public.season_gala_registrations where season_id=v_season and program='continental')));
end;$$;


create or replace function public.get_season_four_gala_entries(p_program text,p_profile text,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_season uuid; v_total integer; v_teams jsonb; v_favorites jsonb := '[]'::jsonb;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Authentification requise.'; end if;
 if p_program is null or p_program not in ('world-tour','continental') or p_profile is null
  or p_profile not in ('mountain','hills',case when p_program='world-tour' then 'cobbles' else 'sprint' end)
  or p_page is null or p_page not between 0 and 1000 then raise exception 'Course du gala invalide.'; end if;
 select id into v_season from public.seasons where game_year=4;
 select count(*) into v_total from public.season_gala_registrations r where season_id=v_season and program=p_program
   and exists(select 1 from public.season_gala_registration_riders rr where rr.registration_id=r.id and rr.profile=p_profile);
 select coalesce(jsonb_agg(entry order by team_name,team_id),'[]'::jsonb) into v_teams from (
  select r.team_id,ts.display_name team_name,jsonb_build_object(
   'teamId',r.team_id,'name',ts.display_name,'jerseyId',jersey.selected_jersey_id,
   'riders',coalesce((select jsonb_agg(jsonb_build_object('id',rr.rider_id,'name',rider.first_name||' '||rider.last_name) order by rr.position)
      from public.season_gala_registration_riders rr join public.riders rider on rider.id=rr.rider_id where rr.registration_id=r.id and rr.profile=p_profile),'[]'::jsonb)) entry
  from public.season_gala_registrations r
  join public.team_seasons ts on ts.team_id=r.team_id and ts.season_id=v_season
  left join lateral (
   select c.selected_jersey_id from public.team_sponsor_contracts c
   join public.seasons cs on cs.id=c.start_season_id join public.seasons ce on ce.id=c.end_season_id
   where c.team_id=r.team_id and c.status in ('active','completed') and cs.game_year<=4 and ce.game_year>=4
   order by cs.game_year desc,c.signed_at desc nulls last,c.id limit 1
  ) jersey on true
  where r.season_id=v_season and r.program=p_program
   and exists(select 1 from public.season_gala_registration_riders rr where rr.registration_id=r.id and rr.profile=p_profile)
  order by ts.display_name,r.team_id limit 20 offset p_page*20
 ) page;
 if not private.season_four_gala_is_open() then
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'team',team_name) order by score desc,name),'[]'::jsonb) into v_favorites from (
   select rider.first_name||' '||rider.last_name name,ts.display_name team_name,
    case p_profile when 'mountain' then n.mountain when 'hills' then n.hills when 'cobbles' then n.cobbles else n.sprint end score
   from public.season_gala_registrations registration
   join public.season_gala_registration_riders rr on rr.registration_id=registration.id and rr.profile=p_profile
   join public.riders rider on rider.id=rr.rider_id
   join public.team_seasons ts on ts.team_id=registration.team_id and ts.season_id=v_season
   join public.rider_season_ratings n on n.rider_id=rider.id and n.season_id=v_season
   where registration.season_id=v_season and registration.program=p_program
   order by score desc nulls last,name,rider.id limit 3
  ) favorites;
 end if;
 return jsonb_build_object('teams',v_teams,'total',v_total,'hasMore',v_total>(p_page+1)*20,'favorites',v_favorites);
end;$$;


notify pgrst,'reload schema';
commit;
